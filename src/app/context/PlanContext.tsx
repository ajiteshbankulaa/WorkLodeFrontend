import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { requestJson } from "../lib/api";
import type { CatalogCourse, CourseMeeting } from "../lib/catalog";
import type { PlannerCourseItem, PlannerCustomEvent, PlannerDiagnostics, PlannerItem, SavedPlan, ScenarioComparison } from "../lib/planner";
import { comparePlans, getPlannerDiagnostics, getPlannerTotals, getPlannerWarnings } from "../lib/planner";
import { useAuth } from "./AuthContext";

const LOCAL_STORAGE_KEY = "worklode_saved_plans_v2";

type PlannerCandidate = {
  courseCode: string;
  crn?: string;
  section?: string;
  label: string;
};

type ImportPreviewItem = {
  eventId: string;
  title: string;
  location?: string;
  meeting: CourseMeeting;
  occurrenceEstimate: number;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  confidence: string;
  suggestedItem?: any;
  candidates?: PlannerCandidate[];
  customEvent?: any;
};

type ImportPreview = {
  filename?: string;
  termCode: string;
  summary: {
    matched: number;
    ambiguous: number;
    unmatched: number;
    total: number;
  };
  items: ImportPreviewItem[];
};

type PlanContextType = {
  plans: SavedPlan[];
  activePlanId: string | null;
  activePlan: SavedPlan | null;
  loadingPlans: boolean;
  savingPlan: boolean;
  importing: boolean;
  importPreview: ImportPreview | null;
  comparePlanIds: string[];
  addCourse: (course: {
    id: string;
    code: string;
    name: string;
    avgHours: number;
    credits: number;
  }) => void;
  addCourseFromCatalog: (course: CatalogCourse) => void;
  addCustomEvent: (event: { title: string; description?: string; category?: string; meetings: CourseMeeting[] }) => void;
  removeCourse: (courseId: string) => void;
  removeItem: (plannerItemId: string) => void;
  isInPlan: (courseId: string) => boolean;
  createVariant: (name?: string) => void;
  duplicateVariant: () => void;
  renameActivePlan: (name: string) => void;
  updatePlanNotes: (notes: string) => void;
  selectPlan: (planId: string) => void;
  setComparePlanIds: (planIds: string[]) => void;
  saveActivePlan: () => Promise<void>;
  importSchedule: (file: File, termCode?: string) => Promise<void>;
  confirmImport: (
    decisions?: Array<{
      eventId: string;
      action: "use_suggested" | "match_candidate" | "keep_custom" | "discard";
      courseCode?: string;
      crn?: string;
      section?: string;
    }>
  ) => Promise<void>;
  clearImportPreview: () => void;
  getPlanSummary: (plan?: SavedPlan | null) => {
    totalCredits: number;
    totalOutsideHours: number;
    totalInClassHours: number;
    totalAcademicLoad: number;
    warnings: string[];
  };
  getPlanDiagnostics: (plan?: SavedPlan | null) => PlannerDiagnostics;
  getScenarioComparison: () => ScenarioComparison | null;
};

const PlanContext = createContext<PlanContextType | undefined>(undefined);

function createEmptyPlan(name = "Main scenario"): SavedPlan {
  return {
    id: crypto.randomUUID(),
    name,
    termCode: "latest",
    items: [],
    notes: "",
    updatedAt: new Date().toISOString(),
    active: true,
  };
}

function loadLocalPlans(): SavedPlan[] {
  if (typeof window === "undefined") {
    return [createEmptyPlan()];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [createEmptyPlan()];
    }

    const parsed = JSON.parse(raw) as SavedPlan[];
    return parsed.length > 0 ? parsed : [createEmptyPlan()];
  } catch {
    return [createEmptyPlan()];
  }
}

function persistLocalPlans(plans: SavedPlan[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plans));
}

function initializeLocalPlannerState() {
  const localPlans = loadLocalPlans();
  const activePlanId =
    localPlans.find((plan) => plan.active)?.id ??
    localPlans[0]?.id ??
    null;

  return {
    plans: localPlans.map((plan) => ({
      ...plan,
      active: plan.id === activePlanId,
    })),
    activePlanId,
  };
}

function toMeeting(raw: any): CourseMeeting {
  return {
    days: Array.isArray(raw?.days) ? raw.days : [],
    timeStart: typeof raw?.timeStart === "number" ? raw.timeStart : -1,
    timeEnd: typeof raw?.timeEnd === "number" ? raw.timeEnd : -1,
    dateStart: raw?.dateStart || null,
    dateEnd: raw?.dateEnd || null,
    location: raw?.location || "",
    instructor: raw?.instructor || "",
  };
}

function toCatalogCourse(raw: any): CatalogCourse {
  return {
    id: raw?.courseCode || raw?.id || crypto.randomUUID(),
    courseCode: raw?.courseCode || raw?.id || "",
    code: raw?.code || raw?.courseCode || "",
    name: raw?.name || "Course",
    dept: raw?.dept || "",
    courseNumber: typeof raw?.courseNumber === "number" ? raw.courseNumber : null,
    level: raw?.level || "",
    credits: typeof raw?.credits === "number" ? raw.credits : null,
    avgHours: typeof raw?.avgHours === "number" ? raw.avgHours : null,
    stdDev: typeof raw?.stdDev === "number" ? raw.stdDev : null,
    responses: typeof raw?.responses === "number" ? raw.responses : null,
    statsSource: raw?.statsSource || "manual",
    trustTier: raw?.trustTier || "unavailable",
    trustLabel: raw?.trustLabel || "Unavailable",
    meetsMinResponses: Boolean(raw?.meetsMinResponses),
    latestTerm: raw?.latestTerm || raw?.termCode || "",
    termsOffered: Array.isArray(raw?.termsOffered) ? raw.termsOffered : [],
    attributes: Array.isArray(raw?.attributes) ? raw.attributes : [],
    professor: raw?.professor || "",
    section: raw?.section || "",
    crn: raw?.crn || "",
    meetings: Array.isArray(raw?.meetings) ? raw.meetings.map(toMeeting) : [],
  };
}

function normalizePlannerItem(raw: any): PlannerItem {
  if (raw?.type === "custom_event") {
    const customEvent: PlannerCustomEvent = {
      type: "custom_event",
      plannerItemId: raw?.plannerItemId || crypto.randomUUID(),
      source: "ics",
      title: raw?.title || raw?.name || "Imported event",
      description: raw?.description || "",
      meetings: Array.isArray(raw?.meetings) ? raw.meetings.map(toMeeting) : raw?.meeting ? [toMeeting(raw.meeting)] : [],
    };
    return customEvent;
  }

  const course = toCatalogCourse(raw);
  const plannerCourse: PlannerCourseItem = {
    type: "course",
    plannerItemId: raw?.plannerItemId || crypto.randomUUID(),
    source: raw?.source === "ics" ? "ics" : "manual",
    course,
    meetings: Array.isArray(raw?.meetings) ? raw.meetings.map(toMeeting) : raw?.meeting ? [toMeeting(raw.meeting)] : [],
    crn: raw?.crn || course.crn,
    section: raw?.section || course.section,
  };
  return plannerCourse;
}

function normalizePlan(raw: any): SavedPlan {
  return {
    id: raw?.id || raw?._id || crypto.randomUUID(),
    name: raw?.name || "Saved plan",
    termCode: raw?.termCode || "latest",
    items: Array.isArray(raw?.items) ? raw.items.map(normalizePlannerItem) : [],
    updatedAt: raw?.updatedAt || raw?.updated_at || new Date().toISOString(),
    active: Boolean(raw?.active),
    notes: raw?.notes || "",
    summary: raw?.summary,
  };
}

function serializePlannerItem(item: PlannerItem) {
  if (item.type === "custom_event") {
    return {
      type: "custom_event",
      source: item.source,
      title: item.title,
      description: item.description,
      category: item.category,
      meetings: item.meetings,
    };
  }

  return {
    type: "course",
    source: item.source,
    courseCode: item.course.courseCode,
    code: item.course.code,
    name: item.course.name,
    dept: item.course.dept,
    credits: item.course.credits ?? 0,
    avgHours: item.course.avgHours ?? 0,
    stdDev: item.course.stdDev,
    responses: item.course.responses,
    trustTier: item.course.trustTier,
    trustLabel: item.course.trustLabel,
    statsSource: item.course.statsSource,
    termCode: item.course.latestTerm,
    crn: item.crn || item.course.crn,
    section: item.section || item.course.section,
    meetings: item.meetings,
  };
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [initialPlannerState] = useState(() => initializeLocalPlannerState());
  const [plans, setPlans] = useState<SavedPlan[]>(initialPlannerState.plans);
  const [activePlanId, setActivePlanId] = useState<string | null>(initialPlannerState.activePlanId);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [comparePlanIds, setComparePlanIds] = useState<string[]>([]);

  useEffect(() => {
    persistLocalPlans(plans);
  }, [plans]);

  useEffect(() => {
    let ignore = false;

    async function loadRemotePlans() {
      if (!token) {
        if (!ignore) {
          setLoadingPlans(false);
        }
        return;
      }

      try {
        const data = await requestJson<{ plans: any[] }>("/planner/plans", { token, cacheTtlMs: 0 });
        if (!ignore) {
          const remotePlans = (data.plans || []).map(normalizePlan);
          if (remotePlans.length > 0) {
            setPlans(remotePlans);
            const active = remotePlans.find((plan) => plan.active) || remotePlans[0];
            setActivePlanId(active.id);
          }
        }
      } catch {
        // Keep local plans if the backend is unavailable.
      } finally {
        if (!ignore) {
          setLoadingPlans(false);
        }
      }
    }

    void loadRemotePlans();
    return () => {
      ignore = true;
    };
  }, [token]);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) ?? plans[0] ?? null,
    [plans, activePlanId]
  );

  const updateActivePlan = (updater: (plan: SavedPlan) => SavedPlan) => {
    setPlans((currentPlans) =>
      currentPlans.map((plan) => (plan.id === activePlanId ? updater(plan) : plan))
    );
  };

  const addCourseFromCatalog = (course: CatalogCourse) => {
    if (!activePlan) {
      return;
    }

    updateActivePlan((plan) => {
      const exists = plan.items.some(
        (item) => item.type === "course" && item.course.courseCode === course.courseCode
      );
      if (exists) {
        return plan;
      }

      const nextItem: PlannerCourseItem = {
        type: "course",
        plannerItemId: crypto.randomUUID(),
        source: "manual",
        course,
        meetings: course.meetings ?? [],
        crn: course.crn,
        section: course.section,
      };

      return {
        ...plan,
        items: [...plan.items, nextItem],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const addCustomEvent = (event: { title: string; description?: string; category?: string; meetings: CourseMeeting[] }) => {
    updateActivePlan((plan) => ({
      ...plan,
      items: [
        ...plan.items,
        {
          type: "custom_event",
          plannerItemId: crypto.randomUUID(),
          source: "manual",
          title: event.title.trim() || "Custom event",
          description: event.description || "",
          category: event.category || "Other",
          meetings: event.meetings,
        } satisfies PlannerCustomEvent,
      ],
      updatedAt: new Date().toISOString(),
    }));
  };

  const addCourse = (course: {
    id: string;
    code: string;
    name: string;
    avgHours: number;
    credits: number;
  }) => {
    addCourseFromCatalog(
      toCatalogCourse({
        id: course.id,
        courseCode: course.id,
        code: course.code,
        name: course.name,
        avgHours: course.avgHours,
        credits: course.credits,
        trustTier: "unavailable",
        trustLabel: "Added manually",
        statsSource: "manual",
        latestTerm: "latest",
        termsOffered: [],
        attributes: [],
      })
    );
  };

  const removeCourse = (courseId: string) => {
    updateActivePlan((plan) => ({
      ...plan,
      items: plan.items.filter((item) => !(item.type === "course" && item.course.courseCode === courseId)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeItem = (plannerItemId: string) => {
    updateActivePlan((plan) => ({
      ...plan,
      items: plan.items.filter((item) => item.plannerItemId !== plannerItemId),
      updatedAt: new Date().toISOString(),
    }));
  };

  const isInPlan = (courseId: string) => {
    return Boolean(
      activePlan?.items.some((item) => item.type === "course" && item.course.courseCode === courseId)
    );
  };

  const createVariant = (name?: string) => {
    const nextPlan = createEmptyPlan(name || `Scenario ${plans.length + 1}`);
    setPlans((currentPlans) => [...currentPlans.map((plan) => ({ ...plan, active: false })), nextPlan]);
    setActivePlanId(nextPlan.id);
  };

  const duplicateVariant = () => {
    if (!activePlan) {
      return;
    }

    const clone: SavedPlan = {
      ...activePlan,
      id: crypto.randomUUID(),
      name: `${activePlan.name} alt`,
      active: true,
      updatedAt: new Date().toISOString(),
      items: [...activePlan.items],
    };

    setPlans((currentPlans) => [...currentPlans.map((plan) => ({ ...plan, active: false })), clone]);
    setActivePlanId(clone.id);
  };

  const renameActivePlan = (name: string) => {
    updateActivePlan((plan) => ({
      ...plan,
      name: name.trim() || plan.name,
      updatedAt: new Date().toISOString(),
    }));
  };

  const updatePlanNotes = (notes: string) => {
    updateActivePlan((plan) => ({
      ...plan,
      notes,
      updatedAt: new Date().toISOString(),
    }));
  };

  const selectPlan = (planId: string) => {
    setActivePlanId(planId);
    setPlans((currentPlans) =>
      currentPlans.map((plan) => ({
        ...plan,
        active: plan.id === planId,
      }))
    );
  };

  const saveActivePlan = async () => {
    if (!activePlan) {
      return;
    }

    if (!token) {
      persistLocalPlans(plans);
      return;
    }

    setSavingPlan(true);
    try {
      const body = {
        name: activePlan.name,
        termCode: activePlan.termCode,
        notes: activePlan.notes || "",
        items: activePlan.items.map(serializePlannerItem),
        active: true,
      };

      const saved = await requestJson<any>(`/planner/plans/${activePlan.id}`, {
        token,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(async () =>
        requestJson<any>("/planner/plans", {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );

      const normalized = normalizePlan(saved);
      setPlans((currentPlans) => {
        const exists = currentPlans.some((plan) => plan.id === normalized.id);
        const nextPlans = exists
          ? currentPlans.map((plan) => (plan.id === normalized.id ? normalized : { ...plan, active: false }))
          : [...currentPlans.map((plan) => ({ ...plan, active: false })), normalized];
        return nextPlans;
      });
      setActivePlanId(normalized.id);
    } finally {
      setSavingPlan(false);
    }
  };

  const importSchedule = async (file: File, termCode?: string) => {
    if (!token) {
      throw new Error("Sign in before importing a saved schedule.");
    }

    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (termCode) {
        form.append("term_code", termCode);
      }

      const preview = await requestJson<ImportPreview>("/planner/import-ics", {
        token,
        method: "POST",
        body: form,
      });
      setImportPreview(preview);
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async (
    decisions: Array<{
      eventId: string;
      action: "use_suggested" | "match_candidate" | "keep_custom" | "discard";
      courseCode?: string;
      crn?: string;
      section?: string;
    }> = []
  ) => {
    if (!token || !importPreview || !activePlan) {
      return;
    }

    setImporting(true);
    try {
      const data = await requestJson<{ items: any[] }>("/planner/import-ics/confirm", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termCode: importPreview.termCode,
          previewItems: importPreview.items,
          decisions,
        }),
      });

      updateActivePlan((plan) => ({
        ...plan,
        termCode: importPreview.termCode,
        items: [...plan.items, ...data.items.map(normalizePlannerItem)],
        updatedAt: new Date().toISOString(),
      }));
      setImportPreview(null);
    } finally {
      setImporting(false);
    }
  };

  const clearImportPreview = () => setImportPreview(null);

  const getPlanSummary = (plan = activePlan) => {
    const items = plan?.items ?? [];
    const totals = getPlannerTotals(items);
    return {
      ...totals,
      warnings: getPlannerWarnings(items),
    };
  };

  const getPlanDiagnostics = (plan = activePlan) => getPlannerDiagnostics(plan?.items ?? []);

  const getScenarioComparison = () => {
    const [leftId, rightId] = comparePlanIds;
    const left = plans.find((plan) => plan.id === leftId);
    const right = plans.find((plan) => plan.id === rightId);
    return comparePlans(left, right);
  };

  const value: PlanContextType = {
    plans,
    activePlanId,
    activePlan,
    loadingPlans,
    savingPlan,
    importing,
    importPreview,
    comparePlanIds,
    addCourse,
    addCourseFromCatalog,
    addCustomEvent,
    removeCourse,
    removeItem,
    isInPlan,
    createVariant,
    duplicateVariant,
    renameActivePlan,
    updatePlanNotes,
    selectPlan,
    setComparePlanIds,
    saveActivePlan,
    importSchedule,
    confirmImport,
    clearImportPreview,
    getPlanSummary,
    getPlanDiagnostics,
    getScenarioComparison,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error("usePlan must be used within a PlanProvider");
  }
  return context;
}
