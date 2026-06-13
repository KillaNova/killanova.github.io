/* ============================================================
   EREN YILMAZ — PORTFOLIO "DE REIS"
   Vanilla JS, geen libraries. UI-laag bovenop de canvas-film:
   taalwissel (NL/EN), hoofdstuk-HUD + timecode, hero-stagger,
   typewriter, scroll-voortgang, segmented switcher, cursor/tilt.
   Respecteert prefers-reduced-motion.
   ============================================================ */
(() => {
'use strict';
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine    = matchMedia('(pointer: fine)').matches;
const wait    = ms => new Promise(r => setTimeout(r, ms));

/* jaartal */
const jaar = $('#jaar'); if (jaar) jaar.textContent = new Date().getFullYear();

/* ============================================================
   i18n — NL standaard, EN als optie (progressive enhancement)
   ============================================================ */
const langBtn = $('#lang'), langLabel = $('#langlabel');
let LANG = 'nl';

function buildStagger(el, text) {
  el.textContent = '';
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((wd, i) => {
    const span = document.createElement('span');
    span.className = 'w' + (i === words.length - 1 ? ' grad' : '');
    span.textContent = wd;
    el.appendChild(span);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

function applyLang(lang) {
  LANG = lang === 'en' ? 'en' : 'nl';
  const en = LANG === 'en';
  document.documentElement.lang = LANG;
  $$('[data-nl]').forEach(el => {
    if (el.hasAttribute('data-grad')) return;        // stagger-koppen apart
    const v = en ? el.dataset.en : el.dataset.nl;
    if (v != null) el.textContent = v;
  });
  $$('[data-grad]').forEach(el => buildStagger(el, (en ? el.dataset.en : el.dataset.nl) || el.textContent));
  if (langLabel) langLabel.textContent = en ? 'NL' : 'EN';
  if (langBtn) langBtn.setAttribute('aria-label', en ? 'Schakel naar Nederlands' : 'Switch to English');
  try { localStorage.setItem('ey-lang', LANG); } catch (e) {}
  initType();
}

let saved = 'nl';
try { saved = localStorage.getItem('ey-lang') || 'nl'; } catch (e) {}
applyLang(saved);
document.body.classList.add('loaded');           // trigger hero-stagger

if (langBtn) langBtn.addEventListener('click', () => applyLang(LANG === 'en' ? 'nl' : 'en'));

/* ============================================================
   typewriter (taal-afhankelijk, herstart bij taalwissel)
   ============================================================ */
const ROLES = {
  nl: ['Python-developer', 'PxPlus / legacy-developer', 'API- & automatiseringsbouwer', 'AI-native developer'],
  en: ['Python developer', 'PxPlus / legacy developer', 'API & automation builder', 'AI-native developer']
};
let typeToken = 0;
function initType() {
  const el = $('#typewoord'); if (!el) return;
  const token = ++typeToken;
  const rollen = ROLES[LANG];
  el.textContent = '';
  if (reduced) { el.textContent = rollen[rollen.length - 1]; return; }
  let ri = 0, ci = 0, del = false, rondes = 0;
  const stap = () => {
    if (token !== typeToken) return;               // afgebroken door taalwissel
    const w = rollen[ri];
    ci += del ? -1 : 1;
    el.textContent = w.slice(0, ci);
    let pauze = del ? 36 : 72;
    if (!del && ci === w.length) {
      if (rondes >= 1 && ri === rollen.length - 1) return;
      pauze = 1600; del = true;
    } else if (del && ci === 0) {
      del = false; ri = (ri + 1) % rollen.length;
      if (ri === 0) rondes++;
      pauze = 360;
    }
    setTimeout(stap, pauze);
  };
  setTimeout(stap, 700);
}

/* ============================================================
   scroll-reveal + count-up + seg-switcher (IntersectionObserver)
   ============================================================ */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach(el => io.observe(el));

const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, eind = +el.dataset.count, suf = el.dataset.suffix || '';
  const duur = reduced ? 0 : 1300, t0 = performance.now();
  const tick = t => {
    const p = duur ? Math.min(1, (t - t0) / duur) : 1;
    el.textContent = Math.round(eind * (1 - Math.pow(1 - p, 3))) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { threshold: .5 });
$$('[data-count]').forEach(el => cio.observe(el));

/* ============================================================
   hoofdstuk-HUD: actief hoofdstuk + nav-link volgen scène
   ============================================================ */
const chapters = $$('.chapters li');
const navLinks = $$('.nav-links a');
const sceneEls = $$('[data-scene]');
const sio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const idx = e.target.dataset.scene;
  chapters.forEach(li => li.classList.toggle('on', li.dataset.scene === idx));
}), { rootMargin: '-45% 0px -50% 0px' });
sceneEls.forEach(s => sio.observe(s));

const sectionEls = $$('main section[id], header[id]');
const nio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) navLinks.forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-40% 0px -55% 0px' });
sectionEls.forEach(s => nio.observe(s));

/* ============================================================
   scroll-voortgang: balk + film-timecode (rAF-throttled)
   ============================================================ */
const bar = $('#progress'), tc = $('#tc');
let busy = false;
const onScroll = () => {
  const h = document.documentElement;
  const max = h.scrollHeight - innerHeight;
  const f = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
  if (bar) bar.style.transform = 'scaleX(' + f + ')';
  if (tc) {
    const sec = Math.round(f * 60);
    tc.textContent = '00:' + String(sec).padStart(2, '0');
    if (sec >= 60) tc.textContent = '01:00';
  }
  busy = false;
};
addEventListener('scroll', () => { if (!busy) { busy = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

/* ============================================================
   hamburger + mobiel overlay-menu
   ============================================================ */
const burger = $('#burger'), overlay = $('#overlay');
if (burger && overlay) {
  burger.addEventListener('click', () => {
    const open = burger.classList.toggle('open');
    overlay.classList.toggle('open', open);
    burger.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
  });
  $$('a', overlay).forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open'); overlay.classList.remove('open');
  }));
}

/* ============================================================
   inzet: segmented switcher
   ============================================================ */
const seg = $('#seg');
if (seg) {
  const knoppen = $$('button', seg);
  const ind = $('.seg-ind', seg);
  const panelen = $$('.inzet-panel');
  const kies = i => {
    knoppen.forEach((b, j) => b.classList.toggle('active', i === j));
    panelen.forEach((p, j) => p.classList.toggle('active', i === j));
    const b = knoppen[i];
    ind.style.width = b.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + (b.offsetLeft - 5) + 'px)';
  };
  knoppen.forEach((b, i) => b.addEventListener('click', () => kies(i)));
  kies(0);
  addEventListener('resize', () => {
    const i = knoppen.findIndex(b => b.classList.contains('active'));
    kies(i < 0 ? 0 : i);
  }, { passive: true });
}

/* ============================================================
   desktop-only: custom cursor, magnetische knoppen, 3D-tilt
   ============================================================ */
if (fine && !reduced) {
  const ring = $('#cring'), dot = $('#cdot');
  if (ring && dot) {
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = null;
    const loop = () => {
      rx += (mx - rx) * .16; ry += (my - ry) * .16;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      if (Math.abs(mx - rx) > .15 || Math.abs(my - ry) > .15) raf = requestAnimationFrame(loop);
      else raf = null;
    };
    addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px)`;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    $$('a,button').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('big'));
      el.addEventListener('mouseleave', () => ring.classList.remove('big'));
    });
    document.body.classList.add('has-cursor');
  }

  $$('.btn,.nav-cta').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .12}px,${(e.clientY - r.top - r.height / 2) * .18}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  $$('.tilt').forEach(shell => {
    const core = $('.core', shell);
    shell.addEventListener('mousemove', e => {
      const r = shell.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      shell.style.setProperty('--ry', ((px - .5) * 6).toFixed(2) + 'deg');
      shell.style.setProperty('--rx', ((.5 - py) * 6).toFixed(2) + 'deg');
      if (core) {
        core.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        core.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      }
    });
    shell.addEventListener('mouseleave', () => {
      shell.style.setProperty('--rx', '0deg'); shell.style.setProperty('--ry', '0deg');
    });
  });
}
})();
