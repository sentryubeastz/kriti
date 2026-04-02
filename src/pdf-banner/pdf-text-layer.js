// Kriti PDF text-layer bridge: retriggers selection flow for PDF.js text spans.
(function initKritiPdfTextLayerBridge() {
  let observer = null;
  let hasTextLayer = false;

  function hasRenderedTextLayer() {
    return !!document.querySelector('.textLayer span');
  }

  function triggerKritiSelectionFromTextLayer(selectionRect) {
    const syntheticEvent = new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: selectionRect.left,
      clientY: selectionRect.bottom
    });
    document.dispatchEvent(syntheticEvent);
  }

  function onTextLayerMouseUp(event) {
    if (!event.isTrusted) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.textLayer')) {
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    if (selectedText.length <= 1 || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const fallbackRect = target.getBoundingClientRect();
    const safeRect = (rect && (rect.width || rect.height)) ? rect : fallbackRect;

    // Run after native selection settles so content.js can use window.getSelection().
    requestAnimationFrame(() => {
      triggerKritiSelectionFromTextLayer(safeRect);
    });
  }

  function startTextLayerListeners() {
    if (hasTextLayer) {
      return;
    }
    hasTextLayer = true;
    document.addEventListener('mouseup', onTextLayerMouseUp, true);
  }

  function watchForTextLayer() {
    if (hasRenderedTextLayer()) {
      startTextLayerListeners();
      return;
    }

    observer = new MutationObserver(() => {
      if (hasRenderedTextLayer()) {
        startTextLayerListeners();
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchForTextLayer, { once: true });
  } else {
    watchForTextLayer();
  }
})();
