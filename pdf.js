/**
 * pdf.js
 * Generates a PDF snapshot of the current page (#main) using html2pdf.js.
 * The PDF is "just another feature" of the site — it reuses the live DOM,
 * temporarily switched into a light, print-friendly mode via the
 * `pdf-generating` class defined in style.css.
 */

(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('downloadCvBtn');
    const label = document.getElementById('downloadCvLabel');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      if (btn.disabled) return;

      const originalTheme = document.body.getAttribute('data-theme');
      const originalLabel = label.textContent;
      const downloadingText = getDownloadingLabel();

      btn.disabled = true;
      label.textContent = downloadingText;
      document.body.classList.add('pdf-generating');

      // Force light theme colours for the capture, restore afterwards.
      document.body.setAttribute('data-theme', 'light');

      const target = document.getElementById('main');
      const fileName = getFileName();

      const options = {
        margin: [10, 12, 14, 12],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: 1080,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.exp-card', '.skill-group', '.contact-item'] },
      };

      try {
        await window.html2pdf().set(options).from(target).save();
      } catch (err) {
        console.error('PDF generation failed:', err);
        window.alert('Nie udało się wygenerować PDF. Spróbuj ponownie / PDF generation failed. Please try again.');
      } finally {
        document.body.classList.remove('pdf-generating');
        document.body.setAttribute('data-theme', originalTheme);
        btn.disabled = false;
        label.textContent = originalLabel;
      }
    });
  });

  function getDownloadingLabel() {
    try {
      const active = document.querySelector('.lang-btn[aria-pressed="true"]');
      const lang = active ? active.dataset.lang : 'pl';
      return lang === 'pl' ? 'Przygotowywanie PDF…' : 'Preparing PDF…';
    } catch {
      return 'Preparing PDF…';
    }
  }

  function getFileName() {
    const nameEl = document.getElementById('profileName');
    const name = nameEl ? nameEl.textContent.trim().replace(/\s+/g, '_') : 'CV';
    return `${name}_CV.pdf`;
  }
})();
