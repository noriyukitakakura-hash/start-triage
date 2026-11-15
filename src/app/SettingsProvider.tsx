import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, loadState, patchSettings, type Settings } from '@/lib/storage';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * 表示言語以外の設定を保持する。
 * `locale` は `I18nProvider` が所有しており、こちらでは参照しない
 * （二重管理を避けるため。どちらも `patchSettings` で同じ保存先へ書く）。
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadState().settings);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(patchSettings(patch).settings);
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (ctx === null) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}

export { DEFAULT_SETTINGS };
