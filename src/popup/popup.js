// Kriti Popup - Display and manage saved notes

document.addEventListener('DOMContentLoaded', loadNotes);
document.getElementById('clearAllBtn').addEventListener('click', clearAllNotes);

function loadNotes() {
  chrome.storage.local.get(['notes'], (result) => {
    const notes = result.notes || {};
    const notesContainer = document.getElementById('notesContainer');
    const emptyState = document.getElementById('emptyState');

    // Check if there are any notes
    const pages = Object.keys(notes);
    const totalNotes = pages.reduce((sum, page) => sum + notes[page].length, 0);

    if (totalNotes === 0) {
      emptyState.style.display = 'block';
      notesContainer.innerHTML = '';
      return;
    }

    emptyState.style.display = 'none';
    notesContainer.innerHTML = '';

    // Sort pages alphabetically
    pages.sort().forEach((pageTitle) => {
      const pageNotes = notes[pageTitle];
      
      // Create section for this page
      const pageSection = document.createElement('div');
      pageSection.className = 'page-section';

      // Page title header
      const pageHeader = document.createElement('div');
      pageHeader.className = 'page-title';
      
      const pageTitleText = document.createElement('div');
      pageTitleText.className = 'page-title-text';
      pageTitleText.textContent = pageTitle || '(Untitled Page)';
      pageTitleText.title = pageTitle; // Show full title on hover
      
      const noteCount = document.createElement('div');
      noteCount.className = 'note-count';
      noteCount.textContent = pageNotes.length;
      
      pageHeader.appendChild(pageTitleText);
      pageHeader.appendChild(noteCount);

      pageSection.appendChild(pageHeader);

      // Notes list for this page
      const notesList = document.createElement('div');
      notesList.className = 'notes-list';

      // Sort notes by timestamp (newest first)
      const sortedNotes = [...pageNotes].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      sortedNotes.forEach((note) => {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';

        const word = document.createElement('div');
        word.className = 'note-word';
        word.textContent = note.word;

        const definition = document.createElement('div');
        definition.className = 'note-definition';
        definition.textContent = note.definition;

        const translation = document.createElement('div');
        translation.className = 'note-translation';
        translation.textContent = note.translation;

        const timestamp = document.createElement('div');
        timestamp.className = 'note-timestamp';
        timestamp.textContent = formatDate(note.timestamp);

        noteItem.appendChild(word);
        noteItem.appendChild(definition);
        noteItem.appendChild(translation);
        noteItem.appendChild(timestamp);

        notesList.appendChild(noteItem);
      });

      pageSection.appendChild(notesList);
      notesContainer.appendChild(pageSection);
    });
  });
}

function clearAllNotes() {
  const confirmed = confirm('Are you sure you want to delete all saved notes? This action cannot be undone.');
  
  if (confirmed) {
    chrome.storage.local.set({ notes: {} }, () => {
      loadNotes();
    });
  }
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  } catch (e) {
    return '';
  }
}

// Refresh notes when popup is opened
window.addEventListener('focus', loadNotes);
