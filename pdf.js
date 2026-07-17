/**
 * pdf.js
 * Turns a rendered DOM node into a downloaded PDF file, using html2canvas
 * and jsPDF directly (loaded separately in index.html) rather than through
 * html2pdf.js's own bundled wrapper.
 *
 * Why not html2pdf.js: it wraps the source in its own internal capture
 * container, which centers itself (`margin: auto`) inside a full-viewport
 * overlay — so its horizontal offset depends on the real browser window
 * width (0 on a narrow/mobile window, 100px+ on a wide desktop window).
 * This is a confirmed, acknowledged limitation of that architecture, not
 * something fixable via its public options — see e.g.
 * github.com/parallax/jsPDF/issues/2987, where the html2canvas `onclone`
 * hook is shown not to reliably reach that internal container either.
 *
 * Calling html2canvas + jsPDF directly, per their own official docs
 * (html2canvas.hertzen.com/configuration, html2canvas.hertzen.com/faq.html),
 * avoids that indirection entirely: we capture our own node with a fully
 * documented, predictable configuration, and place the result on PDF pages
 * ourselves.
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
   * Bottom edge (in the node's own local, unscaled px) of every
   * .cv-entry / .cv-section — safe places to cut between PDF pages without
   * splitting a block in half.
   */
  function collectSafeBreaksPx(node) {
    const top = node.getBoundingClientRect().top;
    const blocks = node.querySelectorAll('.cv-entry, .cv-section');
    const breaks = [];
    blocks.forEach((el) => {
      breaks.push(Math.round(el.getBoundingClientRect().bottom - top));
    });
    breaks.push(node.scrollHeight);
    return Array.from(new Set(breaks)).sort((a, b) => a - b);
  }

  /**
   * @param {HTMLElement} node        Element to capture. Must be attached
   *                                  to the DOM, at its natural (untransformed,
   *                                  unscaled) size — cv-builder.js is
   *                                  responsible for that.
   * @param {string} filename         Output file name, e.g. "Name_Profile_EN.pdf".
   * @returns {Promise<void>}
   */
  async function generatePdf(node, filename) {
    if (!window.html2canvas) {
      return Promise.reject(new Error('html2canvas not loaded'));
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      return Promise.reject(new Error('jsPDF not loaded'));
    }
    if (!node) {
      return Promise.reject(new Error('generatePdf: node is required'));
    }

    await waitForFonts();
    await waitForImages(node);
    await nextPaint();

    const safeBreaksPx = collectSafeBreaksPx(node);

    // Options per the official docs:
    // https://html2canvas.hertzen.com/configuration
    // https://html2canvas.hertzen.com/faq.html
    const canvas = await window.html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: node.scrollWidth,
      windowHeight: node.scrollHeight,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidthMM = pdf.internal.pageSize.getWidth();
    const pageHeightMM = pdf.internal.pageSize.getHeight();

    const pxPerMM = canvas.width / pageWidthMM;
    const pageHeightPx = pageHeightMM * pxPerMM;
    const captureScale = canvas.width / node.scrollWidth;

    let cursor = 0;
    let firstPage = true;

    while (cursor < canvas.height - 1) {
      let sliceEnd = Math.min(cursor + pageHeightPx, canvas.height);

      if (sliceEnd < canvas.height) {
        let snapped = 0;
        for (const breakPx of safeBreaksPx) {
          const scaled = breakPx * captureScale;
          if (scaled > cursor && scaled <= sliceEnd) snapped = scaled;
        }
        if (snapped > cursor) sliceEnd = snapped;
      }

      const sliceHeightPx = Math.round(sliceEnd - cursor);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0, cursor, canvas.width, sliceHeightPx,
        0, 0, canvas.width, sliceHeightPx
      );

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.98);
      const sliceHeightMM = sliceHeightPx / pxPerMM;

      if (!firstPage) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMM, sliceHeightMM);
      firstPage = false;

      cursor = sliceEnd;
    }

    pdf.save(filename);
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
