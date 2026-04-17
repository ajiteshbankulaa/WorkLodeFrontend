import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ArrowRight, Brain, CalendarDays, CheckCircle2, ChevronDown, CopyPlus, FileUp, Palette, Plus, Save, Search, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useAppearance } from "../context/AppearanceContext";
import { usePlan } from "../context/PlanContext";
import { requestJson } from "../lib/api";
import type { CatalogCourse, CourseMeeting, ExploreResponse } from "../lib/catalog";
import { formatAcademicTerm, getSubjectTheme } from "../lib/display";
import { LoadingState } from "../components/PageState";

type ImportDecision = { eventId: string; action: "use_suggested" | "match_candidate" | "keep_custom" | "discard"; courseCode?: string; crn?: string; section?: string };
type ToolTab = "actions" | "compare" | "schedule";

function formatMeetingTime(value: number) {
  if (value < 0) return "TBD";
  const hour = Math.floor(value / 100);
  const minute = value % 100;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
function meetingLabel(meeting: CourseMeeting) { return `${meeting.days.length ? meeting.days.join("") : "TBD"} / ${formatMeetingTime(meeting.timeStart)}-${formatMeetingTime(meeting.timeEnd)}`; }

export function Plan() {
  const { openPanel } = useAppearance();
  const { plans, activePlan, loadingPlans, savingPlan, importing, importPreview, comparePlanIds, addCourseFromCatalog, addCustomEvent, removeItem, createVariant, duplicateVariant, renameActivePlan, updatePlanNotes, selectPlan, setComparePlanIds, saveActivePlan, importSchedule, confirmImport, clearImportPreview, getPlanSummary, getPlanDiagnostics, getScenarioComparison } = usePlan();
  const [planName, setPlanName] = useState(activePlan?.name || "");
  const [courseQuery, setCourseQuery] = useState("");
  const [manualResults, setManualResults] = useState<CatalogCourse[]>([]);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const [manualSearchError, setManualSearchError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDecisions, setImportDecisions] = useState<Record<string, ImportDecision>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [planAdvice, setPlanAdvice] = useState("");
  const [planAdviceMeta, setPlanAdviceMeta] = useState<{ model?: string } | null>(null);
  const [planAdviceLoading, setPlanAdviceLoading] = useState(false);
  const [planAdviceError, setPlanAdviceError] = useState<string | null>(null);
  const [customEventOpen, setCustomEventOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCategory, setCustomCategory] = useState("Work");
  const [customDays, setCustomDays] = useState<string[]>(["M"]);
  const [customStart, setCustomStart] = useState("0900");
  const [customEnd, setCustomEnd] = useState("1030");
  const [customNotes, setCustomNotes] = useState("");
  const [toolTab, setToolTab] = useState<ToolTab>("actions");

  useEffect(() => { setPlanName(activePlan?.name || ""); }, [activePlan?.name]);
  useEffect(() => {
    if (courseQuery.trim().length < 2) { setManualResults([]); setManualSearchError(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setManualSearchLoading(true);
        setManualSearchError(null);
        const response = await requestJson<ExploreResponse>(`/catalog/explore?q=${encodeURIComponent(courseQuery.trim())}&sort=relevance&limit=8`, { signal: controller.signal, cacheTtlMs: 15_000 });
        setManualResults(response.data);
      } catch (error) {
        if (!controller.signal.aborted) setManualSearchError(error instanceof Error ? error.message : "Failed to search courses");
      } finally {
        if (!controller.signal.aborted) setManualSearchLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [courseQuery]);

  const summary = useMemo(() => getPlanSummary(activePlan), [activePlan, getPlanSummary]);
  const diagnostics = useMemo(() => getPlanDiagnostics(activePlan), [activePlan, getPlanDiagnostics]);
  const courseItems = useMemo(() => (activePlan?.items ?? []).filter((item) => item.type === "course"), [activePlan]);
  const scenarioComparison = useMemo(() => getScenarioComparison(), [getScenarioComparison, comparePlanIds, plans]);
  const weeklySchedule = useMemo(() => {
    const buckets: Record<string, Array<{ label: string; detail: string; timeStart: number }>> = { M: [], T: [], W: [], R: [], F: [], S: [], U: [] };
    for (const item of activePlan?.items ?? []) {
      const label = item.type === "course" ? item.course.code : item.title;
      for (const meeting of item.meetings ?? []) for (const day of meeting.days) if (buckets[day]) buckets[day].push({ label, detail: meetingLabel(meeting), timeStart: meeting.timeStart });
    }
    for (const day of Object.keys(buckets)) buckets[day].sort((left, right) => left.timeStart - right.timeStart);
    return buckets;
  }, [activePlan]);
  const scheduleSummary = useMemo(() => {
    const daysWithMeetings = Object.values(weeklySchedule).filter((entries) => entries.length > 0);
    const firstMeeting = daysWithMeetings.flatMap((entries) => entries).sort((a, b) => a.timeStart - b.timeStart)[0];
    return { busyDays: daysWithMeetings.length, totalMeetings: daysWithMeetings.reduce((sum, entries) => sum + entries.length, 0), firstStart: firstMeeting ? formatMeetingTime(firstMeeting.timeStart) : "No meetings" };
  }, [weeklySchedule]);

  const customEventDays = ["M", "T", "W", "R", "F", "S", "U"];

  if (loadingPlans && !activePlan) return <div className="min-h-screen bg-background px-4 py-10"><div className="container mx-auto max-w-3xl"><LoadingState label="Loading planner..." /></div></div>;

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportError(null);
      setImportDecisions({});
      setImportOpen(true);
      await importSchedule(file, activePlan?.termCode);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import schedule");
    } finally {
      event.target.value = "";
    }
  };
  const runPlanAdvice = async () => {
    try {
      setPlanAdviceLoading(true);
      setPlanAdviceError(null);
      const intensity = summary.totalAcademicLoad >= 55 ? "hard" : summary.totalAcademicLoad >= 35 ? "medium" : "light";
      const data = await requestJson<{ text?: string; model?: string }>("/ai/student/loadout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals: "", intensity, notes: `${activePlan?.name || "Current scenario"} (${activePlan?.termCode || "latest"})`, selectedCourses: courseItems.map((item) => ({ code: item.course.code, name: item.course.name, avgHours: item.course.avgHours, stdDev: item.course.stdDev, responses: item.course.responses })) }),
      });
      setPlanAdvice(data.text || "");
      setPlanAdviceMeta({ model: data.model });
    } catch (error) {
      setPlanAdviceError(error instanceof Error ? error.message : "Failed to analyze this plan");
    } finally {
      setPlanAdviceLoading(false);
    }
  };
  const addPlannerCustomEvent = () => {
    const start = Number(customStart);
    const end = Number(customEnd);
    if (!customTitle.trim() || !customDays.length) return;
    addCustomEvent({
      title: customTitle,
      description: customNotes,
      category: customCategory,
      meetings: [{ days: customDays, timeStart: start, timeEnd: end, location: customCategory }],
    });
    setCustomTitle("");
    setCustomCategory("Work");
    setCustomDays(["M"]);
    setCustomStart("0900");
    setCustomEnd("1030");
    setCustomNotes("");
    setCustomEventOpen(false);
  };

  return (
    <div className="min-h-screen bg-background pb-16" style={{ backgroundImage: "var(--page-gradient)" }}>
      <section className="border-b border-border bg-[var(--hero-gradient)]">
        <div className="container mx-auto max-w-6xl px-4 py-7">
          <div className="rounded-[32px] border border-border bg-white/92 p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Planner</div>
                <input value={planName} onChange={(event) => setPlanName(event.target.value)} onBlur={() => renameActivePlan(planName)} className="mt-2 w-full bg-transparent text-4xl font-black tracking-tight text-text outline-none" />
                <div className="mt-2 text-sm text-text-secondary">{formatAcademicTerm(activePlan?.termCode || "latest")} / {plans.length} scenario{plans.length === 1 ? "" : "s"}</div>
                <div className="mt-5 flex flex-wrap items-stretch gap-4">
                  <SummaryCard label="Credits" value={summary.totalCredits} />
                  <SummaryCard label="Outside Load" value={summary.totalOutsideHours.toFixed(1)} />
                  <SummaryCard label="Total Load" value={summary.totalAcademicLoad.toFixed(1)} />
                  <SummaryCard label="Meetings" value={scheduleSummary.totalMeetings} />
                  <div className={`flex-[2] min-w-[200px] rounded-[22px] border p-5 flex flex-col justify-center ${summary.warnings.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Checkpoint</div>
                    <div className="mt-1 text-xl font-black leading-tight sm:text-2xl">{diagnostics.checkpointLabel}</div>
                    <div className="mt-2 text-sm font-semibold opacity-90">Overall Score: {diagnostics.scenarioScore}/100</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover"><FileUp size={15} />Import<input type="file" accept=".ics,text/calendar" className="hidden" onChange={handleImportFile} /></label>
                <button type="button" onClick={() => createVariant()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-text shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-surface-2"><Plus size={15} />New scenario</button>
                <button type="button" onClick={() => void saveActivePlan()} disabled={savingPlan} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-text shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-surface-2 disabled:opacity-60"><Save size={15} />{savingPlan ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setSettingsOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-text shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-surface-2"><Sparkles size={15} />Settings</button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr),auto]">
              <select value={activePlan?.id || ""} onChange={(event) => selectPlan(event.target.value)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text outline-none focus:border-primary">
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">Focus: load, risk balance, meetings, and pacing.</div>
            </div>

            {settingsOpen && <div className="mt-4 space-y-4 rounded-[24px] border border-border bg-surface p-4"><div className="flex flex-wrap gap-3"><button type="button" onClick={duplicateVariant} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text"><CopyPlus size={15} />Duplicate scenario</button><button type="button" onClick={openPanel} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text"><Palette size={15} />Appearance</button><div className="text-sm text-text-secondary">Scenario tools live here so the main planner stays focused on the schedule.</div></div><label className="block"><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Scenario notes</div><textarea value={activePlan?.notes || ""} onChange={(event) => updatePlanNotes(event.target.value)} rows={3} className="w-full rounded-2xl border border-border bg-white px-3 py-3 text-sm text-text-secondary outline-none focus:border-primary" placeholder="Advising notes, non-negotiables, internship timing, commute constraints..." /></label></div>}
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <section className="rounded-[28px] border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Current items</div><div className="mt-1 text-sm text-text-secondary">Use scenarios to compare different mixes without losing the active plan.</div></div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">{(activePlan?.items ?? []).length} items</span>
            </div>
            {(summary.warnings.length > 0 || diagnostics.conflicts.length > 0) && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{diagnostics.conflicts.length > 0 ? `${diagnostics.conflicts.length} direct meeting conflict${diagnostics.conflicts.length === 1 ? "" : "s"} detected.` : summary.warnings[0]}{summary.warnings.length > 1 && <span className="ml-2 font-semibold">+{summary.warnings.length - 1} more</span>}</div>}
            {(activePlan?.items ?? []).length > 0 ? <div className="mt-4 space-y-2">
              {activePlan?.items.map((item) => {
                const expanded = Boolean(expandedItems[item.plannerItemId]);
                const title = item.type === "course" ? item.course.code : item.title;
                const subtitle = item.type === "course" ? item.course.name : "Imported custom schedule block";
                const theme = item.type === "course" ? getSubjectTheme(item.course.dept) : null;
                return <div key={item.plannerItemId} className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-sm" style={theme ? { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder, boxShadow: `inset 4px 0 0 ${theme.accent}` } : undefined}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button type="button" onClick={() => setExpandedItems((current) => ({ ...current, [item.plannerItemId]: !current[item.plannerItemId] }))} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2"><div className="font-bold text-text">{title}</div>{item.type === "course" && theme && <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ borderColor: theme.accentBorder, backgroundColor: "rgba(255,255,255,0.72)", color: theme.accentText }}>{item.course.dept}</span>}{item.type === "course" && <><Pill tone={theme}>{item.course.credits ?? 0} cr</Pill><Pill tone={theme}>{item.course.avgHours ?? 0}h outside</Pill></>}<Pill tone={theme}>{item.source === "ics" ? "Imported" : "Manual"}</Pill></div>
                      <div className="mt-1 text-sm text-text-secondary">{subtitle}</div>
                    </button>
                    <button type="button" onClick={() => setExpandedItems((current) => ({ ...current, [item.plannerItemId]: !current[item.plannerItemId] }))} className="rounded-lg p-2 text-muted transition hover:bg-white/75"><ChevronDown size={16} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} /></button>
                    <button type="button" onClick={() => removeItem(item.plannerItemId)} className="rounded-lg p-2 text-muted transition hover:bg-white/75 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                  {expanded && <div className="border-t border-border px-4 py-3">{item.meetings.length ? <div className="space-y-1 text-sm text-text-secondary">{item.meetings.map((meeting, index) => <div key={`${item.plannerItemId}-${index}`}>{meetingLabel(meeting)}</div>)}</div> : <div className="text-sm text-text-secondary">No scheduled meetings attached.</div>}</div>}
                </div>;
              })}
            </div> : <div className="mt-4 rounded-[24px] border-2 border-dashed border-border bg-surface px-6 py-10 text-center"><div className="text-lg font-bold text-text">Your planner is empty.</div><p className="mt-2 text-sm text-text-secondary">Add courses manually or import a QUACS `.ics` file to start shaping a real semester.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => setManualAddOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-bold text-text"><Search size={15} />Add course</button><Link to="/explore" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-bold text-text">Browse courses<ArrowRight size={15} /></Link></div></div>}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[28px] border border-border bg-white/92 p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Planner workspace</div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-[22px] border border-border bg-surface p-2">
                <TabButton active={toolTab === "actions"} onClick={() => setToolTab("actions")}>Plan tools</TabButton>
                <TabButton active={toolTab === "compare"} onClick={() => setToolTab("compare")}>Compare</TabButton>
                <TabButton active={toolTab === "schedule"} onClick={() => setToolTab("schedule")}>Schedule</TabButton>
              </div>
              <div className="mt-4 text-sm text-text-secondary">
                {toolTab === "actions" ? "Quick edits, AI guidance, and manual additions stay together here." : toolTab === "compare" ? "Scenario comparison and calendar imports live in one review lane." : "Custom constraints and weekly schedule stay in the scheduling lane."}
              </div>
            </section>

            {toolTab === "actions" && <>
            <AccordionCard title="AI balance note" subtitle="Interpret the current scenario and suggest one balancing move." icon={<Brain size={15} />} open={aiOpen} onToggle={() => setAiOpen((open) => !open)}>
              <button type="button" onClick={runPlanAdvice} disabled={planAdviceLoading || courseItems.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Wand2 size={15} />{planAdviceLoading ? "Analyzing..." : "Analyze scenario"}</button>
              {planAdviceError && <div className="mt-3 text-sm text-red-600">{planAdviceError}</div>}
              <div className="mt-3 rounded-2xl border border-border bg-white p-3 text-sm text-text-secondary whitespace-pre-wrap">{planAdvice || "Run the helper when you want a quick workload interpretation without leaving the planner."}</div>
              {planAdviceMeta?.model && <div className="mt-2 text-xs text-text-secondary">Model: {planAdviceMeta.model}</div>}
            </AccordionCard>
            </>}

            {toolTab === "compare" && <>
            <AccordionCard title="Scenario compare" subtitle="Compare two saved scenarios with a cleaner planning summary." icon={<AlertTriangle size={15} />} open={compareOpen} onToggle={() => setCompareOpen((open) => !open)}>
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Scenario A</div>
                    <select value={comparePlanIds[0] || ""} onChange={(event) => setComparePlanIds([event.target.value, comparePlanIds[1] || activePlan?.id || ""])} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold text-text outline-none focus:border-primary">
                      <option value="">Select scenario</option>
                      {plans.map((plan) => <option key={`left-${plan.id}`} value={plan.id}>{plan.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Scenario B</div>
                    <select value={comparePlanIds[1] || ""} onChange={(event) => setComparePlanIds([comparePlanIds[0] || activePlan?.id || "", event.target.value])} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold text-text outline-none focus:border-primary">
                      <option value="">Select scenario</option>
                      {plans.map((plan) => <option key={`right-${plan.id}`} value={plan.id}>{plan.name}</option>)}
                    </select>
                  </label>
                </div>
                {scenarioComparison ? <div className="rounded-[22px] border border-border bg-surface p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CompareMetric label="Credits" value={scenarioComparison.creditsDelta} />
                    <CompareMetric label="Total load" value={scenarioComparison.totalLoadDelta} />
                    <CompareMetric label="Warnings" value={scenarioComparison.warningDelta} />
                    <CompareMetric label="Planner score" value={scenarioComparison.scoreDelta} />
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-secondary">
                    Positive values mean Scenario B is higher than Scenario A. Use this to spot heavier variants before you save or import around them.
                  </div>
                </div> : <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-4 text-sm text-text-secondary">Select two scenarios to compare credits, workload, warnings, and planner score in one clean view.</div>}
              </div>
            </AccordionCard>

            <AccordionCard title="Schedule import" subtitle="Bring in a `.ics` calendar file and review matches before applying it." icon={<Upload size={15} />} open={importOpen || Boolean(importPreview) || Boolean(importError)} onToggle={() => setImportOpen((open) => !open)}>
              <div className="rounded-[22px] border border-border bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-text">Import calendar file</div>
                    <div className="mt-1 text-sm text-text-secondary">Upload an `.ics` export from QUACS or another calendar source. Review matched, ambiguous, and custom events before they are added to the active scenario.</div>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-hover">
                    <FileUp size={15} />
                    {importing ? "Preparing..." : "Choose .ics file"}
                    <input type="file" accept=".ics,text/calendar" className="hidden" onChange={handleImportFile} />
                  </label>
                </div>
                {!importPreview && !importError && <div className="mt-4 rounded-2xl border border-dashed border-border bg-white px-4 py-3 text-sm text-text-secondary">The imported events are only added after you confirm the review below.</div>}
              </div>

              {importError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</div>}
              {importPreview && <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryCard label="Matched" value={importPreview.summary.matched} compact />
                  <SummaryCard label="Ambiguous" value={importPreview.summary.ambiguous} compact />
                  <SummaryCard label="Unmatched" value={importPreview.summary.unmatched} compact />
                  <SummaryCard label="Events" value={importPreview.summary.total} compact />
                </div>
                <div className="rounded-[22px] border border-border bg-surface p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
                    <CheckCircle2 size={16} />
                    Import review
                  </div>
                  <div className="space-y-3">
                    {importPreview.items.map((item) => <div key={item.eventId} className="rounded-2xl border border-border bg-white p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold text-text">{item.title}</div><div className="mt-1 text-xs text-text-secondary">{meetingLabel(item.meeting)}</div><div className="mt-1 text-xs text-text-secondary">{item.matchStatus} / confidence {item.confidence}</div></div><div className="min-w-[220px]"><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Decision</div><select value={importDecisions[item.eventId]?.action || ""} onChange={(event) => setImportDecisions((current) => ({ ...current, [item.eventId]: { eventId: item.eventId, action: event.target.value as ImportDecision["action"] } }))} className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"><option value="">Use default</option>{item.matchStatus === "matched" && <option value="use_suggested">Use suggested match</option>}{item.matchStatus === "ambiguous" && <option value="match_candidate">Choose candidate</option>}<option value="keep_custom">Keep as custom event</option><option value="discard">Discard</option></select></div></div></div>)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={importing} onClick={() => void confirmImport(Object.values(importDecisions))} className="rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{importing ? "Applying..." : "Apply import to scenario"}</button>
                  <button type="button" onClick={clearImportPreview} className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-text">Clear review</button>
                </div>
              </div>}
            </AccordionCard>
            </>}

            {toolTab === "actions" && <>
            <AccordionCard title="Add course" subtitle="Search once and pull a course directly into the active scenario." icon={<Search size={15} />} open={manualAddOpen} onToggle={() => setManualAddOpen((open) => !open)}>
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} /><input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="Search a course to add manually..." className="w-full rounded-2xl border border-border bg-white py-3 pl-10 pr-4 text-sm text-text outline-none focus:border-primary" /></div>
              {manualSearchError && <div className="mt-3 text-sm text-red-600">{manualSearchError}</div>}
              {manualSearchLoading && <div className="mt-3 text-sm text-text-secondary">Searching courses...</div>}
              {manualResults.length > 0 && <div className="mt-3 space-y-2">{manualResults.map((course) => <button key={course.id} type="button" onClick={() => { addCourseFromCatalog(course); setCourseQuery(""); setManualResults([]); }} className="w-full rounded-2xl border border-border bg-white px-3 py-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-text">{course.code}</div><div className="mt-1 text-sm text-text-secondary">{course.name}</div></div><div className="text-right text-xs text-text-secondary"><div>{course.avgHours ?? "N/A"}h</div><div>{course.trustLabel}</div></div></div></button>)}</div>}
            </AccordionCard>

            <AccordionCard title="Custom event" subtitle="Add work, commute, study blocks, or other real-life constraints." icon={<Plus size={15} />} open={customEventOpen} onToggle={() => setCustomEventOpen((open) => !open)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="Event title" className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <select value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option>Work</option><option>Commute</option><option>Club</option><option>Study</option><option>Other</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{customEventDays.map((day) => <button key={day} type="button" onClick={() => setCustomDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} className={`rounded-full px-3 py-1.5 text-xs font-bold ${customDays.includes(day) ? "bg-primary text-white" : "border border-border bg-white text-text-secondary"}`}>{day}</button>)}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={customStart} onChange={(event) => setCustomStart(event.target.value)} placeholder="0900" className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <input value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} placeholder="1030" className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" />
              </div>
              <textarea value={customNotes} onChange={(event) => setCustomNotes(event.target.value)} rows={3} placeholder="Optional notes" className="mt-3 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <button type="button" onClick={addPlannerCustomEvent} disabled={!customTitle.trim() || customDays.length === 0} className="mt-3 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-60">Add event</button>
            </AccordionCard>
            </>}

            {toolTab === "schedule" && <>
            <AccordionCard title="Weekly schedule" subtitle={`${scheduleSummary.busyDays} busy days / first start ${scheduleSummary.firstStart}`} icon={<CalendarDays size={15} />} open={scheduleOpen} onToggle={() => setScheduleOpen((open) => !open)}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{Object.entries(weeklySchedule).map(([day, entries]) => <div key={day} className="rounded-2xl border border-border bg-white p-3"><div className="text-sm font-bold text-text">{day}</div><div className="mt-2 space-y-2">{entries.length ? entries.map((entry) => <div key={`${day}-${entry.label}-${entry.detail}`} className="rounded-xl bg-surface px-3 py-2"><div className="text-sm font-semibold text-text">{entry.label}</div><div className="mt-1 text-xs text-text-secondary">{entry.detail}</div></div>) : <div className="text-xs text-text-secondary">No meetings</div>}</div></div>)}</div>
              {(diagnostics.conflicts.length > 0 || diagnostics.compressedDays.length > 0) && <div className="mt-4 grid gap-3">{diagnostics.conflicts.map((conflict) => <div key={`${conflict.day}-${conflict.firstLabel}-${conflict.secondLabel}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{conflict.day}: {conflict.firstLabel} overlaps with {conflict.secondLabel} by {conflict.overlapMinutes} minutes.</div>)}{diagnostics.compressedDays.map((day) => <div key={day.day} className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary">{day.day}: {day.meetingCount} meetings / {day.totalMeetingHours} class hours.</div>)}</div>}
            </AccordionCard>
            </>}

          </aside>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) { return <div className="flex-1 min-w-[130px] rounded-[22px] border border-border bg-surface p-5 flex flex-col justify-center shadow-sm"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div><div className={`mt-1 font-black text-text ${compact ? "text-xl" : "text-3xl"}`}>{value}</div></div>; }
function CompareMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl border border-border bg-white px-4 py-3"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div><div className="mt-1 text-2xl font-black text-text">{value}</div></div>; }
function Pill({ children, tone }: { children: ReactNode; tone?: { accentBorder: string; accentText: string } | null }) { return <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-text-secondary" style={tone ? { borderColor: tone.accentBorder, backgroundColor: "rgba(255,255,255,0.68)", color: tone.accentText } : undefined}>{children}</span>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-2xl border px-3 py-2.5 text-sm font-bold transition-all ${active ? "border-primary bg-primary text-white shadow-sm" : "border-border bg-white text-text-secondary shadow-sm hover:border-primary/35 hover:text-text"}`}>{children}</button>; }
function AccordionCard({ title, subtitle, icon, open, onToggle, children }: { title: string; subtitle: string; icon: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) { return <section className="rounded-[24px] border border-border bg-white shadow-sm"><button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-muted">{icon}{title}</div><div className="mt-1 text-sm text-text-secondary">{subtitle}</div></div><ChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} /></button>{open && <div className="border-t border-border px-4 py-4">{children}</div>}</section>; }
