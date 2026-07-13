/**
 * script.js
 * Loads JSON data, handles i18n (PL/EN), theme switching, navigation
 * and renders the Experience / Skills / Contact sections.
 * No frameworks, no build step.
 */

(() => {
  'use strict';

  const STORAGE_THEME = 'devsite-theme';
  const STORAGE_LANG = 'devsite-lang';

  const state = {
    lang: localStorage.getItem(STORAGE_LANG) || 'pl',
    profile: null,
    experience: null,
    skills: null,
    translations: null,
  };

  const els = {
    body: document.body,
    themeToggle: document.getElementById('themeToggle'),
    navToggle: document.getElementById('navToggle'),
    mobileMenu: document.getElementById('mobileMenu'),
    langBtns: document.querySelectorAll('.lang-btn'),
    profileName: document.getElementById('profileName'),
    availability: document.getElementById('availability'),
    githubLink: document.getElementById('githubLink'),
    linkedinLink: document.getElementById('linkedinLink'),
    experienceList: document.getElementById('experienceList'),
    skillsList: document.getElementById('skillsList'),
    contactList: document.getElementById('contactList'),
    year: document.getElementById('year'),
  };

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
  }

  function setTheme(theme) {
    els.body.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1117' : '#ffffff');
  }

  els.themeToggle.addEventListener('click', () => {
    const current = els.body.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  /* ------------------------------------------------------------------ */
  /* Mobile nav                                                          */
  /* ------------------------------------------------------------------ */
  els.navToggle.addEventListener('click', () => {
    const isOpen = els.mobileMenu.classList.toggle('open');
    els.navToggle.setAttribute('aria-expanded', String(isOpen));
    els.navToggle.setAttribute('aria-label', isOpen ? 'Zamknij menu' : 'Otwórz menu');
  });

  els.mobileMenu.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      els.mobileMenu.classList.remove('open');
      els.navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Data loading                                                        */
  /* ------------------------------------------------------------------ */
  async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    return res.json();
  }

  async function loadStaticData() {
    const [profile, experience, skills] = await Promise.all([
      fetchJSON('data/profile.json'),
      fetchJSON('data/experience.json'),
      fetchJSON('data/skills.json'),
    ]);
    state.profile = profile;
    state.experience = experience;
    state.skills = skills;
  }

  async function loadTranslations(lang) {
    state.translations = await fetchJSON(`data/translations/${lang}.json`);
  }

  function t(path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), state.translations) || '';
  }

  /* ------------------------------------------------------------------ */
  /* i18n: apply to static [data-i18n] elements                          */
  /* ------------------------------------------------------------------ */
  function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = t(el.getAttribute('data-i18n'));
      if (value) el.textContent = value;
    });

    document.title = t('meta.title') || document.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('meta.description'));

    document.documentElement.lang = state.lang;
  }

  /* ------------------------------------------------------------------ */
  /* Render: Hero                                                        */
  /* ------------------------------------------------------------------ */
  function renderHero() {
    const p = state.profile;
    els.profileName.textContent = p.name;
    els.githubLink.href = p.github.url;
    els.linkedinLink.href = p.linkedin.url;
    els.availability.style.display = p.available ? 'inline-flex' : 'none';
  }

  /* ------------------------------------------------------------------ */
  /* Render: Experience                                                  */
  /* ------------------------------------------------------------------ */
  function renderExperience() {
    els.experienceList.innerHTML = '';

    state.experience.forEach((item) => {
      const copy = t(`experience.items.${item.id}`);
      const article = document.createElement('article');
      article.className = 'exp-card';

      const companyMarkup = item.companyUrl
        ? `<a href="${item.companyUrl}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.company)}</a>`
        : escapeHTML(item.company);

      article.innerHTML = `
        <span class="exp-period">${escapeHTML(item.period)}</span>
        <h3 class="exp-role">${escapeHTML(copy && copy.role ? copy.role : item.id)}</h3>
        <p class="exp-company">${companyMarkup}</p>
        <p class="exp-description">${escapeHTML(copy && copy.description ? copy.description : '')}</p>
        <div class="exp-tags">
          ${item.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
        </div>
      `;
      els.experienceList.appendChild(article);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Render: Skills                                                      */
  /* ------------------------------------------------------------------ */
  function renderSkills() {
    els.skillsList.innerHTML = '';

    state.skills.forEach((group) => {
      const label = t(`skills.groups.${group.id}`) || group.id;
      const wrapper = document.createElement('div');
      wrapper.className = 'skill-group';
      wrapper.innerHTML = `
        <h3 class="skill-group-title">${escapeHTML(label)}</h3>
        <div class="skill-tags">
          ${group.items.map((item) => `<span class="skill-tag">${escapeHTML(item)}</span>`).join('')}
        </div>
      `;
      els.skillsList.appendChild(wrapper);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Render: Contact                                                     */
  /* ------------------------------------------------------------------ */
  function renderContact() {
    const p = state.profile;
    const items = [
      {
        label: t('contact.email'),
        value: p.email,
        href: `mailto:${p.email}`,
        icon: iconMail(),
      },
      {
        label: t('contact.github'),
        value: p.github.label,
        href: p.github.url,
        icon: iconGithub(),
      },
      {
        label: t('contact.linkedin'),
        value: p.linkedin.label,
        href: p.linkedin.url,
        icon: iconLinkedin(),
      },
      {
        label: t('contact.location'),
        value: p.location,
        href: null,
        icon: iconPin(),
      },
    ];

    els.contactList.innerHTML = items
      .map(
        (item) => `
        <li class="contact-item">
          <span class="contact-icon">${item.icon}</span>
          <span>
            <span class="contact-label">${escapeHTML(item.label)}</span>
            <span class="contact-value">${
              item.href
                ? `<a href="${item.href}" ${item.href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(item.value)}</a>`
                : escapeHTML(item.value)
            }</span>
          </span>
        </li>`
      )
      .join('');
  }

  function iconMail() {
    return '<svg viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="m2 4 6 5 6-5"/></svg>';
  }
  function iconGithub() {
    return '<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.49c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.88-1.17-.88-1.17-.72-.49.05-.48.05-.48.8.06 1.22.82 1.22.82.71 1.21 1.87.86 2.33.66.07-.52.28-.86.5-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
  }
  function iconLinkedin() {
    return '<svg viewBox="0 0 16 16"><path d="M14.82 0H1.18C.53 0 0 .53 0 1.19v13.62C0 15.47.53 16 1.18 16h13.64c.65 0 1.18-.53 1.18-1.19V1.19C16 .53 15.47 0 14.82 0ZM4.75 13.5H2.4V6h2.35v7.5ZM3.58 4.98a1.36 1.36 0 1 1 0-2.72 1.36 1.36 0 0 1 0 2.72ZM13.6 13.5h-2.35V9.87c0-.87-.02-1.98-1.21-1.98-1.22 0-1.4.95-1.4 1.92v3.69H6.29V6h2.26v1.03h.03c.31-.6 1.08-1.22 2.22-1.22 2.38 0 2.8 1.56 2.8 3.6v4.09Z"/></svg>';
  }
  function iconPin() {
    return '<svg viewBox="0 0 16 16"><path d="M8 15s5-4.5 5-8.5a5 5 0 0 0-10 0C3 10.5 8 15 8 15Z"/><circle cx="8" cy="6.5" r="1.75"/></svg>';
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------------ */
  /* Language switching                                                  */
  /* ------------------------------------------------------------------ */
  function updateLangButtons() {
    els.langBtns.forEach((btn) => {
      const active = btn.dataset.lang === state.lang;
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  async function setLanguage(lang) {
    if (lang === state.lang && state.translations) {
      updateLangButtons();
      return;
    }
    state.lang = lang;
    localStorage.setItem(STORAGE_LANG, lang);
    await loadTranslations(lang);
    applyStaticTranslations();
    renderHero();
    renderExperience();
    renderSkills();
    renderContact();
    updateLangButtons();
  }

  els.langBtns.forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */
  async function init() {
    initTheme();
    els.year.textContent = new Date().getFullYear();

    try {
      await loadStaticData();
      await loadTranslations(state.lang);
      applyStaticTranslations();
      renderHero();
      renderExperience();
      renderSkills();
      renderContact();
      updateLangButtons();
    } catch (err) {
      console.error('Data load error:', err);
      els.experienceList.innerHTML =
        '<p style="color:var(--text-secondary)">Nie udało się wczytać danych. Uruchom stronę przez lokalny serwer (np. `npx serve`).</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
