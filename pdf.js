/**
 * pdf.js
 * Thin wrapper around html2pdf.js. Exposes a single low-level helper that
 * the CV builder (cv-builder.js) uses to turn any rendered DOM node into a
 * downloaded PDF file. Contains no CV-specific logic on purpose — the
 * document itself is built from JSON data by cv-builder.js.
 */

(() => {
  'use strict';

  /**
   * @param {HTMLElement} node        Element to capture (must be attached to the DOM).
   * @param {string} filename         Output file name, e.g. "Name_Profile_EN.pdf".
   * @returns {Promise<void>}
   */
  function generatePdf(node, filename) {
    if (!window.html2pdf) {
      return Promise.reject(new Error('html2pdf.js not loaded'));
    }

    const options = {
      margin: [12, 14, 14, 14],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['.cv-entry', '.cv-block'],
      },
    };

    return window.html2pdf().set(options).from(node).save();
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
