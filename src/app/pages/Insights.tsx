import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, BarChart3, Brain, Briefcase, Clock3, GraduationCap, Save, Shield, Sigma, Sparkles, Wand2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { LoadingState } from "../components/PageState";
import { requestJson } from "../lib/api";
import type { CatalogCourse, ExploreResponse } from "../lib/catalog";
import { average, formatAcademicTerm, formatMetric } from "../lib/display";

type InsightBuckets = { heaviest: CatalogCourse[]; lightest: CatalogCourse[]; variable: CatalogCourse[]; pool: CatalogCourse[]; departments: string[] };
type ModelOption = { id: string; label: string; tier: string; category: string; default: boolean };
type ModelsResponse = { default: string; models: ModelOption[] };
type TermsResponse = { terms: string[] };
type DepartmentRiskRow = { course_code: string; name: string; count: number; avg_hours: number | null; avg_difficulty: number | null };
type ActionState = { loading: boolean; error: string | null };
type AdminChartMetric = "avg_hours" | "responses" | "variability";

const DEFAULT_STUDENT = { graduationPlanNotes: "", takenClasses: "", goals: "", intensity: "medium" as const, targetJobs: "" };
const DEFAULT_ADMIN = { dept: "", term: "", course: "", includeExternalData: false, focusArea: "Workload pressure and staffing", notes: "" };

async function loadInsightBuckets() {
  const [heaviest, lightest, variable, pool] = await Promise.all([
    requestJson<ExploreResponse>("/catalog/explore?sort=workload_desc&limit=8", { cacheTtlMs: 60_000 }),
    requestJson<ExploreResponse>("/catalog/explore?sort=workload_asc&limit=8", { cacheTtlMs: 60_000 }),
    requestJson<ExploreResponse>("/catalog/explore?sort=variability_desc&limit=8", { cacheTtlMs: 60_000 }),
    requestJson<ExploreResponse>("/catalog/explore?sort=relevance&limit=18", { cacheTtlMs: 60_000 }),
  ]);
  const merged = [...heaviest.data, ...lightest.data, ...variable.data, ...pool.data];
  const seen = new Set<string>();
  const deduped = merged.filter((course) => { const key = course.courseCode || course.id; if (seen.has(key)) return false; seen.add(key); return true; });
  const departments = Array.from(new Set([...heaviest.availableFilters.departments, ...lightest.availableFilters.departments, ...variable.availableFilters.departments, ...pool.availableFilters.departments])).sort();
  return { heaviest: heaviest.data.slice(0, 4), lightest: lightest.data.filter((course) => course.avgHours !== null).sort((a, b) => (a.avgHours ?? 999) - (b.avgHours ?? 999)).slice(0, 4), variable: variable.data.slice(0, 4), pool: deduped.slice(0, 12), departments } satisfies InsightBuckets;
}
async function postJson<T>(path: string, body: unknown, token?: string | null) { return requestJson<T>(path, { method: "POST", token, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

export function Insights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user, isAuthenticated, loading: authLoading, authError } = useAuth();
  const { activePlan, getPlanSummary, getPlanDiagnostics } = usePlan();
  const [buckets, setBuckets] = useState<InsightBuckets | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [studentInputs, setStudentInputs] = useState(DEFAULT_STUDENT);
  const [selectedLoadout, setSelectedLoadout] = useState<string[]>([]);
  const [loadoutQuestion, setLoadoutQuestion] = useState("");
  const [studentPlan, setStudentPlan] = useState("");
  const [loadoutAdvice, setLoadoutAdvice] = useState("");
  const [adminInputs, setAdminInputs] = useState(DEFAULT_ADMIN);
  const [riskRows, setRiskRows] = useState<DepartmentRiskRow[]>([]);
  const [adminMemo, setAdminMemo] = useState("");
  const [interventionPlan, setInterventionPlan] = useState("");
  const [loadoutState, setLoadoutState] = useState<ActionState>({ loading: false, error: null });
  const [studentPlanState, setStudentPlanState] = useState<ActionState>({ loading: false, error: null });
  const [adminMemoState, setAdminMemoState] = useState<ActionState>({ loading: false, error: null });
  const [interventionState, setInterventionState] = useState<ActionState>({ loading: false, error: null });
  const [riskState, setRiskState] = useState<ActionState>({ loading: false, error: null });
  const [departmentCourses, setDepartmentCourses] = useState<CatalogCourse[]>([]);
  const [departmentCoursesState, setDepartmentCoursesState] = useState<ActionState>({ loading: false, error: null });
  const [adminChartMetric, setAdminChartMetric] = useState<AdminChartMetric>("avg_hours");
  const [savedStudentSessions, setSavedStudentSessions] = useState<Array<{ id: string; label: string; notes: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const role = user?.role ?? "student";
  const workspace = role === "admin" && searchParams.get("workspace") === "admin" ? "admin" : "student";
  const planCourses = useMemo(
    () => (activePlan?.items ?? []).filter((item) => item.type === "course").map((item) => item.course),
    [activePlan]
  );
  const planSummary = useMemo(() => getPlanSummary(activePlan), [activePlan, getPlanSummary]);
  const loadoutPool = useMemo(() => (planCourses.length > 0 ? planCourses : buckets?.pool ?? []), [planCourses, buckets]);
  const planDiagnostics = useMemo(() => getPlanDiagnostics(activePlan), [activePlan, getPlanDiagnostics]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSavedStudentSessions(JSON.parse(window.localStorage.getItem("worklode_saved_insight_sessions_v1") || "[]"));
    } catch {
      setSavedStudentSessions([]);
    }
  }, []);

  useEffect(() => {
    if (loadoutPool.length === 0) {
      setSelectedLoadout([]);
      return;
    }
    setSelectedLoadout((current) => {
      const valid = current.filter((key) => loadoutPool.some((course) => (course.courseCode || course.id) === key));
      if (valid.length > 0) return valid;
      return loadoutPool.slice(0, 6).map((course) => course.courseCode || course.id);
    });
  }, [loadoutPool]);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    let ignore = false;
    void Promise.all([loadInsightBuckets(), requestJson<ModelsResponse>("/ai/models", { cacheTtlMs: 60_000 }), requestJson<TermsResponse>("/catalog/terms?years=2", { cacheTtlMs: 60_000 })])
      .then(([bucketData, modelData, termData]) => {
        if (ignore) return;
        setBuckets(bucketData); setModels(modelData.models); setSelectedModel(modelData.default); setTerms(termData.terms); setAdminInputs((current) => ({ ...current, term: current.term || termData.terms[0] || "", dept: current.dept || bucketData.departments[0] || "CSCI" })); setError(null);
      })
      .catch((reason) => { if (!ignore) setError(reason instanceof Error ? reason.message : "Failed to load Insights workspace"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (workspace !== "admin" || role !== "admin" || !adminInputs.term || !token) return;
    let ignore = false;
    setRiskState({ loading: true, error: null });
    void requestJson<DepartmentRiskRow[]>(`/deepdive/admin/department-risk?term_code=${encodeURIComponent(adminInputs.term)}&dept=${encodeURIComponent(adminInputs.dept)}&limit=8`, { token, cacheTtlMs: 10_000 })
      .then((data) => { if (!ignore) { setRiskRows(data); setRiskState({ loading: false, error: null }); } })
      .catch((reason) => { if (!ignore) { setRiskRows([]); setRiskState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to load department risk" }); } });
    return () => { ignore = true; };
  }, [workspace, role, adminInputs.term, adminInputs.dept, token]);

  useEffect(() => {
    if (workspace !== "admin" || role !== "admin" || !adminInputs.term || !adminInputs.dept) return;
    let ignore = false;
    setDepartmentCoursesState({ loading: true, error: null });
    void requestJson<ExploreResponse>(`/catalog/explore?term=${encodeURIComponent(adminInputs.term)}&departments=${encodeURIComponent(adminInputs.dept)}&sort=workload_desc&limit=18`, { cacheTtlMs: 30_000 })
      .then((data) => {
        if (!ignore) {
          setDepartmentCourses(data.data);
          setDepartmentCoursesState({ loading: false, error: null });
        }
      })
      .catch((reason) => {
        if (!ignore) {
          setDepartmentCourses([]);
          setDepartmentCoursesState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to load department course data" });
        }
      });
    return () => { ignore = true; };
  }, [workspace, role, adminInputs.term, adminInputs.dept]);

  const selectedCourses = useMemo(() => loadoutPool.filter((course) => selectedLoadout.includes(course.courseCode || course.id)), [loadoutPool, selectedLoadout]);
  const studentStats = useMemo(() => buckets ? { heavy: average(buckets.heaviest.map((course) => course.avgHours)), light: average(buckets.lightest.map((course) => course.avgHours)), variable: average(buckets.variable.map((course) => course.stdDev)), total: Number(selectedCourses.reduce((sum, course) => sum + (course.avgHours ?? 0), 0).toFixed(1)) } : null, [buckets, selectedCourses]);
  const studentChart = useMemo(() => [{ name: "Heavy avg", value: studentStats?.heavy ?? 0 }, { name: "Light avg", value: studentStats?.light ?? 0 }, { name: "Variance avg", value: studentStats?.variable ?? 0 }, { name: "Selected load", value: studentStats?.total ?? 0 }], [studentStats]);
  const adminChart = useMemo(() => {
    if (riskRows.length > 0) {
      return riskRows.map((row) => ({
        name: row.course_code,
        value: adminChartMetric === "avg_hours" ? row.avg_hours ?? 0 : adminChartMetric === "responses" ? row.count : row.avg_difficulty ?? 0,
      }));
    }
    return departmentCourses
      .filter((course) => adminChartMetric === "avg_hours" ? course.avgHours !== null : adminChartMetric === "responses" ? course.responses !== null : course.stdDev !== null)
      .slice(0, 10)
      .map((course) => ({
        name: course.code,
        value: adminChartMetric === "avg_hours" ? course.avgHours ?? 0 : adminChartMetric === "responses" ? course.responses ?? 0 : course.stdDev ?? 0,
      }));
  }, [riskRows, departmentCourses, adminChartMetric]);
  const adminStats = useMemo(() => ({ hours: average(riskRows.map((row) => row.avg_hours)), difficulty: average(riskRows.map((row) => row.avg_difficulty)) }), [riskRows]);
  const adminExplorerCards = useMemo(
    () => departmentCourses.slice(0, 6).map((course) => ({
      code: course.code,
      title: course.name,
      avgHours: formatMetric(course.avgHours, "h"),
      responses: course.responses ?? "N/A",
      variance: formatMetric(course.stdDev, "h"),
    })),
    [departmentCourses]
  );
  const adminChartSourceLabel = riskRows.length > 0 ? "Risk reports" : departmentCourses.length > 0 ? "Department catalog" : "No data";
  const plannerContext = useMemo(() => ({
    planName: activePlan?.name || "Current scenario",
    termCode: activePlan?.termCode || "",
    totalCredits: planSummary.totalCredits,
    totalOutsideHours: planSummary.totalOutsideHours,
    totalAcademicLoad: planSummary.totalAcademicLoad,
    totalInClassHours: planSummary.totalInClassHours,
    warnings: planSummary.warnings,
    planCourses: planCourses.map((course) => ({
      code: course.code,
      name: course.name,
      dept: course.dept,
      credits: course.credits,
      avgHours: course.avgHours,
      stdDev: course.stdDev,
      responses: course.responses,
      latestTerm: course.latestTerm,
    })),
  }), [activePlan, planSummary, planCourses]);
  const deterministicStudentCards = useMemo(() => {
    const suggestions: Array<{ title: string; body: string }> = [];
    if (planDiagnostics.conflicts.length > 0) suggestions.push({ title: "Resolve direct conflicts", body: `${planDiagnostics.conflicts.length} meeting conflict${planDiagnostics.conflicts.length === 1 ? "" : "s"} should be cleared before registration.` });
    if (planDiagnostics.totalAcademicLoad >= 50) suggestions.push({ title: "Load balancing move", body: "Move one heavy course or trim outside commitments before locking this scenario." });
    if (planDiagnostics.compressedDays.length > 0) suggestions.push({ title: "Compressed day warning", body: `${planDiagnostics.compressedDays[0].day} is carrying a dense meeting stack. Spread one block if possible.` });
    const bestAdd = (buckets?.lightest ?? []).find((course) => !plannerContext.planCourses.some((planned) => planned.code === course.code));
    if (bestAdd) suggestions.push({ title: "Best next add", body: `${bestAdd.code} looks like a lighter balancing candidate for a heavy schedule.` });
    if (!suggestions.length) suggestions.push({ title: "Stable scenario", body: "This plan looks balanced enough to save as your baseline and compare against one alternate." });
    return suggestions.slice(0, 4);
  }, [planDiagnostics, buckets, plannerContext.planCourses]);
  const adminActionQueue = useMemo(() => {
    const actions: Array<{ title: string; body: string }> = [];
    if (riskRows[0]) actions.push({ title: "Top flagged course", body: `${riskRows[0].course_code} is the strongest current workload signal in this view.` });
    const highVariance = [...departmentCourses].filter((course) => (course.stdDev ?? 0) > 0).sort((left, right) => (right.stdDev ?? 0) - (left.stdDev ?? 0))[0];
    if (highVariance) actions.push({ title: "Highest workload variance", body: `${highVariance.code} has the widest pacing spread in the department catalog slice.` });
    const lowResponse = [...departmentCourses].filter((course) => course.responses !== null).sort((left, right) => (left.responses ?? 9999) - (right.responses ?? 9999))[0];
    if (lowResponse) actions.push({ title: "Blind spot", body: `${lowResponse.code} has the thinnest published sample and may need more feedback collection.` });
    if (!actions.length) actions.push({ title: "No urgent action", body: "This department slice does not expose a strong operational priority yet." });
    return actions.slice(0, 4);
  }, [riskRows, departmentCourses]);

  function saveStudentSession() {
    const entry = {
      id: crypto.randomUUID(),
      label: `${plannerContext.planName} / ${new Date().toLocaleDateString()}`,
      notes: deterministicStudentCards.map((card) => `${card.title}: ${card.body}`).join("\n"),
    };
    const next = [entry, ...savedStudentSessions].slice(0, 8);
    setSavedStudentSessions(next);
    if (typeof window !== "undefined") window.localStorage.setItem("worklode_saved_insight_sessions_v1", JSON.stringify(next));
  }

  async function exportStudentSummary() {
    const summary = [`Plan: ${plannerContext.planName}`, `Term: ${plannerContext.termCode || "latest"}`, `Checkpoint: ${planDiagnostics.checkpointLabel}`, ...deterministicStudentCards.map((card) => `- ${card.title}: ${card.body}`)].join("\n");
    await navigator.clipboard.writeText(summary);
  }

  async function runLoadoutAnalysis() {
    try {
      setLoadoutState({ loading: true, error: null });
      const data = await postJson<{ text?: string }>("/ai/student/loadout", {
        goals: studentInputs.goals,
        intensity: studentInputs.intensity,
        notes: studentInputs.graduationPlanNotes,
        plannerContext,
        selectedCourses: selectedCourses.map((course) => ({
          code: course.code,
          name: course.name,
          dept: course.dept,
          credits: course.credits,
          avgHours: course.avgHours,
          stdDev: course.stdDev,
          responses: course.responses,
          latestTerm: course.latestTerm,
        })),
        model: selectedModel,
        question: loadoutQuestion,
      }, token);
      setLoadoutAdvice(data.text || "");
    } catch (reason) {
      setLoadoutState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to analyze the selected loadout" });
      return;
    }
    setLoadoutState({ loading: false, error: null });
  }

  async function runStudentStrategy() {
    if (!token) {
      setStudentPlanState({ loading: false, error: "Sign in again to run the semester strategy tool." });
      return;
    }
    try {
      setStudentPlanState({ loading: true, error: null });
      const data = await postJson<{ text?: string }>("/deepdive/student/plan", {
        ...studentInputs,
        uploadedFileName: null,
        selectedCourses: plannerContext.planCourses,
        plannerContext,
        model: selectedModel,
      }, token);
      setStudentPlan(data.text || "");
    } catch (reason) {
      setStudentPlanState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to generate strategy" });
      return;
    }
    setStudentPlanState({ loading: false, error: null });
  }

  async function runAdminMemo() {
    if (!token) {
      setAdminMemoState({ loading: false, error: "Sign in again to run admin AI tools." });
      return;
    }
    try {
      setAdminMemoState({ loading: true, error: null });
      const data = await postJson<{ text?: string }>("/deepdive/admin/analysis", {
        dept: adminInputs.dept,
        term: adminInputs.term,
        course: adminInputs.course,
        includeExternalData: adminInputs.includeExternalData,
        model: selectedModel,
      }, token);
      setAdminMemo(data.text || "");
    } catch (reason) {
      setAdminMemoState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to generate department memo" });
      return;
    }
    setAdminMemoState({ loading: false, error: null });
  }

  async function runInterventionPlan() {
    if (!token) {
      setInterventionState({ loading: false, error: "Sign in again to run admin AI tools." });
      return;
    }
    try {
      setInterventionState({ loading: true, error: null });
      const data = await postJson<{ text?: string }>("/ai/admin/interventions", {
        dept: adminInputs.dept,
        term: adminInputs.term,
        focusArea: adminInputs.focusArea,
        notes: adminInputs.notes,
        riskRows,
        model: selectedModel,
      }, token);
      setInterventionPlan(data.text || "");
    } catch (reason) {
      setInterventionState({ loading: false, error: reason instanceof Error ? reason.message : "Failed to build intervention plan" });
      return;
    }
    setInterventionState({ loading: false, error: null });
  }

  if (loading || authLoading) return <div className="min-h-screen px-4 py-10"><div className="container mx-auto space-y-4"><LoadingState label="Loading insights..." /><div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[24px] border border-border bg-white" />)}</div></div></div>;
  if (!isAuthenticated) return <div className="min-h-screen px-4 py-10"><div className="container mx-auto max-w-2xl"><div className="rounded-[28px] border border-border bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary"><Brain size={24} /></div><h1 className="mt-5 text-3xl font-black tracking-tight text-text">Insights requires sign-in</h1><p className="mt-2 text-sm text-text-secondary">Sign in with Google to open the planning analysis and admin insight workspace.</p><GoogleSignInButton className="mt-6 inline-flex border-slate-950 bg-slate-950 px-4 py-3 text-white hover:bg-slate-800" label="Sign in with Google" />{authError ? <div className="mt-6 text-sm text-red-600">{authError}</div> : null}</div></div></div>;
  if (error || !buckets) return <div className="p-10 text-center text-red-600">{error || "Failed to load insights."}</div>;

  return (
    <div className="min-h-screen bg-background pb-16">
      <section className="glass-panel border-x-0 border-t-0 rounded-none">
        <div className="container mx-auto px-4 py-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Insights</div><h1 className="mt-2 text-4xl font-black tracking-tight text-text">Insights Studio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Cleaner student and admin workspaces with charts instead of stacks of little toggle panels.</p></div>
            <div className="flex flex-wrap gap-2"><Link to="/explore" className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white">Explore<ArrowRight size={15} /></Link><Link to="/plan" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text">Planner<ArrowRight size={15} /></Link></div>
          </div>
          <div className="mt-5 rounded-[24px] nm-flat p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2"><Toggle selected={workspace === "student"} onClick={() => setSearchParams({ workspace: "student" })}>Student</Toggle>{role === "admin" && <Toggle selected={workspace === "admin"} onClick={() => setSearchParams({ workspace: "admin" })}>Admin</Toggle>}</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="rounded-xl nm-button px-3 py-2.5 text-sm font-bold outline-none">{models.map((model) => <option key={model.id} value={model.id}>{model.label} ({model.tier})</option>)}</select><div className="text-xs text-text-secondary">{user?.email}</div></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {workspace === "student" && <>
          <section className="grid gap-3 lg:grid-cols-4"><MiniStat label="Heavy avg" value={formatMetric(studentStats?.heavy ?? null, "h")} icon={<Clock3 size={15} />} /><MiniStat label="Light avg" value={formatMetric(studentStats?.light ?? null, "h")} icon={<GraduationCap size={15} />} /><MiniStat label="Variance avg" value={formatMetric(studentStats?.variable ?? null, "h")} icon={<Sigma size={15} />} /><MiniStat label="Selected load" value={`${studentStats?.total ?? 0}h`} icon={<BarChart3 size={15} />} /></section>
          <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <Surface title="Loadout signals" icon={<BarChart3 size={15} />} description={planCourses.length > 0 ? "Using the active plan by default so the balance note matches your real schedule." : "No planner courses yet, so this falls back to a broader catalog sample."}>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{planCourses.length > 0 ? `${planCourses.length} plan courses` : `${loadoutPool.length} available courses`}</div>
              <div className="mt-3">
                {loadoutPool.map((course) => {
                  const key = course.courseCode || course.id;
                  const active = selectedLoadout.includes(key);
                  return <button key={key} type="button" onClick={() => setSelectedLoadout((current) => active ? current.filter((value) => value !== key) : [...current, key].slice(-6))} className={`mr-2 mt-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all relative overflow-hidden ${active ? "bg-primary text-white nm-raised liquid-glass" : "nm-button text-text-secondary"}`}>{course.code}</button>;
                })}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <input value={loadoutQuestion} onChange={(e) => setLoadoutQuestion(e.target.value)} placeholder="Ask a specific comparison question..." className="w-full rounded-xl nm-input px-4 py-3 text-sm outline-none" />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void runLoadoutAnalysis()} disabled={loadoutState.loading || selectedCourses.length === 0 || !token} className="inline-flex items-center gap-2 rounded-xl nm-button bg-secondary text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"><Sparkles size={15} />{loadoutState.loading ? "Analyzing..." : "Analyze loadout"}</button>
                  <div className="text-sm text-text-secondary">{!token ? "Sign in to analyze." : selectedCourses.length > 0 ? `${selectedCourses.length} course${selectedCourses.length === 1 ? "" : "s"} selected` : "Select at least one course to analyze."}</div>
                </div>
              </div>
              {loadoutState.error && <div className="mt-3 text-sm text-red-600">{loadoutState.error}</div>}
              <OutputBlock text={loadoutState.loading ? "Analyzing your selected courses and planner context..." : loadoutAdvice || "Pick a few courses and generate a compact AI note on balance and pacing."} />
            </Surface>
            <Surface title="Student visualizer" icon={<BarChart3 size={15} />} description="One chart surface keeps the page clean while still showing signal spread."><ChartPanel data={studentChart} color="var(--color-primary)" /></Surface>
          </div>
          <Surface title="Deterministic planner signals" icon={<Sparkles size={15} />} description="Fast planning cues from planner math and catalog data, without waiting on AI."><div className="grid gap-3 md:grid-cols-2">{deterministicStudentCards.map((card) => <div key={card.title} className="rounded-2xl border border-border bg-surface p-4"><div className="text-sm font-black text-text">{card.title}</div><div className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</div></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={saveStudentSession} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text"><Save size={15} />Save session</button><button type="button" onClick={() => void exportStudentSummary()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text">Copy summary</button></div>{savedStudentSessions.length > 0 && <div className="mt-4 space-y-2">{savedStudentSessions.slice(0, 3).map((session) => <div key={session.id} className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-secondary"><div className="font-semibold text-text">{session.label}</div><div className="mt-1 whitespace-pre-wrap">{session.notes}</div></div>)}</div>}</Surface>
          <Surface title="Semester strategy" icon={<Brain size={15} />} description="This now includes your active plan, term, workload totals, and selected courses in the request."><div className="grid gap-3 md:grid-cols-2"><Field label="Goals"><textarea value={studentInputs.goals} onChange={(event) => setStudentInputs((current) => ({ ...current, goals: event.target.value }))} rows={3} className="min-h-[96px] w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary" /></Field><Field label="Target jobs or outcomes"><textarea value={studentInputs.targetJobs} onChange={(event) => setStudentInputs((current) => ({ ...current, targetJobs: event.target.value }))} rows={3} className="min-h-[96px] w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary" /></Field><Field label="Taken classes"><textarea value={studentInputs.takenClasses} onChange={(event) => setStudentInputs((current) => ({ ...current, takenClasses: event.target.value }))} rows={3} className="min-h-[96px] w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary" /></Field><Field label="Grad plan notes"><textarea value={studentInputs.graduationPlanNotes} onChange={(event) => setStudentInputs((current) => ({ ...current, graduationPlanNotes: event.target.value }))} rows={3} className="min-h-[96px] w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary" /></Field></div><div className="mt-4 flex flex-wrap items-center gap-3"><select value={studentInputs.intensity} onChange={(event) => setStudentInputs((current) => ({ ...current, intensity: event.target.value as typeof DEFAULT_STUDENT.intensity }))} className="rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold outline-none transition hover:border-primary/35 focus:border-primary"><option value="light">Light</option><option value="medium">Medium</option><option value="hard">Hard</option></select><button type="button" onClick={() => void runStudentStrategy()} disabled={studentPlanState.loading || !token} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"><Wand2 size={15} />{studentPlanState.loading ? "Generating..." : "Generate strategy"}</button><div className="text-sm text-text-secondary">{plannerContext.planCourses.length > 0 ? `${plannerContext.planCourses.length} planner courses included` : "No planner courses yet, so the AI will rely on your text inputs."}</div></div>{studentPlanState.error && <div className="mt-3 text-sm text-red-600">{studentPlanState.error}</div>}<OutputBlock text={studentPlanState.loading ? "Building a strategy from your goals, pacing preferences, and current planner..." : studentPlan || "Add a few goals and generate a semester strategy with sequencing and pacing advice."} /></Surface>
        </>}

        {workspace === "admin" && role === "admin" && <>
          <section className="grid gap-3 lg:grid-cols-4"><MiniStat label="Courses flagged" value={String(riskRows.length)} icon={<Shield size={15} />} /><MiniStat label="Avg hours" value={formatMetric(adminStats.hours, "h")} icon={<Clock3 size={15} />} /><MiniStat label="Avg difficulty" value={formatMetric(adminStats.difficulty)} icon={<Sigma size={15} />} /><MiniStat label="Term" value={formatAcademicTerm(adminInputs.term || terms[0] || "Current")} icon={<Briefcase size={15} />} /></section>
          <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <Surface title="Department risk" icon={<Shield size={15} />} description="Operational risk first, without the old toggle-box UI."><div className="grid gap-3 md:grid-cols-4"><Field label="Department"><select value={adminInputs.dept} onChange={(event) => setAdminInputs((current) => ({ ...current, dept: event.target.value }))} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold outline-none transition hover:border-primary/35 focus:border-primary">{(buckets?.departments ?? []).map((dept) => <option key={dept} value={dept}>{dept}</option>)}</select></Field><Field label="Term"><select value={adminInputs.term} onChange={(event) => setAdminInputs((current) => ({ ...current, term: event.target.value }))} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-semibold outline-none transition hover:border-primary/35 focus:border-primary">{terms.map((term) => <option key={term} value={term}>{formatAcademicTerm(term)}</option>)}</select></Field><Field label="Course focus"><input value={adminInputs.course} onChange={(event) => setAdminInputs((current) => ({ ...current, course: event.target.value }))} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition hover:border-primary/35 focus:border-primary" /></Field><Field label="External data"><label className="flex h-[42px] items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-text transition hover:border-primary/35 hover:bg-primary-light/40"><input type="checkbox" checked={adminInputs.includeExternalData} onChange={(event) => setAdminInputs((current) => ({ ...current, includeExternalData: event.target.checked }))} />Include trends</label></Field></div>{riskState.error && <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{riskState.error}</div>}{riskState.loading ? <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">Loading department risk for {adminInputs.dept} in {formatAcademicTerm(adminInputs.term)}...</div> : riskRows.length > 0 ? <div className="mt-4 space-y-3">{riskRows.map((row) => <div key={row.course_code} className="rounded-2xl border border-border bg-surface p-3 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-text">{row.course_code}</div><div className="text-xs text-text-secondary">{row.name}</div></div><span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-bold text-text-secondary">{row.count} submissions</span></div></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">No department-risk rows were found for {adminInputs.dept} in {formatAcademicTerm(adminInputs.term)}. The visualizer is using department catalog data below instead.</div>}</Surface>
            <Surface title="Admin visualizer" icon={<BarChart3 size={15} />} description="Always-on exploration using risk reports first, then falling back to department catalog metrics."><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setAdminChartMetric("avg_hours")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${adminChartMetric === "avg_hours" ? "bg-secondary text-white shadow-sm" : "border border-border bg-white text-text-secondary hover:-translate-y-0.5 hover:border-secondary/35 hover:text-text"}`}>Avg hours</button><button type="button" onClick={() => setAdminChartMetric("responses")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${adminChartMetric === "responses" ? "bg-primary text-white shadow-sm" : "border border-border bg-white text-text-secondary hover:-translate-y-0.5 hover:border-primary/35 hover:text-text"}`}>Responses</button><button type="button" onClick={() => setAdminChartMetric("variability")} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${adminChartMetric === "variability" ? "bg-emerald-600 text-white shadow-sm" : "border border-border bg-white text-text-secondary hover:-translate-y-0.5 hover:border-emerald-300 hover:text-text"}`}>Variability</button><span className="ml-auto rounded-full border border-border bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{adminChartSourceLabel}</span></div>{riskState.loading || departmentCoursesState.loading ? <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">Preparing chart data...</div> : adminChart.length ? <div className="mt-4"><ChartPanel data={adminChart} color={adminChartMetric === "avg_hours" ? "var(--color-secondary)" : adminChartMetric === "responses" ? "var(--color-primary)" : "var(--color-success)"} /></div> : <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">No graph data is available for {adminInputs.dept} in {formatAcademicTerm(adminInputs.term)}.</div>}{departmentCoursesState.error && <div className="mt-3 text-sm text-red-600">{departmentCoursesState.error}</div>}{adminExplorerCards.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{adminExplorerCards.map((card) => <div key={card.code} className="rounded-2xl border border-border bg-surface p-3"><div className="font-black text-text">{card.code}</div><div className="mt-1 text-sm text-text-secondary">{card.title}</div><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary"><span className="rounded-full border border-border bg-white px-2.5 py-1">{card.avgHours} avg</span><span className="rounded-full border border-border bg-white px-2.5 py-1">{card.responses} responses</span><span className="rounded-full border border-border bg-white px-2.5 py-1">{card.variance} var</span></div></div>)}</div>}</Surface>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Surface title="AI department memo" icon={<Brain size={15} />} description="Generate a concise readout for staffing and comms."><button type="button" onClick={() => void runAdminMemo()} disabled={adminMemoState.loading || !token} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-secondary-hover hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"><Brain size={15} />{adminMemoState.loading ? "Generating..." : "Generate memo"}</button>{adminMemoState.error && <div className="mt-3 text-sm text-red-600">{adminMemoState.error}</div>}<OutputBlock text={adminMemoState.loading ? "Reviewing department risk rows and drafting a memo..." : adminMemo || "Generate a concise department memo after selecting a term and department."} /></Surface>
            <Surface title="Intervention planner" icon={<Wand2 size={15} />} description="Focused AI help for actions, not generic dashboard commentary."><div className="grid gap-3 md:grid-cols-2"><Field label="Focus area"><input value={adminInputs.focusArea} onChange={(event) => setAdminInputs((current) => ({ ...current, focusArea: event.target.value }))} className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition hover:border-primary/35 focus:border-primary" /></Field><Field label="Notes"><textarea value={adminInputs.notes} onChange={(event) => setAdminInputs((current) => ({ ...current, notes: event.target.value }))} rows={4} className="min-h-[110px] w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none transition hover:border-primary/35 focus:border-primary" /></Field></div><button type="button" onClick={() => void runInterventionPlan()} disabled={interventionState.loading || !token} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"><Sparkles size={15} />{interventionState.loading ? "Building..." : "Build intervention plan"}</button>{interventionState.error && <div className="mt-3 text-sm text-red-600">{interventionState.error}</div>}<OutputBlock text={interventionState.loading ? "Turning current risk rows into an intervention plan..." : interventionPlan || "Use risk rows as context, then generate a focused intervention plan."} /></Surface>
          </div>
          <Surface title="Admin action queue" icon={<Briefcase size={15} />} description="Deterministic operational prompts from the current risk and catalog slice."><div className="grid gap-3 md:grid-cols-2">{adminActionQueue.map((item) => <div key={item.title} className="rounded-2xl border border-border bg-white p-4"><div className="text-sm font-black text-text">{item.title}</div><div className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</div></div>)}</div></Surface>
        </>}
      </div>
    </div>
  );
}

function Toggle({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${selected ? "bg-primary text-white nm-raised" : "nm-button text-text"}`}>{children}</button>; }
function Surface({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) { return <section className="rounded-[28px] nm-raised p-6 liquid-glass"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">{icon}{title}</div><div className="mt-2 text-sm text-text-secondary leading-relaxed">{description}</div><div className="mt-6">{children}</div></section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>{children}</label>; }
function MiniStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="rounded-[22px] nm-flat p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">{icon}{label}</div><div className="mt-2 text-2xl font-black tracking-tight text-text">{value}</div></div>; }
function ChartPanel({ data, color }: { data: Array<{ name: string; value: number }>; color: string }) { return <div className="h-[320px] rounded-[24px] nm-inset p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} /><Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "var(--shadow-nm-raised)" }} /><Bar dataKey="value" radius={[6, 6, 0, 0]} fill={color} /></BarChart></ResponsiveContainer></div>; }
function OutputBlock({ text }: { text: string }) { return <div className="mt-4 rounded-2xl nm-inset p-5 whitespace-pre-wrap text-sm leading-7 text-text-secondary border-l-4 border-secondary/30">{text}</div>; }
