import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, LoaderCircle, Pencil, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useAuth } from "../context/AuthContext";
import { requestJson } from "../lib/api";

type ExtractedInfo = {
  exams: { label: string; date?: string; time?: string }[];
  notes?: string;
};

type SearchCourse = {
  courseCode: string;
  code: string;
  name: string;
  latestTerm: string;
  avgHours: number | null;
  stdDev: number | null;
  responses: number | null;
  dept: string;
};

type SubmissionRecord = {
  id: string;
  termCode: string;
  courseCode: string;
  hoursPerWeek: number;
  difficulty: number;
  peakWeek: boolean;
  comment: string;
  extracted: ExtractedInfo;
  submittedAt?: string | null;
  sourceType: string;
};

type SubmitResult = {
  stats?: {
    avgHours?: number;
    stdDev?: number;
    responses?: number;
    avg_hours?: number;
    std_dev?: number;
    count?: number;
  };
  submission?: SubmissionRecord;
};

function normalizeStats(stats: SubmitResult["stats"]) {
  if (!stats) return null;
  return {
    avgHours: typeof stats.avgHours === "number" ? stats.avgHours : typeof stats.avg_hours === "number" ? stats.avg_hours : null,
    stdDev: typeof stats.stdDev === "number" ? stats.stdDev : typeof stats.std_dev === "number" ? stats.std_dev : null,
    responses: typeof stats.responses === "number" ? stats.responses : typeof stats.count === "number" ? stats.count : null,
  };
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function emptyExtracted(): ExtractedInfo {
  return { exams: [], notes: "" };
}

export function Feedback() {
  const { token, user, isAuthenticated, loading: authLoading, authError } = useAuth();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<SearchCourse | null>(null);
  const [history, setHistory] = useState<SubmissionRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [hours, setHours] = useState(10);
  const [difficulty, setDifficulty] = useState(3);
  const [peakWeek, setPeakWeek] = useState(false);
  const [comment, setComment] = useState("");
  const [extracted] = useState<ExtractedInfo>(emptyExtracted());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const canAdvance = Boolean(selectedCourse) && isAuthenticated && !authLoading;
  const prettyStats = normalizeStats(submitResult?.stats);

  useEffect(() => {
    if (!searchQuery.trim() || selectedCourse) {
      if (!selectedCourse) setSearchResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    let ignore = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const data = await requestJson<Array<{ course_code: string; term?: string; code: string; name: string; avgHours?: number | null; stdDev?: number | null; responses?: number | null; subj?: string }>>(`/catalog/search?q=${encodeURIComponent(searchQuery.trim())}&limit=12`, { signal: controller.signal });
        if (ignore) return;
        setSearchResults(
          data.map((course) => ({
            courseCode: course.course_code,
            code: course.code,
            name: course.name,
            latestTerm: course.term || "latest",
            avgHours: typeof course.avgHours === "number" ? course.avgHours : null,
            stdDev: typeof course.stdDev === "number" ? course.stdDev : null,
            responses: typeof course.responses === "number" ? course.responses : null,
            dept: course.subj || course.code.split(" ")[0] || "Course",
          }))
        );
        setSearchError(null);
      } catch (error) {
        if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
          setSearchError(error instanceof Error ? error.message : "Failed to search courses");
        }
      } finally {
        if (!ignore) setSearching(false);
      }
    }, 220);

    return () => {
      ignore = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchQuery, selectedCourse]);

  useEffect(() => {
    if (!token) {
      setHistory([]);
      return;
    }

    let ignore = false;
    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const data = await requestJson<{ items?: SubmissionRecord[] }>("/feedback/workload/history?limit=8", { token });
        if (!ignore) {
          setHistory(Array.isArray(data.items) ? data.items : []);
          setHistoryError(null);
        }
      } catch (error) {
        if (!ignore) setHistoryError(error instanceof Error ? error.message : "Failed to load submission history");
      } finally {
        if (!ignore) setLoadingHistory(false);
      }
    }
    void loadHistory();
    return () => {
      ignore = true;
    };
  }, [token]);

  const resetForm = () => {
    setStep(1);
    setSelectedCourse(null);
    setSearchQuery("");
    setSearchResults([]);
    setEditingSubmissionId(null);
    setHours(10);
    setDifficulty(3);
    setPeakWeek(false);
    setComment("");
    setSubmitError(null);
    setSubmitResult(null);
  };

  const loadSubmissionIntoForm = (submission: SubmissionRecord) => {
    setEditingSubmissionId(submission.id);
    setSelectedCourse({
      courseCode: submission.courseCode,
      code: submission.courseCode.replace("-", " "),
      name: submission.courseCode,
      latestTerm: submission.termCode,
      avgHours: null,
      stdDev: null,
      responses: null,
      dept: submission.courseCode.split("-")[0] || "Course",
    });
    setHours(submission.hoursPerWeek);
    setDifficulty(submission.difficulty);
    setPeakWeek(submission.peakWeek);
    setComment(submission.comment);
    setStep(2);
    setSubmitError(null);
    setSubmitResult(null);
  };

  const handleDelete = async (submissionId: string) => {
    if (!token) return;
    try {
      await requestJson<Record<string, unknown>>(`/feedback/workload/${submissionId}`, { method: "DELETE", token });
      setHistory((current) => current.filter((item) => item.id !== submissionId));
      if (editingSubmissionId === submissionId) resetForm();
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Failed to delete submission");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!token) throw new Error("Please sign in with Google before submitting feedback.");
      if (!selectedCourse) throw new Error("Please choose a course first.");
      const payload = {
        term_code: selectedCourse.latestTerm || "latest",
        course_code: selectedCourse.courseCode,
        hours_per_week: hours,
        difficulty,
        peak_week: peakWeek,
        comment,
        extracted,
      };
      const typed = await requestJson<SubmitResult>(editingSubmissionId ? `/feedback/workload/${editingSubmissionId}` : "/feedback/workload", {
        method: editingSubmissionId ? "PATCH" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSubmitResult(typed);
      if (typed.submission?.id) {
        setHistory((current) => [typed.submission!, ...current.filter((item) => item.id !== typed.submission!.id)].slice(0, 8));
      }
      setEditingSubmissionId(null);
      setStep(3);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMeta = useMemo(() => {
    if (!selectedCourse) return "";
    return `${selectedCourse.dept} • ${selectedCourse.latestTerm === "latest" ? "Latest term" : selectedCourse.latestTerm}`;
  }, [selectedCourse]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-text">Feedback</h1>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-1.5 text-sm text-text-secondary">
            <ShieldCheck size={16} className="text-emerald-500" />
            <span className="font-medium">Private uploads • Aggregated metrics • Thresholded display</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-secondary shadow-sm">
          Choose a course, report workload, then confirm the impact on course stats.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-xl shadow-slate-200/50">
          <div className="absolute left-0 right-0 top-0 h-1.5 bg-surface-2">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }} />
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pt-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 1</div>
                  <h2 className="mt-1 text-2xl font-black text-text">Choose course</h2>
                </div>

                <div className="rounded-2xl border border-border bg-surface-2 p-4">
                  {isAuthenticated && user ? (
                    <div className="text-sm text-text-secondary">Signed in as <span className="font-bold text-text">{user.email}</span>. Feedback submissions use your Google-backed Worklode session.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-bold text-text">Google sign-in required</div>
                      <div className="text-sm text-text-secondary">Sign in with Google before submitting workload feedback.</div>
                      <GoogleSignInButton className="w-full" label={authLoading ? "Checking session..." : "Sign in with Google"} />
                      {authError && <div className="text-xs text-red-600">{authError}</div>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-3 block text-sm font-bold text-text">Search course</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                      value={selectedCourse ? `${selectedCourse.code} - ${selectedCourse.name}` : searchQuery}
                      onChange={(event) => {
                        setSelectedCourse(null);
                        setSearchQuery(event.target.value);
                      }}
                      placeholder="Search by code or title"
                      className="w-full rounded-xl border border-transparent bg-surface-2 py-3 pl-10 pr-4 text-text outline-none transition focus:border-primary focus:bg-white"
                    />
                  </div>

                  {searching && <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary"><LoaderCircle size={15} className="animate-spin" />Searching courses...</div>}
                  {searchError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</div>}

                  {!selectedCourse && searchResults.length > 0 && (
                    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-white p-2">
                      {searchResults.map((course) => (
                        <button key={`${course.courseCode}-${course.latestTerm}`} type="button" onClick={() => { setSelectedCourse(course); setSearchQuery(""); }} className="w-full rounded-xl border border-transparent bg-surface px-3 py-3 text-left transition hover:border-primary/20 hover:bg-primary-light/40">
                          <div className="text-sm font-bold text-text">{course.code}</div>
                          <div className="mt-1 text-sm text-text-secondary">{course.name}</div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                            <span>{course.latestTerm}</span>
                            <span>{course.avgHours === null ? "Load N/A" : `${course.avgHours}h/wk`}</span>
                            <span>{course.responses === null ? "No responses" : `${course.responses} responses`}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCourse && (
                    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary-light/40 px-4 py-3">
                      <div className="text-sm font-black text-text">{selectedCourse.code}</div>
                      <div className="mt-1 text-sm text-text-secondary">{selectedCourse.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-text-secondary">
                        <span>{selectedMeta}</span>
                        <span>{selectedCourse.avgHours === null ? "Load N/A" : `${selectedCourse.avgHours}h/wk avg`}</span>
                        <span>{selectedCourse.stdDev === null ? "Variance N/A" : `± ${selectedCourse.stdDev} variance`}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button type="button" disabled={!canAdvance} onClick={() => setStep(2)} className="w-full rounded-xl bg-primary py-4 font-bold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                  {editingSubmissionId ? "Continue Edit" : "Report workload"}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pt-4" onSubmit={handleSubmit}>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 2</div>
                  <h2 className="mt-1 text-2xl font-black text-text">Report workload</h2>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{editingSubmissionId ? "Editing submission" : "Selected course"}</div>
                  <div className="mt-2 text-lg font-black text-text">{selectedCourse?.code || "No course selected"}</div>
                  <div className="mt-1 text-sm text-text-secondary">{selectedCourse?.name}</div>
                </div>

                <div>
                  <label className="mb-6 flex items-end justify-between text-sm font-bold text-text">
                    <span>Weekly average hours</span>
                    <span className="font-mono text-3xl font-black text-primary">{hours} <span className="text-sm font-bold uppercase text-muted">hrs</span></span>
                  </label>
                  <input type="range" min="0" max="40" step="0.5" value={hours} onChange={(event) => setHours(Number(event.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-primary" />
                  <div className="mt-3 flex justify-between font-mono text-xs font-medium text-muted"><span>0h</span><span>20h</span><span>40h+</span></div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-text">Difficulty</label>
                  <select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} className="w-full rounded-xl border border-transparent bg-surface-2 p-4 font-medium text-text outline-none transition-all focus:border-primary focus:bg-white">
                    <option value={1}>1 - Very easy</option>
                    <option value={2}>2 - Easy</option>
                    <option value={3}>3 - Moderate</option>
                    <option value={4}>4 - Hard</option>
                    <option value={5}>5 - Very hard</option>
                  </select>
                </div>

                <button type="button" onClick={() => setPeakWeek((current) => !current)} className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-surface-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${peakWeek ? "border-primary bg-primary text-white" : "border-muted bg-white"}`}>{peakWeek && <Check size={14} />}</div>
                  <span className="text-sm font-medium text-text-secondary">Workload spike: was there a specific week significantly above average?</span>
                </button>

                <div>
                  <label className="mb-3 block text-sm font-bold text-text">Short advice for future students</label>
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="w-full resize-none rounded-xl border border-transparent bg-surface-2 p-4 font-medium text-text outline-none transition-all focus:border-primary focus:bg-white" placeholder="What would help someone plan for this course?" />
                </div>

                <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  Recent duplicate submissions for the same course and term are blocked, so use edit if you need to correct something you just submitted.
                </div>

                {submitError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div>}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-4 font-bold text-text-secondary transition-all hover:bg-surface-2">Back</button>
                  <button type="submit" disabled={submitting || !selectedCourse} className="flex-1 rounded-xl bg-primary py-4 font-bold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? "Saving..." : editingSubmissionId ? "Update Feedback" : "Submit Feedback"}
                  </button>
                </div>
              </motion.form>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-8 pt-6 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={36} /></div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">Step 3</div>
                <h2 className="mb-3 text-2xl font-black text-text">Feedback saved</h2>
                <p className="mx-auto mb-6 max-w-md leading-relaxed text-text-secondary">Your report was saved and the per-course stats were recomputed.</p>
                {prettyStats && (
                  <div className="mx-auto mb-6 max-w-sm rounded-2xl border border-border bg-surface-2 p-4 text-left">
                    <div className="mb-2 text-sm font-bold text-text">Updated course stats</div>
                    <div className="text-sm text-text-secondary">Avg Hours: <span className="font-bold text-text">{prettyStats.avgHours ?? "N/A"}</span></div>
                    <div className="text-sm text-text-secondary">Std Dev: <span className="font-bold text-text">{prettyStats.stdDev ?? "N/A"}</span></div>
                    <div className="text-sm text-text-secondary">Responses: <span className="font-bold text-text">{prettyStats.responses ?? "N/A"}</span></div>
                  </div>
                )}
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Link to="/explore" className="rounded-xl bg-primary px-6 py-3 font-bold text-white transition-all hover:bg-primary-hover">Explore Courses</Link>
                  <button onClick={resetForm} className="rounded-xl border border-border px-6 py-3 font-bold text-text-secondary transition-all hover:bg-surface-2">Submit Another</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Recent submissions</div>
            <div className="mt-1 text-sm text-text-secondary">Edit or retract a recent report instead of sending another duplicate.</div>
            <div className="mt-4 space-y-3">
              {!token ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">Sign in to view and manage your recent feedback submissions.</div>
              ) : loadingHistory ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary"><LoaderCircle size={15} className="animate-spin" />Loading submission history...</div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{historyError}</div>
              ) : history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">No recent submissions yet.</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-text">{item.courseCode}</div>
                        <div className="mt-1 text-xs text-text-secondary">{item.termCode} • {formatTimestamp(item.submittedAt)}</div>
                      </div>
                      <span className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-bold text-text-secondary">{item.sourceType === "syllabus_upload" ? "Syllabus" : "Manual"}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-text-secondary">
                      <div className="rounded-xl border border-border bg-white px-3 py-2">{item.hoursPerWeek}h/wk</div>
                      <div className="rounded-xl border border-border bg-white px-3 py-2">Diff {item.difficulty}/5</div>
                      <div className="rounded-xl border border-border bg-white px-3 py-2">{item.peakWeek ? "Peak week" : "Steady"}</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => loadSubmissionIntoForm(item)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text transition hover:border-primary/30 hover:text-primary"><Pencil size={13} />Edit</button>
                      <button type="button" onClick={() => void handleDelete(item.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100"><Trash2 size={13} />Retract</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
