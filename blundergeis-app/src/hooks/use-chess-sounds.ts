"use client";

import { useCallback, useRef, useEffect } from "react";

export type SoundType = "move" | "capture" | "check" | "blunder" | "mate";

export function useChessSounds() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback(
    (type: SoundType) => {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
          case "move":
            // Crisp percussive click
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
            break;

          case "capture":
            // Deeper double-tap thud
            osc.type = "triangle";
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;

          case "check":
            // High bell alert
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.setValueAtTime(1174.66, now + 0.08);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
            break;

          case "blunder":
            // Low dissonant alert
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(120, now + 0.25);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
            break;

          case "mate":
            // Triumphant chord chime
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
              const chordOsc = ctx.createOscillator();
              const chordGain = ctx.createGain();
              chordOsc.type = "sine";
              chordOsc.frequency.setValueAtTime(freq, now + idx * 0.05);
              chordGain.gain.setValueAtTime(0.15, now + idx * 0.05);
              chordGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
              chordOsc.connect(chordGain);
              chordGain.connect(ctx.destination);
              chordOsc.start(now + idx * 0.05);
              chordOsc.stop(now + 0.6);
            });
            break;
        }
      } catch {
        // Ignore audio failures if browser blocks autoplay
      }
    },
    [getAudioContext]
  );

  return { playSound };
}
