// Kriti PDF banner: prompts users to open PDFs in Kriti's bundled viewer.
(function initKritiPdfBanner() {
  function isPdfUrl(url) {
    if (!url) return false;
    const normalized = url.split('#')[0].split('?')[0].toLowerCase();
    return normalized.endsWith('.pdf');
  }

  function isPdfContentType() {
    const type = (document.contentType || '').toLowerCase();
    return type.includes('application/pdf');
  }

  function isPdfPage() {
    return isPdfUrl(window.location.href) || isPdfContentType();
  }

  function injectBanner() {
    if (document.getElementById('kriti-pdf-banner')) return;

    // Inject keyframe animations into the page
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @keyframes kriti-slide-down {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes kriti-shimmer {
        0%   { transform: translateX(-100%) skewX(-15deg); }
        100% { transform: translateX(250%)  skewX(-15deg); }
      }
      @keyframes kriti-slide-up {
        from { transform: translateY(0);    opacity: 1; }
        to   { transform: translateY(-100%); opacity: 0; }
      }
      #kriti-pdf-banner {
        animation: kriti-slide-down 0.3s ease both;
      }
      #kriti-pdf-banner.dismiss {
        animation: kriti-slide-up 0.3s ease both;
      }
      #kriti-pdf-banner-shimmer {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        overflow: hidden;
        border-radius: inherit;
      }
      #kriti-pdf-banner-shimmer::after {
        content: '';
        position: absolute;
        top: 0; bottom: 0;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
        animation: kriti-shimmer 3s ease-in-out infinite;
      }
      #kriti-pdf-open-btn:hover {
        background: #f0f0ff !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
      }
      #kriti-pdf-close-btn:hover {
        opacity: 1 !important;
        background: rgba(255,255,255,0.15) !important;
      }
    `;
    document.documentElement.appendChild(styleEl);

    const banner = document.createElement('div');
    banner.id = 'kriti-pdf-banner';
    banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0',
      'z-index:2147483647',
      'display:flex', 'align-items:center', 'justify-content:space-between',
      'gap:12px', 'padding:10px 20px',
      'background:linear-gradient(135deg,#667eea,#764ba2)',
      'color:#ffffff',
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      'font-size:14px',
      'box-shadow:0 2px 12px rgba(0,0,0,0.25)',
      'overflow:hidden',
    ].join(';');

    // Shimmer overlay
    const shimmer = document.createElement('div');
    shimmer.id = 'kriti-pdf-banner-shimmer';
    banner.appendChild(shimmer);

    // Left side: PDF icon + text
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:10px;flex:1;min-width:0';

    const pdfIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pdfIcon.setAttribute('width', '20');
    pdfIcon.setAttribute('height', '20');
    pdfIcon.setAttribute('viewBox', '0 0 24 24');
    pdfIcon.setAttribute('fill', 'none');
    pdfIcon.setAttribute('stroke', 'white');
    pdfIcon.setAttribute('stroke-width', '2');
    pdfIcon.style.flexShrink = '0';
    pdfIcon.innerHTML =
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<polyline points="14 2 14 8 20 8"/>' +
      '<line x1="16" y1="13" x2="8" y2="13"/>' +
      '<line x1="16" y1="17" x2="8" y2="17"/>' +
      '<polyline points="10 9 9 9 8 9"/>';

    const text = document.createElement('span');
    text.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    text.textContent = '✨ Get word meanings & save notes while reading this PDF — powered by Kriti';

    left.appendChild(pdfIcon);
    left.appendChild(text);

    // Right side: Open button + close button
    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:10px;flex-shrink:0';

    const button = document.createElement('button');
    button.id = 'kriti-pdf-open-btn';
    button.type = 'button';
    button.style.cssText = [
      'border:none',
      'border-radius:999px',
      'padding:8px 20px',
      'cursor:pointer',
      'font-weight:700',
      'font-size:13px',
      'background:#ffffff',
      'color:#667eea',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'transition:all 0.2s ease',
      'display:inline-flex', 'align-items:center', 'gap:6px',
      'white-space:nowrap',
    ].join(';');
    const btnText = document.createElement('span');
    btnText.textContent = 'Open with Kriti';
    const btnArrow = document.createElement('span');
    btnArrow.textContent = '→';
    btnArrow.style.cssText = 'font-size:14px;line-height:1';
    button.appendChild(btnText);
    button.appendChild(btnArrow);

    button.addEventListener('click', () => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        alert('Please open this PDF from a website, not from your local files. Local PDFs cannot be opened with Kriti due to browser security restrictions.');
        return;
      }
      const viewerUrl = chrome.runtime.getURL('pdfjs/web/viewer.html');
      const targetUrl = viewerUrl + '?file=' + encodeURIComponent(window.location.href);
      window.open(targetUrl, '_blank', 'noopener');
    });

    // Close / dismiss button
    const closeBtn = document.createElement('button');
    closeBtn.id = 'kriti-pdf-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss banner');
    closeBtn.style.cssText = [
      'border:none', 'background:transparent', 'cursor:pointer',
      'color:#ffffff', 'font-size:18px', 'line-height:1',
      'padding:4px 6px', 'border-radius:6px',
      'opacity:0.75', 'transition:opacity 0.2s,background 0.2s',
      'flex-shrink:0',
    ].join(';');
    closeBtn.textContent = '×';

    closeBtn.addEventListener('click', () => {
      banner.classList.add('dismiss');
      banner.addEventListener('animationend', () => {
        if (document.body) {
          const current = parseFloat(document.body.style.paddingTop) || 0;
          const bh = banner.offsetHeight;
          document.body.style.paddingTop = `${Math.max(0, current - bh)}px`;
        }
        banner.remove();
        styleEl.remove();
      }, { once: true });
    });

    right.appendChild(button);
    right.appendChild(closeBtn);

    banner.appendChild(left);
    banner.appendChild(right);
    document.documentElement.appendChild(banner);

    const bannerHeight = banner.offsetHeight;
    document.documentElement.style.setProperty('--kriti-pdf-banner-height', `${bannerHeight}px`);
    if (document.body) {
      const existingPaddingTop = parseFloat(window.getComputedStyle(document.body).paddingTop) || 0;
      document.body.style.paddingTop = `${existingPaddingTop + bannerHeight}px`;
    }
  }

  if (!isPdfPage()) {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner, { once: true });
  } else {
    injectBanner();
  }
})();
