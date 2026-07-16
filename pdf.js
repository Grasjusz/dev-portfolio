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
 *  2. No `windowWidth` override. Confirmed open bug in html2canvas:
 *     https://github.com/niklasvh/html2canvas/issues/2947 — "html2canvas
 *     seem to ignore WindowWidth setting and scale the screenshot
 *     depending of viewport size". The captured node already has an
 *     explicit CSS width (set in cv-builder.js), which html2canvas reads
 *     correctly on its own without this option.
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
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['.cv-entry', '.cv-block'],
        },
      };

      return window.html2pdf().set(options).from(node).save();
    });
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
