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
  charH = clamp(H * 0.2, 124, 196);
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
  const a = smooth(0, 0.02, p) * (1 - smooth(0.62, span, p));
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
function pt(base, len, ang) { return { x: base.x + Math.sin(ang) * len, y: base.y + Math.cos(ang) * len }; }

function poseWeights(p) {
  const sit = smooth(0.6, 0.67, p) * (1 - smooth(0.78, 0.85, p));   // hoofdstuk 04
  const stand = smooth(0.9, 0.97, p);                               // de top
  let walk = clamp(1 - sit - stand, 0, 1);
  const s = walk + sit + stand || 1;
  return { walk: walk / s, sit: sit / s, stand: stand / s };
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
  const S = charH;
  const gY = groundTopY(charX, p);

  // bewegende cyclus
  const a = walkAmp;
  const ph = walkPhase;
  const bob = Math.sin(ph * 2) * 0.018 * S * a + Math.sin(time * 1.4) * 0.006 * S * (w.stand + (1 - a) * w.walk);

  // pelvis-hoogte per houding
  const pelvisY =
      w.walk * (gY - S * 0.50) +
      w.sit  * (gY - S * 0.17) +
      w.stand * (gY - S * 0.52) + bob;
  const pelvis = { x: charX, y: pelvisY };

  // --- gewrichtshoeken per houding, daarna gemengd ---
  // romp / hoofd
  const torso = w.walk * (0.12 + 0.05 * a) + w.sit * 0.20 + w.stand * (-0.04);
  const head  = w.walk * 0.04 + w.sit * 0.34 + w.stand * (-0.05);

  // benen
  const thN_w = a * 0.45 * Math.sin(ph),        thF_w = a * 0.45 * Math.sin(ph + Math.PI);
  const knN_w = a * 0.55 * clamp(Math.sin(ph + 0.6) + 0.35, 0, 1.4);
  const knF_w = a * 0.55 * clamp(Math.sin(ph + Math.PI + 0.6) + 0.35, 0, 1.4);
  const thN = w.walk * thN_w + w.sit * 1.30 + w.stand * 0.03;
  const thF = w.walk * thF_w + w.sit * 1.42 + w.stand * (-0.03);
  const knN = w.walk * knN_w + w.sit * 1.15 + w.stand * 0.05;
  const knF = w.walk * knF_w + w.sit * 1.05 + w.stand * 0.05;

  // armen (near = voorste, draagt/typt; far = achterste, zwaait/kijkt)
  const shN = w.walk * (0.55) + w.sit * 0.95 + w.stand * 0.30;
  const elN = w.walk * (-1.35) + w.sit * (-1.15) + w.stand * (-0.20);
  const shF = w.walk * (-a * 0.42 * Math.sin(ph)) + w.sit * 0.90 + w.stand * (-1.15);
  const elF = w.walk * (-0.45) + w.sit * (-1.05) + w.stand * (-1.25);

  // --- forward kinematics ---
  const neck = pt(pelvis, S * 0.32, torso);
  const headC = pt(neck, S * 0.12 + S * 0.075, head);
  const shoulder = pt(neck, S * 0.05, torso + 0.2);

  const kneeN = pt(pelvis, S * 0.23, thN);
  const ankN = pt(kneeN, S * 0.24, thN - knN);
  const footN = pt(ankN, S * 0.10, thN - knN + 1.3);
  const kneeF = pt(pelvis, S * 0.23, thF);
  const ankF = pt(kneeF, S * 0.24, thF - knF);
  const footF = pt(ankF, S * 0.10, thF - knF + 1.3);

  const elbowN = pt(shoulder, S * 0.20, shN);
  const handN = pt(elbowN, S * 0.18, shN + elN);
  const elbowF = pt(shoulder, S * 0.20, shF);
  const handF = pt(elbowF, S * 0.18, shF + elF);

  // laptop-ankerpunt (gedragen → op schoot → dicht aan de zij)
  const carry = { x: pelvis.x + 0.16 * S, y: pelvis.y - 0.04 * S };
  const lap   = { x: pelvis.x + 0.24 * S, y: pelvis.y + 0.10 * S };
  const sidex = { x: pelvis.x + 0.17 * S, y: pelvis.y + 0.06 * S };
  const lc = {
    x: w.walk * carry.x + w.sit * lap.x + w.stand * sidex.x,
    y: w.walk * carry.y + w.sit * lap.y + w.stand * sidex.y
  };
  const lapGlow = w.sit * 1 + (w.walk + w.stand) * 0.32;

  const fill = rgb(mix(light, [3, 4, 10], 0.86));
  const dim  = rgb(mix(light, [2, 3, 8], 0.92));
  const lw = S * 0.075, lwTorso = S * 0.14;
  const rim = { c: rimCol, b: S * 0.12 };

  ctx.save();
  if (dir < 0) { ctx.translate(charX, 0); ctx.scale(-1, 1); ctx.translate(-charX, 0); }

  // schaduw
  const sa = (0.18 + 0.14 * smooth(0.2, 0.5, p)) * (1 - 0.5 * smooth(0.82, 1, p));
  const sg = ctx.createRadialGradient(charX, gY + 4, 2, charX, gY + 4, S * 0.4);
  sg.addColorStop(0, `rgba(0,0,0,${sa})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(charX, gY + 4, S * 0.4, S * 0.09, 0, 0, TAU); ctx.fill();

  // achterste ledematen (dimmer → diepte)
  strokeChain([pelvis, kneeF, ankF, footF], lw, dim);
  strokeChain([shoulder, elbowF, handF], lw * 0.9, dim);

  // romp + hoofd
  strokeChain([pelvis, neck], lwTorso, fill);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(headC.x, headC.y, S * 0.082, 0, TAU); ctx.fill();

  // voorste ledematen
  strokeChain([shoulder, elbowN, handN], lw * 0.95, fill);
  strokeChain([pelvis, kneeN, ankN, footN], lw, fill);

  // rim-light (gloeiende contour aan de lichtzijde)
  ctx.globalAlpha = 0.9;
  strokeChain([pelvis, neck], lwTorso * 0.34, rgba(rimCol, 0.5), rim);
  strokeChain([shoulder, elbowN, handN], lw * 0.4, rgba(rimCol, 0.45), rim);
  strokeChain([pelvis, kneeN, ankN], lw * 0.4, rgba(rimCol, 0.4), rim);
  ctx.beginPath(); ctx.arc(headC.x, headC.y, S * 0.082, 0, TAU);
  ctx.lineWidth = lw * 0.3; ctx.strokeStyle = rgba(rimCol, 0.5);
  ctx.shadowColor = rimCol; ctx.shadowBlur = S * 0.12; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // de gloeiende laptop
  drawLaptop(lc, lapGlow, S);

  ctx.restore();
}

function drawLaptop(c, glow, S) {
  const w = S * 0.26, h = S * 0.02, sh = S * 0.18;
  // gloed-puddle (kampvuur-effect bij het typen)
  if (glow > 0.05) {
    const g = ctx.createRadialGradient(c.x, c.y - sh * 0.4, 2, c.x, c.y - sh * 0.4, S * (0.5 + glow));
    g.addColorStop(0, `rgba(120,200,255,${(0.22 * glow).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(110,150,255,${(0.08 * glow).toFixed(3)})`);
    g.addColorStop(1, 'rgba(110,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y - sh * 0.4, S * (0.5 + glow), 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(c.x, c.y);
  // onderkant
  ctx.fillStyle = '#0b0d14';
  ctx.beginPath(); ctx.rect(-w / 2, 0, w, h); ctx.fill();
  // scherm (omhoog gekanteld)
  ctx.rotate(-0.32);
  ctx.fillStyle = '#0a0c12';
  ctx.beginPath(); ctx.rect(-w / 2, -sh, w, sh); ctx.fill();
  // schermgloed
  const sg = ctx.createLinearGradient(0, -sh, 0, 0);
  sg.addColorStop(0, `rgba(150,210,255,${(0.85 * Math.max(glow, 0.4)).toFixed(3)})`);
  sg.addColorStop(1, `rgba(90,150,255,${(0.45 * Math.max(glow, 0.4)).toFixed(3)})`);
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
