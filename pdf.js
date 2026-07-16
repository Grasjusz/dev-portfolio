/**
 * pdf.js
 * Thin wrapper around html2pdf.js. Exposes a single low-level helper that
 * the CV builder (cv-builder.js) uses to turn any rendered DOM node into a
 * downloaded PDF file. Contains no CV-specific logic on purpose — the
 * document itself is built from JSON data by cv-builder.js.
 *
 * Two confirmed, evidence-based fixes vs. the original:
 *
 *  1. `margin: 0` instead of `[12, 14, 14, 14]`. html2pdf.js's own worker.js
 *     (toContainer) wraps the source in an internal container sized to
 *     `pageSize.inner.width` = page width MINUS this margin. With a
 *     non-zero margin that container became ~688px — narrower than our
 *     fixed 794px-wide .cv-doc — silently clipping ~106px of content on
 *     every export. Confirmed by inspecting the raw PDF: the embedded
 *     image is now exactly 1588px (794px x scale 2), the correct size.
 *     .cv-doc already has its own internal padding (style.css) providing
 *     the visual margin, same as the live preview — no separate PDF-level
 *     margin is needed on top of it.
 *  2. `windowWidth`/`windowHeight` matched to the captured node's own
 *     size. Without this, html2canvas falls back to the REAL browser
 *     viewport width. That's wide enough on desktop to not matter, but on
 *     a phone (~375-430px) it's narrower than our fixed 794px-wide
 *     document, so the right/left edge gets cropped — the exact bug that
 *     showed up when testing on mobile. This is safe now (unlike earlier
 *     attempts) because `margin: 0` above already makes html2pdf.js's own
 *     internal container exactly 794px too, so there's no mismatch between
 *     what html2canvas is told to render and what html2pdf actually wraps
 *     the content in.
 *
 * Plus two low-risk, standard additions: wait for web fonts before
 * capturing, and compensate html2canvas for the page's current scroll
 * position.
 */

(() => {
  'use strict';

  function waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready.catch(() => {});
    }
    return Promise.resolve();
  }

  /**
   * @param {HTMLElement} node        Element to capture (must be attached to the DOM).
   * @param {string} filename         Output file name, e.g. "Name_Profile_EN.pdf".
   * @returns {Promise<void>}
   */
  function generatePdf(node, filename) {
    if (!window.html2pdf) {
      return Promise.reject(new Error('html2pdf.js not loaded'));
    }

    return waitForFonts().then(() => {
      const options = {
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: node.offsetWidth || 794,
          windowHeight: node.scrollHeight,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          // 'css' only — mixing 'css' + 'legacy' is a documented
          // html2pdf.js footgun: the two page-break strategies can
          // disagree about where a block needs to move to the next page,
          // and html2pdf inserts blank filler space to reconcile them,
          // producing the large empty gaps seen before a section that got
          // pushed to page 2.
          mode: ['css'],
          // '.cv-block' doesn't exist anywhere in style.css — it protected
          // nothing. '.cv-section' is the real wrapper class (it already
          // has its own `break-inside: avoid` in CSS; listing it here too
          // makes html2pdf's own break logic agree with it explicitly).
          avoid: ['.cv-entry', '.cv-section'],
        },
      };

      return window.html2pdf().set(options).from(node).save();
    });
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
