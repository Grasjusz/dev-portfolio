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
  /**
   * Two tiers of break points, in the node's own local, unscaled px:
   *  - sectionBreaksPx: only between whole .cv-section blocks. Preferred —
   *    using these means a section never gets split across pages.
   *  - blockBreaksPx: finer breaks (.cv-entry, .cv-skill-group, list rows).
   *    Fallback only, used when a single .cv-section is taller than one
   *    page and has no choice but to be split internally.
   */
  function collectBreaksPx(node) {
    const top = node.getBoundingClientRect().top;

    const sectionBreaksPx = [0];
    node.querySelectorAll('.cv-section').forEach((el) => {
      sectionBreaksPx.push(Math.round(el.getBoundingClientRect().bottom - top));
    });

    const blockSelectors = '.cv-entry, .cv-skill-group, .cv-cert-list li, .cv-lang-list li';
    const blockBreaksPx = [];
    node.querySelectorAll(blockSelectors).forEach((el) => {
      blockBreaksPx.push(Math.round(el.getBoundingClientRect().bottom - top));
    });

    const dedupeSort = (arr) => Array.from(new Set(arr)).sort((a, b) => a - b);
    return {
      sectionBreaksPx: dedupeSort([...sectionBreaksPx, node.scrollHeight]),
      blockBreaksPx: dedupeSort([...blockBreaksPx, node.scrollHeight]),
    };
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

    // Version marker — check DevTools Console for this exact line when
    // generating. If it's missing or says something else, the browser is
    // running a cached, older pdf.js, not this file.
    console.log('[pdf.js] section-aware pagination build — 2026-07-18-a');

    const { sectionBreaksPx, blockBreaksPx } = collectBreaksPx(node);
    console.log('[pdf.js] sectionBreaksPx (unscaled, local px):', sectionBreaksPx);

    // Options per the official docs:
    // https://html2canvas.hertzen.com/configuration
    // https://html2canvas.hertzen.com/faq.html
    const canvas = await window.html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: node.scrollWidth,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    // Vertical breathing room only — horizontal stays edge-to-edge (0), since
    // that's what keeps the captured content's width exactly matching the
    // page width (see windowWidth/scrollX notes above). This just keeps
    // text from sitting flush against the very top/bottom edge of each page.
    const MARGIN_Y_MM = 10;

    const pageWidthMM = pdf.internal.pageSize.getWidth();
    const pageHeightMM = pdf.internal.pageSize.getHeight() - MARGIN_Y_MM * 2;

    const pxPerMM = canvas.width / pageWidthMM;
    const pageHeightPx = pageHeightMM * pxPerMM;
    // Break points are Y-axis (vertical) measurements, so they must be
    // converted using the Y-axis scale factor — NOT canvas.width/node.
    // scrollWidth. Confirmed via console logs that html2canvas's `scale`
    // option doesn't always produce perfectly identical X/Y ratios (off by
    // ~0.1-0.2% in practice), and using the wrong axis's factor compounded
    // that error across the full document height, enough to land mid-line
    // at a page break.
    const captureScaleY = canvas.height / node.scrollHeight;
    console.log('[pdf.js] canvas:', canvas.width, 'x', canvas.height,
      '| node.scrollWidth/Height:', node.scrollWidth, node.scrollHeight,
      '| captureScaleY:', captureScaleY);

    let cursor = 0;
    let firstPage = true;
    let pageNum = 1;

    while (cursor < canvas.height - 1) {
      let sliceEnd = Math.min(cursor + pageHeightPx, canvas.height);

      if (sliceEnd < canvas.height) {
        let snappedSection = 0;
        for (const breakPx of sectionBreaksPx) {
          const scaled = breakPx * captureScaleY;
          if (scaled > cursor && scaled <= sliceEnd) snappedSection = scaled;
        }

        if (snappedSection > cursor) {
          // A whole section (or several) fits — end the page there, plus a
          // small extension into the guaranteed-empty space right after it
          // (.cv-section has margin-bottom: 18px in CSS, never occupied by
          // real content). Cutting exactly at the last text pixel with zero
          // buffer produced visible JPEG compression ringing/ghosting right
          // at the page edge, which looked like faint duplicated text —
          // extending into real whitespace instead avoids that.
          const TRAILING_WHITESPACE_PX = 10 * captureScaleY;
          sliceEnd = Math.min(canvas.height, snappedSection + TRAILING_WHITESPACE_PX);
        } else {
          // Not even one whole section fits in the remaining space —
          // this single section is taller than a full page, so it has to
          // be split. Fall back to the finer, still-safe block breaks.
          let snappedBlock = 0;
          for (const breakPx of blockBreaksPx) {
            const scaled = breakPx * captureScaleY;
            if (scaled > cursor && scaled <= sliceEnd) snappedBlock = scaled;
          }
          if (snappedBlock > cursor) sliceEnd = snappedBlock;
        }
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
      pdf.addImage(imgData, 'JPEG', 0, MARGIN_Y_MM, pageWidthMM, sliceHeightMM);
      console.log(`[pdf.js] page ${pageNum}: cursor=${cursor} -> sliceEnd=${sliceEnd} (canvas.height=${canvas.height})`);
      firstPage = false;
      pageNum += 1;

      cursor = sliceEnd;
    }

    pdf.save(filename);
  }

  window.SiteUtils = window.SiteUtils || {};
  window.SiteUtils.generatePdf = generatePdf;
})();
