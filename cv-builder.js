/**
 * cv-builder.js
 * Powers the "Generate CV" modal: lets the user pick a CV profile, language,
 * target market, visual style and included sections, renders a live A4
 * preview, and generates a matching PDF — all derived from the same JSON
 * data files the rest of the site uses. No content is hardcoded here.
 */

(() => {
  'use strict';

  const A4_WIDTH = 794; // px @ 96dpi, matches A4 210mm

  const cache = { loaded: false, loading: null };
  const data = {
    profile: null,
    profiles: null,
    experience: null,
    skills: null,
    projects: null,
    education: null,
    certificates: null,
    translations: { pl: null, en: null },
  };

  const builder = {
    profileId: null,
    lang: 'pl',
    country: 'pl',
    style: 'ats',
    sections: { summary: true, experience: true, skills: true, projects: false, education: true, certificates: true, languages: true, contact: true },
    contactFields: { email: true, github: true, linkedin: true, phone: false, address: false },
    projectsMode: 'top3',
    skillsMode: 'matched',
  };

  const els = {};
  let renderScheduled = false;

  /* ------------------------------------------------------------------ */
  /* Control group definitions (static enumerations, not JSON content)   */
  /* ------------------------------------------------------------------ */
  const SECTION_KEYS = ['summary', 'experience', 'skills', 'projects', 'education', 'certificates', 'languages', 'contact'];
  const CONTACT_KEYS = ['email', 'github', 'linkedin', 'phone', 'address'];
  const STYLE_KEYS = ['ats', 'modern', 'minimal'];
  const PROJECT_MODES = ['none', 'top3', 'all'];
  const SKILLS_MODES = ['all', 'top', 'matched'];

  /* ------------------------------------------------------------------ */
  /* Data loading                                                        */
  /* ------------------------------------------------------------------ */
  async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return res.json();
  }

  function loadAllData() {
    if (cache.loaded) return Promise.resolve();
    if (cache.loading) return cache.loading;

    cache.loading = Promise.all([
      fetchJSON('data/profile.json'),
      fetchJSON('data/profiles.json'),
      fetchJSON('data/experience.json'),
      fetchJSON('data/skills.json'),
      fetchJSON('data/projects.json'),
      fetchJSON('data/education.json'),
      fetchJSON('data/certificates.json'),
      fetchJSON('data/translations/pl.json'),
      fetchJSON('data/translations/en.json'),
    ]).then(([profile, profiles, experience, skills, projects, education, certificates, pl, en]) => {
      data.profile = profile;
      data.profiles = profiles;
      data.experience = experience;
      data.skills = skills;
      data.projects = projects;
      data.education = education;
      data.certificates = certificates;
      data.translations.pl = pl;
      data.translations.en = en;
      builder.profileId = Object.keys(profiles).sort((a, b) => profiles[a].order - profiles[b].order)[0];
      cache.loaded = true;
    });

    return cache.loading;
  }

  function tt(lang, path) {
    const dict = data.translations[lang] || data.translations.pl;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), dict) || '';
  }

  /* ------------------------------------------------------------------ */
  /* DOM refs (resolved lazily since modal markup already exists in HTML)*/
  /* ------------------------------------------------------------------ */
  function resolveEls() {
    els.overlay = document.getElementById('cvModalOverlay');
    els.modal = document.getElementById('cvModal');
    els.closeBtn = document.getElementById('cvModalClose');
    els.profileOptions = document.getElementById('profileOptions');
    els.languageOptions = document.getElementById('languageOptions');
    els.countryOptions = document.getElementById('countryOptions');
    els.styleOptions = document.getElementById('styleOptions');
    els.sectionsOptions = document.getElementById('sectionsOptions');
    els.contactOptions = document.getElementById('contactOptions');
    els.projectsOptions = document.getElementById('projectsOptions');
    els.skillsModeOptions = document.getElementById('skillsModeOptions');
    els.previewFrame = document.getElementById('cvPreviewFrame');
    els.previewScaler = document.getElementById('cvPreviewScaler');
    els.renderRoot = document.getElementById('cvRenderRoot');
    els.filenamePreview = document.getElementById('cvFilenamePreview');
    els.generateBtn = document.getElementById('generatePdfBtn');
    els.generateLabel = document.getElementById('generatePdfLabel');
  }

  /* ------------------------------------------------------------------ */
  /* Modal open / close                                                  */
  /* ------------------------------------------------------------------ */
  function currentSiteLang() {
    return document.documentElement.lang === 'en' ? 'en' : 'pl';
  }

  async function openModal() {
    resolveEls();
    if (!els.overlay) return;

    const uiLang = currentSiteLang();
    builder.lang = uiLang;

    els.overlay.hidden = false;
    document.body.classList.add('modal-open');

    try {
      await loadAllData();
    } catch (err) {
      console.error('CV builder data load error:', err);
      return;
    }

    buildControls(uiLang);
    scheduleRender();
    window.addEventListener('resize', scheduleRender);
    els.closeBtn.focus();
  }

  function closeModal() {
    if (!els.overlay) return;
    els.overlay.hidden = true;
    document.body.classList.remove('modal-open');
    window.removeEventListener('resize', scheduleRender);
  }

  /* ------------------------------------------------------------------ */
  /* Control builders                                                    */
  /* ------------------------------------------------------------------ */
  function buildControls(uiLang) {
    buildProfileOptions(uiLang);
    buildSegmented(els.languageOptions, ['pl', 'en'], builder.lang, (val) => {
      builder.lang = val;
      scheduleRender();
    }, (val) => tt(uiLang, `cv.languageOptions.${val}`));
    buildSegmented(els.countryOptions, ['pl', 'de', 'intl'], builder.country, (val) => {
      builder.country = val;
      scheduleRender();
    }, (val) => tt(uiLang, `cv.countryOptions.${val}`));
    buildStyleOptions(uiLang);
    buildCheckboxGrid(els.sectionsOptions, SECTION_KEYS, builder.sections, uiLang, 'sectionsOptions', (key, checked) => {
      builder.sections[key] = checked;
      if (key === 'projects') {
        if (checked && builder.projectsMode === 'none') builder.projectsMode = 'top3';
        if (!checked) { /* keep mode, just hidden */ }
        buildProjectsOptions(uiLang);
      }
      scheduleRender();
    });
    buildCheckboxGrid(els.contactOptions, CONTACT_KEYS, builder.contactFields, uiLang, 'contactOptions', (key, checked) => {
      builder.contactFields[key] = checked;
      scheduleRender();
    });
    buildProjectsOptions(uiLang);
    buildSegmentedVertical(els.skillsModeOptions, SKILLS_MODES, builder.skillsMode, uiLang, 'skillsOptions', (val) => {
      builder.skillsMode = val;
      scheduleRender();
    });
  }

  function buildProfileOptions(uiLang) {
    const ids = Object.keys(data.profiles).sort((a, b) => data.profiles[a].order - data.profiles[b].order);
    els.profileOptions.innerHTML = '';
    ids.forEach((id) => {
      const profile = data.profiles[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radio-card';
      btn.setAttribute('aria-pressed', String(builder.profileId === id));
      btn.innerHTML = `<span class="radio-card-name">${window.SiteUtils.escapeHTML(profile.headline[uiLang] || profile.headline.en)}</span>
        <span class="radio-card-desc">${window.SiteUtils.escapeHTML(profile.tagline[uiLang] || profile.tagline.en)}</span>`;
      btn.addEventListener('click', () => {
        builder.profileId = id;
        els.profileOptions.querySelectorAll('.radio-card').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        scheduleRender();
      });
      els.profileOptions.appendChild(btn);
    });
  }

  function buildStyleOptions(uiLang) {
    els.styleOptions.innerHTML = '';
    STYLE_KEYS.forEach((key) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'radio-card';
      btn.setAttribute('aria-pressed', String(builder.style === key));
      btn.innerHTML = `<span class="radio-card-name">${window.SiteUtils.escapeHTML(tt(uiLang, `cv.styleOptions.${key}.name`))}</span>
        <span class="radio-card-desc">${window.SiteUtils.escapeHTML(tt(uiLang, `cv.styleOptions.${key}.desc`))}</span>`;
      btn.addEventListener('click', () => {
        builder.style = key;
        els.styleOptions.querySelectorAll('.radio-card').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        scheduleRender();
      });
      els.styleOptions.appendChild(btn);
    });
  }

  function buildProjectsOptions(uiLang) {
    buildSegmentedVertical(els.projectsOptions, PROJECT_MODES, builder.projectsMode, uiLang, 'projectsOptions', (val) => {
      builder.projectsMode = val;
      builder.sections.projects = val !== 'none';
      syncSectionsCheckboxUI();
      scheduleRender();
    });
  }

  function syncSectionsCheckboxUI() {
    if (!els.sectionsOptions) return;
    const box = els.sectionsOptions.querySelector('[data-key="projects"] input');
    if (box) box.checked = builder.sections.projects;
  }

  function buildSegmented(container, values, current, onChange, labelFor) {
    container.innerHTML = '';
    values.forEach((val) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'segmented-option';
      btn.setAttribute('aria-pressed', String(current === val));
      btn.textContent = labelFor(val);
      btn.addEventListener('click', () => {
        container.querySelectorAll('.segmented-option').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        onChange(val);
      });
      container.appendChild(btn);
    });
  }

  function buildSegmentedVertical(container, values, current, uiLang, i18nGroup, onChange) {
    container.innerHTML = '';
    values.forEach((val) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'segmented-option segmented-option-block';
      btn.setAttribute('aria-pressed', String(current === val));
      btn.textContent = tt(uiLang, `cv.${i18nGroup}.${val}`);
      btn.addEventListener('click', () => {
        container.querySelectorAll('.segmented-option').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        onChange(val);
      });
      container.appendChild(btn);
    });
  }

  function buildCheckboxGrid(container, keys, stateObj, uiLang, i18nGroup, onChange) {
    container.innerHTML = '';
    keys.forEach((key) => {
      const id = `${i18nGroup}-${key}`;
      const label = document.createElement('label');
      label.className = 'checkbox-option';
      label.dataset.key = key;
      label.innerHTML = `<input type="checkbox" id="${id}" ${stateObj[key] ? 'checked' : ''}>
        <span>${window.SiteUtils.escapeHTML(tt(uiLang, `cv.${i18nGroup}.${key}`))}</span>`;
      label.querySelector('input').addEventListener('change', (e) => onChange(key, e.target.checked));
      container.appendChild(label);
    });
  }

  /* ------------------------------------------------------------------ */
  /* CV document rendering                                               */
  /* ------------------------------------------------------------------ */
  const esc = (s) => window.SiteUtils.escapeHTML(s);

  function presentLabel(lang) {
    return lang === 'pl' ? 'obecnie' : 'present';
  }

  function periodStr(period, lang, country) {
    const dateStyle = country === 'intl' ? 'short' : 'numeric';
    return window.SiteUtils.formatPeriod(period, lang, presentLabel(lang), dateStyle);
  }

  function buildHeader(profile, cvProfile, lang) {
    const parts = [];
    if (builder.sections.contact) {
      if (builder.contactFields.email) parts.push(`<a href="mailto:${profile.email}">${esc(profile.email)}</a>`);
      if (builder.contactFields.github) parts.push(`<a href="${profile.github.url}" target="_blank" rel="noopener noreferrer">github.com/${esc(profile.github.label)}</a>`);
      if (builder.contactFields.linkedin) parts.push(`<a href="${profile.linkedin.url}" target="_blank" rel="noopener noreferrer">linkedin.com/in/${esc(profile.linkedin.label)}</a>`);
      if (builder.contactFields.phone) parts.push(esc(profile.phone));
      if (builder.contactFields.address) parts.push(esc(profile.address[lang] || profile.address.en));
    }
    const contactLine = parts.length ? `<p class="cv-contact-line">${parts.join(' &nbsp;·&nbsp; ')}</p>` : '';

    return `
      <header class="cv-header">
        <h1 class="cv-name">${esc(profile.name)}</h1>
        <p class="cv-headline">${esc(cvProfile.headline[lang] || cvProfile.headline.en)}</p>
        <p class="cv-tagline">${esc(cvProfile.tagline[lang] || cvProfile.tagline.en)}</p>
        ${contactLine}
      </header>`;
  }

  function sectionWrap(key, title, inner) {
    if (!inner) return '';
    return `<section class="cv-section cv-section-${key}"><h2 class="cv-section-title">${esc(title)}</h2>${inner}</section>`;
  }

  function buildSummary(cvProfile, lang, uiLang) {
    if (!builder.sections.summary) return '';
    let html = `<p class="cv-summary-text">${esc(cvProfile.summary[lang] || cvProfile.summary.en)}</p>`;
    if (builder.style !== 'minimal') {
      const kw = (cvProfile.keywords[lang] || cvProfile.keywords.en || []).join(', ');
      if (kw) html += `<p class="cv-keywords-line"><strong>${esc(tt(uiLang, 'cv.docHeadings.keywords'))}:</strong> ${esc(kw)}</p>`;
    }
    return sectionWrap('summary', tt(uiLang, 'cv.docHeadings.summary'), html);
  }

  function tagsBlock(tags, uiLang, lang) {
    if (!tags || !tags.length) return '';
    if (builder.style === 'modern') {
      return `<div class="cv-tags-pills">${tags.map((t) => `<span class="cv-tag-pill">${esc(t)}</span>`).join('')}</div>`;
    }
    const label = tt(uiLang, 'cv.docHeadings.technologies') || (lang === 'pl' ? 'Technologie' : 'Technologies');
    return `<p class="cv-tags-plain">${esc(label)}: ${esc(tags.join(', '))}</p>`;
  }

  function buildExperience(lang, country, uiLang) {
    if (!builder.sections.experience) return '';
    const order = data.profiles[builder.profileId].experienceOrder;
    const items = order.map((id) => data.experience.find((e) => e.id === id)).filter(Boolean);
    if (!items.length) return '';

    const html = items
      .map((item) => {
        const companyMarkup = item.companyUrl
          ? `<a href="${item.companyUrl}" target="_blank" rel="noopener noreferrer">${esc(item.company)}</a>`
          : esc(item.company);
        return `
        <article class="cv-entry">
          <div class="cv-entry-head">
            <span class="cv-entry-role">${esc(item.role[lang] || item.role.en)}</span>
            <span class="cv-entry-period">${esc(periodStr(item.period, lang, country))}</span>
          </div>
          <p class="cv-entry-company">${companyMarkup}</p>
          <p class="cv-entry-desc">${esc(item.description[lang] || item.description.en)}</p>
          ${tagsBlock(item.tags, uiLang, lang)}
        </article>`;
      })
      .join('');
    return sectionWrap('experience', tt(uiLang, 'cv.docHeadings.experience'), html);
  }

  function filterSkillItems(group, cvProfile) {
    if (builder.skillsMode === 'all') return group.items;
    if (builder.skillsMode === 'top') return group.items.filter((i) => i.core);
    const matched = cvProfile.matchedSkills || [];
    return group.items.filter((i) => matched.includes(i.name));
  }

  function buildSkills(lang, uiLang) {
    if (!builder.sections.skills) return '';
    const cvProfile = data.profiles[builder.profileId];
    const order = cvProfile.skillsOrder;
    const groupLabel = (id) => tt(uiLang, `skills.groups.${id}`);

    const html = order
      .map((id) => data.skills.find((g) => g.id === id))
      .filter(Boolean)
      .map((group) => {
        const items = filterSkillItems(group, cvProfile);
        if (!items.length) return '';
        const names = items.map((i) => i.name);
        const valueHtml =
          builder.style === 'modern'
            ? `<span class="cv-tags-pills">${names.map((n) => `<span class="cv-tag-pill">${esc(n)}</span>`).join('')}</span>`
            : `<span class="cv-skill-list">${esc(names.join(', '))}</span>`;
        return `<div class="cv-skill-group"><span class="cv-skill-group-label">${esc(groupLabel(group.id))}:</span> ${valueHtml}</div>`;
      })
      .join('');

    return sectionWrap('skills', tt(uiLang, 'cv.docHeadings.skills'), html || '');
  }

  function buildProjects(lang, country, uiLang) {
    if (!builder.sections.projects || builder.projectsMode === 'none') return '';
    const cvProfile = data.profiles[builder.profileId];
    let order = cvProfile.projectsOrder || data.projects.map((p) => p.id);
    let items = order.map((id) => data.projects.find((p) => p.id === id)).filter(Boolean);
    if (builder.projectsMode === 'top3') items = items.slice(0, 3);
    if (!items.length) return '';

    const html = items
      .map((item) => {
        const nameMarkup = item.url
          ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${esc(item.name)}</a>`
          : esc(item.name);
        return `
        <article class="cv-entry">
          <div class="cv-entry-head">
            <span class="cv-entry-role">${nameMarkup}</span>
            <span class="cv-entry-period">${esc(periodStr(item.period, lang, country))}</span>
          </div>
          <p class="cv-entry-desc">${esc(item.description[lang] || item.description.en)}</p>
          ${tagsBlock(item.tags, uiLang, lang)}
        </article>`;
      })
      .join('');
    return sectionWrap('projects', tt(uiLang, 'cv.docHeadings.projects'), html);
  }

  function buildEducation(lang, country, uiLang) {
    if (!builder.sections.education || !data.education.length) return '';
    const html = data.education
      .map(
        (item) => `
        <article class="cv-entry">
          <div class="cv-entry-head">
            <span class="cv-entry-role">${esc(item.degree[lang] || item.degree.en)}</span>
            <span class="cv-entry-period">${esc(periodStr(item.period, lang, country))}</span>
          </div>
          <p class="cv-entry-company">${esc(item.school)} — ${esc(item.location[lang] || item.location.en)}</p>
          <p class="cv-entry-desc">${esc(item.detail[lang] || item.detail.en)}</p>
        </article>`
      )
      .join('');
    return sectionWrap('education', tt(uiLang, 'cv.docHeadings.education'), html);
  }

  function buildCertificates(uiLang) {
    if (!builder.sections.certificates || !data.certificates.length) return '';
    const html = `<ul class="cv-cert-list">${data.certificates
      .map((c) => {
        const nameMarkup = c.url ? `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a>` : esc(c.name);
        return `<li><span class="cv-cert-name">${nameMarkup}</span><span class="cv-cert-meta">${esc(c.issuer)} · ${esc(c.year)}</span></li>`;
      })
      .join('')}</ul>`;
    return sectionWrap('certificates', tt(uiLang, 'cv.docHeadings.certificates'), html);
  }

  function buildLanguages(lang, uiLang) {
    if (!builder.sections.languages || !data.profile.spokenLanguages.length) return '';
    const html = `<ul class="cv-lang-list">${data.profile.spokenLanguages
      .map((l) => `<li>${esc(l.name[lang] || l.name.en)}: <strong>${esc(l.level[lang] || l.level.en)}</strong></li>`)
      .join('')}</ul>`;
    return sectionWrap('languages', tt(uiLang, 'cv.docHeadings.languages'), html);
  }

  function buildCvDocument() {
    const lang = builder.lang;
    const uiLang = lang;
    const cvProfile = data.profiles[builder.profileId];
    const profile = data.profile;

    els.renderRoot.className = `cv-doc style-${builder.style}`;
    els.renderRoot.innerHTML = [
      buildHeader(profile, cvProfile, lang),
      buildSummary(cvProfile, lang, uiLang),
      buildExperience(lang, builder.country, uiLang),
      buildSkills(lang, uiLang),
      buildProjects(lang, builder.country, uiLang),
      buildEducation(lang, builder.country, uiLang),
      buildCertificates(uiLang),
      buildLanguages(lang, uiLang),
    ].join('');
  }

  /* ------------------------------------------------------------------ */
  /* Filename                                                             */
  /* ------------------------------------------------------------------ */
  function slug(str) {
    return str
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function buildFilename() {
    const cvProfile = data.profiles[builder.profileId];
    const nameSlug = slug(data.profile.name);
    const headlineSlug = slug(cvProfile.headline[builder.lang] || cvProfile.headline.en);
    const marketCode = builder.country === 'pl' ? 'PL' : builder.country === 'de' ? 'DE' : builder.lang.toUpperCase();
    return `${nameSlug}_${headlineSlug}_${marketCode}.pdf`;
  }

  /* ------------------------------------------------------------------ */
  /* Preview scaling + render pipeline                                   */
  /* ------------------------------------------------------------------ */
  function scaleFrame() {
    if (!els.previewFrame || !els.previewScaler) return;
    const frameWidth = els.previewFrame.clientWidth;
    if (!frameWidth) return;
    const scale = frameWidth / A4_WIDTH;
    els.previewScaler.style.width = `${A4_WIDTH}px`;
    els.previewScaler.style.transform = `scale(${scale})`;
  }

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      buildCvDocument();
      scaleFrame();
      if (els.filenamePreview) els.filenamePreview.textContent = buildFilename();
    });
  }

  /* ------------------------------------------------------------------ */
  /* PDF generation                                                       */
  /* ------------------------------------------------------------------ */
  async function handleGenerate() {
    if (els.generateBtn.disabled) return;
    const uiLang = currentSiteLang();
    const originalLabel = els.generateLabel.textContent;

    els.generateBtn.disabled = true;
    els.generateLabel.textContent = tt(uiLang, 'cv.generating');

    const filename = buildFilename();
    const clone = els.renderRoot.cloneNode(true);
    clone.className = els.renderRoot.className;
    clone.style.width = `${A4_WIDTH}px`;

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = `${A4_WIDTH}px`;
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      await window.SiteUtils.generatePdf(clone, filename);
    } catch (err) {
      console.error('CV PDF generation failed:', err);
      window.alert('Nie udało się wygenerować PDF. Spróbuj ponownie / PDF generation failed. Please try again.');
    } finally {
      document.body.removeChild(host);
      els.generateBtn.disabled = false;
      els.generateLabel.textContent = originalLabel;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Wire up                                                              */
  /* ------------------------------------------------------------------ */
  function init() {
    resolveEls();
    if (!els.overlay) return;

    ['navDownloadCvBtn', 'heroDownloadCvBtn', 'mobileDownloadCvBtn'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    });

    els.closeBtn.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.overlay.hidden) closeModal();
    });
    els.generateBtn.addEventListener('click', handleGenerate);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
