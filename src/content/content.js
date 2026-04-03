// Kriti - Word Definition and Translation Extension

let modal = null;
let selectionTimer = null;
let isHandling = false;
const DEFAULT_LANG_KEY = 'defaultLang';
const LANGUAGE_LABELS = {
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  bn: 'Bengali',
  pt: 'Portuguese'
};
const SPEAK_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
const STOP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
const COPY_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

// Listen for text selection on the webpage

// touchend - fast 100ms so double-tap selections aren't missed
document.addEventListener('touchend', (event) => {
  if (modal && modal.contains(event.target)) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => handleTextSelection(event), 100);
}, true);

// mouseup - fast 100ms, no isHandling guard so it always fires
document.addEventListener('mouseup', (event) => {
  if (modal && modal.contains(event.target)) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => handleTextSelection(event), 100);
}, true);

// pointerup - fast 100ms for pointer-device selections
document.addEventListener('pointerup', (event) => {
  if (modal && modal.contains(event.target)) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => handleTextSelection(event), 100);
}, true);

// dblclick - 50ms so double-click word selection opens the modal quickly
document.addEventListener('dblclick', (event) => {
  if (modal && modal.contains(event.target)) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => handleTextSelection(event), 50);
}, true);

// selectionchange - 500ms fallback (e.g. keyboard selection, some single-click sites)
// isHandling guard is applied HERE only, not inside handleTextSelection
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel || sel.toString().trim().length <= 1) return;
  clearTimeout(selectionTimer);
  const delay = window.location.href.includes('pdfjs') ? 600 : 500;
  selectionTimer = setTimeout(() => {
    if (isHandling) return;
    handleTextSelection();
  }, delay);
});

async function handleTextSelection(event) {
  // Set isHandling so the selectionchange fallback doesn't double-fire
  isHandling = true;
  setTimeout(() => { isHandling = false; }, 400);

  if (event && event.target && modal && modal.contains(event.target)) {
    return;
  }
  if (modal && modal.contains(document.activeElement)) {
    return;
  }

  // Wait for the browser to finalize the selection range after the event.
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // Double-check selection is still valid after the rAF wait.
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const selectedText = selection.toString().trim();

  // Show modal only for text longer than 1 character.
  if (selectedText.length <= 1) {
    return;
  }

  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();

  // Some selections return empty rects; prefer first client rect, then pointer/touch fallback.
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const clientRects = range.getClientRects();
    if (clientRects && clientRects.length > 0) {
      rect = clientRects[0];
    }
  }

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    const clientX = event && typeof event.clientX === 'number'
      ? event.clientX
      : event && event.changedTouches && event.changedTouches[0]
        ? event.changedTouches[0].clientX
        : window.innerWidth / 2;
    const clientY = event && typeof event.clientY === 'number'
      ? event.clientY
      : event && event.changedTouches && event.changedTouches[0]
        ? event.changedTouches[0].clientY
        : window.innerHeight / 2;

    rect = {
      left: clientX,
      top: clientY,
      right: clientX,
      bottom: clientY,
      width: 0,
      height: 0
    };
  }

  await showModal(selectedText, rect);
}

async function showModal(word, position) {
  closeModal(); // Close any existing modal
  const defaultLang = getDefaultLang();
  const mode = getSelectionMode(word);
  trackLookupHistory(word, defaultLang);

  // Create modal container
  modal = document.createElement('div');
  modal.className = 'kriti-modal';
  modal.innerHTML = `
    <div class="kriti-modal-content">
      <div class="kriti-close-btn">&times;</div>
      <div class="kriti-mode-badge">${escapeHtml(mode.label)}</div>
      <div class="kriti-word-row">
        <div class="kriti-word">${escapeHtml(word)}</div>
        <button class="kriti-speak-btn" data-speak-target="word" aria-label="Read word aloud"></button>
        <button class="kriti-speak-btn kriti-copy-btn" aria-label="Copy word details"></button>
      </div>
      <div class="kriti-definition-row">
        <div class="kriti-definition">${escapeHtml(getInitialDefinitionText(mode))}</div>
        <button class="kriti-speak-btn" data-speak-target="definition" aria-label="Read definition aloud"></button>
      </div>
      ${mode.type !== 'word'
        ? `<div class="kriti-phrase-lang-row">
              <span class="kriti-phrase-lang-label">Translate to:</span>
              <button class="kriti-lang-badge kriti-phrase-lang-badge"></button>
            </div>`
        : ''}
      <div class="kriti-translation" style="display:none;"></div>
      <div class="kriti-button-row">
        <button class="kriti-save-btn">Save to Notes</button>
        ${mode.type === 'word'
          ? `<div class="kriti-translate-group">
              <button class="kriti-translate-btn">Translate</button>
              <button class="kriti-lang-badge"></button>
            </div>`
          : '<button class="kriti-search-btn">Search</button>'}
      </div>
      <div class="kriti-language-picker" style="display:none;"></div>
    </div>
  `;

  // Position modal near selected text
  modal.style.position = 'absolute';
  modal.style.visibility = 'hidden';
  document.body.appendChild(modal);
  const safePosition = position || {
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    bottom: window.innerHeight / 2
  };
  positionModal(modal, safePosition);
  modal.style.visibility = 'visible';

  const translateBtn = modal.querySelector('.kriti-translate-btn');
  const searchBtn = modal.querySelector('.kriti-search-btn');
  const langBadge = modal.querySelector('.kriti-lang-badge');
  if (langBadge) {
    updateLanguageBadge(langBadge, defaultLang);
    renderLanguagePicker(modal, word, langBadge);
    // For phrase/sentence: clicking a language in the picker should also re-fetch translation
    if (mode.type !== 'word') {
      const pickerBtns = modal.querySelectorAll('.kriti-lang-btn');
      pickerBtns.forEach((btn, i) => {
        const code = Object.keys(LANGUAGE_LABELS)[i];
        btn.addEventListener('click', () => fetchTranslation(word, code));
      });
    }
  }

  // Add event listeners
  modal.querySelector('.kriti-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.kriti-save-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    saveWord(modal);
  });
  modal.querySelectorAll('.kriti-speak-btn:not(.kriti-copy-btn)').forEach((button) => {
    updateSpeechButtonState(button, false);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSpeech(button, modal);
    });
  });
  const copyBtn = modal.querySelector('.kriti-copy-btn');
  if (copyBtn) {
    copyBtn.innerHTML = COPY_ICON_SVG;
    copyBtn.addEventListener('click', async (event) => {
      event.stopPropagation();

      const wordText = (modal.querySelector('.kriti-word')?.textContent || '').trim();
      const definitionText = getSpeakText('definition', modal).replace(/^Definition:\s*/i, '').trim();
      const translationElement = modal.querySelector('.kriti-translation');
      const isTranslationVisible = !!translationElement && translationElement.style.display !== 'none';
      const translationText = isTranslationVisible
        ? (translationElement.textContent || '').replace(/^[^:]*Translation:\s*/i, '').trim()
        : '';

      const copyLines = [
        `Word: ${wordText}`,
        `Definition: ${definitionText}`
      ];
      if (translationText) {
        copyLines.push(`Translation: ${translationText}`);
      }

      try {
        await navigator.clipboard.writeText(copyLines.join('\n'));
        copyBtn.innerHTML = '✓';
        copyBtn.classList.add('speaking');
        setTimeout(() => {
          if (copyBtn.isConnected) {
            copyBtn.innerHTML = COPY_ICON_SVG;
            copyBtn.classList.remove('speaking');
          }
        }, 1500);
      } catch (error) {
        console.log('Copy failed:', error);
      }
    });
  }
  if (translateBtn) {
    translateBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      fetchTranslation(word, getDefaultLang());
    });
  }
  if (langBadge) {
    langBadge.addEventListener('click', (event) => {
      event.stopPropagation();
      const picker = modal.querySelector('.kriti-language-picker');
      picker.style.display = picker.style.display === 'none' ? 'grid' : 'none';
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      openMeaningSearch(word, mode);
    });
  }
  document.addEventListener('click', handleOutsideClick);

  // Fetch data
  fetchDefinition(word, mode);
}

function trackLookupHistory(word, language) {
  if (!word) {
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  chrome.storage.local.get(['history'], (result) => {
    if (chrome.runtime && chrome.runtime.lastError) {
      return;
    }

    const history = Array.isArray(result.history) ? result.history : [];
    history.push({
      word: String(word).trim(),
      timestamp: new Date().toISOString(),
      language: language || getDefaultLang()
    });

    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }

    chrome.storage.local.set({ history });
  });
}

function positionModal(element, position) {
  const margin = 8;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const modalRect = element.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  const selectionTopDoc = position.top + scrollY;
  const selectionBottomDoc = position.bottom + scrollY;
  const selectionLeftDoc = position.left + scrollX;

  let top = selectionBottomDoc + margin;
  const hasRoomBelow = position.bottom + modalRect.height + margin <= viewportHeight;
  const hasRoomAbove = position.top - modalRect.height - margin >= 0;

  if (!hasRoomBelow && hasRoomAbove) {
    top = selectionTopDoc - modalRect.height - margin;
  }

  const minLeft = scrollX + margin;
  const maxLeft = scrollX + viewportWidth - modalRect.width - margin;
  let left = selectionLeftDoc;
  left = Math.max(minLeft, Math.min(left, maxLeft));

  element.style.position = 'absolute';
  element.style.top = `${Math.max(scrollY + margin, top)}px`;
  element.style.left = `${left}px`;
  element.style.zIndex = '10000';
}

async function fetchDefinition(word, mode = getSelectionMode(word)) {
  const activeModal = modal;

  if (!activeModal) {
    return;
  }

  if (mode.type !== 'word') {
    const defElement = activeModal.querySelector('.kriti-definition');
    if (defElement) {
      defElement.innerHTML = `<strong>${escapeHtml(mode.label)}:</strong> ${escapeHtml(word)}`;
      defElement.style.display = 'block';
    }
    updateSpeechButtonState(activeModal.querySelector('[data-speak-target="definition"]'), false);
    fetchTranslation(word, getDefaultLang());
    return;
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) throw new Error('Word not found');

    const data = await response.json();
    const entry = data[0];

    let definitionHTML = '';
    if (entry.meanings && entry.meanings.length > 0) {
      const meaning = entry.meanings[0];
      if (meaning.definitions && meaning.definitions.length > 0) {
        const def = meaning.definitions[0];
        definitionHTML = `<strong>Definition:</strong> ${escapeHtml(def.definition)}`;
        if (def.example) {
          definitionHTML += `<div class="kriti-example"><em>Example:</em> ${escapeHtml(def.example)}</div>`;
        }
      }
    }

    if (definitionHTML && activeModal && activeModal === modal) {
      const defElement = activeModal.querySelector('.kriti-definition');
      defElement.innerHTML = definitionHTML;
      defElement.style.display = 'block';
      updateSpeechButtonState(activeModal.querySelector('[data-speak-target="definition"]'), false);
    }
  } catch (error) {
    console.log('Definition fetch error:', error);
    if (activeModal && activeModal === modal) {
      const defElement = activeModal.querySelector('.kriti-definition');
      defElement.innerHTML = '<strong>Definition:</strong> Not found';
      defElement.style.display = 'block';
      updateSpeechButtonState(activeModal.querySelector('[data-speak-target="definition"]'), false);
    }
  }
}

function getSelectionMode(selectedText) {
  const wordCount = selectedText.trim().split(/\s+/).length;

  if (wordCount <= 1) {
    return { type: 'word', label: 'Word' };
  }

  if (wordCount <= 8) {
    return { type: 'phrase', label: 'Phrase' };
  }

  return { type: 'sentence', label: 'Sentence' };
}

function getInitialDefinitionText(mode) {
  if (mode.type === 'word') {
    return 'Loading definition...';
  }

  return `${mode.label} selected`;
}

function openMeaningSearch(text, mode) {
  const suffix = mode.type === 'sentence' ? 'sentence meaning' : 'phrase meaning';
  const url = `https://www.google.com/search?q=${encodeURIComponent(`${text} ${suffix}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getSpeakText(target, modalElement) {
  if (!modalElement) return '';
  if (target === 'word') {
    const wordElement = modalElement.querySelector('.kriti-word');
    return wordElement ? wordElement.textContent.trim() : '';
  }
  if (target === 'definition') {
    const definitionElement = modalElement.querySelector('.kriti-definition');
    if (!definitionElement) return '';
    const temp = document.createElement('div');
    temp.innerHTML = definitionElement.innerHTML;
    return (temp.textContent || '').trim();
  }
  return '';
}

function updateSpeechButtonState(button, isSpeaking) {
  if (!button) return;
  button.innerHTML = isSpeaking ? STOP_ICON_SVG : SPEAK_ICON_SVG;
  button.dataset.speaking = isSpeaking ? 'true' : 'false';
  button.classList.toggle('speaking', isSpeaking);
}

function resetSpeechButtons(modalElement) {
  if (!modalElement) return;
  modalElement.querySelectorAll('.kriti-speak-btn').forEach((button) => {
    updateSpeechButtonState(button, false);
  });
}

function toggleSpeech(button, modalElement) {
  if (!button || !modalElement || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return;
  }

  const isSpeaking = button.dataset.speaking === 'true';
  if (isSpeaking) {
    window.speechSynthesis.cancel();
    resetSpeechButtons(modalElement);
    return;
  }

  const target = button.dataset.speakTarget;
  const text = getSpeakText(target, modalElement);
  if (!text) {
    resetSpeechButtons(modalElement);
    return;
  }

  window.speechSynthesis.cancel();
  resetSpeechButtons(modalElement);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.onend = () => {
    if (modalElement.isConnected) {
      updateSpeechButtonState(button, false);
    }
  };
  utterance.onerror = () => {
    if (modalElement.isConnected) {
      updateSpeechButtonState(button, false);
    }
  };

  updateSpeechButtonState(button, true);
  window.speechSynthesis.speak(utterance);
}

async function fetchTranslation(word, targetLang = 'hi') {
  const activeModal = modal;
  if (!activeModal) {
    return;
  }

  const transElement = activeModal.querySelector('.kriti-translation');
  const languageLabel = LANGUAGE_LABELS[targetLang] || targetLang.toUpperCase();

  transElement.innerHTML = `<strong>${escapeHtml(languageLabel)} Translation:</strong> Translating...`;
  transElement.style.display = 'block';

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|${encodeURIComponent(targetLang)}`);
    const data = await response.json();

    const responseStatus = data && data.responseStatus;
    const translatedText = data && data.responseData && data.responseData.translatedText
      ? data.responseData.translatedText.trim()
      : '';
    const isSameAsInput = translatedText.toLowerCase() === word.trim().toLowerCase();

    if (!activeModal || activeModal !== modal) {
      return;
    }

    if (responseStatus !== 200 || !translatedText || isSameAsInput) {
      transElement.innerHTML = `<strong>${escapeHtml(languageLabel)} Translation:</strong> Translation unavailable`;
    } else {
      transElement.innerHTML = `<strong>${escapeHtml(languageLabel)} Translation:</strong> ${escapeHtml(translatedText)}`;
    }

    transElement.style.display = 'block';
  } catch (error) {
    console.log('Translation fetch error:', error);
    if (activeModal && activeModal === modal) {
      transElement.innerHTML = `<strong>${escapeHtml(languageLabel)} Translation:</strong> Translation unavailable`;
      transElement.style.display = 'block';
    }
  }
}

function getDefaultLang() {
  const saved = localStorage.getItem(DEFAULT_LANG_KEY);
  if (saved && LANGUAGE_LABELS[saved]) {
    return saved;
  }
  return 'hi';
}

function updateLanguageBadge(badgeElement, langCode) {
  if (!badgeElement) return;
  badgeElement.textContent = `${langCode.toUpperCase()} ▾`;
}

function renderLanguagePicker(modalElement, word, langBadge) {
  const picker = modalElement.querySelector('.kriti-language-picker');
  picker.innerHTML = '';
  const currentLang = getDefaultLang();

  Object.entries(LANGUAGE_LABELS).forEach(([code, label]) => {
    const langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'kriti-lang-btn';
    const checkmark = code === currentLang ? '✓ ' : '';
    langBtn.textContent = checkmark + label;
    langBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      localStorage.setItem(DEFAULT_LANG_KEY, code);
      updateLanguageBadge(langBadge, code);
      picker.style.display = 'none';
    });
    picker.appendChild(langBtn);
  });
}

function saveWord(modalElement) {
  if (!modalElement) return;

  if (typeof chrome === 'undefined' ||
      !chrome.storage ||
      !chrome.storage.local) {
    console.log('Kriti: storage not available on this page');
    const saveBtn = modalElement.querySelector('.kriti-save-btn');
    if (saveBtn) {
      saveBtn.textContent = 'Cannot save here';
      setTimeout(() => { saveBtn.textContent = 'Save to Notes'; }, 2000);
    }
    return;
  }

  const word = modalElement.querySelector('.kriti-word').textContent;
  const definition = modalElement.querySelector('.kriti-definition').textContent;
  const translation = modalElement.querySelector('.kriti-translation').textContent;
  const wordCount = word.trim().split(/\s+/).length;
  const noteType = wordCount <= 1 ? 'word' : (wordCount <= 8 ? 'phrase' : 'sentence');

  // Get page title
  const pageTitle = document.title;

  // Store in chrome.storage.local
  chrome.storage.local.get(['notes'], (result) => {
    if (chrome.runtime.lastError) {
      console.log('Storage get error:', chrome.runtime.lastError);
      return;
    }

    const notes = result.notes || {};
    const wordLower = String(word || '').toLowerCase().trim();
    const saveBtn = modalElement.querySelector('.kriti-save-btn');

    // Check if word exists in same folder
    const currentFolderWords = notes[pageTitle] || [];
    const existsInSameFolder = currentFolderWords.some(
      (n) => String((n && n.word) || '').toLowerCase().trim() === wordLower
    );

    if (existsInSameFolder) {
      if (saveBtn) {
        saveBtn.textContent = '⚠ Already in this folder';
        saveBtn.style.background = '#f59e0b';
        setTimeout(() => {
          if (!saveBtn.isConnected) return;
          saveBtn.textContent = 'Save to Notes';
          saveBtn.style.background = '';
        }, 2500);
      }
      return;
    }

    // Check if word exists in OTHER folders
    const otherFolder = Object.keys(notes).find((folder) =>
      folder !== pageTitle &&
      (notes[folder] || []).some(
        (n) => String((n && n.word) || '').toLowerCase().trim() === wordLower
      )
    );

    if (otherFolder && !modalElement.dataset.confirmSave) {
      if (saveBtn) {
        const shortFolder = otherFolder.length > 15 ? `${otherFolder.substring(0, 15)}...` : otherFolder;
        saveBtn.textContent = `⚠ Exists in "${shortFolder}" - Click to save anyway`;
        saveBtn.style.background = '#f59e0b';
        saveBtn.style.fontSize = '11px';
        modalElement.dataset.confirmSave = 'true';

        if (modalElement._confirmSaveTimer) {
          clearTimeout(modalElement._confirmSaveTimer);
        }
        modalElement._confirmSaveTimer = setTimeout(() => {
          if (!saveBtn.isConnected) return;
          saveBtn.textContent = 'Save to Notes';
          saveBtn.style.background = '';
          saveBtn.style.fontSize = '';
          delete modalElement.dataset.confirmSave;
          modalElement._confirmSaveTimer = null;
        }, 3000);
      }
      return;
    }

    // Clear confirm flag and proceed to save
    delete modalElement.dataset.confirmSave;
    if (modalElement._confirmSaveTimer) {
      clearTimeout(modalElement._confirmSaveTimer);
      modalElement._confirmSaveTimer = null;
    }
    if (saveBtn) {
      saveBtn.style.background = '';
      saveBtn.style.fontSize = '';
    }

    if (!notes[pageTitle]) {
      notes[pageTitle] = [];
    }

    notes[pageTitle].push({
      word: word,
      definition: definition,
      translation: translation,
      type: noteType,
      personalNotes: '',
      pinned: false,
      pinnedAt: null,
      timestamp: new Date().toISOString()
    });

    chrome.storage.local.set({ notes }, () => {
      if (chrome.runtime.lastError) {
        console.log('Storage set error:', chrome.runtime.lastError);
        if (saveBtn) {
          saveBtn.textContent = 'Save failed';
        }
        setTimeout(() => {
          if (!saveBtn || !saveBtn.isConnected) return;
          saveBtn.textContent = 'Save to Notes';
          saveBtn.style.background = '';
          saveBtn.style.fontSize = '';
        }, 1500);
        return;
      }

      // Visual feedback
      if (!saveBtn) {
        return;
      }
      const originalText = 'Save to Notes';
      saveBtn.textContent = '✓ Saved';
      saveBtn.disabled = true;
      saveBtn.style.background = '';
      saveBtn.style.fontSize = '';
      setTimeout(() => {
        if (!saveBtn.isConnected) return;
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
    });
  });
}

function closeModal() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (modal) {
    if (modal._confirmSaveTimer) {
      clearTimeout(modal._confirmSaveTimer);
      modal._confirmSaveTimer = null;
    }
    delete modal.dataset.confirmSave;
    modal.remove();
    modal = null;
  }
  document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(e) {
  if (modal) {
    if (!modal.contains(e.target)) {
      // Clicked outside modal, close modal
      closeModal();
    } else {
      // Clicked inside modal, check if picker is open
      const picker = modal.querySelector('.kriti-language-picker');
      const langBadge = modal.querySelector('.kriti-lang-badge');
      if (picker && picker.style.display === 'grid' && !picker.contains(e.target) && !langBadge.contains(e.target)) {
        // Clicked inside modal but outside picker and badge, close picker only
        picker.style.display = 'none';
      }
    }
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inject styles
injectStyles();

function injectStyles() {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .kriti-modal {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      max-width: 300px;
      z-index: 10000;
    }

    .kriti-modal-content {
      position: relative;
    }

    .kriti-close-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      padding: 0 4px;
      line-height: 1;
    }

    .kriti-close-btn:hover {
      color: #333;
    }

    .kriti-word {
      font-weight: 600;
      font-size: 16px;
      color: #333;
      word-break: break-word;
    }

    .kriti-word-row,
    .kriti-definition-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kriti-mode-badge {
      position: absolute;
      top: 0;
      right: 22px;
      padding: 2px 8px;
      background: #eef1f5;
      color: #5f6675;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.6;
    }

    .kriti-word-row {
      margin-bottom: 12px;
      padding-right: 80px;
    }

    .kriti-button-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 12px;
    }

    .kriti-translate-group {
      display: flex;
      gap: 0;
    }

    .kriti-definition {
      flex: 1;
      margin-top: 8px;
      padding: 8px;
      background: #f5f5f5;
      border-left: 3px solid #4CAF50;
      border-radius: 4px;
      color: #333;
    }

    .kriti-speak-btn {
      appearance: none;
      -webkit-appearance: none;
      border: none;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      vertical-align: middle;
      color: #9ca3af;
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      flex-shrink: 0;
      transition: color 0.2s, background 0.2s;
    }

    .kriti-speak-btn:hover {
      color: #667eea;
      background: #f0f2ff;
    }

    .kriti-speak-btn.speaking {
      color: #667eea;
      animation: kritiSpeakPulse 1.1s ease-in-out infinite;
    }

    @keyframes kritiSpeakPulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.08);
      }
    }

    .kriti-language-picker {
      margin-top: 10px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .kriti-lang-btn {
      border: 1px solid #dbe1f5;
      border-radius: 6px;
      background: #f7f9ff;
      color: #36456f;
      font-size: 12px;
      padding: 6px 4px;
      cursor: pointer;
      text-align: center;
    }

    .kriti-lang-btn:hover {
      background: #e9eeff;
      border-color: #c6d2fb;
    }

    .kriti-translation {
      margin: 12px 0;
      padding: 8px;
      background: #f9f9f9;
      border-left: 3px solid #2196F3;
      border-radius: 4px;
      color: #333;
    }

    .kriti-example {
      margin-top: 8px;
      font-size: 13px;
      color: #666;
    }

    .kriti-save-btn {
      padding: 8px 6px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .kriti-save-btn:hover {
      background: #45a049;
    }

    .kriti-save-btn:disabled {
      background: #4CAF50;
      cursor: not-allowed;
    }

    .kriti-translate-btn {
      padding: 8px 12px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 4px 0 0 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      flex: 1;
    }

    .kriti-translate-btn:hover {
      background: #1976d2;
    }

    .kriti-search-btn {
      padding: 8px 12px;
      background: #6b7280;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      width: 100%;
    }

    .kriti-search-btn:hover {
      background: #4b5563;
    }

    .kriti-lang-badge {
      padding: 8px 8px;
      background: #1565c0;
      color: white;
      border: none;
      border-radius: 0 4px 4px 0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      min-width: 45px;
    }

    .kriti-lang-badge:hover {
      background: #0d47a1;
    }

    .kriti-phrase-lang-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }

    .kriti-phrase-lang-label {
      font-size: 12px;
      color: #6b7280;
      white-space: nowrap;
    }

    .kriti-phrase-lang-badge {
      border-radius: 4px !important;
    }
  `;
  document.head.appendChild(styleSheet);
}
