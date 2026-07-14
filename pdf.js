/**
 * pdf.js
 * Thin wrapper around html2pdf.js. Exposes a single low-level helper that
 * the CV builder (cv-builder.js) uses to turn any rendered DOM node into a
 * downloaded PDF file. Contains no CV-specific logic on purpose — the
 * document itself is built from JSON data by cv-builder.js.
 *
 * Export pipeline (why it looks different from a naive html2pdf().from(node)):
 *  1. Clone the live node into an isolated, invisible "capture host" that is
 *     positioned with the document flow (not `position: fixed`), so it is
 *     immune to the page's current scroll offset. `position: fixed` targets
 *     are a documented source of misaligned/duplicated html2canvas output
 *     when the underlying page is scrolled — that mismatch is what produced
 *     the "rozlany" / overlapping PDF layout.
 *  2. Wait for web fonts (`document.fonts.ready`) and any images inside the
 *     clone to finish loading before rasterizing, so html2canvas measures
 *     the exact same box model the browser preview used.
 *  3. Capture with an explicit, deterministic virtual viewport
 *     (windowWidth/windowHeight) and scrollX/scrollY pinned to 0, so the
 *     crop region html2canvas computes can never drift.
 *  4. Let html2pdf paginate using CSS break rules only (`mode: ['css']`),
 *     with an explicit `avoid` list covering every CV block — mixing the
 *     'legacy' pixel-slicing mode together with 'css' is a known html2pdf.js
 *     combination that produces duplicated/overlapping content across page
 *     boundaries.
 */

(() => {
  'use strict';

  function waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready.catch(() => {});
    }
    return Promise.resolve();
  }

  function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    return Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  /**
   * Builds an off-screen, invisible clone of `node` that lives in normal
   * document flow (so it scrolls/positions exactly like any other element,
   * unlike `position: fixed`) but is visually removed via opacity + a
   * negative stacking context, and cannot receive input.
   */
  function createCaptureHost(node, width) {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'absolute';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = `${width}px`;
    host.style.margin = '0';
    host.style.padding = '0';
    host.style.overflow = 'visible';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '-1';

    const clone = node.cloneNode(true);
    clone.style.width = `${width}px`;
    clone.style.margin = '0';
    host.appendChild(clone);
    document.body.appendChild(host);

    return { host, clone };
  }

  /**
   * @param {HTMLElement} node        Live element to export. It is only read
   *                                  (cloned), never modified, so the visible
   *                                  preview never flickers or shifts.
   * @param {string} filename         Output file name, e.g. "Name_Profile_EN.pdf".
   * @param {{ width?: number }} [opts]
   * @returns {Promise<void>}
   */
  async function generatePdf(node, filename, opts = {}) {
    if (!window.html2pdf) {
      return Promise.reject(new Error('html2pdf.js not loaded'));
    }
    if (!node) {
      return Promise.reject(new Error('generatePdf: node is required'));
    }

    const width = opts.width || node.offsetWidth || 794;
    const { host, clone } = createCaptureHost(node, width);

    try {
      await waitForFonts();
      await waitForImages(clone);
      await nextPaint();

      const options = {
        margin: [12, 14, 14, 14],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: width,
          windowHeight: clone.scrollHeight,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css'],
          avoid: ['.cv-section', '.cv-entry', '.cv-skill-group', 'img', 'tr'],
        },
      };

      await window.html2pdf().set(options).from(clone).save();
    } finally {
      document.body.removeChild(host);
    }
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
