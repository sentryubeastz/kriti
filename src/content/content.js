// Kriti - Word Definition and Translation Extension

let modal = null;

// Listen for text selection on the webpage
document.addEventListener('mouseup', handleTextSelection, true);
document.addEventListener('touchend', handleTextSelection, true);

async function handleTextSelection(event) {
  // Capture selection from any element type after browser finalizes the range.
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  // Show modal only for text longer than 1 character.
  if (selectedText.length <= 1) {
    closeModal();
    return;
  }

  if (!selection || selection.rangeCount === 0) {
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

  // Create modal container
  modal = document.createElement('div');
  modal.className = 'kriti-modal';
  modal.innerHTML = `
    <div class="kriti-modal-content">
      <div class="kriti-close-btn">&times;</div>
      <div class="kriti-word">${escapeHtml(word)}</div>
      <div class="kriti-loading">Loading...</div>
      <div class="kriti-definition" style="display:none;"></div>
      <div class="kriti-translation" style="display:none;"></div>
      <button class="kriti-save-btn" style="display:none;">Save to Notes</button>
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

  // Add event listeners
  modal.querySelector('.kriti-close-btn').addEventListener('click', closeModal);
  modal.querySelector('.kriti-save-btn').addEventListener('click', () => saveWord(modal));
  document.addEventListener('click', handleOutsideClick);

  // Fetch data
  fetchDefinition(word);
  fetchTranslation(word);
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

async function fetchDefinition(word) {
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

    if (definitionHTML && modal) {
      const defElement = modal.querySelector('.kriti-definition');
      defElement.innerHTML = definitionHTML;
      defElement.style.display = 'block';
    }
  } catch (error) {
    console.log('Definition fetch error:', error);
    if (modal) {
      const defElement = modal.querySelector('.kriti-definition');
      defElement.innerHTML = '<strong>Definition:</strong> Not found';
      defElement.style.display = 'block';
    }
  }

  hideLoading();
}

async function fetchTranslation(word) {
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|hi`);
    const data = await response.json();

    const responseStatus = data && data.responseStatus;
    const translatedText = data && data.responseData && data.responseData.translatedText
      ? data.responseData.translatedText.trim()
      : '';
    const isSameAsInput = translatedText.toLowerCase() === word.trim().toLowerCase();

    if (!modal) {
      return;
    }

    const transElement = modal.querySelector('.kriti-translation');

    if (responseStatus !== 200 || !translatedText || isSameAsInput) {
      transElement.innerHTML = '<strong>Hindi Translation:</strong> Translation unavailable';
    } else {
      transElement.innerHTML = `<strong>Hindi Translation:</strong> ${escapeHtml(translatedText)}`;
    }

    transElement.style.display = 'block';
  } catch (error) {
    console.log('Translation fetch error:', error);
    if (modal) {
      const transElement = modal.querySelector('.kriti-translation');
      transElement.innerHTML = '<strong>Hindi Translation:</strong> Translation unavailable';
      transElement.style.display = 'block';
    }
  }

  hideLoading();
}

function hideLoading() {
  if (modal) {
    const loading = modal.querySelector('.kriti-loading');
    if (loading) {
      loading.style.display = 'none';
    }
    const saveBtn = modal.querySelector('.kriti-save-btn');
    if (saveBtn) {
      saveBtn.style.display = 'block';
    }
  }
}

function saveWord(modalElement) {
  if (!modalElement) return;

  const word = modalElement.querySelector('.kriti-word').textContent;
  const definition = modalElement.querySelector('.kriti-definition').textContent;
  const translation = modalElement.querySelector('.kriti-translation').textContent;

  // Get page title
  const pageTitle = document.title;

  // Store in chrome.storage.local
  chrome.storage.local.get(['notes'], (result) => {
    if (chrome.runtime.lastError) {
      console.log('Storage get error:', chrome.runtime.lastError);
      return;
    }

    const notes = result.notes || {};
    if (!notes[pageTitle]) {
      notes[pageTitle] = [];
    }

    notes[pageTitle].push({
      word: word,
      definition: definition,
      translation: translation,
      timestamp: new Date().toISOString()
    });

    chrome.storage.local.set({ notes }, () => {
      if (chrome.runtime.lastError) {
        console.log('Storage set error:', chrome.runtime.lastError);
        const saveBtn = modalElement.querySelector('.kriti-save-btn');
        saveBtn.textContent = 'Save failed';
        setTimeout(() => {
          saveBtn.textContent = 'Save to Notes';
        }, 1500);
        return;
      }

      // Visual feedback
      const saveBtn = modalElement.querySelector('.kriti-save-btn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = '✓ Saved';
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);
    });
  });
}

function closeModal() {
  if (modal) {
    modal.remove();
    modal = null;
  }
  document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(e) {
  if (modal && !modal.contains(e.target)) {
    closeModal();
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
      margin-bottom: 12px;
      color: #333;
      word-break: break-word;
    }

    .kriti-loading {
      color: #999;
      font-style: italic;
      text-align: center;
      padding: 8px 0;
    }

    .kriti-definition {
      margin: 12px 0;
      padding: 8px;
      background: #f5f5f5;
      border-left: 3px solid #4CAF50;
      border-radius: 4px;
      color: #333;
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
      width: 100%;
      padding: 8px 12px;
      margin-top: 12px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
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
  `;
  document.head.appendChild(styleSheet);
}
