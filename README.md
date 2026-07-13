# Aleksander Kowalski — Developer Site / CV

Nowoczesna, jednostronicowa strona Software Developera pełniąca funkcję CV.
Czysty HTML5 + CSS3 + Vanilla JS, bez frameworków i bez build stepu.

## Uruchomienie lokalne

Dane są ładowane przez `fetch()` z plików JSON, więc strona **musi** być
serwowana przez HTTP (nie działa po prostu otwarta jako `file://`).

```bash
# dowolna z poniższych opcji
npx serve .
python3 -m http.server 8080
```

Następnie otwórz `http://localhost:8080`.

## Struktura

```
index.html          — struktura strony (semantyczny HTML5)
style.css            — design tokens, layout, komponenty, dark mode, print
script.js            — i18n, theme switch, render danych z JSON
pdf.js               — generowanie PDF z aktualnego DOM (html2pdf.js)

data/
  profile.json        — dane kontaktowe / linki (bez tłumaczeń)
  experience.json      — stanowiska: firma, okres, tagi technologiczne
  skills.json           — grupy umiejętności i technologie
  translations/
    pl.json / en.json   — wszystkie teksty UI (PL/EN)

assets/               — miejsce na zdjęcie/favicon/inne pliki statyczne
```

## Personalizacja

1. **Dane osobowe / linki** → `data/profile.json`
2. **Doświadczenie** → `data/experience.json` (dane strukturalne: firma, okres,
   tagi) + treść (rola, opis) w `data/translations/pl.json` i `en.json` pod
   kluczem `experience.items.<id>`
3. **Umiejętności** → `data/skills.json` (technologie nie są tłumaczone —
   nazwy pozostają takie same w obu językach)
4. **Teksty UI** (nagłówki, przyciski, opisy) → pliki w `data/translations/`
5. **Kolory / typografia** → zmienne CSS w `:root` i `[data-theme="dark"]`
   na górze `style.css`

## Funkcje

- **Dark / Light mode** — przełącznik w navbarze, zapamiętywany w `localStorage`,
  domyślnie dopasowany do `prefers-color-scheme`
- **PL / EN** — przełącznik języka, dane doświadczenia/umiejętności/kontaktu
  renderowane dynamicznie na podstawie aktywnego języka
- **Download CV (PDF)** — przycisk w Hero generuje PDF z aktualnego stanu
  strony (html2pdf.js), bez osobnego szablonu — to ten sam layout, tylko w
  trybie do druku
- **Responsywność** — CSS Grid + Flexbox, breakpointy dla tabletu/mobile,
  menu hamburgerowe poniżej 760px
- **Dostępność** — semantyczny HTML, `aria-*` na kontrolkach, `:focus-visible`,
  `prefers-reduced-motion`, skip-link
- **`@media print`** — osobny zestaw stylów na wypadek klasycznego druku
  (Ctrl+P), niezależny od trybu generowania PDF

## Deploy na GitHub Pages

1. Wypchnij zawartość repozytorium na branch `main`
2. W ustawieniach repo: **Settings → Pages → Source: `main` / root**
3. Strona będzie dostępna pod `https://<user>.github.io/<repo>/`

Brak backendu, brak build stepu — GitHub Pages serwuje pliki bezpośrednio.
