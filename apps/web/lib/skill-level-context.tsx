'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { SkillLevel, FeatureFlags } from './types/skill-level';
import { getFeatureFlags } from './types/skill-level';

const STORAGE_KEY = 'varyn_skill_level';

interface SkillLevelContextValue {
  skillLevel: SkillLevel | null;
  setSkillLevel: (level: SkillLevel) => void;
  features: FeatureFlags;
  isLoaded: boolean;
}

const DEFAULT_FEATURES = getFeatureFlags(1);

const SkillLevelContext = createContext<SkillLevelContextValue | null>(null);

export function SkillLevelProvider({ children }: { children: ReactNode }) {
  const [skillLevel, setSkillLevelState] = useState<SkillLevel | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 1 && parsed <= 4) {
        setSkillLevelState(parsed as SkillLevel);
      }
    }
    setIsLoaded(true);
  }, []);

  const setSkillLevel = useCallback((level: SkillLevel) => {
    localStorage.setItem(STORAGE_KEY, String(level));
    setSkillLevelState(level);
  }, []);

  const features = useMemo(
    () => (skillLevel ? getFeatureFlags(skillLevel) : DEFAULT_FEATURES),
    [skillLevel],
  );

  return (
    <SkillLevelContext.Provider value={{ skillLevel, setSkillLevel, features, isLoaded }}>
      {children}
    </SkillLevelContext.Provider>
  );
}

export function useSkillLevel(): SkillLevelContextValue {
  const ctx = useContext(SkillLevelContext);
  if (!ctx) throw new Error('useSkillLevel must be used within SkillLevelProvider');
  return ctx;
}
