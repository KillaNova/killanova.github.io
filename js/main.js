/* ============================================================
   EREN YILMAZ — PORTFOLIO v2
   Vanilla JS, geen libraries. Alle effecten respecteren
   prefers-reduced-motion en draaien alleen waar zinvol
   (cursor/tilt alleen op desktop met muis).
   ============================================================ */
(() => {
'use strict';
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine    = matchMedia('(pointer: fine)').matches;
const wait    = ms => new Promise(r => setTimeout(r, ms));

/* hero-stagger triggeren zodra DOM klaar is (script staat op defer) */
document.body.classList.add('loaded');

/* jaartal in footer */
const jaar = $('#jaar');
if (jaar) jaar.textContent = new Date().getFullYear();

/* ---------- scroll-reveal (IntersectionObserver, geen scroll-listener) ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
$$('.reveal').forEach(el => io.observe(el));

/* ---------- tellers (count-up zodra zichtbaar) ---------- */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  cio.unobserve(e.target);
  const el = e.target, eind = +el.dataset.count, suf = el.dataset.suffix || '';
  const duur = reduced ? 0 : 1300, t0 = performance.now();
  const tick = t => {
    const p = duur ? Math.min(1, (t - t0) / duur) : 1;
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eind * ease) + suf;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { threshold: .5 });
$$('[data-count]').forEach(el => cio.observe(el));

/* ---------- actieve nav-link volgt de sectie in beeld ---------- */
const navLinks = $$('.nav-links a');
const sio = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) navLinks.forEach(a =>
    a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-40% 0px -55% 0px' });
$$('main [id]').forEach(s => { if (s.tagName === 'SECTION') sio.observe(s); });

/* ---------- hamburger-morph + overlay ---------- */
const burger = $('#burger'), overlay = $('#overlay');
if (burger && overlay) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  $$('a', overlay).forEach(a => a.addEventListener('click', () => {
    burger.classList.remove('open');
    overlay.classList.remove('open');
  }));
}

/* ---------- scroll-progressbalk (rAF-throttled, alleen transform) ---------- */
const bar = $('#progress');
if (bar) {
  let busy = false;
  const zet = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ')';
    busy = false;
  };
  addEventListener('scroll', () => {
    if (!busy) { busy = true; requestAnimationFrame(zet); }
  }, { passive: true });
  zet();
}

/* ---------- typewriter in de hero ---------- */
const tEl = $('#typewoord');
if (tEl) {
  const rollen = ['Python-developer', 'PxPlus / legacy-developer', 'API- & automatiseringsbouwer', 'AI-native developer'];
  if (reduced) { tEl.textContent = rollen[rollen.length - 1]; }
  else {
    /* typt 2 volledige rondes en blijft dan staan op de laatste rol (geen eeuwige timer-lus) */
    let ri = 0, ci = 0, del = false, rondes = 0;
    const stap = () => {
      const w = rollen[ri];
      ci += del ? -1 : 1;
      tEl.textContent = w.slice(0, ci);
      let pauze = del ? 36 : 72;
      if (!del && ci === w.length) {
        if (rondes >= 2 && ri === rollen.length - 1) return; /* klaar: laat staan */
        pauze = 1700; del = true;
      } else if (del && ci === 0) {
        del = false; ri = (ri + 1) % rollen.length;
        if (ri === 0) rondes++;
        pauze = 380;
      }
      setTimeout(stap, pauze);
    };
    setTimeout(stap, 900);
  }
}

/* ---------- terminal: typt zichzelf zodra hij in beeld komt ---------- */
const term = $('#termbody');
if (term) {
  const REGELS = [
    ['cmd', 'whoami'],
    ['out', 'eren-yilmaz · junior developer · nijmegen'],
    ['cmd', 'eren --stack'],
    ['out', 'python · fastapi · postgresql · sqlite'],
    ['out', 'pxplus · providex · nomads  (legacy)'],
    ['out', 'claude code · ai-native workflow'],
    ['cmd', 'eren --beschikbaar'],
    ['ok',  'freelance [ok]  remote [ok]  on-site [ok]'],
    ['cmd', 'eren --hire'],
    ['ok',  '-> linkedin · github · mail']
  ];
  const caret = document.createElement('span');
  caret.className = 'caret';
  const run = async () => {
    for (const [soort, tekst] of REGELS) {
      const r = document.createElement('div');
      r.className = 'tl-' + soort;
      term.appendChild(r);
      if (soort === 'cmd' && !reduced) {
        for (let i = 0; i <= tekst.length; i++) {
          r.textContent = '$ ' + tekst.slice(0, i);
          r.appendChild(caret);
          await wait(34);
        }
        await wait(280);
      } else {
        r.textContent = (soort === 'cmd' ? '$ ' : '') + tekst;
        await wait(reduced ? 0 : 130);
      }
    }
    term.appendChild(caret);
  };
  const tio = new IntersectionObserver(es => {
    if (es[0].isIntersecting) { tio.disconnect(); run(); }
  }, { threshold: .4 });
  tio.observe(term);
}

/* ---------- inzet: segmented switcher ---------- */
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

/* ---------- desktop-only: custom cursor, magnetische knoppen, tilt ---------- */
if (fine && !reduced) {

  /* cursor: dot volgt direct, ring zweeft erachteraan (lerp) */
  const ring = $('#cring'), dot = $('#cdot');
  if (ring && dot) {
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = null;
    /* lus draait alleen zolang de ring onderweg is — stopt vanzelf (geen eeuwige rAF) */
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

  /* magnetische knoppen: trekken licht naar de cursor toe */
  $$('.btn,.nav-cta').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - r.left - r.width / 2;
      const dy = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${dx * .12}px,${dy * .18}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });

  /* 3D-tilt + spotlight op projectkaarten */
  $$('.tilt').forEach(shell => {
    const core = $('.core', shell);
    shell.addEventListener('mousemove', e => {
      const r = shell.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      shell.style.setProperty('--ry', ((px - .5) * 6).toFixed(2) + 'deg');
      shell.style.setProperty('--rx', ((.5 - py) * 6).toFixed(2) + 'deg');
      if (core) {
        core.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        core.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      }
    });
    shell.addEventListener('mouseleave', () => {
      shell.style.setProperty('--rx', '0deg');
      shell.style.setProperty('--ry', '0deg');
    });
  });
}
})();
