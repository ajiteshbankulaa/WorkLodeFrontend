import { useMemo, useState } from "react";
import { Shield, Upload, Presentation, TrendingUp, Users, Filter } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../lib/api";

type AdminFilters = {
  dept: string;
  term: string;
  course: string;
  includeExternalData: boolean;
};

export function AdminDeepDive() {
  const { token } = useAuth();
  const [filters, setFilters] = useState<AdminFilters>({
    dept: "CSCI",
    term: "Spring 2026",
    course: "",
    includeExternalData: false,
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ model?: string; usage?: any } | null>(null);

  const headline = useMemo(() => {
    const coursePart = filters.course ? ` • Course: ${filters.course}` : "";
    const ext = filters.includeExternalData ? " • External data: ON" : "";
    return `${filters.dept} • ${filters.term}${coursePart}${ext}`;
  }, [filters]);

  const runAnalysis = async () => {
    if (!token) {
      setAnalysisError("You must be signed in as an admin to run department analysis.");
      return;
    }

    try {
      setAnalysisLoading(true);
      setAnalysisError(null);

      const res = await fetch(`${API_BASE}/deepdive/admin/analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(filters),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Failed to run department analysis (${res.status})`);
      }

      setAnalysis(typeof data?.text === "string" ? data.text : "");
      setAnalysisMeta({ model: data?.model, usage: data?.usage });
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to run department analysis");
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-text flex items-center gap-2">
            <Shield size={18} />
            Admin Workspace
          </h2>
          <span className="text-xs text-muted">Deep Dive • Admin</span>
        </div>

        <div className="mt-4 space-y-4">
          <div className="bg-surface-2 border border-border rounded-2xl p-4">
            <div className="text-sm font-semibold text-text flex items-center gap-2">
              <Filter size={16} />
              Filters
            </div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <label className="text-sm text-text-secondary">
                Department
                <select
                  value={filters.dept}
                  onChange={(e) => setFilters((p) => ({ ...p, dept: e.target.value }))}
                  className="mt-1 w-full bg-surface border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
                >
                  <option value="CSCI">CSCI</option>
                  <option value="ECSE">ECSE</option>
                  <option value="MATH">MATH</option>
                  <option value="ITWS">ITWS</option>
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Term
                <select
                  value={filters.term}
                  onChange={(e) => setFilters((p) => ({ ...p, term: e.target.value }))}
                  className="mt-1 w-full bg-surface border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
                >
                  <option>Spring 2026</option>
                  <option>Fall 2025</option>
                  <option>Spring 2025</option>
                </select>
              </label>

              <label className="text-sm text-text-secondary">
                Course (optional)
                <input
                  value={filters.course}
                  onChange={(e) => setFilters((p) => ({ ...p, course: e.target.value }))}
                  className="mt-1 w-full bg-surface border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
                  placeholder="e.g., CSCI-1200"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={filters.includeExternalData}
                  onChange={(e) => setFilters((p) => ({ ...p, includeExternalData: e.target.checked }))}
                />
                Include external department data
              </label>
            </div>
          </div>

          <div className="bg-surface-2 border border-border rounded-2xl p-4">
            <div className="text-sm font-semibold text-text flex items-center gap-2">
              <Upload size={16} />
              Upload Department Data (CSV/PDF)
            </div>
            <input
              type="file"
              className="block w-full text-sm mt-2"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            {fileName && <div className="text-xs text-text-secondary mt-2">Selected: {fileName}</div>}
            <div className="text-xs text-muted mt-1">
              Current backend analysis uses live risk rows plus the selected filters; file ingestion can be added next.
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={analysisLoading}
            className="w-full bg-secondary hover:bg-secondary-hover text-white font-extrabold rounded-xl py-3 disabled:opacity-60"
          >
            {analysisLoading ? "Running Analysis..." : "Run Department Analysis"}
          </button>

          {analysisError && <div className="text-sm text-red-600">{analysisError}</div>}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-text">Department Overview</h2>
              <p className="text-sm text-text-secondary mt-1">{headline}</p>
            </div>
            <button
              className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-2 font-semibold text-sm flex items-center gap-2"
              onClick={() => window.print()}
            >
              <Presentation size={16} />
              Export Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            {[
              { label: "Enrollment Trend", icon: TrendingUp, value: "+6.2%" },
              { label: "Cohort Size", icon: Users, value: "1,284" },
              { label: "Workload Risk", icon: TrendingUp, value: "Medium" },
            ].map((k) => (
              <div key={k.label} className="bg-surface-2 border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 text-text font-bold">
                  <k.icon size={16} />
                  {k.label}
                </div>
                <div className="mt-3 text-2xl font-extrabold text-text">{k.value}</div>
                <div className="text-xs text-muted mt-1">Placeholder KPI card; AI memo below is backend-generated.</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="font-extrabold text-text">AI Department Analysis</h3>
          <p className="text-sm text-text-secondary mt-1">
            Generated from the backend OpenRouter analysis endpoint plus live department risk rows.
          </p>

          <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-4">
            <pre className="whitespace-pre-wrap text-sm text-text leading-6">
              {analysis || "Run Department Analysis to generate an admin memo with risks and recommended actions."}
            </pre>
          </div>

          {analysisMeta?.model && <div className="mt-4 text-xs text-muted">Model: {analysisMeta.model}</div>}
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="font-extrabold text-text">Planning Tools</h3>
          <p className="text-sm text-text-secondary mt-1">
            Build tools admins actually need: TA allocation, course redesign flags, bottleneck detection, and presentation-ready visuals.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
            {[
              {
                title: "TA Allocation Optimizer",
                desc: "Suggest TA distribution using enrollment + reported workload + office hours demand.",
              },
              {
                title: "Course Restructure Candidates",
                desc: "Identify courses with extreme hours/week, low satisfaction, or high fail/withdrawal.",
              },
              {
                title: "Prerequisite Bottleneck Map",
                desc: "Detect flow constraints that delay graduation for large student segments.",
              },
              {
                title: "Slide-Ready Insights",
                desc: "Auto-generate charts + narrative bullets for department meetings.",
              },
            ].map((x) => (
              <div
                key={x.title}
                className="text-left p-4 rounded-2xl border border-border bg-surface hover:bg-surface-2 transition-all"
              >
                <div className="font-bold text-text">{x.title}</div>
                <div className="text-sm text-text-secondary mt-1">{x.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
