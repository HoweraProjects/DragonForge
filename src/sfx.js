// 以 WebAudio 即時合成 UI 音效（不需音檔）
let ctx; let master; let muted = false;
try { muted = localStorage.getItem('dndforge.muted') === '1'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const c = ac(); const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.2, from = 400, to = 4000, delay = 0, q = 1.5 } = {}) {
  if (muted) return;
  const c = ac(); const t = c.currentTime + delay;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t);
}

let lastHover = 0;
export const sfx = {
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('dndforge.muted', muted ? '1' : '0'); } catch { /* ignore */ } if (!muted) sfx.click(); return muted; },
  unlock() { if (!muted) ac(); },
  hover() { const n = performance.now(); if (n - lastHover < 40) return; lastHover = n; tone(2400, 0.04, { type: 'triangle', vol: 0.04 }); },
  click() { tone(880, 0.07, { type: 'triangle', vol: 0.12 }); tone(1320, 0.09, { type: 'sine', vol: 0.08, delay: 0.04 }); },
  select() { tone(523, 0.12, { type: 'triangle', vol: 0.12 }); tone(784, 0.16, { vol: 0.1, delay: 0.06 }); tone(1046, 0.25, { vol: 0.08, delay: 0.12 }); },
  whoosh() { noise(0.55, { vol: 0.18, from: 300, to: 3000 }); tone(180, 0.5, { type: 'sine', vol: 0.12, slide: 400 }); },
  forge() { noise(0.9, { vol: 0.22, from: 2000, to: 200, q: 0.8 }); [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); tone(65, 1.2, { type: 'sine', vol: 0.3, slide: -20 }); },
  level() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, { type: 'square', vol: 0.04, delay: i * 0.05 })); },
  dice() { for (let i = 0; i < 6; i++) noise(0.05, { vol: 0.15, from: 1800 + Math.random() * 1500, to: 900, delay: i * 0.06 + Math.random() * 0.03, q: 4 }); },
  error() { tone(200, 0.15, { type: 'sawtooth', vol: 0.06, slide: -80 }); },
  cast() { noise(0.7, { vol: 0.16, from: 600, to: 6000, q: 3 }); tone(440, 0.6, { type: 'sine', vol: 0.1, slide: 880 }); },
};
