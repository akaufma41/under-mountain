export interface UnderMountainStore {
  // Onboarding
  hasSeenIntro: boolean;
  // Game State
  childName: string;
  discoveredSquiggles: string[];
  history: { role: 'user' | 'assistant'; content: string }[];
  // Dad Settings
  currentObject: string;
  mythicalInterpretation: string;
  // Persistence
  lastActive: number | null;
  lastObject: string;
  // Session & Safety
  sessionStartTime: number | null;
  isSleepy: boolean;
  lastEmergencyAlert: number | null;
}

const STORAGE_KEY = 'under-mountain';

const DEFAULT_STORE: UnderMountainStore = {
  hasSeenIntro: false,
  childName: '',
  discoveredSquiggles: [],
  history: [],
  currentObject: 'Shiny Penny',
  mythicalInterpretation: 'a shield for a squirrel',
  lastActive: null,
  lastObject: '',
  sessionStartTime: null,
  isSleepy: false,
  lastEmergencyAlert: null,
};

export function getStore(): UnderMountainStore {
  if (typeof window === 'undefined') return { ...DEFAULT_STORE };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function setStore(updates: Partial<UnderMountainStore>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getStore();
    const merged = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}
