'use strict';
// Garden vs Birthday Boys — a lane-defense game. Pure canvas + WebAudio, no dependencies.

// ---------- layout (logical pixels; the canvas is scaled to fit the screen) ----------
const W = 960, H = 560;
const LAWN_X = 120, LAWN_Y = 96, COLS = 9, ROWS = 5, CW = 88, RH = 92;
const BAR_H = 90;
const SUN_BOX = { x: 8, y: 8, w: 80, h: 76 };
const CARD = { x: 96, y: 8, w: 62, h: 76, gap: 5 };
const PROG = { x: 712, y: 30, w: 180 };
const PAUSE_BTN = { x: W - 48, y: 6, w: 42, h: 24 };
const SPEED_BTN = { x: W - 48, y: 33, w: 42, h: 24 };
const MUTE_BTN = { x: W - 48, y: 60, w: 42, h: 24 };
const FONT = 'Trebuchet MS, sans-serif';

// ---------- content ----------
const PLANTS = {
  daisy:   { name: 'Sun Daisy',  cost: 50,  recharge: 7.5, hp: 300,  desc: 'Makes extra sun. Plant lots early!' },
  shooter: { name: 'Pea Pod',    cost: 100, recharge: 7.5, hp: 300,  desc: 'Shoots peas down its row.' },
  melon:   { name: 'Wall Melon', cost: 50,  recharge: 30,  hp: 4000, desc: 'Very tough to chew. Blocks the way.' },
  boom:    { name: 'Boom Berry', cost: 150, recharge: 45,  hp: 1e9,  desc: 'Explodes, popping everyone close by.', noEat: true, startCool: 15 },
  frost:   { name: 'Frost Pod',  cost: 175, recharge: 7.5, hp: 300,  desc: 'Icy peas slow boys to half speed.' },
  thorn:   { name: 'Thorn Mat',  cost: 100, recharge: 7.5, hp: 1e9,  desc: 'Pokes anyone who walks over it. Ignores armor.', noEat: true, ground: true },
  twin:    { name: 'Twin Pod',   cost: 200, recharge: 7.5, hp: 300,  desc: 'Fires two peas at a time.' },
  pepper:  { name: 'Hot Pepper', cost: 125, recharge: 45,  hp: 1e9,  desc: 'Burns everyone in its whole row.', noEat: true, startCool: 15 },
};
const ALL_PLANTS = ['daisy', 'shooter', 'twin', 'frost', 'melon', 'thorn', 'boom', 'pepper'];

const BOYS = {
  basic:  { hp: 200,  armor: 0,    speed: [14, 18], cost: 1, weight: 4,   from: 1 },
  hat:    { hp: 200,  armor: 370,  speed: [14, 18], cost: 2, weight: 3,   from: 2 },
  runner: { hp: 180,  armor: 0,    speed: [30, 36], cost: 2, weight: 2,   from: 3, name: 'Sugar Rush', desc: 'way too much cake — he runs!' },
  pogo:   { hp: 340,  armor: 0,    speed: [26, 30], cost: 3, weight: 1.6, from: 3, name: 'Pogo Kid', desc: 'hops right over the first plant he meets.' },
  gift:   { hp: 200,  armor: 1100, speed: [13, 16], cost: 4, weight: 1.4, from: 4, name: 'Gift Box', desc: 'a sturdy present protects his head.' },
  king:   { hp: 4000, armor: 0,    speed: [7, 8],   cost: 0, weight: 0,   from: 99, boss: true, scale: 1.7, name: 'The Birthday King', desc: 'huge, slow, and smashes plants flat.' },
};

const LEVELS = [
  { name: 'Morning Party', plants: ['daisy', 'shooter', 'melon'], boys: ['basic', 'hat'],
    waves: 6, big: [6], diff: 0.8, firstWave: 26, tutorial: true, icon: 'daisy' },
  { name: 'Hats On!', plants: ['daisy', 'shooter', 'melon', 'boom'], boys: ['basic', 'hat', 'runner'],
    waves: 8, big: [4, 8], diff: 0.95, newPlants: ['boom'], newBoys: ['runner'], icon: 'boom' },
  { name: 'Gift Rush', plants: ['daisy', 'shooter', 'frost', 'melon', 'thorn', 'boom'], boys: ['basic', 'hat', 'runner', 'gift'],
    waves: 10, big: [5, 10], diff: 1.0, newPlants: ['frost', 'thorn'], newBoys: ['gift'], icon: 'frost' },
  { name: 'Sunset Bounce', plants: ['daisy', 'shooter', 'twin', 'frost', 'melon', 'thorn', 'boom'], boys: ['basic', 'hat', 'runner', 'gift', 'pogo'],
    waves: 12, big: [6, 12], diff: 1.1, newPlants: ['twin'], newBoys: ['pogo'], sky: 'sunset', icon: 'twin' },
  { name: 'The Birthday King', plants: ALL_PLANTS, boys: ['basic', 'hat', 'runner', 'gift', 'pogo'],
    waves: 14, big: [7, 14], diff: 1.2, newPlants: ['pepper'], newBoys: ['king'], sky: 'night', boss: true, icon: 'pepper' },
];
const ENDLESS = { name: 'Endless Party', endless: true, plants: ALL_PLANTS, boys: ['basic', 'hat', 'runner', 'gift', 'pogo'],
  waves: Infinity, diff: 1.1, firstWave: 20, icon: 'melon' };

// ---------- save data ----------
const SAVE_KEY = 'gvbb-save-v1';
const progress = { stars: LEVELS.map(() => 0), best: 0, muted: false };
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) Object.assign(progress, JSON.parse(raw)); } catch (e) { /* private mode */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ } }
const levelUnlocked = i => i === 0 || progress.stars[i - 1] > 0;
const endlessUnlocked = () => progress.stars[2] > 0;

// ---------- assets ----------
const heads = [1, 2, 3, 4].map(i => { const im = new Image(); im.src = `assets/head${i}.png`; return im; });

// ---------- canvas & scaling ----------
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
let scale = 1;
function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  canvas.width = Math.round(W * s * dpr);
  canvas.height = Math.round(H * s * dpr);
  scale = s * dpr;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = n => Math.floor(Math.random() * n);
const pick = arr => arr[randInt(arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const tileCX = c => LAWN_X + c * CW + CW / 2;
const rowBase = r => LAWN_Y + r * RH + RH - 12;
function cardRect(i) { return { x: CARD.x + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h }; }
function tileAt(x, y) {
  const c = Math.floor((x - LAWN_X) / CW), r = Math.floor((y - LAWN_Y) / RH);
  return (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? { c, r } : null;
}
function weightedPick(items, wOf) {
  let total = 0; for (const it of items) total += wOf(it);
  let r = Math.random() * total;
  for (const it of items) { r -= wOf(it); if (r <= 0) return it; }
  return items[items.length - 1];
}
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function ellipse(x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.abs(r), 0, Math.PI * 2); }
function wrapText(text, maxW) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- audio (tiny WebAudio synth) ----------
let AC = null, master = null, musicBus = null, noiseBuf = null, muted = !!progress.muted;
function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(AC.destination);
      musicBus = AC.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
      const len = Math.floor(AC.sampleRate * 0.05); noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function setMuted(m) {
  muted = m; progress.muted = m; persist();
  if (master) master.gain.value = m ? 0 : 1;
}
function tone(freq, dur, type = 'square', vol = 0.06, slideTo = 0, delay = 0, bus = null) {
  if (!AC || muted) return;
  const t0 = AC.currentTime + Math.max(0, delay);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus || master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.2, delay = 0, bus = null) {
  if (!AC || muted) return;
  const len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = vol;
  s.buffer = buf; s.connect(g).connect(bus || master); s.start(AC.currentTime + delay);
}
function hat(delay, vol) {
  if (!AC || muted || !noiseBuf) return;
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
  s.buffer = noiseBuf; s.connect(f).connect(g).connect(musicBus); s.start(AC.currentTime + delay);
}
const sfx = {
  shoot: () => tone(520, 0.07, 'square', 0.025, 300),
  hit: () => tone(180, 0.06, 'triangle', 0.07, 90),
  plant: () => { tone(300, 0.08, 'sine', 0.12, 500); },
  sun: () => { tone(880, 0.08, 'sine', 0.08); tone(1320, 0.12, 'sine', 0.06, 0, 0.06); },
  chomp: () => tone(110, 0.08, 'sawtooth', 0.04, 70),
  boom: () => { noise(0.7, 0.35); tone(120, 0.5, 'sine', 0.2, 40); },
  fire: () => { noise(0.9, 0.25); tone(200, 0.8, 'sawtooth', 0.06, 60); },
  armorOff: () => tone(700, 0.15, 'triangle', 0.06, 200),
  pop: () => { tone(500, 0.09, 'triangle', 0.07, 1400); noise(0.08, 0.08); },
  poke: () => tone(900, 0.04, 'square', 0.02, 600),
  boing: () => tone(220, 0.35, 'sine', 0.1, 660),
  stomp: () => { noise(0.4, 0.3); tone(70, 0.4, 'sine', 0.25, 35); },
  cart: () => tone(90, 0.8, 'sawtooth', 0.05, 160),
  deny: () => tone(150, 0.12, 'square', 0.04),
  click: () => tone(660, 0.04, 'square', 0.03),
  wave: () => { tone(392, 0.15, 'square', 0.05); tone(523, 0.25, 'square', 0.05, 0, 0.15); },
  boss: () => { [196, 185, 175, 165].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.07, 0, i * 0.3)); },
  birthday() {
    // "Happy Birthday" (public domain melody)
    const n = { G: 392, A: 440, B: 494, C: 523, D: 587, E: 659, F: 698, G5: 784 };
    const seq = [['G', .3], ['G', .15], ['A', .45], ['G', .45], ['C', .45], ['B', .9],
                 ['G', .3], ['G', .15], ['A', .45], ['G', .45], ['D', .45], ['C', .9]];
    let t = 0; for (const [k, d] of seq) { tone(n[k], d * 0.95, 'triangle', 0.09, 0, t); t += d; }
  },
  lose: () => { tone(400, 0.3, 'sawtooth', 0.06, 300); tone(300, 0.3, 'sawtooth', 0.06, 200, 0.3); tone(200, 0.6, 'sawtooth', 0.06, 90, 0.6); },
};

// Background music: an original bouncy loop over I–vi–IV–V, scheduled ahead of time.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const MELODY = [
  76, 0, 79, 0, 76, 74, 72, 0,   72, 0, 76, 0, 69, 0, 0, 0,   69, 0, 72, 0, 77, 76, 74, 0,   74, 0, 71, 0, 67, 0, 74, 0,
  79, 0, 76, 0, 72, 0, 76, 79,   81, 0, 79, 0, 76, 0, 72, 0,  77, 0, 81, 0, 77, 76, 74, 72,  71, 0, 74, 0, 79, 0, 0, 0,
];
const CHORDS = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]];
const Music = {
  next: 0, step: 0,
  reset() { this.step = 0; this.next = AC ? AC.currentTime + 0.15 : 0; },
  tick(fast) {
    if (!AC || muted) { if (AC) this.next = AC.currentTime + 0.1; return; }
    const stepDur = fast ? 0.15 : 0.19;
    if (this.next < AC.currentTime) this.next = AC.currentTime + 0.05;
    while (this.next < AC.currentTime + 0.25) {
      const s = this.step % 64, delay = this.next - AC.currentTime;
      const ch = CHORDS[Math.floor(s / 8) % 4], inBar = s % 8;
      if (inBar === 0) tone(midi(ch[0]), stepDur * 3.5, 'triangle', 0.13, 0, delay, musicBus);
      if (inBar === 4) tone(midi(ch[0] + 12), stepDur * 1.8, 'triangle', 0.1, 0, delay, musicBus);
      if (inBar % 2 === 1) tone(midi(ch[1 + (inBar >> 1) % 3] + 12), stepDur * 0.9, 'square', 0.012, 0, delay, musicBus);
      if (MELODY[s]) tone(midi(MELODY[s]), stepDur * 1.6, 'square', 0.022, 0, delay, musicBus);
      if (inBar % 2 === 0) hat(delay, inBar % 4 === 0 ? 0.05 : 0.025);
      this.step++; this.next += stepDur;
    }
  },
};

// ---------- game state ----------
let S = null;
let running = false, paused = false, endShown = false;

function newGame(levelIdx) {
  const L = levelIdx === 'endless' ? ENDLESS : LEVELS[levelIdx];
  const cards = L.plants;
  const shovelX = CARD.x + cards.length * (CARD.w + CARD.gap) + 4;
  S = {
    L, levelIdx, t: 0, sun: 150,
    cards, shovelRect: { x: shovelX, y: 8, w: 54, h: 76 },
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    boys: [], peas: [], suns: [], fx: [], parts: [], texts: [],
    carts: Array.from({ length: ROWS }, (_, r) => ({ r, x: LAWN_X - 36, state: 'ready' })),
    selected: null, selT: 9, shovel: false, drag: null, hover: null,
    cool: Object.fromEntries(cards.map(k => [k, PLANTS[k].startCool || 0])),
    skyTimer: 5, wave: 0, waveTimer: L.firstWave || 20, banner: null,
    over: false, won: false, endTimer: 0, shake: 0, speed: 1, sunPulse: 0,
    stats: { kills: 0, sun: 0, planted: {}, lost: 0 },
    tips: buildTips(L),
  };
  showBanner(L.endless ? 'Endless Party!' : `Party ${levelIdx + 1}: ${L.name}`);
  Music.reset();
}

function buildTips(L) {
  const planted = (s, k) => s.stats.planted[k] || 0;
  if (L.tutorial) return [
    { text: 'Tap the Sun Daisy card, then tap the lawn to plant it.', card: 'daisy', when: s => s.t > 2.8, done: s => planted(s, 'daisy') > 0 },
    { text: 'Tap the falling suns to collect them. Daisies make sun too!', done: s => s.stats.sun > 0, dur: 14 },
    { text: 'Plant a Pea Pod — it shoots birthday boys in its row.', card: 'shooter', when: s => s.sun >= 100, done: s => planted(s, 'shooter') > 0 },
    { text: 'More Sun Daisies = more sun. A full column of them is a great start.', dur: 7, when: s => s.t > 30 },
    { text: 'Wall Melons are cheap and tough: put them in front to protect your pods.', card: 'melon', dur: 7, when: s => s.wave >= 2 },
    { text: 'If a boy reaches the end of a row, a garden cart clears it — but only once!', dur: 7, when: s => s.wave >= 3 },
  ];
  const tips = [];
  for (const k of L.newPlants || []) tips.push({ text: `New plant: ${PLANTS[k].name} — ${PLANTS[k].desc}`, card: k, dur: 6.5, when: s => s.t > 2.8 });
  for (const k of L.newBoys || []) tips.push({ text: `Watch out for ${BOYS[k].name}: ${BOYS[k].desc}`, dur: 6, when: s => s.t > 12 });
  if (L.endless) tips.push({ text: 'How many waves can you survive? Every 10th wave brings the Birthday King.', dur: 7, when: s => s.t > 2.8 });
  return tips;
}

// ---------- spawning ----------
function spawnBoy(type, row = randInt(ROWS), xOff = 0) {
  const d = BOYS[type];
  let hpMul = 1;
  if (S.L.endless) {
    if (d.boss) hpMul = 1 + (S.wave / 10 - 1) * 0.5;
    else if (S.wave > 15) hpMul = 1 + (S.wave - 15) * 0.04;
  }
  S.boys.push({
    type, def: d, row, x: W + 30 + xOff, hp: d.hp * hpMul, maxHp: d.hp * hpMul, armor: d.armor, armorMax: d.armor,
    speed: rand(d.speed[0], d.speed[1]), head: pick(heads), phase: Math.random() * 6, sc: d.scale || 1,
    slow: 0, flash: 0, eating: false, chompT: 0, dead: false, deathT: 0,
    jumpT: -1, jumped: false, smashT: 0,
  });
}

const isBig = w => S.L.endless ? w % 5 === 0 : S.L.big.includes(w);

function spawnWave() {
  S.wave++;
  const L = S.L, w = S.wave, big = isBig(w), final = !L.endless && w === L.waves;
  let budget = w === 1 ? 1 : Math.ceil(w * 0.9 * L.diff + (L.endless ? w * w * 0.025 : 0)) + (big ? (final ? 10 : 5) : 0);
  const spread = big ? 380 : 160;
  const pool = L.boys.filter(t => w >= BOYS[t].from);
  let n = 0;
  while (budget > 0 && n++ < 80) {
    const opts = pool.filter(t => BOYS[t].cost <= budget);
    const type = weightedPick(opts, t => BOYS[t].weight);
    budget -= BOYS[type].cost;
    spawnBoy(type, randInt(ROWS), rand(0, spread));
  }
  const king = (L.boss && final) || (L.endless && w % 10 === 0);
  if (king) { spawnBoy('king', 1 + randInt(3), spread * 0.5 + 60); showBanner('The Birthday King approaches!'); sfx.boss(); }
  else if (w === 1) showBanner('Here they come!');
  else if (final) showBanner('FINAL WAVE!');
  else if (big) showBanner('A huge wave is approaching!');
  if (!king && (big || w === 1)) sfx.wave();
  S.waveTimer = Math.max(L.endless ? 9 : 11, 19 - w * 0.6);
}

function showBanner(text) { S.banner = { text, t: 0 }; }

function spawnSun(x, y, ty, value, sky) {
  S.suns.push({ x, y, ty, value, sky, vy: sky ? 42 : -170, vx: sky ? 0 : rand(-30, 30), life: 9, collecting: false, rot: Math.random() * 6 });
}

const CONFETTI = ['#ff4f8b', '#ffd23f', '#3aa0ff', '#7ed957', '#b06cff', '#ff8a3a'];
function confetti(x, y, n = 22, power = 1) {
  for (let i = 0; i < n && S.parts.length < 500; i++) {
    const a = rand(-Math.PI, 0), v = rand(120, 320) * power;
    S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: rand(0, 6), vr: rand(-12, 12),
      color: pick(CONFETTI), w: rand(4, 8), h: rand(3, 5), t: 0, life: rand(0.9, 1.5) });
  }
}
function floatText(x, y, text, color = '#fff7b0') { S.texts.push({ x, y, text, color, t: 0 }); }
function shake(a) { S.shake = Math.max(S.shake, a); }

// ---------- damage ----------
function damageBoy(b, d, pierce = false) {
  if (b.dead) return;
  b.flash = 0.1;
  if (b.armor > 0 && !pierce) {
    b.armor -= d;
    if (b.armor <= 0) {
      d = -b.armor; b.armor = 0;
      const hy = rowBase(b.row) - 110;
      S.fx.push({ kind: 'armor', type: b.type, x: b.x, y: hy, vx: rand(30, 70), vy: -160, rot: 0, t: 0 });
      sfx.armorOff();
    } else return;
  }
  b.hp -= d;
  if (b.hp <= 0) {
    b.dead = true; b.deathT = 0; S.stats.kills++;
    const hy = rowBase(b.row) - 90 * b.sc;
    if (b.def.boss) {
      confetti(b.x, hy, 160, 1.6); shake(12); sfx.boom(); showBanner('The King is down!');
      for (let i = 0; i < 4; i++) spawnSun(b.x + rand(-40, 40), hy, rowBase(b.row) - rand(0, 30), 25, false);
    } else { confetti(b.x, hy); sfx.pop(); }
  }
}

// ---------- update ----------
function update(dt) {
  const L = S.L;
  S.t += dt; S.selT += dt;
  S.shake = Math.max(0, S.shake - dt * 30);
  S.sunPulse = Math.max(0, S.sunPulse - dt);
  for (const k in S.cool) S.cool[k] = Math.max(0, S.cool[k] - dt);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > 2.6) S.banner = null; }
  updateTips(dt);

  // sky sun
  S.skyTimer -= dt;
  if (S.skyTimer <= 0 && !S.over) {
    S.skyTimer = L.sky === 'night' ? rand(11, 15) : rand(8, 12);
    spawnSun(rand(LAWN_X + 30, LAWN_X + COLS * CW - 30), BAR_H - 20, rand(LAWN_Y + 50, H - 50), 25, true);
  }

  // waves
  if (!S.over && S.wave < L.waves) {
    S.waveTimer -= dt;
    const alive = S.boys.some(b => !b.dead);
    if (S.wave > 0 && !alive) S.waveTimer = Math.min(S.waveTimer, 2.5);
    if (S.waveTimer <= 0) spawnWave();
  }

  // plants
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = S.grid[r][c]; if (!p) continue;
    const cx = tileCX(c), by = rowBase(r);
    p.age += dt; p.hurt = Math.max(0, p.hurt - dt);
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 6);
    if (p.type === 'daisy') {
      p.timer -= dt;
      if (p.timer <= 0) { p.timer = 22; spawnSun(cx + 10, by - 50, by - 10, 25, false); p.glow = 0.6; }
      p.glow = Math.max(0, (p.glow || 0) - dt);
    } else if (p.type === 'shooter' || p.type === 'frost' || p.type === 'twin') {
      p.timer -= dt;
      if (p.timer <= 0) {
        const target = S.boys.some(b => !b.dead && b.row === r && b.x > cx - 10 && b.x < W - 10);
        if (target) {
          p.timer = 1.4; p.recoil = 1;
          S.peas.push({ r, x: cx + 30, y: by - 46, frost: p.type === 'frost' });
          if (p.type === 'twin') p.burst = 0.16;
          sfx.shoot();
        } else p.timer = 0.1;
      }
      if (p.burst > 0) {
        p.burst -= dt;
        if (p.burst <= 0) { p.burst = 0; p.recoil = 1; S.peas.push({ r, x: cx + 30, y: by - 46, frost: false }); sfx.shoot(); }
      }
    } else if (p.type === 'thorn') {
      p.timer -= dt;
      if (p.timer <= 0) {
        let any = false;
        for (const b of S.boys) {
          if (!b.dead && b.row === r && b.jumpT < 0 && Math.abs(b.x - cx) < CW * 0.55) { damageBoy(b, 20, true); any = true; }
        }
        p.timer = any ? 0.75 : 0.1;
        if (any) { p.recoil = 1; sfx.poke(); }
      }
    } else if (p.type === 'boom') {
      p.timer -= dt;
      if (p.timer <= 0) {
        for (const b of S.boys) {
          if (!b.dead && Math.abs(b.row - r) <= 1 && Math.abs(b.x - cx) < CW * 1.5) { damageBoy(b, 1800, true); b.armor = 0; b.burnt = true; }
        }
        S.fx.push({ kind: 'boom', x: cx, y: by - 30, t: 0 });
        S.grid[r][c] = null; sfx.boom(); shake(9);
        continue;
      }
    } else if (p.type === 'pepper') {
      p.timer -= dt;
      if (p.timer <= 0) {
        for (const b of S.boys) if (!b.dead && b.row === r && b.x < W + 10) { damageBoy(b, 1800, true); b.armor = 0; b.burnt = true; }
        S.fx.push({ kind: 'fire', r, t: 0 });
        S.grid[r][c] = null; sfx.fire(); shake(7);
        continue;
      }
    }
    if (p.hp <= 0) { S.grid[r][c] = null; S.stats.lost++; }
  }

  // peas
  for (const pea of S.peas) {
    pea.x += 320 * dt;
    let hit = null;
    for (const b of S.boys) {
      if (b.dead || b.row !== pea.r || b.x > W - 5) continue;
      if (Math.abs(b.x - pea.x) < 22 * b.sc && (!hit || b.x < hit.x)) hit = b;
    }
    if (hit) {
      damageBoy(hit, 20);
      if (pea.frost) hit.slow = 4;
      pea.dead = true; sfx.hit();
      S.fx.push({ kind: 'splat', x: pea.x, y: pea.y, frost: pea.frost, t: 0 });
    }
    if (pea.x > W + 20) pea.dead = true;
  }
  S.peas = S.peas.filter(p => !p.dead);

  // boys
  for (const b of S.boys) {
    b.flash = Math.max(0, b.flash - dt);
    if (b.dead) { b.deathT += dt; continue; }
    b.slow = Math.max(0, b.slow - dt);
    const k = b.slow > 0 ? 0.5 : 1;
    if (b.jumpT >= 0) {
      // pogo leap over a plant
      const dur = 0.8;
      b.jumpT += dt;
      b.x -= (CW * 1.3 / dur) * dt;
      if (b.jumpT >= dur) {
        b.jumpT = -1; b.jumped = true; b.speed = rand(14, 17);
        S.fx.push({ kind: 'dust', x: b.x, y: rowBase(b.row), t: 0 });
        S.fx.push({ kind: 'pogo', x: b.x + 10, y: rowBase(b.row) - 30, vx: rand(40, 80), vy: -200, rot: 0, t: 0 });
      }
    } else {
      const reach = b.def.boss ? 46 : 24;
      const c = Math.floor((b.x - reach - LAWN_X) / CW);
      const p = (c >= 0 && c < COLS) ? S.grid[b.row][c] : null;
      let victim = null;
      if (p) victim = b.def.boss ? (p.type === 'boom' || p.type === 'pepper' ? null : p) : (PLANTS[p.type].noEat ? null : p);
      if (victim && b.type === 'pogo' && !b.jumped) {
        b.jumpT = 0; b.eating = false; sfx.boing();
      } else if (victim && b.def.boss) {
        b.eating = true;
        b.smashT += dt * k;
        if (b.smashT >= 1.1) {
          b.smashT = 0; S.grid[b.row][c] = null; S.stats.lost++;
          S.fx.push({ kind: 'dust', x: tileCX(c), y: rowBase(b.row), t: 0 });
          shake(8); sfx.stomp();
        }
      } else if (victim) {
        b.eating = true;
        victim.hp -= 100 * k * dt; victim.hurt = 0.1;
        b.chompT -= dt;
        if (b.chompT <= 0) { b.chompT = 0.5; sfx.chomp(); }
      } else {
        b.eating = false; b.smashT = 0;
        const sp = b.def.boss && b.hp < b.maxHp / 2 ? b.speed * 1.5 : b.speed;
        b.x -= sp * k * dt;
        b.phase += dt * sp * 0.32 * k;
      }
    }
    // garden cart defence
    const cart = S.carts[b.row];
    if (cart.state === 'ready' && b.x < LAWN_X - 10) { cart.state = 'go'; sfx.cart(); }
    if (b.x < 28 && !S.over) lose();
  }
  S.boys = S.boys.filter(b => !(b.dead && b.deathT > 1.1));

  // carts
  for (const cart of S.carts) {
    if (cart.state !== 'go') continue;
    cart.x += 440 * dt;
    for (const b of S.boys) {
      if (b.dead || b.row !== cart.r || b.x < cart.x - 30 || b.x > cart.x + 40 * b.sc) continue;
      if (b.def.boss) {
        // the King stops the cart, but it hurts
        damageBoy(b, 1500, true); cart.state = 'used';
        S.fx.push({ kind: 'boom', x: cart.x, y: rowBase(cart.r) - 20, t: 0.3 }); sfx.boom(); shake(8);
        break;
      }
      b.armor = 0; damageBoy(b, 9999);
    }
    if (cart.x > W + 60) cart.state = 'used';
  }

  // suns
  for (const s of S.suns) {
    s.rot += dt;
    if (s.collecting) {
      const tx = SUN_BOX.x + SUN_BOX.w / 2, ty = SUN_BOX.y + 28, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
      const step = Math.max(600, d * 6) * dt;
      if (d <= step) { s.dead = true; S.sun += s.value; S.stats.sun += s.value; }
      else { s.x += dx / d * step; s.y += dy / d * step; }
      continue;
    }
    if (s.sky) { if (s.y < s.ty) s.y += s.vy * dt; else s.life -= dt; }
    else {
      if (s.y < s.ty || s.vy < 0) { s.vy += 420 * dt; s.y += s.vy * dt; s.x += s.vx * dt; if (s.y >= s.ty && s.vy > 0) { s.y = s.ty; s.vy = 0; } }
      else s.life -= dt;
    }
    if (s.life <= 0) s.dead = true;
  }
  S.suns = S.suns.filter(s => !s.dead);

  // fx, particles, floating text
  for (const f of S.fx) {
    f.t += dt;
    if (f.kind === 'armor' || f.kind === 'pogo') { f.vy += 600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 5; }
  }
  const FX_LIFE = { boom: 0.7, splat: 0.2, fire: 0.9, dust: 1.2, armor: 1.2, pogo: 1.2 };
  S.fx = S.fx.filter(f => f.t < FX_LIFE[f.kind]);
  for (const p of S.parts) {
    p.t += dt; p.vy += 520 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  S.parts = S.parts.filter(p => p.t < p.life);
  for (const tx of S.texts) tx.t += dt;
  S.texts = S.texts.filter(tx => tx.t < 1);

  // win
  if (!S.over && !L.endless && S.wave >= L.waves && S.boys.length === 0) {
    S.over = true; S.won = true; S.endTimer = 0; sfx.birthday();
    showBanner('Party saved!');
    for (let i = 0; i < 6; i++) confetti(rand(200, 800), rand(150, 300), 30, 1.3);
  }
  if (S.over) {
    S.endTimer += dt;
    if (S.endTimer > 2.2 && !endShown) showEnd();
  }
}

function updateTips(dt) {
  const tip = S.tips[0]; if (!tip) return;
  if (!tip.shown && tip.when && !tip.when(S)) return;
  tip.shown = (tip.shown || 0) + dt;
  if ((tip.done && tip.done(S)) || (tip.dur && tip.shown > tip.dur)) S.tips.shift();
}

function lose() {
  S.over = true; S.won = false; S.endTimer = 0; sfx.lose(); shake(10);
  showBanner('They got to the cake!');
}

// ---------- input ----------
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}

function canUse(type) { return S.sun >= PLANTS[type].cost && S.cool[type] <= 0; }
function denyCard(type) { sfx.deny(); if (S.sun < PLANTS[type].cost) S.sunPulse = 0.6; }

function selectCard(type) {
  if (!canUse(type)) { denyCard(type); S.selected = null; return false; }
  S.selected = S.selected === type ? null : type;
  S.selT = 0; S.shovel = false;
  sfx.click();
  return !!S.selected;
}

function tryPlant(t) {
  if (!S.selected || !t) return false;
  const type = S.selected, def = PLANTS[type];
  if (S.grid[t.r][t.c] || !canUse(type)) { sfx.deny(); return false; }
  S.sun -= def.cost;
  S.cool[type] = def.recharge;
  S.grid[t.r][t.c] = {
    type, hp: def.hp, maxHp: def.hp, age: 0, hurt: 0, recoil: 0, burst: 0,
    timer: type === 'daisy' ? 6 : type === 'boom' ? 1.1 : type === 'pepper' ? 0.9 : 0.4,
  };
  S.stats.planted[type] = (S.stats.planted[type] || 0) + 1;
  S.fx.push({ kind: 'dust', x: tileCX(t.c), y: rowBase(t.r), t: 0 });
  sfx.plant();
  S.selected = null;
  return true;
}

function collectSun(s) {
  s.collecting = true; sfx.sun();
  floatText(s.x, s.y - 24, `+${s.value}`);
}

canvas.addEventListener('pointerdown', e => {
  if (!running || !S) return;
  e.preventDefault();
  initAudio();
  const { x, y } = toLogical(e);
  S.hover = { x, y };

  if (inRect(x, y, PAUSE_BTN)) { togglePause(); return; }
  if (inRect(x, y, MUTE_BTN)) { setMuted(!muted); return; }
  if (inRect(x, y, SPEED_BTN)) { toggleSpeed(); return; }
  if (paused || S.over) return;

  // suns first (generous touch radius)
  for (let i = S.suns.length - 1; i >= 0; i--) {
    const s = S.suns[i];
    if (!s.collecting && Math.hypot(s.x - x, s.y - y) < 40) { collectSun(s); return; }
  }

  for (let i = 0; i < S.cards.length; i++) {
    if (inRect(x, y, cardRect(i))) {
      const type = S.cards[i];
      S.drag = selectCard(type) ? { type, moved: false } : null;
      return;
    }
  }
  if (inRect(x, y, S.shovelRect)) { S.shovel = !S.shovel; S.selected = null; sfx.click(); return; }

  const t = tileAt(x, y);
  if (t && S.selected) { tryPlant(t); return; }
  if (t && S.shovel) {
    if (S.grid[t.r][t.c]) { S.grid[t.r][t.c] = null; sfx.plant(); S.fx.push({ kind: 'dust', x: tileCX(t.c), y: rowBase(t.r), t: 0 }); }
    S.shovel = false; return;
  }
  S.selected = null; S.shovel = false;
});

canvas.addEventListener('pointermove', e => {
  if (!S) return;
  const p = toLogical(e);
  S.hover = p;
  if (S.drag && p.y > BAR_H) S.drag.moved = true;
  // mouse users: sweep over suns to collect them
  if (lastPointerMouse && running && !paused && !S.over && e.buttons === 0) {
    for (const s of S.suns) if (!s.collecting && Math.hypot(s.x - p.x, s.y - p.y) < 26) collectSun(s);
  }
});

canvas.addEventListener('pointerup', e => {
  if (!S || !S.drag) return;
  const p = toLogical(e);
  // drag-and-drop from card onto lawn
  if (S.drag.moved && S.selected) tryPlant(tileAt(p.x, p.y));
  S.drag = null;
});
canvas.addEventListener('pointerleave', () => { if (S && lastPointerMouse) S.hover = null; });
let lastPointerMouse = true;
window.addEventListener('pointerdown', e => { lastPointerMouse = e.pointerType === 'mouse'; }, true);

window.addEventListener('keydown', e => {
  if (!running || !S) return;
  if (e.code === 'Space' || e.code === 'KeyP') { e.preventDefault(); togglePause(); return; }
  if (e.code === 'KeyM') { setMuted(!muted); return; }
  if (paused || S.over) return;
  if (e.code === 'KeyF') toggleSpeed();
  if (e.code === 'Escape') { S.selected = null; S.shovel = false; }
  if (e.code === 'KeyS') { S.shovel = !S.shovel; S.selected = null; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= S.cards.length) { const type = S.cards[n - 1]; if (S.selected !== type) selectCard(type); }
});

function toggleSpeed() { if (S && !S.over) { S.speed = S.speed === 1 ? 2 : 1; sfx.click(); } }
function togglePause() {
  if (!S || S.over) return;
  paused = !paused;
  $('pause').classList.toggle('hidden', !paused);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && running && S && !S.over && !paused) togglePause(); });

// ---------- drawing: scenery ----------
const SKY = {
  day: null,
  sunset: { tint: 'rgba(255,120,40,.13)' },
  night: { tint: 'rgba(25,25,100,.38)' },
};

function drawScenery() {
  // house (left)
  const g = ctx.createLinearGradient(0, 0, LAWN_X, 0);
  g.addColorStop(0, '#d8b48a'); g.addColorStop(1, '#c49a6c');
  ctx.fillStyle = g; ctx.fillRect(0, BAR_H, 62, H - BAR_H);
  ctx.fillStyle = '#9b6f45';
  for (let y = BAR_H + 10; y < H; y += 22) ctx.fillRect(0, y, 62, 2);
  // windows
  for (const wy of [140, 430]) {
    ctx.fillStyle = S && S.L.sky === 'night' ? '#ffe9a0' : '#a9d8f5'; ctx.fillRect(12, wy, 38, 34);
    ctx.strokeStyle = '#7a4a26'; ctx.lineWidth = 3; ctx.strokeRect(12, wy, 38, 34);
    ctx.beginPath(); ctx.moveTo(31, wy); ctx.lineTo(31, wy + 34); ctx.moveTo(12, wy + 17); ctx.lineTo(50, wy + 17); ctx.stroke();
  }
  // door + cake
  ctx.fillStyle = '#7a4a26'; rrect(14, 300, 36, 70, 6); ctx.fill();
  ctx.fillStyle = '#e3b35c'; circle(42, 336, 3); ctx.fill();
  drawCake(32, 270, 0.8);
  // balloons tied to the house
  const t = S ? S.t : 0;
  [[18, '#ff4f8b', 0], [40, '#3aa0ff', 1.3], [29, '#ffd23f', 2.4]].forEach(([bx, col, ph]) => {
    const sway = Math.sin(t * 1.3 + ph) * 4, top = 212 + Math.sin(t * 2 + ph) * 3 - (bx === 29 ? 12 : 0);
    ctx.strokeStyle = 'rgba(60,40,20,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 250); ctx.quadraticCurveTo(bx, 236, bx + sway, top + 14); ctx.stroke();
    ctx.fillStyle = col; ellipse(bx + sway, top, 9, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ellipse(bx + sway - 3, top - 4, 2.5, 4); ctx.fill();
  });
  // path
  ctx.fillStyle = '#b9b2a3'; ctx.fillRect(62, BAR_H, LAWN_X - 62, H - BAR_H);
  ctx.fillStyle = '#a8a091';
  for (let y = BAR_H; y < H; y += 46) ctx.fillRect(62, y, LAWN_X - 62, 3);

  // lawn
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#6cbb45' : '#78c74f';
    if (r % 2) ctx.fillStyle = (r + c) % 2 ? '#64b03e' : '#70bd48';
    ctx.fillRect(LAWN_X + c * CW, LAWN_Y + r * RH, CW, RH);
  }
  // grass tufts and little flowers (deterministic)
  ctx.strokeStyle = 'rgba(40,110,30,.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = LAWN_X + ((i * 137) % (COLS * CW)), y = LAWN_Y + ((i * 59) % (ROWS * RH));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 7); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 6); ctx.stroke();
  }
  for (let i = 0; i < 18; i++) {
    const x = LAWN_X + 20 + ((i * 211) % (COLS * CW - 40)), y = LAWN_Y + 14 + ((i * 97) % (ROWS * RH - 20));
    ctx.fillStyle = ['#fff', '#ffe5f0', '#fff6b0'][i % 3];
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; circle(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.8); ctx.fill(); }
    ctx.fillStyle = '#f5b400'; circle(x, y, 1.6); ctx.fill();
  }
  // top strip above lawn
  ctx.fillStyle = '#4f8f33'; ctx.fillRect(LAWN_X, BAR_H, COLS * CW, LAWN_Y - BAR_H);
  // street (right)
  const sx = LAWN_X + COLS * CW;
  ctx.fillStyle = '#5c5f66'; ctx.fillRect(sx, BAR_H, W - sx, H - BAR_H);
  ctx.fillStyle = '#e8d35a';
  for (let y = BAR_H + 10; y < H; y += 40) ctx.fillRect(sx + 20, y, 6, 20);

  // time-of-day tint
  const sky = S && SKY[S.L.sky || 'day'];
  if (sky) { ctx.fillStyle = sky.tint; ctx.fillRect(0, BAR_H, W, H - BAR_H); }

  // party bunting across the top of the lawn (string lights at night)
  const night = S && S.L.sky === 'night';
  ctx.strokeStyle = 'rgba(60,40,20,.7)'; ctx.lineWidth = 1.5;
  const bx0 = 62, bx1 = sx + 20, sag = 10;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const k = i / 40, x = bx0 + (bx1 - bx0) * k, seg = (k * 6) % 1; ctx.lineTo(x, BAR_H + 3 + Math.sin(seg * Math.PI) * sag); }
  ctx.stroke();
  for (let i = 0; i < 48; i++) {
    const k = (i + 0.5) / 48, x = bx0 + (bx1 - bx0) * k, seg = (k * 6) % 1, y = BAR_H + 3 + Math.sin(seg * Math.PI) * sag;
    if (night) {
      const on = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.7);
      ctx.fillStyle = `rgba(255,230,140,${0.25 * on})`; circle(x, y + 5, 9); ctx.fill();
      ctx.fillStyle = CONFETTI[i % CONFETTI.length]; circle(x, y + 5, 3.2); ctx.fill();
    } else {
      ctx.fillStyle = CONFETTI[i % CONFETTI.length];
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 12); ctx.closePath(); ctx.fill();
    }
  }
}

function drawCake(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#f7d7e4'; rrect(-22, -14, 44, 26, 5); ctx.fill();
  ctx.fillStyle = '#e7609a'; ctx.fillRect(-22, -4, 44, 5);
  ctx.fillStyle = '#fff'; rrect(-24, -18, 48, 8, 4); ctx.fill();
  const t = S ? S.t : 0;
  for (let i = -1; i <= 1; i++) {
    ctx.fillStyle = '#7fc3f0'; ctx.fillRect(i * 12 - 2, -32, 4, 14);
    ctx.fillStyle = '#ffb300'; ellipse(i * 12 + Math.sin(t * 9 + i) * 0.8, -36, 3, 5 + Math.sin(t * 13 + i * 2) * 0.8); ctx.fill();
  }
  ctx.restore();
}

// ---------- drawing: plants ----------
function podHead(dx, dy, body, dark, frost) {
  ctx.save(); ctx.translate(dx, dy);
  ctx.fillStyle = dark; ellipse(-20, -52, 10, 5, -0.6); ctx.fill();
  ctx.fillStyle = body; ctx.strokeStyle = dark; ctx.lineWidth = 2;
  rrect(6, -54, 26, 18, 6); ctx.fill(); ctx.stroke();
  ellipse(32, -45, 6, 11); ctx.fill(); ctx.stroke();
  ctx.fillStyle = frost ? '#163c5c' : '#123a0e'; ellipse(32, -45, 3, 6.5); ctx.fill();
  ctx.fillStyle = body; circle(0, -46, 19); ctx.fill(); ctx.stroke();
  if (frost) {
    ctx.fillStyle = '#e6f7ff';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 8, -60); ctx.lineTo(-10 + i * 8, -74 + (i % 2) * 5); ctx.lineTo(-6 + i * 8, -60); ctx.fill(); }
  }
  ctx.fillStyle = '#fff'; circle(4, -51, 6); ctx.fill();
  ctx.fillStyle = '#111'; circle(6, -51, 3); ctx.fill();
  ctx.restore();
}

function drawPlant(type, x, y, s = 1, p = null) {
  const t = S ? S.t : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (p && p.age < 0.25) { const k = 0.6 + p.age / 0.25 * 0.4; ctx.scale(k, k); }
  if (p && p.hurt > 0) ctx.translate(Math.sin(t * 60) * 1.5, 0);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ellipse(0, 2, 24, 6); ctx.fill();

  if (type === 'daisy') {
    ctx.strokeStyle = '#2e8b2e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, -20, 0, -36); ctx.stroke();
    ctx.fillStyle = '#3fa83f'; ellipse(-12, -10, 12, 5, -0.4); ctx.fill(); ellipse(12, -14, 12, 5, 0.4); ctx.fill();
    ctx.translate(0, -46 + Math.sin(t * 3) * 1.5); ctx.rotate(Math.sin(t * 1.5) * 0.12);
    if (p && p.glow > 0) { ctx.fillStyle = `rgba(255,240,120,${p.glow})`; circle(0, 0, 34); ctx.fill(); }
    ctx.fillStyle = '#ffd21f'; ctx.strokeStyle = '#e0a000'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i / 12 * Math.PI * 2); ellipse(0, -18, 6, 11); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = '#8b5a2b'; circle(0, 0, 13); ctx.fill();
    ctx.fillStyle = '#2a1a0a'; circle(-4.5, -3, 2); ctx.fill(); circle(4.5, -3, 2); ctx.fill();
    ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 1, 6, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,120,.5)'; circle(-8, 3, 2.5); ctx.fill(); circle(8, 3, 2.5); ctx.fill();
  }
  else if (type === 'shooter' || type === 'frost' || type === 'twin') {
    const frost = type === 'frost';
    const body = frost ? '#8fd3ff' : type === 'twin' ? '#4fbf62' : '#62c94a', dark = frost ? '#3f8fca' : '#2f8a26';
    ctx.strokeStyle = '#2e8b2e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
    ctx.fillStyle = '#3fa83f'; ellipse(-13, -4, 13, 5, -0.3); ctx.fill(); ellipse(13, -4, 13, 5, 0.3); ctx.fill();
    const rc = p ? p.recoil * 5 : 0;
    ctx.translate(-rc, Math.sin(t * 2.5 + x) * 1.2);
    if (type === 'twin') {
      ctx.save(); ctx.scale(0.85, 0.85); podHead(-8, -14, '#3e9e50', dark, false); ctx.restore();
    }
    podHead(0, 0, body, dark, frost);
  }
  else if (type === 'melon') {
    const ratio = p ? p.hp / p.maxHp : 1;
    ctx.translate(0, Math.sin(t * 2) * 0.8);
    ctx.fillStyle = '#4fae4b'; ctx.strokeStyle = '#2a6e28'; ctx.lineWidth = 2.5;
    ellipse(0, -34, 30, 35); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#2f7d2c'; ctx.lineWidth = 4;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, -34, Math.abs(i) * 8 + 2, 33, 0, -Math.PI / 2, Math.PI / 2, i < 0); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ellipse(-9, -40, 6, 8); ctx.fill(); ellipse(9, -40, 6, 8); ctx.fill();
    ctx.fillStyle = '#111'; circle(-8, -38, 3.5); ctx.fill(); circle(10, -38, 3.5); ctx.fill();
    if (ratio < 0.5) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, -47); ctx.lineTo(-3, -45); ctx.moveTo(16, -47); ctx.lineTo(3, -45); ctx.stroke(); }
    ctx.strokeStyle = '#173d15'; ctx.lineWidth = 2;
    if (ratio < 0.66) { ctx.beginPath(); ctx.moveTo(-20, -60); ctx.lineTo(-12, -50); ctx.lineTo(-18, -42); ctx.stroke(); }
    if (ratio < 0.33) { ctx.beginPath(); ctx.moveTo(22, -20); ctx.lineTo(12, -16); ctx.lineTo(16, -6); ctx.lineTo(8, -2); ctx.stroke(); }
  }
  else if (type === 'thorn') {
    const poke = p ? p.recoil : 0;
    ctx.fillStyle = '#3d7a2a'; ctx.strokeStyle = '#24501a'; ctx.lineWidth = 2;
    ellipse(0, -4, 34, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8e2c8'; ctx.strokeStyle = '#8a7f5a'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const sx = -27 + i * 9, h = 10 + (i % 2) * 4 + poke * 7;
      ctx.beginPath(); ctx.moveTo(sx - 3.5, -6); ctx.lineTo(sx, -6 - h); ctx.lineTo(sx + 3.5, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#fff'; circle(-8, -3, 3); ctx.fill(); circle(8, -3, 3); ctx.fill();
    ctx.fillStyle = '#111'; circle(-7, -3, 1.6); ctx.fill(); circle(9, -3, 1.6); ctx.fill();
  }
  else if (type === 'boom') {
    const k = p ? 1 + (1 - Math.max(0, p.timer) / 1.1) * 0.35 : 1;
    ctx.translate(0, -24); ctx.scale(k, k);
    if (p) ctx.translate(Math.sin(t * 50) * k, 0);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(0, -36, 2, -30); ctx.quadraticCurveTo(4, -36, 12, -14); ctx.stroke();
    ctx.fillStyle = '#3fa83f'; ellipse(4, -32, 8, 4, 0.3); ctx.fill();
    for (const [bx, by] of [[-12, 0], [12, -4]]) {
      const red = p ? `rgb(${220 + 35 * Math.sin(t * 20)},40,40)` : '#d93030';
      ctx.fillStyle = red; ctx.strokeStyle = '#8a1414'; ctx.lineWidth = 2; circle(bx, by, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(bx - 6, by - 6, 4); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx - 8, by - 4); ctx.lineTo(bx - 2, by - 1); ctx.moveTo(bx + 8, by - 4); ctx.lineTo(bx + 2, by - 1); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx, by + 8, 4, Math.PI + 0.3, -0.3); ctx.stroke();
    }
  }
  else if (type === 'pepper') {
    const k = p ? 1 + (1 - Math.max(0, p.timer) / 0.9) * 0.4 : 1;
    ctx.translate(0, -6); ctx.scale(k, k);
    if (p) ctx.translate(Math.sin(t * 55) * 1.5 * k, 0);
    ctx.rotate(0.15);
    ctx.fillStyle = p ? `rgb(${215 + 40 * Math.sin(t * 24)},${40 + 30 * Math.sin(t * 24)},30)` : '#e0351f';
    ctx.strokeStyle = '#8a1a0e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -48);
    ctx.bezierCurveTo(-20, -30, -14, -8, 4, 0);
    ctx.bezierCurveTo(-2, -12, 8, -30, 12, -48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ellipse(-6, -36, 2.5, 8, 0.2); ctx.fill();
    ctx.fillStyle = '#3c9a2e'; ellipse(0, -50, 14, 5); ctx.fill();
    ctx.strokeStyle = '#2e7d22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -52); ctx.quadraticCurveTo(2, -62, 8, -64); ctx.stroke();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -38); ctx.lineTo(-2, -35); ctx.moveTo(8, -38); ctx.lineTo(2, -35); ctx.stroke();
    ctx.fillStyle = '#111'; circle(-4, -33, 1.8); ctx.fill(); circle(4, -33, 1.8); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -24, 3.5, Math.PI + 0.3, -0.3); ctx.stroke();
  }
  ctx.restore();

  // health bar for damaged sturdy plants
  if (p && p.hp < p.maxHp && p.maxHp < 1e8) {
    const k = clamp(p.hp / p.maxHp, 0, 1), bw = 40;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(x - bw / 2 - 1, y + 4, bw + 2, 6, 3); ctx.fill();
    ctx.fillStyle = k > 0.5 ? '#7ed957' : k > 0.25 ? '#ffd23f' : '#ff5a4a'; rrect(x - bw / 2, y + 5, bw * k, 4, 2); ctx.fill();
  }
}

// ---------- drawing: birthday boys ----------
const OUTFIT = {
  basic:  { shirt: '#1d1d22', sleeve: '#7ed957', arm: '#5cb53b', text: 'LGN' },
  hat:    { shirt: '#1d1d22', sleeve: '#7ed957', arm: '#5cb53b', text: 'LGN' },
  gift:   { shirt: '#1d1d22', sleeve: '#7ed957', arm: '#5cb53b', text: 'LGN' },
  runner: { shirt: '#e8562a', sleeve: '#ffb347', arm: '#e08a2a', text: 'GO!' },
  pogo:   { shirt: '#3b5bdb', sleeve: '#74c0fc', arm: '#4c8fd6', text: 'HOP' },
  king:   { shirt: '#c79a14', sleeve: '#8e44ad', arm: '#6c3483', text: 'KING' },
};

function drawBoy(b) {
  const base = rowBase(b.row);
  const t = S.t;
  ctx.save();
  ctx.translate(b.x, base);
  ctx.scale(b.sc, b.sc);
  if (b.dead) {
    ctx.globalAlpha = clamp(1 - (b.deathT - 0.4) / 0.7, 0, 1);
    ctx.rotate(Math.min(b.deathT * 2.2, 1.45));
  }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ellipse(0, 0, 24, 6); ctx.fill();
  const tint = b.slow > 0;
  const o = OUTFIT[b.type];
  const pogoStick = b.type === 'pogo' && !b.jumped;

  // lift off the ground (pogo bounce / leap)
  let lift = 0;
  if (pogoStick) {
    lift = b.jumpT >= 0 ? 14 + Math.sin(Math.PI * b.jumpT / 0.8) * 80 : 12 + Math.abs(Math.sin(b.phase * 1.4)) * 16;
    ctx.translate(0, -lift);
  }
  if (b.type === 'runner' && !b.eating && !b.dead) ctx.rotate(-0.12);
  const step = b.eating || pogoStick ? 0 : Math.sin(b.phase * (b.type === 'runner' ? 1.4 : 1)) * 8;

  // cape for the King
  if (b.type === 'king') {
    ctx.fillStyle = '#b3202a'; ctx.beginPath(); ctx.moveTo(-14, -58); ctx.lineTo(18, -58); ctx.lineTo(26 + Math.sin(t * 3) * 2, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-4 + Math.sin(t * 3), -6, 30, 5);
  }

  // pogo stick
  if (pogoStick) {
    ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-14, -56); ctx.lineTo(-14, lift - 16); ctx.stroke();
    ctx.strokeStyle = '#d33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-24, -56); ctx.lineTo(-4, -56); ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, -6); ctx.lineTo(-4, -6); ctx.stroke();
    ctx.strokeStyle = '#c0c4cc'; ctx.lineWidth = 2; ctx.beginPath();
    const s0 = lift - 16, s1 = lift;
    for (let i = 0; i <= 6; i++) ctx.lineTo(-14 + (i % 2 ? 5 : -5), s0 + (s1 - s0) * i / 6);
    ctx.stroke();
  }

  // legs
  ctx.lineCap = 'round'; ctx.strokeStyle = tint ? '#2c3e5c' : '#2b2b33'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-5, -24); ctx.lineTo(-5 + step, -3); ctx.moveTo(5, -24); ctx.lineTo(5 - step, -3); ctx.stroke();
  ctx.fillStyle = b.type === 'runner' ? '#ff3b3b' : '#f2f2f2'; ellipse(-8 + step, -2, 7, 4); ctx.fill(); ellipse(2 - step, -2, 7, 4); ctx.fill();

  // arms (reaching forward = left); the King raises his for a smash
  const sleeve = tint ? '#8fd0e8' : o.sleeve, hand = tint ? '#cfe2f2' : '#f1c7a5';
  let reach = b.eating ? Math.sin(t * 14) * 6 : Math.sin(b.phase) * 3;
  const raise = b.type === 'king' && b.eating ? clamp(b.smashT / 1.1, 0, 1) : 0;
  if (raise) reach = 0;
  const ay = -48 - reach - raise * 40;
  const handX = pogoStick ? -14 : -32;
  ctx.strokeStyle = tint ? '#6aa9c4' : o.arm; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(4, -52); ctx.lineTo(handX + 2, pogoStick ? -56 : ay); ctx.stroke();
  ctx.fillStyle = hand; circle(handX, pogoStick ? -56 : ay, 5); ctx.fill();

  // torso
  ctx.fillStyle = tint ? '#25303f' : o.shirt; rrect(-18, -60, 36, 40, 9); ctx.fill();
  ctx.fillStyle = '#ececec'; ctx.font = `bold ${o.text.length > 3 ? 9 : 11}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(o.text, 0, -40);
  ctx.strokeStyle = b.type === 'king' ? '#fff3b0' : '#4fd34a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-12, -33); ctx.lineTo(-5, -28); ctx.lineTo(2, -34); ctx.lineTo(10, -28); ctx.stroke();

  const ay2 = -50 + reach - raise * 44;
  ctx.strokeStyle = sleeve; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-8, -54); ctx.lineTo(pogoStick ? -12 : -38, pogoStick ? -56 : ay2); ctx.stroke();
  ctx.fillStyle = hand; circle(pogoStick ? -14 : -41, pogoStick ? -56 : ay2, 5.5); ctx.fill();

  // head (photo)
  const img = b.head, ok = img.complete && img.naturalWidth > 0;
  const hw = 56, hh = ok ? hw * img.naturalHeight / img.naturalWidth : 70;
  const bob = b.eating ? Math.sin(t * 14) * 2 : Math.sin(b.phase * 2) * 1.5;
  ctx.save();
  ctx.translate(-2, -58 - hh / 2 + 14 + bob);
  ctx.rotate(Math.sin(b.phase) * 0.06 + (b.eating ? Math.sin(t * 14) * 0.08 : 0) - 0.05);
  if (ok) ctx.drawImage(img, -hw / 2, -hh / 2, hw, hh);
  else { ctx.fillStyle = '#f1c7a5'; ellipse(0, 0, hw / 2, hh / 2); ctx.fill(); }
  if (b.burnt) { ctx.fillStyle = 'rgba(20,20,20,.75)'; ellipse(0, 0, hw / 2 - 1, hh / 2 - 1); ctx.fill(); }
  if (tint) { ctx.fillStyle = 'rgba(110,180,255,.35)'; ellipse(0, 0, hw / 2 - 1, hh / 2 - 1); ctx.fill(); }
  if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ellipse(0, 0, hw / 2 - 1, hh / 2 - 1); ctx.fill(); }
  if (b.type === 'runner') {
    // party blower
    const len = 12 + (Math.sin(t * 7 + b.phase) * 0.5 + 0.5) * 16;
    ctx.save(); ctx.translate(-hw / 2 + 10, hh * 0.18);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-6, -3, 8, 6);
    ctx.fillStyle = '#ff4f8b'; ctx.fillRect(-6 - len, -3.5, len, 7);
    ctx.fillStyle = '#fff'; for (let i = 6; i < len; i += 8) ctx.fillRect(-6 - i, -3.5, 3, 7);
    ctx.restore();
  }
  if (b.type === 'king') drawCrown(-hh / 2 + 6);
  if (b.armor > 0) drawArmor(b.type, -hh / 2, b.armor / b.armorMax);
  ctx.restore();

  ctx.restore();
}

function drawCrown(top) {
  ctx.save(); ctx.translate(0, top);
  ctx.fillStyle = '#ffcc1f'; ctx.strokeStyle = '#a0700a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-24, 4); ctx.lineTo(-26, -22); ctx.lineTo(-13, -10); ctx.lineTo(0, -30); ctx.lineTo(13, -10); ctx.lineTo(26, -22); ctx.lineTo(24, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e23b44'; circle(0, -6, 4); ctx.fill();
  ctx.fillStyle = '#3aa0ff'; circle(-15, -3, 3); ctx.fill(); circle(15, -3, 3); ctx.fill();
  ctx.restore();
}

function drawArmor(type, top, ratio) {
  ctx.save();
  if (type === 'hat') {
    ctx.translate(2, top + 14); ctx.rotate(ratio < 0.5 ? 0.35 : 0.12);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(17, 0); ctx.lineTo(2, -44); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#3aa0ff'; ctx.fillRect(-20, -46, 40, 48);
    ctx.fillStyle = '#ffde3b';
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(0, -8 - i * 9); ctx.rotate(-0.4); ctx.fillRect(-25, -2.5, 50, 4.5); ctx.restore(); }
    ctx.restore();
    ctx.fillStyle = '#ff4f8b'; circle(2, -45, 6); ctx.fill();
    if (ratio < 0.5) { ctx.strokeStyle = '#1b4f80'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(0, -18); ctx.lineTo(-3, -26); ctx.stroke(); }
  } else if (type === 'gift') {
    ctx.translate(0, top + 8); ctx.rotate(ratio < 0.4 ? -0.15 : 0);
    ctx.fillStyle = ratio < 0.4 ? '#b8282f' : '#e23b44'; rrect(-26, -26, 52, 34, 4); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -26, 8, 34); ctx.fillRect(-26, -12, 52, 7);
    ellipse(-8, -30, 9, 5, 0.5); ctx.fill(); ellipse(8, -30, 9, 5, -0.5); ctx.fill();
    if (ratio < 0.7) { ctx.strokeStyle = '#7a1218'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, -20); ctx.lineTo(-14, -14); ctx.lineTo(-20, -6); ctx.stroke(); }
    if (ratio < 0.4) { ctx.beginPath(); ctx.moveTo(20, -24); ctx.lineTo(12, -14); ctx.lineTo(18, 0); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------- drawing: misc ----------
function drawSunToken(x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(255,230,90,.35)'; circle(0, 0, r * 1.6); ctx.fill();
  ctx.fillStyle = '#ffcf2e';
  for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i / 10 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(-4, -r); ctx.lineTo(0, -r * 1.45); ctx.lineTo(4, -r); ctx.fill(); ctx.restore(); }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
  g.addColorStop(0, '#fff7b0'); g.addColorStop(1, '#ffb300');
  ctx.fillStyle = g; circle(0, 0, r); ctx.fill();
  ctx.restore();
}

function drawCart(cart) {
  if (cart.state === 'used') return;
  const y = rowBase(cart.r);
  ctx.save(); ctx.translate(cart.x, y);
  if (cart.state === 'go') ctx.translate(0, Math.sin(S.t * 40) * 1.5);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ellipse(0, 2, 22, 5); ctx.fill();
  ctx.fillStyle = '#d6372f'; rrect(-20, -26, 40, 18, 5); ctx.fill();
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-14, -22, 28, 4);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -24); ctx.lineTo(-28, -42); ctx.stroke();
  ctx.fillStyle = '#222'; circle(-12, -5, 6); ctx.fill(); circle(12, -5, 6); ctx.fill();
  ctx.fillStyle = '#999'; circle(-12, -5, 2); ctx.fill(); circle(12, -5, 2); ctx.fill();
  ctx.restore();
}

function drawFx(f) {
  if (f.kind === 'boom') {
    const k = f.t / 0.7;
    ctx.save(); ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#ffdd55'; circle(f.x, f.y, 40 + k * 110); ctx.fill();
    ctx.fillStyle = '#ff7a1a'; circle(f.x, f.y, 25 + k * 85); ctx.fill();
    ctx.fillStyle = '#e02a1a'; circle(f.x, f.y, 10 + k * 50); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('POP!', f.x, f.y + 12);
    ctx.restore();
  } else if (f.kind === 'fire') {
    const k = f.t / 0.9, by = rowBase(f.r);
    ctx.save(); ctx.globalAlpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    for (let x = LAWN_X - 10; x < W; x += 22) {
      const h = 50 + Math.sin(x * 0.3 + f.t * 30) * 14 + (1 - k) * 20;
      ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(x - 16, by); ctx.quadraticCurveTo(x - 10, by - h * 0.6, x, by - h); ctx.quadraticCurveTo(x + 10, by - h * 0.6, x + 16, by); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x - 8, by); ctx.quadraticCurveTo(x - 5, by - h * 0.35, x, by - h * 0.55); ctx.quadraticCurveTo(x + 5, by - h * 0.35, x + 8, by); ctx.fill();
    }
    ctx.restore();
  } else if (f.kind === 'splat') {
    ctx.save(); ctx.globalAlpha = 1 - f.t / 0.2;
    ctx.fillStyle = f.frost ? '#bfe9ff' : '#8fe06a';
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; circle(f.x + Math.cos(a) * (6 + f.t * 60), f.y + Math.sin(a) * (6 + f.t * 60), 3); ctx.fill(); }
    ctx.restore();
  } else if (f.kind === 'armor') {
    ctx.save(); ctx.globalAlpha = clamp(1.2 - f.t, 0, 1); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    drawArmor(f.type, 0, 1); ctx.restore();
  } else if (f.kind === 'pogo') {
    ctx.save(); ctx.globalAlpha = clamp(1.2 - f.t, 0, 1); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.stroke();
    ctx.strokeStyle = '#d33'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(10, -30); ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'dust') {
    ctx.save(); ctx.globalAlpha = 1 - f.t / 1.2;
    ctx.fillStyle = '#a07a4e';
    for (let i = 0; i < 5; i++) { circle(f.x - 24 + i * 12, f.y - f.t * 20, 5 + f.t * 6); ctx.fill(); }
    ctx.restore();
  }
}

function drawPea(p) {
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ellipse(p.x, rowBase(p.r), 7, 3); ctx.fill();
  ctx.fillStyle = p.frost ? '#a9e4ff' : '#6fd34b'; ctx.strokeStyle = p.frost ? '#3f8fca' : '#2f8a26'; ctx.lineWidth = 1.5;
  circle(p.x, p.y, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)'; circle(p.x - 3, p.y - 3, 2.5); ctx.fill();
}

function drawParts() {
  for (const p of S.parts) {
    ctx.save(); ctx.globalAlpha = clamp((p.life - p.t) / 0.4, 0, 1);
    ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 1.7));
    ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

function drawTexts() {
  ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#5b2d0c';
  for (const tx of S.texts) {
    ctx.save(); ctx.globalAlpha = 1 - tx.t;
    const y = tx.y - tx.t * 30;
    ctx.strokeText(tx.text, tx.x, y); ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, y);
    ctx.restore();
  }
}

function drawBar() {
  const g = ctx.createLinearGradient(0, 0, 0, BAR_H);
  g.addColorStop(0, '#8a5a2b'); g.addColorStop(1, '#6b4220');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, BAR_H);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, BAR_H - 4, W, 4);

  // sun counter
  ctx.fillStyle = S.sunPulse > 0 && Math.sin(S.sunPulse * 30) > 0 ? '#9e2a1a' : '#4a2d14';
  rrect(SUN_BOX.x, SUN_BOX.y, SUN_BOX.w, SUN_BOX.h, 10); ctx.fill();
  drawSunToken(SUN_BOX.x + SUN_BOX.w / 2, SUN_BOX.y + 28, 16, S.t * 0.5);
  ctx.fillStyle = '#fff7d6'; ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(S.sun, SUN_BOX.x + SUN_BOX.w / 2, SUN_BOX.y + 68);

  // seed cards
  const tipCard = S.tips[0] && S.tips[0].shown && S.tips[0].card;
  S.cards.forEach((type, i) => {
    const r = cardRect(i), def = PLANTS[type];
    const ready = S.cool[type] <= 0, afford = S.sun >= def.cost, sel = S.selected === type;
    ctx.save();
    if (sel) ctx.translate(0, -3);
    ctx.fillStyle = sel ? '#fff4b8' : '#f4e3b5'; rrect(r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = sel ? '#ffcc00' : '#5a3a1a'; ctx.lineWidth = sel ? 4 : 2; ctx.stroke();
    ctx.save(); rrect(r.x + 4, r.y + 4, r.w - 8, r.h - 24, 5); ctx.clip();
    ctx.fillStyle = '#9fd47c'; ctx.fillRect(r.x, r.y, r.w, r.h);
    const off = (type === 'shooter' || type === 'frost' || type === 'twin') ? 6 : 0;
    const sc = type === 'melon' ? 0.56 : type === 'thorn' ? 0.7 : 0.6;
    drawPlant(type, r.x + r.w / 2 - off, r.y + r.h - (type === 'thorn' ? 34 : 24), sc);
    ctx.restore();
    ctx.fillStyle = '#3b230d'; ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(def.cost, r.x + r.w / 2, r.y + r.h - 6);
    if (!afford || !ready) { ctx.fillStyle = 'rgba(0,0,0,.4)'; rrect(r.x, r.y, r.w, r.h, 8); ctx.fill(); }
    if (!ready) {
      const k = S.cool[type] / def.recharge;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(r.x, r.y, r.w, r.h * k);
    }
    if (lastPointerMouse) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `bold 10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(i + 1, r.x + 6, r.y + 14); }
    if (tipCard === type && !sel) {
      ctx.strokeStyle = `rgba(255,236,80,${0.55 + 0.45 * Math.sin(S.t * 8)})`; ctx.lineWidth = 4;
      rrect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 9); ctx.stroke();
    }
    ctx.restore();
  });

  // shovel
  const sr = S.shovelRect;
  ctx.fillStyle = S.shovel ? '#c9a46b' : '#4a2d14'; rrect(sr.x, sr.y, sr.w, sr.h, 10); ctx.fill();
  drawShovel(sr.x + sr.w / 2, sr.y + sr.h / 2, 0.9);

  // wave progress
  const { x: px, y: py, w: pw } = PROG, L = S.L;
  ctx.fillStyle = '#3b230d'; rrect(px, py, pw, 16, 8); ctx.fill();
  const prog = L.endless ? (S.wave % 10) / 10 : clamp(S.wave / L.waves, 0, 1);
  ctx.fillStyle = '#7ed957'; if (prog > 0) { rrect(px + pw * (1 - prog), py + 2, pw * prog, 12, 6); ctx.fill(); }
  const flags = L.endless ? [5, 10] : L.big;
  const span = L.endless ? 10 : L.waves;
  for (const bw of flags) {
    const fx = px + pw * (1 - bw / span) + 4;
    const reached = L.endless ? (S.wave % 10) >= bw || (bw === 10 && S.wave % 10 === 0 && S.wave > 0) : S.wave >= bw;
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, py + 16); ctx.lineTo(fx, py - 10); ctx.stroke();
    ctx.fillStyle = reached ? '#e23b44' : '#ffd84a'; ctx.fillRect(fx, py - 10, 12, 8);
  }
  const hi = heads[0];
  if (hi.complete && hi.naturalWidth) ctx.drawImage(hi, px + pw * (1 - prog) - 12, py - 8, 24, 24 * hi.naturalHeight / hi.naturalWidth);
  ctx.fillStyle = '#fff7d6'; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center';
  const label = L.endless ? `Wave ${S.wave} · Best ${progress.best}`
    : S.wave === 0 ? `Party ${S.levelIdx + 1} · Get ready…` : `Wave ${S.wave} / ${L.waves}`;
  ctx.fillText(label, px + pw / 2, py + 40);

  // pause / speed / mute
  for (const [b, label2, on] of [[PAUSE_BTN, paused ? '▶' : 'II', paused], [SPEED_BTN, S.speed === 2 ? '2×' : '1×', S.speed === 2], [MUTE_BTN, muted ? '🔇' : '🔊', false]]) {
    ctx.fillStyle = on ? '#c98a1d' : '#4a2d14'; rrect(b.x, b.y, b.w, b.h, 7); ctx.fill();
    ctx.fillStyle = '#fff7d6'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(label2, b.x + b.w / 2, b.y + 17);
  }
}

function drawShovel(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.7);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-3, -26, 6, 30);
  ctx.fillStyle = '#ccc'; ctx.strokeStyle = '#777'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, 4); ctx.lineTo(11, 4); ctx.lineTo(9, 18); ctx.quadraticCurveTo(0, 28, -9, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-8, -30, 16, 5);
  ctx.restore();
}

function drawTooltip() {
  let type = null, i = -1;
  if (lastPointerMouse && S.hover && S.hover.y < BAR_H) {
    i = S.cards.findIndex((_, k) => inRect(S.hover.x, S.hover.y, cardRect(k)));
    if (i >= 0) type = S.cards[i];
  }
  if (!type && S.selected && S.selT < 1.8) { type = S.selected; i = S.cards.indexOf(type); }
  if (!type) return;
  const def = PLANTS[type], r = cardRect(i);
  ctx.font = `13px ${FONT}`;
  const lines = wrapText(def.desc, 200);
  const w = 220, h = 30 + lines.length * 17, x = clamp(r.x + r.w / 2 - w / 2, 6, W - w - 6), y = BAR_H + 6;
  ctx.fillStyle = 'rgba(40,24,8,.92)'; rrect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffd84a'; ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(def.name, x + 10, y + 19);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff7d6'; ctx.font = `12px ${FONT}`;
  ctx.fillText(`${def.cost} sun`, x + w - 10, y + 19);
  ctx.textAlign = 'left'; ctx.font = `13px ${FONT}`; ctx.fillStyle = '#e7f3dc';
  lines.forEach((ln, k) => ctx.fillText(ln, x + 10, y + 37 + k * 17));
}

function drawTip() {
  const tip = S.tips[0];
  if (!tip || !tip.shown || S.over) return;
  const a = clamp(tip.shown * 3, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `bold 15px ${FONT}`;
  const lines = wrapText(tip.text, 560);
  const w = Math.min(600, Math.max(...lines.map(l => ctx.measureText(l).width)) + 56), h = 16 + lines.length * 20;
  const x = LAWN_X + (COLS * CW - w) / 2, y = H - h - 10;
  ctx.fillStyle = 'rgba(30,20,6,.78)'; rrect(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#ffd84a'; circle(x + 18, y + h / 2, 9); ctx.fill();
  ctx.fillStyle = '#4a2408'; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('!', x + 18, y + h / 2 + 5);
  ctx.fillStyle = '#fff7d6'; ctx.font = `bold 15px ${FONT}`; ctx.textAlign = 'left';
  lines.forEach((ln, k) => ctx.fillText(ln, x + 36, y + 22 + k * 20));
  ctx.restore();
}

function drawBossBar() {
  const k = S.boys.find(b => b.def.boss && !b.dead);
  if (!k) return;
  const w = 320, x = LAWN_X + (COLS * CW - w) / 2, y = LAWN_Y + 8;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; rrect(x - 4, y - 4, w + 8, 26, 8); ctx.fill();
  ctx.fillStyle = '#3b0d0d'; rrect(x, y + 8, w, 10, 5); ctx.fill();
  ctx.fillStyle = '#e23b44'; rrect(x, y + 8, w * clamp(k.hp / k.maxHp, 0, 1), 10, 5); ctx.fill();
  ctx.fillStyle = '#ffd84a'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('👑 THE BIRTHDAY KING', x + w / 2, y + 5);
}

function drawBanner() {
  if (!S.banner) return;
  const t = S.banner.t, a = clamp(Math.min(t * 4, (2.6 - t) * 3), 0, 1);
  const s = 1 + Math.max(0, 0.3 - t) * 2;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H / 2); ctx.scale(s, s);
  ctx.font = `bold 44px ${FONT}`; ctx.textAlign = 'center';
  ctx.lineWidth = 8; ctx.strokeStyle = '#5b2d0c'; ctx.strokeText(S.banner.text, 0, 0);
  ctx.fillStyle = '#ffd84a'; ctx.fillText(S.banner.text, 0, 0);
  ctx.restore();
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake, rand(-1, 1) * S.shake);
  drawScenery();

  // placement preview
  if (S.hover && (S.selected || S.shovel) && !paused) {
    const tl = tileAt(S.hover.x, S.hover.y);
    if (tl) {
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(LAWN_X, LAWN_Y + tl.r * RH, COLS * CW, RH);
      ctx.fillRect(LAWN_X + tl.c * CW, LAWN_Y, CW, ROWS * RH);
      if (S.selected && !S.grid[tl.r][tl.c]) { ctx.save(); ctx.globalAlpha = 0.45; drawPlant(S.selected, tileCX(tl.c), rowBase(tl.r)); ctx.restore(); }
      if (S.shovel && S.grid[tl.r][tl.c]) { ctx.fillStyle = 'rgba(255,80,60,.25)'; ctx.fillRect(LAWN_X + tl.c * CW, LAWN_Y + tl.r * RH, CW, RH); }
    }
  }

  // ground plants first, then everything else, then carts
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = S.grid[r][c]; if (p && PLANTS[p.type].ground) drawPlant(p.type, tileCX(c), rowBase(r), 1, p); }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = S.grid[r][c]; if (p && !PLANTS[p.type].ground) drawPlant(p.type, tileCX(c), rowBase(r), 1, p); }
  for (const cart of S.carts) drawCart(cart);

  // boys, back rows first
  const order = [...S.boys].sort((a, b) => a.row - b.row || b.x - a.x);
  for (const b of order) drawBoy(b);
  for (const p of S.peas) drawPea(p);
  for (const f of S.fx) drawFx(f);
  drawParts();
  drawBossBar();
  ctx.restore();

  drawBar();

  for (const s of S.suns) {
    ctx.save(); if (s.life < 2) ctx.globalAlpha = Math.max(0.2, s.life / 2);
    drawSunToken(s.x, s.y, 20, s.rot); ctx.restore();
  }
  drawTexts();

  // dragged card follows the finger
  if (S.drag && S.drag.moved && S.hover && S.selected) {
    ctx.save(); ctx.globalAlpha = 0.85; drawPlant(S.selected, S.hover.x, S.hover.y + 30, 0.9); ctx.restore();
  }
  if (S.shovel && S.hover && S.hover.y > BAR_H) drawShovel(S.hover.x + 10, S.hover.y - 14, 0.9);

  drawTooltip();
  drawTip();
  drawBanner();

  if (paused) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, BAR_H, W, H - BAR_H); }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (running && S) {
    if (!paused) for (let i = 0; i < S.speed; i++) update(dt);
    if (!paused && !S.over) Music.tick(S.boys.some(b => b.def.boss && !b.dead) || (!S.L.endless && S.wave === S.L.waves));
    render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- screens ----------
const $ = id => document.getElementById(id);

// Render a plant to an image so HTML screens can show it.
const iconCache = {};
function plantIcon(type) {
  if (iconCache[type]) return iconCache[type];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const saved = ctx; ctx = c.getContext('2d');
  ctx.scale(1.6, 1.6);
  drawPlant(type, 40, type === 'thorn' ? 56 : 72, type === 'melon' ? 0.85 : 0.95);
  ctx = saved;
  return (iconCache[type] = c.toDataURL());
}

let currentLevel = 0;
function startGame(levelIdx = currentLevel) {
  currentLevel = levelIdx;
  initAudio();
  newGame(levelIdx); paused = false; running = true; endShown = false;
  for (const id of ['start', 'end', 'levels', 'pause']) $(id).classList.add('hidden');
  const el = document.documentElement;
  if (matchMedia('(pointer: coarse)').matches && el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
  }
}

function showLevels() {
  running = false; paused = false;
  for (const id of ['start', 'end', 'pause']) $(id).classList.add('hidden');
  const grid = $('levelGrid'); grid.innerHTML = '';
  const card = (label, name, icon, sub, unlocked, onClick, extraClass = '') => {
    const b = document.createElement('button');
    b.className = 'lvl ' + extraClass; b.disabled = !unlocked;
    b.innerHTML = `<span class="num">${label}</span><img alt="" src="${plantIcon(icon)}"><span class="name"></span><span class="sub"></span>`;
    b.querySelector('.name').textContent = name;
    if (typeof sub === 'number') {
      const st = document.createElement('span'); st.className = 'stars';
      st.innerHTML = [0, 1, 2].map(k => `<span class="${k < sub ? '' : 'off'}">★</span>`).join('');
      b.querySelector('.sub').replaceWith(st);
    } else b.querySelector('.sub').textContent = sub;
    if (!unlocked) { const l = document.createElement('span'); l.className = 'lock'; l.textContent = '🔒'; b.appendChild(l); }
    b.addEventListener('click', onClick);
    grid.appendChild(b);
  };
  LEVELS.forEach((L, i) => card(i + 1, L.name, L.icon, progress.stars[i], levelUnlocked(i), () => startGame(i)));
  card('∞', ENDLESS.name, ENDLESS.icon, endlessUnlocked() ? `Best: wave ${progress.best}` : 'Beat party 3 to unlock', endlessUnlocked(), () => startGame('endless'), 'endless');
  $('levels').classList.remove('hidden');
}

function showEnd() {
  endShown = true;
  const L = S.L, cartsLeft = S.carts.filter(c => c.state === 'ready').length;
  const mins = Math.floor(S.t / 60), secs = String(Math.floor(S.t % 60)).padStart(2, '0');
  let stars = 0;
  $('unlock').classList.add('hidden');
  $('btnNext').classList.add('hidden');
  if (L.endless) {
    const newBest = S.wave > progress.best;
    if (newBest) { progress.best = S.wave; persist(); }
    $('endTitle').textContent = newBest ? 'New record! 🎉' : 'Party over!';
    $('endText').textContent = `You survived until wave ${S.wave}.` + (newBest ? '' : ` Your best is wave ${progress.best}.`);
  } else if (S.won) {
    stars = 1 + (cartsLeft >= 3 ? 1 : 0) + (cartsLeft === ROWS ? 1 : 0);
    const i = S.levelIdx, firstClear = progress.stars[i] === 0;
    progress.stars[i] = Math.max(progress.stars[i], stars); persist();
    $('endTitle').textContent = 'Party saved! 🎂';
    $('endText').textContent = i === LEVELS.length - 1
      ? 'You beat the Birthday King himself! Happy birthday — now everyone can share the cake!'
      : stars < 3 ? `Nice! Keep all ${ROWS} garden carts to earn 3 stars.` : 'Perfect party — not a single cart used!';
    const next = LEVELS[i + 1];
    if (next) {
      $('btnNext').classList.remove('hidden');
      if (firstClear && next.newPlants) {
        const k = next.newPlants[0];
        $('unlockImg').src = plantIcon(k);
        $('unlockText').textContent = `New plant${next.newPlants.length > 1 ? 's' : ''} unlocked: ${next.newPlants.map(n => PLANTS[n].name).join(' & ')}!`;
        $('unlock').classList.remove('hidden');
      }
    }
    if (i === 2 && firstClear) {
      $('unlockImg').src = plantIcon(ENDLESS.icon);
      $('unlockText').textContent = `New plant unlocked: ${PLANTS.twin.name}! Endless Party is open too.`;
      $('unlock').classList.remove('hidden');
    }
  } else {
    $('endTitle').textContent = 'Oh no!';
    const daisies = S.stats.planted.daisy || 0;
    $('endText').textContent = 'A birthday boy made it to the house and ate the whole cake. ' +
      (daisies < 5 ? 'Tip: plant more Sun Daisies early — sun wins games.' : 'Tip: put Wall Melons in front so your pods have time to shoot.');
  }
  $('endStars').style.display = L.endless || !S.won ? 'none' : '';
  [...$('endStars').children].forEach((el, k) => {
    el.classList.remove('on');
    if (k < stars) setTimeout(() => { el.classList.add('on'); tone(660 + k * 220, 0.15, 'triangle', 0.08); }, 300 + k * 350);
  });
  $('endStats').innerHTML = '';
  for (const [label, val] of [['Boys popped', S.stats.kills], ['Sun collected', S.stats.sun], ['Plants planted', Object.values(S.stats.planted).reduce((a, b) => a + b, 0)], ['Time', `${mins}:${secs}`]]) {
    const d = document.createElement('div'); d.innerHTML = `<b></b>${label}`; d.querySelector('b').textContent = val; $('endStats').appendChild(d);
  }
  $('end').classList.remove('hidden');
}

$('btnStart').addEventListener('click', () => { initAudio(); showLevels(); });
$('btnLevelsBack').addEventListener('click', () => { $('levels').classList.add('hidden'); $('start').classList.remove('hidden'); });
$('btnAgain').addEventListener('click', () => startGame());
$('btnNext').addEventListener('click', () => startGame(currentLevel + 1));
$('btnEndLevels').addEventListener('click', showLevels);
$('btnResume').addEventListener('click', togglePause);
$('btnRestart').addEventListener('click', () => startGame());
$('btnPauseLevels').addEventListener('click', showLevels);
$('btnRotateDismiss').addEventListener('click', () => { $('rotate').classList.add('dismissed'); });
