import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowUpRight, Check, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { requestJson } from "../lib/api";
import type { CatalogCourse, ExploreResponse } from "../lib/catalog";
import { average, formatAcademicTerm, formatCourseSignal, formatMetric, getBarWidth, getSubjectTheme } from "../lib/display";
import { SkeletonGrid } from "../components/ui/SkeletonCard";
import { FilterChip, MetricPill } from "../components/FilterChip";
import { PageState } from "../components/PageState";

type SortOption = "relevance" | "workload_desc" | "workload_asc" | "variability_desc" | "responses_desc" | "alpha" | "course_number";
type ExplorePreset = "" | "heavy" | "light" | "high_variance" | "low_data" | "high_confidence";
type ExploreFilters = {
  departments: string[];
  level: string;
  creditsMin: string;
  creditsMax: string;
  avgHoursMin: string;
  avgHoursMax: string;
  stdDevMin: string;
  stdDevMax: string;
  responsesMin: string;
  term: string;
  attribute: string;
  preset: ExplorePreset;
  sort: SortOption;
};
type SubjectGroup = { dept: string; courses: CatalogCourse[]; avgHours: number | null; avgStdDev: number | null; avgResponses: number | null };
type DepartmentCluster = { title: string; departments: Array<{ code: string; name: string }> };
type PresetOption = { value: Exclude<ExplorePreset, "">; label: string };

const DEFAULT_FILTERS: ExploreFilters = {
  departments: [], level: "", creditsMin: "", creditsMax: "", avgHoursMin: "", avgHoursMax: "", stdDevMin: "", stdDevMax: "", responsesMin: "", term: "", attribute: "", preset: "", sort: "relevance",
};
const SAVED_PRESET_KEY = "worklode_explore_saved_preset";
const EXPLORE_PAGE_LIMIT = 1000;
const PRESET_OPTIONS: PresetOption[] = [
  { value: "heavy", label: "Heavy load" },
  { value: "light", label: "Lighter load" },
  { value: "high_variance", label: "Spiky workload" },
  { value: "low_data", label: "Needs reports" },
  { value: "high_confidence", label: "Strong signal" },
];
const DEPARTMENT_NAMES: Record<string, string> = {
  ADMN: "Administrative Courses",
  ARCH: "Architecture",
  ARTS: "Arts",
  ASTR: "Astronomy",
  BCBP: "Biochemistry and Biophysics",
  BIOL: "Biology",
  BMED: "Biomedical Engineering",
  BUSN: "Business",
  CHEM: "Chemistry",
  CHME: "Chemical Engineering",
  CIVL: "Civil Engineering",
  COGS: "Cognitive Science",
  COMM: "Communication",
  CSCI: "Computer Science",
  ECON: "Economics",
  ECSE: "Electrical, Computer, and Systems Engineering",
  ENGR: "General Engineering",
  ENVE: "Environmental Engineering",
  ERTH: "Earth and Environmental Science",
  ESCI: "Engineering Science",
  GSAS: "Games and Simulation Arts and Sciences",
  IENV: "Interdisciplinary Environmental Courses",
  IHSS: "Interdisciplinary Humanities and Social Sciences",
  ISCI: "Interdisciplinary Science",
  ISYE: "Industrial and Systems Engineering",
  ITWS: "Information Technology and Web Science",
  LANG: "Foreign Languages",
  LGHT: "Lighting",
  LITR: "Literature",
  MANE: "Mechanical, Aerospace, and Nuclear Engineering",
  MATH: "Mathematics",
  MATP: "Mathematical Programming, Probability, and Statistics",
  MGMT: "Management",
  MTLE: "Materials Science and Engineering",
  PHIL: "Philosophy",
  PHYS: "Physics",
  PSYC: "Psychology",
  STSO: "Science, Technology, and Society",
  USAF: "Aerospace Studies",
  USAR: "Military Science",
  USNA: "Naval Science",
  WRIT: "Writing",
};
const DEPARTMENT_CATEGORIES: Array<{ title: string; codes: string[] }> = [
  { title: "Humanities, Arts, and Social Sciences", codes: ["ARTS", "COGS", "COMM", "ECON", "GSAS", "IHSS", "LANG", "LITR", "PHIL", "PSYC", "STSO", "WRIT"] },
  { title: "Engineering", codes: ["BMED", "CHME", "CIVL", "ECSE", "ENGR", "ENVE", "ESCI", "ISYE", "MANE", "MTLE"] },
  { title: "Science", codes: ["ASTR", "BCBP", "BIOL", "CHEM", "CSCI", "ERTH", "ISCI", "MATH", "MATP", "PHYS"] },
  { title: "Architecture", codes: ["ARCH", "LGHT"] },
  { title: "Management", codes: ["BUSN", "MGMT"] },
  { title: "Information Technology", codes: ["ITWS"] },
  { title: "Interdisciplinary and Other", codes: ["ADMN", "IENV", "USAF", "USAR", "USNA"] },
];

function buildExploreQuery(searchTerm: string, filters: ExploreFilters) {
  const params = new URLSearchParams();
  if (searchTerm.trim()) params.set("q", searchTerm.trim());
  if (filters.departments.length) params.set("departments", filters.departments.join(","));
  if (filters.level) params.set("levels", filters.level);
  if (filters.creditsMin) params.set("credits_min", filters.creditsMin);
  if (filters.creditsMax) params.set("credits_max", filters.creditsMax);
  if (filters.avgHoursMin) params.set("avg_hours_min", filters.avgHoursMin);
  if (filters.avgHoursMax) params.set("avg_hours_max", filters.avgHoursMax);
  if (filters.stdDevMin) params.set("std_dev_min", filters.stdDevMin);
  if (filters.stdDevMax) params.set("std_dev_max", filters.stdDevMax);
  if (filters.responsesMin) params.set("responses_min", filters.responsesMin);
  if (filters.term) params.set("term_availability", filters.term);
  if (filters.attribute) params.set("attribute", filters.attribute);
  if (filters.preset) params.set("preset", filters.preset);
  params.set("sort", filters.sort);
  params.set("limit", String(EXPLORE_PAGE_LIMIT));
  return params.toString();
}

function loadSavedPreset() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_PRESET_KEY);
    return raw ? (JSON.parse(raw) as ExploreFilters) : null;
  } catch {
    return null;
  }
}

function buildCourseSummary(course: CatalogCourse) {
  const parts: string[] = [];
  if (course.avgHours !== null) parts.push(course.avgHours >= 15 ? "heavy load" : course.avgHours >= 8 ? "moderate load" : "lighter load");
  if (course.stdDev !== null) parts.push(course.stdDev >= 5 ? "more uneven pacing" : "steadier pacing");
  if (course.responses !== null) parts.push(course.responses >= 50 ? "strong sample" : "limited sample");
  return parts.length ? parts.join(" / ") : "No public workload signal yet";
}

function formatPresetLabel(preset: ExplorePreset) {
  return PRESET_OPTIONS.find((option) => option.value === preset)?.label || preset.replaceAll("_", " ");
}

export function Explore() {
  const { dept } = useParams();
  const selectedDept = dept?.toUpperCase() || "";
  const [searchParams, setSearchParams] = useSearchParams();
  const { addCourseFromCatalog, isInPlan } = usePlan();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS);
  const [savedPreset, setSavedPreset] = useState<ExploreFilters | null>(() => loadSavedPreset());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => { setQuery(initialQuery); setDebouncedQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setPage(0); }, [debouncedQuery, filters]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      const next = query.trim();
      if (next) setSearchParams({ q: next }); else setSearchParams({});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, setSearchParams]);
  useEffect(() => {
    const controller = new AbortController();
    const scopedFilters = selectedDept ? { ...filters, departments: [selectedDept] } : filters;
    const queryString = `${buildExploreQuery(debouncedQuery, scopedFilters)}&offset=${page * EXPLORE_PAGE_LIMIT}`;
    void requestJson<ExploreResponse>(`/catalog/explore?${queryString}`, { cacheTtlMs: 20_000, signal: controller.signal })
      .then((data) => { setResult(data); setLoadError(null); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Failed to load course catalog"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [debouncedQuery, filters, page, selectedDept]);

  const courses = result?.data ?? [];
  const departments = result?.availableFilters.departments ?? [];
  const levels = result?.availableFilters.levels ?? [];
  const attributes = result?.availableFilters.attributes ?? [];
  const terms = result?.availableFilters.terms ?? [];
  const groupedSubjects = useMemo<SubjectGroup[]>(() => {
    const bucket = new Map<string, CatalogCourse[]>();
    for (const course of courses) {
      const dept = course.dept || "Other";
      bucket.set(dept, [...(bucket.get(dept) ?? []), course]);
    }
    return Array.from(bucket.entries()).map(([dept, deptCourses]) => ({
      dept, courses: deptCourses, avgHours: average(deptCourses.map((course) => course.avgHours)), avgStdDev: average(deptCourses.map((course) => course.stdDev)), avgResponses: average(deptCourses.map((course) => course.responses)),
    })).sort((a, b) => a.dept.localeCompare(b.dept));
  }, [courses]);
  const activeFilterCount = filters.departments.length + Number(Boolean(filters.level)) + Number(Boolean(filters.creditsMin || filters.creditsMax)) + Number(Boolean(filters.avgHoursMin || filters.avgHoursMax)) + Number(Boolean(filters.stdDevMin || filters.stdDevMax)) + Number(Boolean(filters.responsesMin)) + Number(Boolean(filters.term)) + Number(Boolean(filters.attribute)) + Number(Boolean(filters.preset));
  const filterSummary = [
    filters.departments.length ? filters.departments.join(", ") : "",
    filters.level ? `${filters.level}-level` : "",
    filters.preset ? formatPresetLabel(filters.preset) : "",
    filters.term ? formatAcademicTerm(filters.term) : "",
    filters.responsesMin ? `${filters.responsesMin}+ reports` : "",
  ].filter(Boolean).slice(0, 4).join(" / ");
  const filteredDepartmentCodes = useMemo(() => {
    const search = departmentSearch.trim().toLowerCase();
    const hasCourseNarrowing = Boolean(
      debouncedQuery.trim() ||
      filters.departments.length ||
      filters.level ||
      filters.creditsMin ||
      filters.creditsMax ||
      filters.avgHoursMin ||
      filters.avgHoursMax ||
      filters.stdDevMin ||
      filters.stdDevMax ||
      filters.responsesMin ||
      filters.term ||
      filters.attribute ||
      filters.preset
    );
    const source = hasCourseNarrowing
      ? groupedSubjects.filter((group) => group.courses.length > 0).map((group) => group.dept)
      : departments;
    return source.filter((code) => {
      if (!search) return true;
      const name = DEPARTMENT_NAMES[code] || "";
      return code.toLowerCase().includes(search) || name.toLowerCase().includes(search);
    });
  }, [debouncedQuery, filters, departments, groupedSubjects, departmentSearch]);
  const visibleDepartments = useMemo(() => new Set(filteredDepartmentCodes), [filteredDepartmentCodes]);
  const directoryClusters = useMemo<DepartmentCluster[]>(() => {
    const seen = new Set<string>();
    const clusters = DEPARTMENT_CATEGORIES.map((category) => {
      const categoryDepartments = category.codes
        .filter((code) => visibleDepartments.has(code))
        .map((code) => {
          seen.add(code);
          return { code, name: DEPARTMENT_NAMES[code] || code };
        });
      return { title: category.title, departments: categoryDepartments };
    }).filter((cluster) => cluster.departments.length > 0);

    const otherDepartments = Array.from(visibleDepartments)
      .filter((code) => !seen.has(code))
      .sort()
      .map((code) => ({ code, name: DEPARTMENT_NAMES[code] || "Other Courses" }));

    return otherDepartments.length ? [...clusters, { title: "Other", departments: otherDepartments }] : clusters;
  }, [visibleDepartments]);
  const selectedDepartmentName = selectedDept ? DEPARTMENT_NAMES[selectedDept] || selectedDept : "";
  const activeChips = [
    ...filters.departments.map((department) => ({
      key: `department-${department}`,
      label: department,
      remove: () => setFilters((current) => ({ ...current, departments: current.departments.filter((value) => value !== department) })),
    })),
    filters.level ? { key: "level", label: `${filters.level}-level`, remove: () => setFilters((current) => ({ ...current, level: "" })) } : null,
    filters.creditsMin || filters.creditsMax ? { key: "credits", label: `Credits ${filters.creditsMin || "0"}-${filters.creditsMax || "any"}`, remove: () => setFilters((current) => ({ ...current, creditsMin: "", creditsMax: "" })) } : null,
    filters.avgHoursMin || filters.avgHoursMax ? { key: "hours", label: `Hours ${filters.avgHoursMin || "0"}-${filters.avgHoursMax || "any"}`, remove: () => setFilters((current) => ({ ...current, avgHoursMin: "", avgHoursMax: "" })) } : null,
    filters.stdDevMin || filters.stdDevMax ? { key: "variance", label: `Pacing ${filters.stdDevMin || "0"}-${filters.stdDevMax || "any"}`, remove: () => setFilters((current) => ({ ...current, stdDevMin: "", stdDevMax: "" })) } : null,
    filters.responsesMin ? { key: "reports", label: `${filters.responsesMin}+ reports`, remove: () => setFilters((current) => ({ ...current, responsesMin: "" })) } : null,
    filters.term ? { key: "term", label: formatAcademicTerm(filters.term), remove: () => setFilters((current) => ({ ...current, term: "" })) } : null,
    filters.attribute ? { key: "attribute", label: filters.attribute, remove: () => setFilters((current) => ({ ...current, attribute: "" })) } : null,
    filters.preset ? { key: "preset", label: formatPresetLabel(filters.preset), remove: () => setFilters((current) => ({ ...current, preset: "" })) } : null,
  ].filter((chip): chip is { key: string; label: string; remove: () => void } => Boolean(chip));


  return (
    <div className="min-h-screen bg-background pb-16">
      <section className="glass-panel border-x-0 border-t-0 rounded-none">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              {selectedDept && <Link to="/explore" className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-text-secondary transition hover:text-primary"><ArrowLeft size={16} />All departments</Link>}
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Explore</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-text">{selectedDept ? `${selectedDept} ${selectedDepartmentName}` : "Browse courses by subject"}</h1>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto,auto]">
              <div className="relative min-w-[280px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={selectedDept ? `Search ${selectedDept} courses...` : "Search departments or courses..."} className="w-full rounded-xl nm-input px-10 py-2.5 text-sm outline-none" />
                {query && <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted hover:bg-surface"><X size={14} /></button>}
              </div>
              <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as SortOption }))} className="rounded-xl nm-button px-4 py-2.5 text-sm font-bold text-text outline-none">
                <option value="relevance">Relevance</option><option value="workload_desc">Workload high-low</option><option value="workload_asc">Workload low-high</option><option value="variability_desc">Most variable</option><option value="responses_desc">Most responses</option><option value="alpha">Alphabetical</option><option value="course_number">Course number</option>
              </select>
              <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl nm-button px-4 py-2.5 text-sm font-bold text-text"><SlidersHorizontal size={16} />Filters{activeFilterCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white nm-raised">{activeFilterCount}</span>}</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
            <span>{loading ? "Loading courses..." : selectedDept ? `${result?.total ?? 0} ${selectedDept} courses` : `${directoryClusters.reduce((sum, cluster) => sum + cluster.departments.length, 0)} departments / ${result?.total ?? 0} courses`}</span>
            {activeFilterCount > 0 && <><span className="h-1 w-1 rounded-full bg-border" /><span>{filterSummary || `${activeFilterCount} filters active`}</span><button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="font-semibold text-text">Clear all</button></>}
          </div>
          {!selectedDept && (
            <div className="mt-3 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
                <input
                  value={departmentSearch}
                  onChange={(event) => setDepartmentSearch(event.target.value)}
                  placeholder="Find a department..."
                  className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                />
              </div>
            </div>
          )}
          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeChips.map((chip) => <FilterChip key={chip.key} onRemove={chip.remove}>{chip.label}</FilterChip>)}
            </div>
          )}
          {filtersOpen && <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm"><div className={`grid gap-4 ${selectedDept ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
            {!selectedDept && <FilterBlock label="Departments">{departments.map((dept) => { const selected = filters.departments.includes(dept); return <label key={dept} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selected ? "border-primary bg-primary-light text-primary" : "border-border bg-surface text-text"}`}><input type="checkbox" checked={selected} onChange={() => setFilters((current) => ({ ...current, departments: selected ? current.departments.filter((value) => value !== dept) : [...current.departments, dept] }))} />{dept}</label>; })}</FilterBlock>}
            <div className="space-y-4">
              <LabeledSelect label="Course level" value={filters.level} onChange={(value) => setFilters((current) => ({ ...current, level: value }))} options={["", ...levels]} format={(value) => value || "Any"} />
              <RangeFields label="Credits" minValue={filters.creditsMin} maxValue={filters.creditsMax} onMinChange={(value) => setFilters((current) => ({ ...current, creditsMin: value }))} onMaxChange={(value) => setFilters((current) => ({ ...current, creditsMax: value }))} />
              <TextField label="Minimum student reports" value={filters.responsesMin} onChange={(value) => setFilters((current) => ({ ...current, responsesMin: value }))} />
            </div>
            <div className="space-y-4">
              <RangeFields label="Workload hours / week" minValue={filters.avgHoursMin} maxValue={filters.avgHoursMax} onMinChange={(value) => setFilters((current) => ({ ...current, avgHoursMin: value }))} onMaxChange={(value) => setFilters((current) => ({ ...current, avgHoursMax: value }))} />
              <RangeFields label="Pacing variability" minValue={filters.stdDevMin} maxValue={filters.stdDevMax} onMinChange={(value) => setFilters((current) => ({ ...current, stdDevMin: value }))} onMaxChange={(value) => setFilters((current) => ({ ...current, stdDevMax: value }))} />
            </div>
            <div className="space-y-4">
              <LabeledSelect label="Term availability" value={filters.term} onChange={(value) => setFilters((current) => ({ ...current, term: value }))} options={["", ...terms]} format={(value) => value ? formatAcademicTerm(value) : "Any"} />
              <LabeledSelect label="Requirement / tag" value={filters.attribute} onChange={(value) => setFilters((current) => ({ ...current, attribute: value }))} options={["", ...attributes]} format={(value) => value || "Any"} />
              <div><div className="text-xs font-bold uppercase tracking-wide text-muted">Planning presets</div><div className="mt-2 flex flex-wrap gap-2">{PRESET_OPTIONS.map((preset) => <button key={preset.value} type="button" onClick={() => setFilters((current) => ({ ...current, preset: current.preset === preset.value ? "" : preset.value }))} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all relative overflow-hidden ${filters.preset === preset.value ? "bg-primary text-white nm-raised liquid-glass" : "nm-button text-text-secondary"}`}>{preset.label}</button>)}</div></div>
            </div>
          </div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => { window.localStorage.setItem(SAVED_PRESET_KEY, JSON.stringify(filters)); setSavedPreset(filters); }} className="rounded-xl nm-button px-4 py-2 text-sm font-bold text-text">Save this view</button>{savedPreset && <button type="button" onClick={() => setFilters(savedPreset)} className="rounded-xl nm-button px-4 py-2 text-sm font-bold text-text">Apply saved view</button>}</div></div>}
        </div>
      </section>

      <section className="container mx-auto px-4 py-4">
        {loading && <SkeletonGrid count={9} />}
        {!loading && loadError && <PageState tone="error" title="Could not load Explore" description={loadError} />}
        {!loading && !loadError && !courses.length && <PageState title="No courses matched this view" description="Try broadening the search or clearing a few filters." action={<button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setQuery(""); setDepartmentSearch(""); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Clear search and filters</button>} />}
        {!loading && !loadError && courses.length > 0 && !selectedDept && directoryClusters.length === 0 && <PageState title="No departments match" description="The current search or filters removed every department from the directory." action={<button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setDepartmentSearch(""); }} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Clear filters</button>} />}
        {!loading && !loadError && courses.length > 0 && !selectedDept && directoryClusters.length > 0 && <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {directoryClusters.map((cluster) => (
            <section key={cluster.title} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="border-b border-border bg-surface-2 px-4 py-3 text-sm font-black text-text">{cluster.title}</div>
              <div className="divide-y divide-border">
                {cluster.departments.map((department) => {
                  const group = groupedSubjects.find((item) => item.dept === department.code);
                  const theme = getSubjectTheme(department.code);
                  return <Link key={department.code} to={`/explore/${department.code}`} className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-white">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-lg font-black tracking-wide" style={{ color: theme.accentText }}>{department.code}</span>
                        <span className="truncate text-sm font-semibold text-text">{department.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-secondary">
                        <MetricPill label="Courses" value={group?.courses.length ?? 0} />
                        {group?.avgHours !== null && group?.avgHours !== undefined ? <MetricPill label="Avg" value={`${group.avgHours}h`} /> : null}
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                  </Link>;
                })}
              </div>
            </section>
          ))}
        </div>}
        {!loading && !loadError && courses.length > 0 && selectedDept && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groupedSubjects.map((group) => {
            const theme = getSubjectTheme(group.dept);
            return <div key={group.dept} className="contents">
                {group.courses.map((course) => {
                  const key = course.courseCode || course.id;
                  const open = expandedCourseId === key;
                  const inPlan = isInPlan(key);
                  return <div key={`${key}-${course.section || "course"}`} className="rounded-[22px] border border-border bg-surface" style={open ? { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder } : undefined}>
                    <button type="button" onClick={() => setExpandedCourseId((current) => current === key ? null : key)} className="w-full px-3 py-3 text-left">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="font-bold text-text">{course.code}</div><span className="rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-semibold text-text-secondary">{formatCourseSignal(course.trustTier, course.trustLabel)}</span></div><div className="mt-1 truncate text-sm text-text-secondary">{course.name}</div><div className="mt-2 flex flex-wrap gap-2"><MetricPill label="Credits" value={course.credits ?? "?"} /><MetricPill label="Load" value={formatMetric(course.avgHours, "h")} /><MetricPill label="Var" value={formatMetric(course.stdDev, "h")} /></div></div><div className="text-right"><div className="text-sm font-bold text-text">{formatMetric(course.avgHours, "h")}</div><div className="text-xs text-text-secondary">{course.responses === null ? "N/A" : `${course.responses} reports`}</div></div></div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/70"><div className="h-full rounded-full" style={{ width: `${getBarWidth(course.avgHours, 20)}%`, backgroundColor: theme.accent }} /></div>
                    </button>
                    {open && <div className="border-t border-border px-3 py-3"><div className="grid gap-3 md:grid-cols-2"><MiniBar label="Workload" value={formatMetric(course.avgHours, "h")} width={getBarWidth(course.avgHours, 20)} accent={theme.accent} /><MiniBar label="Reports" value={course.responses === null ? "N/A" : String(course.responses)} width={getBarWidth(course.responses, 120)} accent={theme.accent} /></div><div className="mt-3 flex flex-wrap gap-2"><Chip>{course.credits ?? "?"} credits</Chip><Chip>{course.level}</Chip><Chip>{formatAcademicTerm(course.latestTerm)}</Chip>{course.attributes.slice(0, 2).map((attribute) => <Chip key={attribute}>{attribute}</Chip>)}</div><div className="mt-3 rounded-2xl border-l-4 nm-inset p-4 text-sm text-text-secondary" style={{ borderColor: theme.accent }}><div className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Planning read</div><div className="mt-2 leading-relaxed">{buildCourseSummary(course)}. Planner fit: {inPlan ? "already in your active plan" : course.avgHours !== null && course.avgHours <= 10 ? "good candidate to balance a heavy scenario" : "better paired with lighter supporting courses"}.</div></div><div className="sticky bottom-2 mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-white/95 p-2 shadow-sm sm:flex-row"><button type="button" onClick={() => addCourseFromCatalog(course)} disabled={inPlan} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-sm font-bold text-white disabled:bg-emerald-600">{inPlan ? <Check size={14} /> : <Plus size={14} />}{inPlan ? "In plan" : "Add to plan"}</button><Link to={`/course/${encodeURIComponent(key)}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text">More info<ArrowUpRight size={14} /></Link></div></div>}
                  </div>;
                })}
              </div>;
          })}
        </div>}

      </section>
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: ReactNode }) { return <div><div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div><div className="mt-3 grid max-h-40 gap-2 overflow-auto pr-1">{children}</div></div>; }
function LabeledSelect({ label, value, onChange, options, format }: { label: string; value: string; onChange: (value: string) => void; options: string[]; format: (value: string) => string }) { return <label className="block"><div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">{options.map((option) => <option key={option || "empty"} value={option}>{format(option)}</option>)}</select></label>; }
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div><input value={value} onChange={(event) => onChange(event.target.value)} type="number" min="0" className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>; }
function RangeFields({ label, minValue, maxValue, onMinChange, onMaxChange }: { label: string; minValue: string; maxValue: string; onMinChange: (value: string) => void; onMaxChange: (value: string) => void }) { return <div><div className="text-xs font-bold uppercase tracking-wide text-muted">{label}</div><div className="mt-2 grid grid-cols-2 gap-2"><input type="number" min="0" value={minValue} onChange={(event) => onMinChange(event.target.value)} placeholder="Min" className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" /><input type="number" min="0" value={maxValue} onChange={(event) => onMaxChange(event.target.value)} placeholder="Max" className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" /></div></div>; }
function Chip({ children }: { children: ReactNode }) { return <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">{children}</span>; }
function MiniBar({ label, value, width, accent }: { label: string; value: string; width: number; accent: string }) { return <div className="rounded-xl nm-inset px-3 py-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-text">{label}</span><span className="font-bold text-text">{value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: accent }} /></div></div>; }
