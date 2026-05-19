/* ============================================
   audio.js — 闹铃引擎
   全部惰性初始化，模块加载零风险
   零依赖
   ============================================ */

let audioCtx = null;
let isPlaying = false;
let stopFlag = false;
let continuousTimer = null;
let flashOverlay = null;
let a1 = null;
let a2 = null;

// === WAV 生成 ===
function makeWAV(freq, dur, vol) {
  const sr = 8000, ns = Math.max(2, Math.floor(sr * dur));
  const buf = new ArrayBuffer(44 + ns * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + ns * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data');
  v.setUint32(40, ns * 2, true);
  const fl = Math.min(ns, Math.floor(sr * 0.003));
  for (let i = 0; i < ns; i++) {
    const t = i / sr;
    let val = freq > 0 ? Math.sin(2 * Math.PI * freq * t) * vol : 0;
    if (i < fl) val *= i / fl; if (i > ns - fl) val *= (ns - i) / fl;
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, val * 32767)), true);
  }
  return buf;
}

function playSound(freq, durSec, vol) {
  const buf = makeWAV(freq, durSec, vol);
  // 尝试 Blob URL
  try {
    if (!a1 && !a2) { a1 = new Audio(); a1.volume = 0.8; a2 = new Audio(); a2.volume = 0.8; }
    const blob = new Blob([buf], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const el = (a1 && a1.paused) ? a1 : (a2 || a1);
    if (el) { el.src = url; el.currentTime = 0; el.play().catch(() => {}); }
    setTimeout(() => URL.revokeObjectURL(url), 800);
  } catch (e) { /* WAV fail */ }
  // 尝试 Web Audio
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
      gain.gain.setValueAtTime(0.4, now + durSec - 0.02);
      gain.gain.linearRampToValueAtTime(0.001, now + durSec);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now + 0.005); osc.stop(now + durSec + 0.01);
    }
  } catch (e) { /* WA fail */ }
}

let flashTimers = []; // 所有闪烁定时器，统一清理用

function flashScreen() {
  if (!document.body) return;
  if (!flashOverlay) {
    flashOverlay = document.createElement('div');
    flashOverlay.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:rgba(255,50,50,0.4);opacity:0;transition:opacity 0.1s;';
    document.body.appendChild(flashOverlay);
  }
  let c = 0;
  const t = setInterval(() => {
    flashOverlay.style.opacity = c % 2 ? '0' : '1';
    c++;
    if (c >= 6) {
      clearInterval(t);
      flashOverlay.style.opacity = '0';
      // 从全局数组中移除
      const idx = flashTimers.indexOf(t);
      if (idx >= 0) flashTimers.splice(idx, 1);
    }
  }, 200);
  flashTimers.push(t);
  return t;
}

function clearFlashes() {
  flashTimers.forEach(t => clearInterval(t));
  flashTimers = [];
  if (flashOverlay) {
    flashOverlay.remove();
    flashOverlay = null;
  }
}

function vib(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

// === 公开 API ===

export function initOnUserGesture() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch (e) {}
  try {
    if (!a1) a1 = new Audio();
    if (!a2) a2 = new Audio();
    a1.volume = 0.8; a2.volume = 0.8;
  } catch (e) {}
}

export function playSingle() {
  if (isPlaying) return;
  playSound(1000, 0.22, 0.55);
  vib([80, 40, 80]);
  flashScreen();
}

export function playTriple() {
  if (isPlaying) return;
  [920, 1040, 1160].forEach((f, i) => setTimeout(() => playSound(f, 0.2, 0.55), i * 380));
  vib([150, 60, 150, 60, 150]);
  flashScreen();
}

export function playContinuous() {
  stopFlag = false; isPlaying = true;
  let step = 0;
  flashScreen();
  const flashInt = setInterval(flashScreen, 600);

  function tick() {
    if (stopFlag) { isPlaying = false; clearInterval(flashInt); return; }
    playSound([800, 1100, 950, 1200][step % 4], 0.26, 0.6);
    step++;
    continuousTimer = setTimeout(tick, 280);
  }
  tick();
  vib([300, 80, 200, 80, 500]);
  return () => { stopFlag = true; isPlaying = false; if (continuousTimer) clearTimeout(continuousTimer); clearInterval(flashInt); };
}

export function stopAll() {
  stopFlag = true; isPlaying = false;
  if (continuousTimer) { clearTimeout(continuousTimer); continuousTimer = null; }
  clearFlashes();
  try { if (a1) a1.pause(); if (a2) a2.pause(); } catch (e) {}
}
