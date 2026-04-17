import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, BarChart3, BookOpen, GitCompareArrows, Heart, Plus, Radar, Trash2, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar as RadarShape, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePlan } from "../context/PlanContext";
import { requestJson } from "../lib/api";
import type { CourseDetailResponse } from "../lib/catalog";
import { loadCompareSelection, loadShortlist, saveCompareSelection, saveShortlist, toCompareSelection, toShortlistEntry } from "../lib/courseToolkit";
import { formatAcademicTerm, formatCourseSignal, formatMetric, getBarWidth, getSubjectTheme } from "../lib/display";
import { LoadingState } from "../components/PageState";

type ProfileTab = "basic" | "graphs" | "details";
type GraphMode = "bars" | "radar";

function getLoadSummary(course: CourseDetailResponse) {
  if (course.avgHours === null) return "Public workload data is not published yet for this course.";
  if (course.avgHours >= 15) return "Expect a heavy outside-of-class commitment with limited slack.";
  if (course.avgHours >= 8) return "Expect a moderate weekly load with some heavier stretches.";
  return "This looks lighter than most workload-intensive courses.";
}

function getComparisonText(course: CourseDetailResponse) {
  if (course.avgHours === null || course.departmentAverageHours === null) return "Department comparison appears once both course and subject averages are available.";
  const delta = course.departmentDeltaHours ?? course.avgHours - course.departmentAverageHours;
  if (Math.abs(delta) < 0.5) return "Almost identical to the department average workload.";
  if (delta > 0) return `${delta.toFixed(1)}h above the department average.`;
  return `${Math.abs(delta).toFixed(1)}h below the department average.`;
}

function normalizeMetric(value: number | null, max: number) {
  if (value === null || value <= 0) return 0;
  return Math.min(100, Number(((value / max) * 100).toFixed(1)));
}

export function CourseProfile() {
  const { id } = useParams();
  const { addCourseFromCatalog, removeCourse, isInPlan } = usePlan();
  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [sections, setSections] = useState<Array<{ crn: string; sec: string; title: string; timeslots: Array<{ instructor?: string }> }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>("basic");
  const [graphMode, setGraphMode] = useState<GraphMode>("bars");
  const [shortlisted, setShortlisted] = useState(() => loadShortlist());
  const [compareSelection, setCompareSelection] = useState(() => loadCompareSelection());

  useEffect(() => {
    if (!id) {
      setError("Course not found.");
      setLoading(false);
      return;
    }
    let ignore = false;
    void requestJson<CourseDetailResponse>(`/catalog/detail/${encodeURIComponent(id)}`, { cacheTtlMs: 60_000 })
      .then((data) => { if (!ignore) { setCourse(data); setError(null); } })
      .catch((reason) => { if (!ignore) setError(reason instanceof Error ? reason.message : "Failed to load course"); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [id]);
  useEffect(() => { saveShortlist(shortlisted); }, [shortlisted]);
  useEffect(() => { saveCompareSelection(compareSelection); }, [compareSelection]);
  useEffect(() => {
    if (!course?.courseCode || !course.latestTerm) return;
    let ignore = false;
    void requestJson<Array<{ crn: string; sec: string; title: string; timeslots: Array<{ instructor?: string }> }>>(`/catalog/sections?term=${encodeURIComponent(course.latestTerm)}&course_code=${encodeURIComponent(course.courseCode)}`, { cacheTtlMs: 60_000 })
      .then((data) => { if (!ignore) setSections(data.slice(0, 4)); })
      .catch(() => { if (!ignore) setSections([]); });
    return () => { ignore = true; };
  }, [course?.courseCode, course?.latestTerm]);

  const inPlan = course ? isInPlan(course.courseCode || course.id) : false;
  const theme = getSubjectTheme(course?.dept ?? "");
  const comparisonText = useMemo(() => (course ? getComparisonText(course) : ""), [course]);
  const fitText = useMemo(() => {
    if (!course) return "";
    if (inPlan) return "Already in your active plan, so use this page to decide whether it still earns the slot.";
    if ((course.avgHours ?? 0) <= 10) return "This looks like a balancing candidate if your current scenario is trending heavy.";
    if ((course.stdDev ?? 0) >= 4) return "Treat this as a spike-prone course and pair it with steadier commitments.";
    return "This course fits best when you want a straightforward, moderate-load addition.";
  }, [course, inPlan]);
  const graphRows = useMemo(() => {
    if (!course) return [];
    return [
      { label: "Load", actual: course.avgHours ?? 0, comparison: course.departmentAverageHours ?? 0 },
      { label: "Variability", actual: course.stdDev ?? 0, comparison: 4 },
      { label: "Responses", actual: course.responses ?? 0, comparison: 100 },
    ];
  }, [course]);
  const radarRows = useMemo(() => {
    if (!course) return [];
    return [
      { metric: "Load", value: normalizeMetric(course.avgHours, 20) },
      { metric: "Variability", value: normalizeMetric(course.stdDev, 8) },
      { metric: "Responses", value: normalizeMetric(course.responses, 120) },
      { metric: "Dept avg", value: normalizeMetric(course.departmentAverageHours, 20) },
    ];
  }, [course]);

  if (loading) return <div className="min-h-screen bg-background px-4 py-10"><div className="container mx-auto max-w-3xl"><LoadingState label="Loading course details..." /></div></div>;
  if (error || !course) return <div className="p-10 text-center text-red-600">{error || "Course not found."}</div>;
  const courseKey = course.courseCode || course.id;
  const isShortlisted = shortlisted.some((entry) => entry.courseCode === courseKey);
  const inCompare = compareSelection.some((entry) => entry.courseCode === courseKey);

  return (
    <div className="min-h-screen bg-background pb-20" style={{ backgroundImage: "var(--page-gradient)" }}>
      <div className="border-b border-border bg-[var(--hero-gradient)]">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Link to="/explore" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-primary">
            <ArrowLeft size={16} />
            Back to Explore
          </Link>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="rounded-[32px] border bg-white/90 p-6 shadow-sm" style={{ borderColor: theme.accentBorder }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]" style={{ borderColor: theme.accentBorder, backgroundColor: theme.accentSoft, color: theme.accentText }}>{course.dept}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">{course.credits ?? "?"} credits</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">{formatAcademicTerm(course.latestTerm)}</span>
                <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">{formatCourseSignal(course.trustTier, course.trustLabel)}</span>
              </div>
              <h1 className="mt-4 text-5xl font-black tracking-tight text-text">{course.code}</h1>
              <p className="mt-3 text-xl text-text-secondary">{course.name}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <StatCard label="Average load" value={formatMetric(course.avgHours, "h")} note={getLoadSummary(course)} />
                <StatCard label="Variability" value={formatMetric(course.stdDev, "h")} note={course.stdDev !== null && course.stdDev >= 5 ? "Expect more week-to-week spikes." : "Pacing looks steadier."} />
                <StatCard label="Responses" value={course.responses === null ? "Hidden" : String(course.responses)} note="Publication thresholds still apply before response counts appear." />
              </div>
            </div>

            <div className="rounded-[32px] border border-border bg-white/92 p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Quick read</div>
              <div className="mt-4 rounded-[24px] border border-border bg-surface p-4 text-sm leading-6 text-text-secondary">
                {comparisonText} {getLoadSummary(course)}
              </div>
              <div className="mt-5 space-y-3">
                <MetricBand label="Workload" value={formatMetric(course.avgHours, "h / wk")} width={getBarWidth(course.avgHours, 20)} accent={theme.accent} />
                <MetricBand label="Variability" value={formatMetric(course.stdDev, "h")} width={getBarWidth(course.stdDev, 8)} accent={theme.accent} />
                <MetricBand label="Sample depth" value={course.responses === null ? "N/A" : String(course.responses)} width={getBarWidth(course.responses, 120)} accent={theme.accent} />
              </div>
              <button type="button" onClick={() => inPlan ? removeCourse(course.courseCode || course.id) : addCourseFromCatalog(course)} className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold ${inPlan ? "border border-border bg-background text-text hover:border-red-300 hover:text-red-600" : "bg-primary text-white hover:bg-primary-hover"}`}>
                {inPlan ? <Trash2 size={16} /> : <Plus size={16} />}
                {inPlan ? "Remove from plan" : "Add to plan"}
              </button>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setShortlisted((current) => isShortlisted ? current.filter((entry) => entry.courseCode !== courseKey) : [toShortlistEntry(course), ...current].slice(0, 24))} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${isShortlisted ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-border bg-white text-text"}`}><Heart size={15} />{isShortlisted ? "Shortlisted" : "Shortlist"}</button>
                <button type="button" onClick={() => setCompareSelection((current) => inCompare ? current.filter((entry) => entry.courseCode !== courseKey) : [...current, toCompareSelection(course)].slice(0, 3))} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${inCompare ? "border border-secondary/30 bg-secondary-light text-secondary" : "border border-border bg-white text-text"}`}><GitCompareArrows size={15} />{inCompare ? "In compare" : "Add to compare"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["basic", "Basic"],
            ["graphs", "Graph lab"],
            ["details", "Details"],
          ].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTab(value as ProfileTab)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === value ? "bg-primary text-white" : "border border-border bg-white text-text-secondary"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "basic" && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted"><BookOpen size={14} />What matters most</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatCard label="Outside-of-class work" value={formatMetric(course.avgHours, "h")} note={getLoadSummary(course)} compact />
                <StatCard label="Department comparison" value={course.departmentAverageHours === null ? "N/A" : formatMetric(course.departmentAverageHours, "h")} note={comparisonText} compact />
                <StatCard label="Signal type" value={formatCourseSignal(course.trustTier, course.trustLabel)} note="The wording is condensed here so estimated signals do not dominate the page." compact />
                <StatCard label="Best use" value="Quick planning" note={fitText} compact />
              </div>
            </div>
            <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">At a glance</div>
              <div className="mt-4 space-y-3">
                <DetailRow label="Level" value={course.level} />
                <DetailRow label="Latest term" value={formatAcademicTerm(course.latestTerm)} />
                <DetailRow label="Stats source" value={course.statsSource.replaceAll("_", " ")} />
                <DetailRow label="Published responses" value={course.responses === null ? "Hidden" : String(course.responses)} />
                <DetailRow label="Planner fit" value={inPlan ? "Already selected" : (course.avgHours ?? 0) <= 10 ? "Balances heavy plans" : "Best in a moderate scenario"} />
              </div>
            </div>
          </section>
        )}

        {tab === "graphs" && (
          <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted"><BarChart3 size={14} />Graph lab</div>
                <p className="mt-2 text-sm text-text-secondary">Switch the view to compare workload, volatility, and sample strength without reading a long stats block.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGraphMode("bars")} className={`rounded-full px-4 py-2 text-sm font-semibold ${graphMode === "bars" ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"}`}>Bars</button>
                <button type="button" onClick={() => setGraphMode("radar")} className={`rounded-full px-4 py-2 text-sm font-semibold ${graphMode === "radar" ? "bg-primary text-white" : "border border-border bg-surface text-text-secondary"}`}>Radar</button>
              </div>
            </div>
            <div className="mt-6 h-[360px] rounded-[24px] border border-border bg-surface p-4">
              <ResponsiveContainer width="100%" height="100%">
                {graphMode === "bars" ? (
                  <BarChart data={graphRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="actual" radius={[8, 8, 0, 0]} fill="var(--color-primary)" name="Course" />
                    <Bar dataKey="comparison" radius={[8, 8, 0, 0]} fill="var(--color-secondary)" name="Comparison" />
                  </BarChart>
                ) : (
                  <RadarChart data={radarRows}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <RadarShape dataKey="value" fill="var(--color-primary)" fillOpacity={0.35} stroke="var(--color-primary)" />
                    <Tooltip />
                  </RadarChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {tab === "details" && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Catalog description</div>
              <p className="mt-4 text-sm leading-7 text-text-secondary">{course.description || "No catalog description is available for this course yet."}</p>
            </div>
            <div className="space-y-6">
              {course.attributes.length > 0 && (
                <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Requirement tags</div>
                  <div className="mt-4 flex flex-wrap gap-2">{course.attributes.map((attribute) => <span key={attribute} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">{attribute}</span>)}</div>
                </div>
              )}
              {sections.length > 0 && (
                <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Section snapshot</div>
                  <div className="mt-4 space-y-3">{sections.map((section) => <div key={section.crn} className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm"><div className="font-bold text-text">Section {section.sec || "TBD"}</div><div className="mt-1 text-text-secondary">{section.title}</div><div className="mt-1 text-xs text-text-secondary">{section.timeslots?.[0]?.instructor || "Instructor TBD"}</div></div>)}</div>
                </div>
              )}
              <div className="rounded-[28px] border border-border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted"><Users size={14} />Planning note</div>
                <p className="mt-4 text-sm leading-6 text-text-secondary">Term codes on this page are shown as season plus year, so `202609` appears as `Fall 2026` based on the September code.</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, note, compact = false }: { label: string; value: string; note: string; compact?: boolean }) { return <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</div><div className={`mt-3 font-black text-text ${compact ? "text-xl" : "text-3xl"}`}>{value}</div><p className="mt-2 text-sm leading-6 text-text-secondary">{note}</p></div>; }
function MetricBand({ label, value, width, accent }: { label: string; value: string; width: number; accent: string }) { return <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-text">{label}</span><span className="font-black text-text">{value}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: accent }} /></div></div>; }
function DetailRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span className="text-text-secondary">{label}</span><span className="text-right font-bold text-text">{value}</span></div>; }
