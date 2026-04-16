import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ProgressRequirementItem = {
  id: string;
  label: string;
  courseCode: string;
  status: "open" | "in_progress" | "done";
  notes: string;
};

export type ProgressRequirementGroup = {
  id: string;
  title: string;
  description: string;
  requiredCount: number;
  items: ProgressRequirementItem[];
};

export type ProgressMilestone = {
  id: string;
  title: string;
  targetTerm: string;
  status: "planned" | "active" | "done";
  priority: "low" | "medium" | "high";
  notes: string;
};

export type ProgressAlert = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "danger";
  notes: string;
};

export type ProgressProfile = {
  programName: string;
  targetTerm: string;
  targetCredits: number;
  notes: string;
};

type ProgressState = {
  profile: ProgressProfile;
  requirementGroups: ProgressRequirementGroup[];
  milestones: ProgressMilestone[];
  alerts: ProgressAlert[];
};

type ProgressContextValue = ProgressState & {
  setProfile: (patch: Partial<ProgressProfile> | ((current: ProgressProfile) => ProgressProfile)) => void;
  addRequirementGroup: () => void;
  updateRequirementGroup: (groupId: string, patch: Partial<Omit<ProgressRequirementGroup, "id" | "items">>) => void;
  removeRequirementGroup: (groupId: string) => void;
  addRequirementItem: (groupId: string) => void;
  updateRequirementItem: (groupId: string, itemId: string, patch: Partial<Omit<ProgressRequirementItem, "id">>) => void;
  removeRequirementItem: (groupId: string, itemId: string) => void;
  addMilestone: (seed?: Partial<ProgressMilestone>) => void;
  updateMilestone: (milestoneId: string, patch: Partial<Omit<ProgressMilestone, "id">>) => void;
  removeMilestone: (milestoneId: string) => void;
  addAlert: (seed?: Partial<ProgressAlert>) => void;
  updateAlert: (alertId: string, patch: Partial<Omit<ProgressAlert, "id">>) => void;
  removeAlert: (alertId: string) => void;
  resetProgress: () => void;
};

const STORAGE_KEY = "worklode_progress_v1";

function uid() {
  return crypto.randomUUID();
}

function createRequirementItem(seed: Partial<ProgressRequirementItem> = {}): ProgressRequirementItem {
  return {
    id: seed.id || uid(),
    label: seed.label || "New requirement",
    courseCode: seed.courseCode || "",
    status: seed.status || "open",
    notes: seed.notes || "",
  };
}

function createRequirementGroup(seed: Partial<ProgressRequirementGroup> = {}): ProgressRequirementGroup {
  return {
    id: seed.id || uid(),
    title: seed.title || "New requirement group",
    description: seed.description || "Add a short description of what this group covers.",
    requiredCount: typeof seed.requiredCount === "number" ? seed.requiredCount : 4,
    items: (seed.items || [createRequirementItem(), createRequirementItem({ label: "Sample completed item", status: "done" })]).map((item) =>
      createRequirementItem(item)
    ),
  };
}

function createMilestone(seed: Partial<ProgressMilestone> = {}): ProgressMilestone {
  return {
    id: seed.id || uid(),
    title: seed.title || "New milestone",
    targetTerm: seed.targetTerm || "202609",
    status: seed.status || "planned",
    priority: seed.priority || "medium",
    notes: seed.notes || "Add a short note about why this matters.",
  };
}

function createAlert(seed: Partial<ProgressAlert> = {}): ProgressAlert {
  return {
    id: seed.id || uid(),
    title: seed.title || "New alert",
    message: seed.message || "Add a progress note or risk reminder.",
    severity: seed.severity || "info",
    notes: seed.notes || "",
  };
}

function createDefaultState(): ProgressState {
  return {
    profile: {
      programName: "Current degree path",
      targetTerm: "202609",
      targetCredits: 120,
      notes: "Use this page to track requirement blocks, checkpoints, and student-facing alerts.",
    },
    requirementGroups: [
      createRequirementGroup({
        title: "Core requirements",
        description: "The required courses and checkpoints for the program.",
        requiredCount: 4,
        items: [
          createRequirementItem({ label: "Foundation sequence", courseCode: "CSCI-1100", status: "done" }),
          createRequirementItem({ label: "Systems requirement", courseCode: "CSCI-2200", status: "in_progress" }),
          createRequirementItem({ label: "Methods requirement", courseCode: "CSCI-2300", status: "open" }),
        ],
      }),
      createRequirementGroup({
        title: "Flexible electives",
        description: "Optional slots for depth, breadth, or project-based work.",
        requiredCount: 3,
        items: [
          createRequirementItem({ label: "Breadth elective" }),
          createRequirementItem({ label: "Project elective" }),
        ],
      }),
    ],
    milestones: [
      createMilestone({
        title: "Lock next term plan",
        targetTerm: "202609",
        priority: "high",
        notes: "Choose the next term mix before registration opens.",
      }),
      createMilestone({
        title: "Complete capstone prep",
        targetTerm: "202701",
        priority: "medium",
        notes: "Leave room for a portfolio or research deliverable.",
      }),
    ],
    alerts: [
      createAlert({
        title: "Check prerequisite chain",
        severity: "warning",
        message: "One planned requirement still has an open dependency in the current path.",
      }),
      createAlert({
        title: "Plan review due soon",
        severity: "info",
        message: "Review your next-term scenario before the registration window closes.",
      }),
    ],
  };
}

function loadProgressState(): ProgressState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    const defaults = createDefaultState();
    return {
      profile: { ...defaults.profile, ...(parsed.profile || {}) },
      requirementGroups: Array.isArray(parsed.requirementGroups) ? parsed.requirementGroups.map((group) => createRequirementGroup(group)) : defaults.requirementGroups,
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones.map((milestone) => createMilestone(milestone)) : defaults.milestones,
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts.map((alert) => createAlert(alert)) : defaults.alerts,
    };
  } catch {
    return createDefaultState();
  }
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => loadProgressState());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      ...state,
      setProfile: (patch) =>
        setState((current) => ({
          ...current,
          profile: typeof patch === "function" ? patch(current.profile) : { ...current.profile, ...patch },
        })),
      addRequirementGroup: () =>
        setState((current) => ({ ...current, requirementGroups: [...current.requirementGroups, createRequirementGroup()] })),
      updateRequirementGroup: (groupId, patch) =>
        setState((current) => ({
          ...current,
          requirementGroups: current.requirementGroups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
        })),
      removeRequirementGroup: (groupId) =>
        setState((current) => ({ ...current, requirementGroups: current.requirementGroups.filter((group) => group.id !== groupId) })),
      addRequirementItem: (groupId) =>
        setState((current) => ({
          ...current,
          requirementGroups: current.requirementGroups.map((group) =>
            group.id === groupId ? { ...group, items: [...group.items, createRequirementItem()] } : group
          ),
        })),
      updateRequirementItem: (groupId, itemId, patch) =>
        setState((current) => ({
          ...current,
          requirementGroups: current.requirementGroups.map((group) =>
            group.id === groupId
              ? { ...group, items: group.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
              : group
          ),
        })),
      removeRequirementItem: (groupId, itemId) =>
        setState((current) => ({
          ...current,
          requirementGroups: current.requirementGroups.map((group) =>
            group.id === groupId ? { ...group, items: group.items.filter((item) => item.id !== itemId) } : group
          ),
        })),
      addMilestone: (seed) =>
        setState((current) => ({ ...current, milestones: [...current.milestones, createMilestone(seed)] })),
      updateMilestone: (milestoneId, patch) =>
        setState((current) => ({
          ...current,
          milestones: current.milestones.map((milestone) => (milestone.id === milestoneId ? { ...milestone, ...patch } : milestone)),
        })),
      removeMilestone: (milestoneId) =>
        setState((current) => ({ ...current, milestones: current.milestones.filter((milestone) => milestone.id !== milestoneId) })),
      addAlert: (seed) =>
        setState((current) => ({ ...current, alerts: [...current.alerts, createAlert(seed)] })),
      updateAlert: (alertId, patch) =>
        setState((current) => ({
          ...current,
          alerts: current.alerts.map((alert) => (alert.id === alertId ? { ...alert, ...patch } : alert)),
        })),
      removeAlert: (alertId) =>
        setState((current) => ({ ...current, alerts: current.alerts.filter((alert) => alert.id !== alertId) })),
      resetProgress: () => setState(createDefaultState()),
    }),
    [state]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
