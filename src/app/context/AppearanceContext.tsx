import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppearancePreset = "studio" | "sage" | "ember" | "aurora" | "harbor" | "graphite" | "midnight" | "contrast" | "deuteranopia" | "tritanopia" | "lowvision";

type AppearancePresetOption = {
  id: AppearancePreset;
  label: string;
  note: string;
  category: "core" | "accessibility";
};

type AppearanceContextValue = {
  appearance: AppearancePreset;
  setAppearance: (preset: AppearancePreset) => void;
  appearanceOptions: AppearancePresetOption[];
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
};

const STORAGE_KEY = "worklode_appearance_v1";

const APPEARANCE_OPTIONS: AppearancePresetOption[] = [
  {
    id: "studio",
    label: "Studio Blue",
    note: "Cool slate surfaces with crisp blue accents.",
    category: "core",
  },
  {
    id: "sage",
    label: "Sage Grid",
    note: "Softer greens and brass for a calmer planner feel.",
    category: "core",
  },
  {
    id: "ember",
    label: "Ember Paper",
    note: "Warm cream, deep ink, and clay-toned highlights.",
    category: "core",
  },
  {
    id: "aurora",
    label: "Aurora Mint",
    note: "Cool mint glass, navy text, and neon-citrus accents.",
    category: "core",
  },
  {
    id: "harbor",
    label: "Harbor Night",
    note: "Denim blues, seafoam surfaces, and brighter chart contrast.",
    category: "core",
  },
  {
    id: "graphite",
    label: "Graphite Rose",
    note: "Soft graphite neutrals with rose and coral emphasis.",
    category: "core",
  },
  {
    id: "midnight",
    label: "Midnight",
    note: "Full dark mode. Deep navy surfaces with luminous accents.",
    category: "core",
  },
  {
    id: "contrast",
    label: "High Contrast",
    note: "Stronger separation for text, panels, and interactive controls.",
    category: "accessibility",
  },
  {
    id: "deuteranopia",
    label: "Deuteranopia Safe",
    note: "Blue and amber pairing tuned to avoid red-green confusion.",
    category: "accessibility",
  },
  {
    id: "tritanopia",
    label: "Tritanopia Safe",
    note: "Coral and teal pairing with clearer yellow-blue separation.",
    category: "accessibility",
  },
  {
    id: "lowvision",
    label: "Low Vision Focus",
    note: "Larger base text, heavier borders, and calmer background noise.",
    category: "accessibility",
  },
];

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

function loadStoredAppearance(): AppearancePreset {
  if (typeof window === "undefined") return "studio";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "studio" || stored === "sage" || stored === "ember" || stored === "aurora" || stored === "harbor" || stored === "graphite" || stored === "midnight" || stored === "contrast" || stored === "deuteranopia" || stored === "tritanopia" || stored === "lowvision") {
    return stored;
  }
  return "studio";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearancePreset>(() => loadStoredAppearance());
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.style.colorScheme = appearance === "midnight" ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, appearance);
  }, [appearance]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      appearance,
      setAppearance,
      appearanceOptions: APPEARANCE_OPTIONS,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      togglePanel: () => setPanelOpen((current) => !current),
    }),
    [appearance, panelOpen]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within an AppearanceProvider");
  }
  return context;
}
