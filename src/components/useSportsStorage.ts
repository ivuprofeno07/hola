import { useEffect, useState } from 'react';

export function useSportsStorage<T>(key: string, fallback: T, parse: (value: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try { return parse(JSON.parse(localStorage.getItem(key) ?? 'null')); } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ }
  }, [key, value]);
  return [value, setValue] as const;
}
