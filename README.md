# Portfolio — Eren Yilmaz · *"De Reis"*

Persoonlijke portfolio-site, opgezet als een **scrollende korte film**. Terwijl je
scrollt loopt er een gestileerd silhouet (met gloeiende laptop) door een
landschap dat van **dageraad → dag → schemering → nacht** kantelt: parallax-bergen,
een zon die ondergaat terwijl de maan rijst, sterren en een aurora op de top.

Geen videobestand — **elke frame wordt live op een `<canvas>` getekend**, gestuurd
door de scrollpositie. De echte content (projecten, pitch, contact) zweeft als
glas boven de film, blijft volledig leesbaar en toegankelijk, en is tweetalig
(**NL standaard, EN-toggle**).

Statisch, geen build-stap, geen dependencies.

## Structuur

```
killanova.github.io/
├── index.html        # alle content & markup (NL + EN via data-attributes)
├── css/style.css     # design-tokens, glas-panelen, HUD, responsive, reduced-motion
├── js/
│   ├── cinema.js      # de canvas-film: lucht, parallax, hemellichamen, personage
│   └── main.js        # UI: taalwissel, hoofdstuk-HUD, hero-stagger, typewriter, cursor
├── fonts/            # zelf-gehoste variabele fonts (woff2)
└── README.md
```

## De film (`js/cinema.js`)

- **Scroll = tijd.** De scrollpositie (0 → 1) stuurt de lucht-paletten, de parallax,
  de stand van zon/maan en de houding van het personage.
- **Het personage** is volledig procedureel getekend (een gewrichtenrig) en mengt
  drie houdingen: **lopen** (loopcyclus die meebeweegt met je scroll), **zittend
  typen** bij hoofdstuk *De werkwijze*, en **uitkijkend** op de top.
- Alles via `transform`/canvas-2D, één `requestAnimationFrame`-lus die zichzelf
  pauzeert als er niets beweegt en als het tabblad verborgen is.

## Toegankelijkheid

- **`prefers-reduced-motion`**: de film valt terug op één rustig, statisch beeld
  (geen autonome of scroll-beweging), de hero-animaties en cursor worden uitgezet.
- De canvas is `aria-hidden`; alle inhoud staat als echte, semantische HTML in de
  pagina. Beide talen staan in de markup, zodat de zichtbare taal voorgelezen wordt.

## Security

- **Strikte CSP** (meta-tag in `index.html`): `default-src 'none'`, alles van
  `'self'`. Geen inline scripts of styles, geen externe CDN's.
- **Zero third-party requests**: fonts zelf-gehost, iconen als inline SVG-sprite,
  de hele film draait lokaal. Niets om mee te lekken of te compromitteren.
- Externe links met `rel="noopener noreferrer"`. Geen secrets, tracking of cookies.

### Let op bij wijzigingen
- Nieuwe inline `<script>` of `style=""` wordt **geblokkeerd door de CSP**. Zet JS
  in `js/`, styling in `css/style.css`, en dynamische waarden via `element.style`.
- Vertaalbare tekst krijgt `data-nl="…"` en `data-en="…"`; de Nederlandse tekst
  staat ook als zichtbare `textContent` (werkt zo ook zonder JavaScript).

## Lokaal bekijken

```
python -m http.server 8765
```
→ http://localhost:8765

## Publiceren (GitHub Pages)

Upload de **volledige inhoud** van deze map naar de repo `killanova.github.io`
(main branch, root). De site staat dan live op https://killanova.github.io

---

<sub>Gemaakt met de hand op het stuur en Claude als co-piloot.</sub>
