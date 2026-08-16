// Lightweight "fun" layer for Wrapped: synthesized sound (no audio assets in
// this repo) + haptics, both feature-detected and silently no-op when
// unsupported (iOS Safari and desktop browsers lack the Vibration API; some
// browsers block AudioContext until a user gesture has occurred).

const FX_KEY = 'nets-fx-enabled';

export function isFxEnabled(): boolean {
  const v = localStorage.getItem(FX_KEY);
  return v === null ? true : v === '1';
}

export function setFxEnabled(enabled: boolean): void {
  localStorage.setItem(FX_KEY, enabled ? '1' : '0');
}

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playTone(freq: number, duration: number, opts?: { gain?: number; sweepTo?: number }): void {
  if (!isFxEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (opts?.sweepTo) osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, ctx.currentTime + duration);
    const peak = opts?.gain ?? 0.12;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {
    // Audio must never break the UI.
  }
}

export function playTick(): void {
  playTone(720, 0.06, { gain: 0.08 });
}

export function playChime(): void {
  playTone(660, 0.5, { gain: 0.14, sweepTo: 990 });
  setTimeout(() => playTone(880, 0.4, { gain: 0.1 }), 90);
}

type HapticPattern = 'light' | 'medium' | 'success';
const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  success: [15, 40, 15],
};

export function haptic(pattern: HapticPattern): void {
  if (!isFxEnabled()) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // iOS Safari / desktop: silently no-op.
  }
}

/** Slide-navigation feedback: swipe, tap-to-advance, buttons, keyboard arrows. */
export function fxTick(): void {
  haptic('light');
  playTick();
}

/** Celebration feedback: paired with confetti on personality/summary slides. */
export function fxCelebrate(): void {
  haptic('success');
  playChime();
}
