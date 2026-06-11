# Portfolio — Eren Yilmaz

Persoonlijke portfolio-site. Statisch, geen build-stap, geen dependencies.
**Gebouwd met Claude** — bewust zichtbaar, als demonstratie van een AI-native workflow.

## Structuur

```
portfolio/
├── index.html          # alle content & markup
├── css/style.css       # volledig design (tokens, animaties, responsive)
├── js/main.js          # interactie (vanilla JS, geen libraries)
├── fonts/              # zelf-gehoste variabele fonts (woff2)
└── README.md
```

## Security

- **Strikte CSP** (meta-tag in `index.html`): `default-src 'none'`, alles komt
  van `'self'`. Geen inline scripts of styles, geen externe CDN's.
- **Zero third-party requests**: fonts zelf-gehost, iconen als inline SVG-sprite.
  Niemand kan meekijken, niets kan gecompromitteerd worden via een CDN.
- Externe links hebben `rel="noopener noreferrer"`.
- Geen secrets, geen tracking, geen cookies.

### Let op bij wijzigingen
- Nieuwe inline `<script>` of `style=""`-attributen worden **geblokkeerd door de CSP**.
  Zet JS altijd in `js/main.js` en styling in `css/style.css`.
- Voeg je ooit een externe bron toe, breid dan de CSP bewust uit (en pin met SRI).

## Lokaal bekijken

```
python -m http.server 8765
```
→ http://localhost:8765

## Publiceren (GitHub Pages)

Upload de **volledige inhoud** van deze map naar de repo `killanova.github.io`
(main branch, root). De site staat dan live op https://killanova.github.io
