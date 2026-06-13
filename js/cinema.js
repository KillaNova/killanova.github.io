/* ============================================================
   EREN YILMAZ — "DE REIS" / "THE JOURNEY"
   Een scroll-gestuurde korte film op één <canvas>.
   GEEN videobestand: elke frame wordt live getekend.
   Geen libraries, geen externe assets. GPU-vriendelijk.

   De film loopt mee met de scroll-positie (0 → 1):
   de lucht gaat van dageraad → dag → schemering → nacht,
   parallax-bergen schuiven, de zon zakt terwijl de maan rijst,
   en een gestileerde silhouet-Eren loopt met een gloeiende
   laptop door het landschap — hij loopt als je scrollt,
   gaat zitten/typen bij "de werkwijze" en kijkt uit op de top.
   ============================================================ */
(() => {
'use strict';

const canvas = document.getElementById('cinema');
if (!canvas) return;
const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) return;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- helpers ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const TAU = Math.PI * 2;

/* seeded PRNG (mulberry32) — stabiele sterren/stof over resizes heen */
function prng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- viewport ---------- */
let W = 0, H = 0, dpr = 1, horizonY = 0, charH = 0, charX = 0;
let stars = [], dust = [];

function resize() {
  W = innerWidth; H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  horizonY = H * 0.72;
  charH = clamp(H * 0.235, 150, 215);
  charX = W * (W < 720 ? 0.5 : 0.34);

  // sterren (genormaliseerd, schaalt mee)
  const sr = prng(20010427);
  const nStars = Math.round(clamp(W * H / 9000, 60, 220));
  stars = Array.from({ length: nStars }, () => ({
    x: sr(), y: sr() * 0.78, r: 0.4 + sr() * 1.5, ph: sr() * TAU, sp: 0.6 + sr() * 1.8
  }));

  // zwevende "code"-stof / vonken
  const dr = prng(776);
  const nDust = W < 720 ? 22 : 46;
  const glyphs = ['0', '1', '{', '}', ';', '/', '<', '>', '·', '+'];
  dust = Array.from({ length: nDust }, () => ({
    x: dr(), y: dr(), r: 0.6 + dr() * 1.8, sp: 0.2 + dr() * 0.8, ph: dr() * TAU,
    g: glyphs[(dr() * glyphs.length) | 0], gl: dr() > 0.5, drift: 6 + dr() * 22
  }));
}

/* ---------- lucht-paletten (dageraad → nacht) ---------- */
const SKY = [
  { p: 0.00, top: [12, 14, 38],  mid: [60, 38, 88],   bot: [228, 122, 74] },
  { p: 0.20, top: [38, 54, 108], mid: [126, 100, 152], bot: [246, 178, 120] },
  { p: 0.45, top: [44, 100, 168], mid: [126, 168, 214], bot: [210, 228, 238] },
  { p: 0.66, top: [44, 42, 96],  mid: [156, 76, 100],  bot: [242, 140, 70] },
  { p: 0.82, top: [20, 20, 56],  mid: [60, 44, 96],    bot: [150, 82, 98] },
  { p: 1.00, top: [4, 6, 18],    mid: [10, 16, 44],    bot: [22, 28, 60] }
];
function skyAt(p) {
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) {
    if (p >= SKY[i].p && p <= SKY[i + 1].p) { a = SKY[i]; b = SKY[i + 1]; break; }
  }
  const t = smooth(a.p, b.p, p);
  return { top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), bot: mix(a.bot, b.bot, t) };
}

/* ---------- parallax-bergrug (oneindig, deterministisch) ---------- */
const RIDGE = [
  { phase: [1.3, 5.1, 2.7], freq: [0.0016, 0.0041, 0.011], amp: [70, 30, 14], up: 0.30, par: 0.55 },
  { phase: [4.7, 2.2, 0.6], freq: [0.0022, 0.0058, 0.015], amp: [96, 40, 18], up: 0.16, par: 1.25 },
  { phase: [0.9, 3.8, 1.7], freq: [0.0030, 0.0072, 0.020], amp: [40, 22, 12], up: -0.02, par: 2.6 }
];
function ridgeH(L, x) {
  return L.amp[0] * Math.sin(x * L.freq[0] + L.phase[0])
       + L.amp[1] * Math.sin(x * L.freq[1] + L.phase[1])
       + L.amp[2] * Math.sin(x * L.freq[2] + L.phase[2]);
}
/* bovenkant van de voorste laag = de grond waar het personage op staat */
function groundTopY(screenX, p) {
  const L = RIDGE[2];
  const wx = screenX + p * W * L.par + 1000;
  return horizonY + H * L.up + 92 + ridgeH(L, wx) * 0.5;
}

/* ---------- film-status ---------- */
let pTarget = 0, pAnim = 0, walkPhase = 0, walkAmp = 0, dir = 1, t0 = performance.now();

function scrollFraction() {
  const h = document.documentElement;
  const max = h.scrollHeight - innerHeight;
  return max > 0 ? clamp(h.scrollTop / max, 0, 1) : 0;
}

/* ---------- celestial: zon + maan ---------- */
function drawHalo(x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

function drawSun(p) {
  const span = 0.72;
  if (p > span + 0.04) return null;
  const k = clamp(p / span, 0, 1);
  const x = W * (0.14 + 0.74 * k);
  const y = horizonY - Math.sin(k * Math.PI) * (H * 0.52) - 6;
  const a = smooth(0, 0.02, p) * (1 - smooth(0.54, 0.64, p));   // volledig weg bij schemering (geen restgloed)
  if (a <= 0.001) return { x, y };
  const warm = p < 0.33 ? [255, 168, 96] : p < 0.55 ? [255, 226, 168] : [255, 150, 78];
  const R = lerp(54, 40, Math.sin(k * Math.PI));
  drawHalo(x, y, R * 5.2, warm, 0.22 * a);
  ctx.fillStyle = rgba(warm, 0.96 * a);
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  return { x, y, a, warm };
}

function drawMoon(p) {
  const a = smooth(0.6, 0.72, p);
  if (a <= 0.001) return null;
  const k = clamp((p - 0.58) / 0.42, 0, 1);
  const x = W * (0.22 + 0.5 * k);
  const y = horizonY - Math.sin(k * Math.PI * 0.5) * (H * 0.5) - 14;
  const pale = [228, 232, 248];
  const R = 34;
  drawHalo(x, y, R * 4.4, pale, 0.16 * a);
  ctx.fillStyle = rgba(pale, 0.95 * a);
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  // zachte kraters
  ctx.fillStyle = rgba([196, 202, 224], 0.5 * a);
  ctx.beginPath(); ctx.arc(x - 9, y - 6, 6, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8, y + 7, 4.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2, y - 11, 3, 0, TAU); ctx.fill();
  return { x, y, a, pale };
}

/* ---------- sterren + aurora ---------- */
function drawStars(p, time) {
  const nf = smooth(0.5, 0.92, p);
  if (nf <= 0.001) return;
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.ph);
    ctx.fillStyle = `rgba(255,255,255,${(nf * tw * 0.9).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
  }
}
function drawAurora(p, time) {
  const af = smooth(0.78, 0.96, p);
  if (af <= 0.001) return;
  const cols = [[80, 240, 176], [150, 120, 250]];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 2; b++) {
    ctx.beginPath();
    const baseY = horizonY - H * (0.28 + b * 0.1);
    for (let x = 0; x <= W; x += 14) {
      const y = baseY + Math.sin(x * 0.004 + time * 0.4 + b * 2) * 26
                      + Math.sin(x * 0.011 - time * 0.6) * 12;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = 60 - b * 18;
    ctx.strokeStyle = rgba(cols[b], 0.05 * af);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- bergen + grond ---------- */
function drawRidges(p, sky, light) {
  for (let i = 0; i < RIDGE.length; i++) {
    const L = RIDGE[i];
    const depth = i / (RIDGE.length - 1);          // 0 ver, 1 dichtbij
    const baseY = horizonY + H * L.up + (i === 2 ? 92 : 0);
    // atmosferisch perspectief: verre ruggen lichter/luchtkleurig, voorste het donkerst
    let col = mix(sky.bot, [6, 8, 20], 0.5 + depth * 0.42);
    col = mix(col, light, 0.06 * (1 - depth));
    ctx.fillStyle = rgb(col);
    ctx.beginPath();
    ctx.moveTo(-20, H + 20);
    for (let x = -20; x <= W + 20; x += 8) {
      const wx = x + p * W * L.par + 1000;
      const y = baseY + ridgeH(L, wx) * (i === 2 ? 0.5 : 1);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, H + 20);
    ctx.closePath(); ctx.fill();

    // subtiele lichtrand op de bovenkant van elke rug
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 8) {
      const wx = x + p * W * L.par + 1000;
      const y = baseY + ridgeH(L, wx) * (i === 2 ? 0.5 : 1);
      x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(light, 0.05 + 0.05 * (1 - depth));
    ctx.stroke();
  }
}

/* ============================================================
   HET PERSONAGE — gestileerde silhouet-Eren met laptop
   Houding mengt tussen: lopen (φ-cyclus) · zitten/typen · uitkijken
   ============================================================ */
function up(b, len, a) { return { x: b.x + Math.sin(a) * len, y: b.y - Math.cos(a) * len }; }   // omhoog, +a = naar voren
function dn(b, len, a) { return { x: b.x + Math.sin(a) * len, y: b.y + Math.cos(a) * len }; }   // omlaag, +a = naar voren
function vmix(A, B, C, wa, wb, wc) { return { x: A.x * wa + B.x * wb + C.x * wc, y: A.y * wa + B.y * wb + C.y * wc }; }

function poseWeights(p) {
  const sit = smooth(0.6, 0.67, p) * (1 - smooth(0.78, 0.85, p));   // hoofdstuk 04
  const stand = smooth(0.9, 0.97, p);                               // de top
  const walk = clamp(1 - sit - stand, 0, 1);
  const s = walk + sit + stand || 1;
  return { walk: walk / s, sit: sit / s, stand: stand / s };
}

/* drie hand-gemaakte houdingen — elk een complete set gewrichtspunten.
   Door tussen complete (correcte) houdingen te interpoleren kan niets "knopen". */
function poseWalk(cx, S, gY, a, ph) {
  const hip = { x: cx, y: gY - 0.47 * S - Math.sin(ph * 2) * 0.02 * S * a };
  const lean = 0.06 + 0.09 * a;   // rechtop als hij stilstaat, voorover als hij loopt
  const neck = up(hip, 0.36 * S, lean), sh = up(hip, 0.30 * S, lean);
  const headC = up(neck, 0.085 * S, lean * 0.6 + 0.05);
  const thF = a * 0.55 * Math.sin(ph), thB = a * 0.55 * Math.sin(ph + Math.PI);
  const flF = 0.12 + a * 0.9 * clamp(0.3 - Math.sin(ph), 0, 1.4);
  const flB = 0.12 + a * 0.9 * clamp(0.3 - Math.sin(ph + Math.PI), 0, 1.4);
  const kneeF = dn(hip, 0.25 * S, thF), ankF = dn(kneeF, 0.26 * S, thF - flF), toeF = dn(ankF, 0.11 * S, thF - flF + 1.45);
  const kneeB = dn(hip, 0.25 * S, thB), ankB = dn(kneeB, 0.26 * S, thB - flB), toeB = dn(ankB, 0.11 * S, thB - flB + 1.45);
  const sw = a * 0.7 * Math.sin(ph + Math.PI);
  const elbowB = dn(sh, 0.20 * S, sw * 0.7), handB = dn(elbowB, 0.19 * S, sw * 0.9);
  const elbowF = dn(sh, 0.20 * S, 0.42), handF = dn(elbowF, 0.19 * S, 1.2);                 // voorarm draagt de laptop
  const lap = { x: (elbowF.x + handF.x) / 2 + 0.05 * S, y: (elbowF.y + handF.y) / 2 - 0.06 * S };
  return { hip, neck, sh, headC, kneeF, ankF, toeF, kneeB, ankB, toeB, elbowF, handF, elbowB, handB, lap, lapAngle: -0.35, lapGlow: 0.42 };
}
function poseStand(cx, S, gY, time) {
  const hip = { x: cx, y: gY - 0.49 * S - Math.sin(time * 1.4) * 0.008 * S };
  const lean = -0.02;
  const neck = up(hip, 0.36 * S, lean), sh = up(hip, 0.30 * S, lean);
  const headC = up(neck, 0.085 * S, -0.05);
  const kneeF = dn(hip, 0.25 * S, 0.05), ankF = dn(kneeF, 0.26 * S, 0.02), toeF = dn(ankF, 0.11 * S, 1.45);
  const kneeB = dn(hip, 0.25 * S, -0.05), ankB = dn(kneeB, 0.26 * S, -0.02), toeB = dn(ankB, 0.11 * S, 1.35);
  const elbowB = dn(sh, 0.20 * S, -0.12), handB = dn(elbowB, 0.19 * S, -0.16);               // arm ontspannen, licht naar achter
  const elbowF = dn(sh, 0.20 * S, 0.18), handF = dn(elbowF, 0.19 * S, 0.5);                   // laptop ontspannen aan de zij
  const lap = { x: handF.x + 0.05 * S, y: handF.y - 0.02 * S };
  return { hip, neck, sh, headC, kneeF, ankF, toeF, kneeB, ankB, toeB, elbowF, handF, elbowB, handB, lap, lapAngle: -0.16, lapGlow: 0.34 };
}
function poseSit(cx, S, gY) {
  const hip = { x: cx, y: gY - 0.13 * S };                                                  // laag bij de grond
  const lean = 0.24;
  const neck = up(hip, 0.34 * S, lean), sh = up(hip, 0.28 * S, lean);
  const headC = up(neck, 0.085 * S, lean * 0.5 + 0.4);                                       // hoofd gebogen naar het scherm
  const kneeF = dn(hip, 0.25 * S, 1.2), ankF = dn(kneeF, 0.26 * S, -0.02), toeF = dn(ankF, 0.11 * S, 1.3);
  const kneeB = dn(hip, 0.25 * S, 1.05), ankB = dn(kneeB, 0.26 * S, 0.12), toeB = dn(ankB, 0.11 * S, 1.3);
  const elbowF = dn(sh, 0.20 * S, 0.78), handF = dn(elbowF, 0.19 * S, 1.12);                 // beide armen naar het toetsenbord
  const elbowB = dn(sh, 0.20 * S, 0.64), handB = dn(elbowB, 0.19 * S, 1.05);
  const lap = { x: cx + 0.22 * S, y: hip.y - 0.02 * S };
  return { hip, neck, sh, headC, kneeF, ankF, toeF, kneeB, ankB, toeB, elbowF, handF, elbowB, handB, lap, lapAngle: -0.42, lapGlow: 1 };
}

function strokeChain(points, width, style, glow) {
  ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = style;
  if (glow) { ctx.shadowColor = glow.c; ctx.shadowBlur = glow.b; } else { ctx.shadowBlur = 0; }
  ctx.beginPath();
  points.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawCharacter(p, time, light, rimCol) {
  const w = poseWeights(p);
  const S = charH, gY = groundTopY(charX, p);
  const A = poseWalk(charX, S, gY, walkAmp, walkPhase);
  const B = poseStand(charX, S, gY, time);
  const C = poseSit(charX, S, gY);
  const ww = w.walk, ws = w.stand, wi = w.sit;
  const P = {};
  ['hip', 'neck', 'sh', 'headC', 'kneeF', 'ankF', 'toeF', 'kneeB', 'ankB', 'toeB', 'elbowF', 'handF', 'elbowB', 'handB', 'lap']
    .forEach(k => P[k] = vmix(A[k], B[k], C[k], ww, ws, wi));
  const lapAngle = A.lapAngle * ww + B.lapAngle * ws + C.lapAngle * wi;
  const lapGlow = A.lapGlow * ww + B.lapGlow * ws + C.lapGlow * wi;

  const fill = rgb(mix(light, [3, 4, 10], 0.84));
  const dim = rgb(mix(light, [2, 3, 8], 0.9));
  const legW = S * 0.078, armW = S * 0.062, torsoW = S * 0.135, headR = S * 0.088;
  const rim = { c: rimCol, b: S * 0.1 };

  ctx.save();
  if (dir < 0) { ctx.translate(charX, 0); ctx.scale(-1, 1); ctx.translate(-charX, 0); }

  // schaduw op de grond
  const sa = (0.16 + 0.16 * smooth(0.2, 0.5, p)) * (1 - 0.55 * smooth(0.82, 1, p));
  const sg = ctx.createRadialGradient(charX, gY + 3, 2, charX, gY + 3, S * 0.42);
  sg.addColorStop(0, `rgba(0,0,0,${sa.toFixed(3)})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(charX, gY + 3, S * 0.42, S * 0.085, 0, 0, TAU); ctx.fill();

  // achterste ledematen (dimmer → diepte)
  strokeChain([P.hip, P.kneeB, P.ankB, P.toeB], legW, dim);
  strokeChain([P.sh, P.elbowB, P.handB], armW, dim);

  // romp, nek, hoofd
  strokeChain([P.hip, P.neck], torsoW, fill);
  strokeChain([P.neck, P.headC], armW * 0.9, fill);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(P.headC.x, P.headC.y, headR, 0, TAU); ctx.fill();

  // voorste ledematen
  strokeChain([P.hip, P.kneeF, P.ankF, P.toeF], legW, fill);
  strokeChain([P.sh, P.elbowF, P.handF], armW, fill);

  // de gloeiende laptop (vóór het lichaam)
  drawLaptop(P.lap, lapGlow, S, lapAngle);

  // rim-light: gloeiende contour zodat hij oplicht tegen donkere luchten
  ctx.globalAlpha = 0.85;
  strokeChain([P.hip, P.neck], torsoW * 0.3, rgba(rimCol, 0.5), rim);
  strokeChain([P.sh, P.elbowF, P.handF], armW * 0.45, rgba(rimCol, 0.45), rim);
  strokeChain([P.hip, P.kneeF, P.ankF], legW * 0.45, rgba(rimCol, 0.4), rim);
  ctx.beginPath(); ctx.arc(P.headC.x, P.headC.y, headR, 0, TAU);
  ctx.lineWidth = headR * 0.34; ctx.strokeStyle = rgba(rimCol, 0.55);
  ctx.shadowColor = rimCol; ctx.shadowBlur = S * 0.1; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawLaptop(c, glow, S, angle) {
  const w = S * 0.27, base = S * 0.022, sh = S * 0.18;
  if (glow > 0.05) {   // kampvuur-gloed van het scherm
    const r = S * (0.45 + glow * 0.9);
    const g = ctx.createRadialGradient(c.x, c.y - sh * 0.4, 2, c.x, c.y - sh * 0.4, r);
    g.addColorStop(0, `rgba(140,205,255,${(0.24 * glow).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(120,150,255,${(0.09 * glow).toFixed(3)})`);
    g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y - sh * 0.4, r, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = '#0b0d14';
  ctx.beginPath(); ctx.rect(-w / 2, 0, w, base); ctx.fill();             // onderkant
  ctx.rotate(angle);
  ctx.fillStyle = '#0a0c12';
  ctx.beginPath(); ctx.rect(-w / 2, -sh, w, sh); ctx.fill();             // scherm
  const gv = Math.max(glow, 0.45);
  const sg = ctx.createLinearGradient(0, -sh, 0, 0);
  sg.addColorStop(0, `rgba(160,215,255,${(0.9 * gv).toFixed(3)})`);
  sg.addColorStop(1, `rgba(95,150,255,${(0.5 * gv).toFixed(3)})`);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.rect(-w / 2 + 2, -sh + 2, w - 4, sh - 4); ctx.fill();
  ctx.restore();
}

/* ---------- zwevende code-stof ---------- */
function drawDust(p, time) {
  ctx.save();
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  for (const d of dust) {
    const driftX = Math.sin(time * d.sp + d.ph) * d.drift;
    const x = d.x * W + driftX;
    const y = (d.y * H + time * 8 * d.sp) % H;
    const a = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(time * d.sp + d.ph));
    ctx.fillStyle = d.gl ? `rgba(167,139,250,${a})` : `rgba(180,190,210,${a * 0.8})`;
    ctx.fillText(d.g, x, y);
  }
  ctx.restore();
}

/* ============================================================
   RENDER
   ============================================================ */
function render(p, time) {
  const sky = skyAt(p);

  // lucht
  const g = ctx.createLinearGradient(0, 0, 0, horizonY + H * 0.05);
  g.addColorStop(0, rgb(sky.top));
  g.addColorStop(0.55, rgb(sky.mid));
  g.addColorStop(1, rgb(sky.bot));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // hemellichamen + sterren
  drawStars(p, time);
  drawAurora(p, time);
  const sun = drawSun(p);
  const moon = drawMoon(p);

  // lichtbron-kleur (warm overdag → koel 's nachts), rim-kleur voor het personage
  const dayLight = smooth(0.04, 0.2, p) * (1 - smooth(0.62, 0.78, p));
  const light = mix(sky.bot, [255, 210, 150], 0.4 * dayLight);
  let rimCol;
  if (sun && sun.a > 0.15) rimCol = rgb(sun.warm);
  else if (moon) rimCol = rgb([150, 180, 240]);
  else rimCol = rgb([210, 150, 110]);
  // bij "de werkwijze" (zittend typen) wordt de laptop het sleutellicht → warm/claude
  const forge = smooth(0.6, 0.67, p) * (1 - smooth(0.78, 0.85, p));
  if (forge > 0.3) rimCol = rgb(mix([150, 200, 255], [217, 119, 87], 0.4));

  // landschap
  drawRidges(p, sky, light);

  // personage
  drawCharacter(p, time, light, rimCol);

  // voorgrond
  drawDust(p, time);
}

/* ---------- loop ---------- */
let running = false;
function frame() {
  const time = (performance.now() - t0) / 1000;
  const prev = pAnim;
  pAnim += (pTarget - pAnim) * 0.12;
  if (Math.abs(pTarget - pAnim) < 0.0002) pAnim = pTarget;

  const moving = Math.abs(pAnim - prev);
  const isMoving = moving > 0.0003 ? 1 : 0;
  walkAmp += (isMoving - walkAmp) * 0.08;
  if (pAnim - prev > 0.0002) dir = 1; else if (pAnim - prev < -0.0002) dir = -1;
  walkPhase += moving * 230 + walkAmp * 0.06;

  render(pAnim, time);

  // blijf draaien zolang er beweging/animatie is, anders idle-tik laag houden
  if (Math.abs(pTarget - pAnim) > 0.0002 || walkAmp > 0.02 || !document.hidden) {
    requestAnimationFrame(frame);
  } else { running = false; }
}
function ensureRunning() { if (!running) { running = true; requestAnimationFrame(frame); } }

/* ---------- init ---------- */
resize();
addEventListener('resize', () => { resize(); if (reduced) render(pTarget || 0.72, 0); }, { passive: true });

if (reduced) {
  // toegankelijk: één rustig, statisch beeld — geen autonome of scroll-beweging
  walkAmp = 0; dir = 1;
  pTarget = 0.72;
  render(0.72, 0);
} else {
  pTarget = pAnim = scrollFraction();
  addEventListener('scroll', () => { pTarget = scrollFraction(); ensureRunning(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureRunning(); });
  ensureRunning();
}
})();
