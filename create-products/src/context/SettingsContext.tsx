"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { PrintSettings, DEFAULT_PRINT_SETTINGS } from "@/types";

interface SettingsContextValue {
  settings: PrintSettings;
  currency: string;
  updateSettings: (s: Partial<PrintSettings>) => void;
  setCurrency: (c: string) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const STORAGE_KEY = "organza_settings";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [currency, setCurrencyState] = useState("ILS");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.printSettings) setSettings(parsed.printSettings);
        if (parsed.currency) setCurrencyState(parsed.currency);
      }
    } catch {}
  }, []);

  const save = (ps: PrintSettings, cur: string) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ printSettings: ps, currency: cur })); } catch {}
  };

  const updateSettings = useCallback((s: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      save(next, currency);
      return next;
    });
  }, [currency]);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    save(settings, c);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, currency, updateSettings, setCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
