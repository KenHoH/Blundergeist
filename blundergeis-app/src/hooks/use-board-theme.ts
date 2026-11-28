"use client";

import { useSyncExternalStore, useCallback } from "react";

export interface BoardColors {
  name: string;
  dark: string;
  light: string;
}

export const BOARD_THEMES: Record<string, BoardColors> = {
  tournament: {
    name: "Tournament Green",
    dark: "#779952",
    light: "#edeed1",
  },
  classic: {
    name: "Classic Wood",
    dark: "#b58863",
    light: "#f0d9b5",
  },
  ocean: {
    name: "Ocean Blue",
    dark: "#4b7399",
    light: "#eae9d2",
  },
  modern: {
    name: "Modern Slate",
    dark: "#475569",
    light: "#cbd5e1",
  },
  dark: {
    name: "Dark Charcoal",
    dark: "#27272a",
    light: "#71717a",
  },
};

const STORAGE_KEY = "blundergeist_board_colors";

const defaultThemeState = {
  preset: "tournament",
  colors: BOARD_THEMES.tournament,
};

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

export function useBoardTheme() {
  const storeValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  let state = defaultThemeState;
  if (storeValue) {
    try {
      const parsed = JSON.parse(storeValue);
      if (parsed?.preset && BOARD_THEMES[parsed.preset]) {
        state = {
          preset: parsed.preset,
          colors: BOARD_THEMES[parsed.preset],
        };
      } else if (parsed?.colors?.dark && parsed?.colors?.light) {
        state = {
          preset: parsed.preset || "custom",
          colors: parsed.colors,
        };
      }
    } catch {
      // Fallback to default
    }
  }

  const selectPreset = useCallback((presetKey: string) => {
    const preset = BOARD_THEMES[presetKey];
    if (!preset) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset: presetKey, colors: preset })
      );
      listeners.forEach((l) => l());
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setCustomColors = useCallback((dark: string, light: string) => {
    const custom: BoardColors = {
      name: "Custom",
      dark,
      light,
    };
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset: "custom", colors: custom })
      );
      listeners.forEach((l) => l());
    } catch {
      // Ignore storage errors
    }
  }, []);

  return {
    colors: state.colors,
    activePreset: state.preset,
    presets: BOARD_THEMES,
    selectPreset,
    setCustomColors,
  };
}
