# Gracjan Wagner — Developer Site / CV Generator

Nowoczesna, jednostronicowa strona Software Developera z wbudowanym
**generatorem CV** — jedną z głównych funkcji strony. Czysty HTML5 + CSS3 +
Vanilla JS, bez frameworków i bez build stepu.

## Uruchomienie lokalne

Dane są ładowane przez `fetch()` z plików JSON, więc strona **musi** być
serwowana przez HTTP (nie działa po prostu otwarta jako `file://`).

```bash
npx serve .
# lub
python3 -m http.server 8080
```

Otwórz `http://localhost:8080`.

## Struktura

```
index.html          — struktura strony + markup modala "Generate CV"
style.css            — design tokens, layout, komponenty, dark mode,
                        style modala, 3 warianty dokumentu CV (.cv-doc)
script.js            — i18n strony, theme switch, render Experience/Skills/Contact
cv-builder.js        — cały generator CV: kontrolki modala, live preview,
                        renderowanie dokumentu z danych JSON, nazwa pliku
pdf.js               — generyczny wrapper na html2pdf.js (bez logiki CV)

data/
  profile.json         — dane osobowe / kontakt / języki obce
  profiles.json         — 6 profili CV (nagłówek, opis, kolejność sekcji,
                           dopasowane umiejętności, słowa kluczowe ATS)
  experience.json       — stanowiska (dwujęzyczne pole role/description)
  skills.json            — grupy umiejętności, każda pozycja ma flagę "core"
  projects.json           — projekty z priorytetem i tagami
  education.json           — wykształcenie
  certificates.json         — certyfikaty
  translations/
    pl.json / en.json       — teksty UI strony + całego modala generatora

assets/               — miejsce na zdjęcie/favicon/inne pliki statyczne
```

## Generator CV — jak to działa

Przycisk **„Download CV"** (navbar, hero, menu mobilne) otwiera modal
**„Generate CV"**, w którym można wybrać:

| Opcja | Wpływ |
|---|---|
| **Profil CV** (6 wariantów) | nagłówek, opis zawodowy, kolejność doświadczenia/umiejętności/projektów, słowa kluczowe ATS |
| **Język** (PL/EN) | cały dokument |
| **Kraj** (PL/DE/International) | format daty (`03.2023` vs `Mar 2023`) oraz sufiks w nazwie pliku |
| **Styl** (ATS/Modern/Minimal) | układ i typografia dokumentu |
| **Sekcje** (8 checkboxów) | które bloki trafiają do PDF |
| **Kontakt** (5 checkboxów) | które dane kontaktowe pojawiają się w nagłówku |
| **Projekty** (Brak/3 najlepsze/Wszystkie) | liczba i kolejność wg profilu |
| **Umiejętności** (Wszystkie/Najważniejsze/Dopasowane) | filtr tagów wg flagi `core` lub listy `matchedSkills` profilu |

Po prawej stronie modala renderuje się **żywy podgląd** pierwszej strony —
dokładnie ten sam kod HTML/CSS, który trafia do PDF (`#cvRenderRoot`,
klasa `.cv-doc.style-<ats|modern|minimal>`). Podgląd aktualizuje się przy
każdej zmianie opcji.

**Generate PDF** klonuje aktualnie wyrenderowany dokument, przenosi go
poza ekran i generuje PDF przez `html2pdf.js` (`pdf.js` → `SiteUtils.generatePdf`).
Brak osobnego "szablonu PDF" trzymanego w innym miejscu — to dokładnie ten
sam DOM, który widać w podglądzie.

**Nazwa pliku** budowana jest automatycznie:
`{Imię_Nazwisko}_{Profil}_{PL|DE|EN}.pdf`, np. `Gracjan_Wagner_WordPress_Developer_DE.pdf`.

### Dodanie nowego profilu CV

Wystarczy dodać wpis w `data/profiles.json` — żadna zmiana w HTML/JS nie
jest potrzebna, lista profili w modalu generuje się dynamicznie z tego pliku.

### Dodanie nowego doświadczenia / projektu / certyfikatu

Dodaj wpis do odpowiedniego pliku JSON w `data/` i (jeśli chcesz, by profil
go uwzględniał) dopisz jego `id` do `experienceOrder` / `projectsOrder` w
`data/profiles.json`.

## Funkcje

- **Dark / Light mode** — zapamiętywany w `localStorage`, domyślnie
  dopasowany do `prefers-color-scheme`
- **PL / EN** — przełącznik języka całej strony (niezależny od języka
  wybranego wewnątrz generatora CV)
- **Generator CV** — patrz wyżej; jedna baza JSON → wiele wersji dokumentu
- **Responsywność** — CSS Grid + Flexbox, menu hamburgerowe < 760px, modal
  przechodzi na układ jednokolumnowy < 860px
- **Dostępność** — semantyczny HTML, `aria-*` na kontrolkach i modalu,
  `:focus-visible`, `prefers-reduced-motion`, zamykanie modala klawiszem Esc
- **`@media print`** — osobny zestaw stylów dla klasycznego druku strony
  (Ctrl+P), niezależny od generatora PDF

## Deploy na GitHub Pages

1. Wypchnij zawartość repozytorium na branch `main`
2. **Settings → Pages → Source: `main` / root**
3. Strona będzie dostępna pod `https://<user>.github.io/<repo>/`

Brak backendu, brak build stepu — GitHub Pages serwuje pliki bezpośrednio.
Generator CV pobiera dane przez `fetch()`, więc na Pages zadziała od razu
(w przeciwieństwie do otwarcia pliku lokalnie przez `file://`).
