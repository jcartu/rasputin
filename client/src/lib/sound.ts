import { Theme } from "@/contexts/JarvisThemeContext";

type SoundType = "type" | "alert" | "success" | "hover" | "processing" | "scan";

// Sound profiles for different themes
const getThemeProfile = (theme: Theme) => {
  switch (theme) {
    case "code-red":
    case "radioactive-orange":
      return {
        waveform: "sawtooth" as OscillatorType,
        baseFreq: 0.8, // Lower pitch
        distortion: true,
      };
    case "ice-white":
    case "solar-gold":
      return {
        waveform: "sine" as OscillatorType,
        baseFreq: 1.5, // Higher pitch
        distortion: false,
      };
    case "matrix-green":
    case "stealth-obsidian":
      return {
        waveform: "square" as OscillatorType,
        baseFreq: 1.0,
        distortion: true,
      };
    case "neon-pink":
    case "void-purple":
      return {
        waveform: "triangle" as OscillatorType,
        baseFreq: 1.2,
        distortion: false,
      };
    default: // cyber-blue, deep-ocean
      return {
        waveform: "sine" as OscillatorType,
        baseFreq: 1.0,
        distortion: false,
      };
  }
};

export const playSound = (type: SoundType, theme: Theme = "cyber-blue") => {
  // Check if audio context is supported
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Apply theme profile
  const profile = getThemeProfile(theme);
  osc.type = profile.waveform;

  // Connect nodes
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  const f = profile.baseFreq;

  if (type === "type") {
    // High-tech typing click
    osc.frequency.setValueAtTime((800 + Math.random() * 200) * f, now);
    osc.frequency.exponentialRampToValueAtTime(100 * f, now + 0.05);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === "alert") {
    // Warning beep
    osc.frequency.setValueAtTime(440 * f, now);
    osc.frequency.linearRampToValueAtTime(880 * f, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === "success") {
    // Positive chime
    osc.frequency.setValueAtTime(880 * f, now);
    osc.frequency.exponentialRampToValueAtTime(1760 * f, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === "hover") {
    // Subtle hover hum
    osc.frequency.setValueAtTime(220 * f, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === "processing") {
    // Computing hum/crackle
    osc.frequency.setValueAtTime(100 * f, now);
    osc.frequency.linearRampToValueAtTime(50 * f, now + 0.2);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === "scan") {
    // High pitched scan sweep
    osc.frequency.setValueAtTime(2000 * f, now);
    osc.frequency.exponentialRampToValueAtTime(4000 * f, now + 0.1);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  }
};
