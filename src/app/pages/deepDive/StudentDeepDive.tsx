import { useMemo, useState } from "react";
import { Upload, Wand2, FileText, GraduationCap, Briefcase, Flame } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../lib/api";

type StudentInputs = {
  graduationPlanNotes: string;
  takenClasses: string;
  goals: string;
  intensity: "light" | "medium" | "hard";
  targetJobs: string;
};

export function StudentDeepDive() {
  const { token } = useAuth();
  const [fileName, setFileName] = useState<string | null>(null);
  const [inputs, setInputs] = useState<StudentInputs>({
    graduationPlanNotes: "",
    takenClasses: "",
    goals: "",
    intensity: "medium",
    targetJobs: "",
  });
  const [plan, setPlan] = useState<string>("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planMeta, setPlanMeta] = useState<{ model?: string; usage?: any } | null>(null);

  const workloadScore = useMemo(() => {
    let score = 50;
    score += inputs.intensity === "hard" ? 20 : inputs.intensity === "light" ? -15 : 0;
    score += Math.min(15, Math.floor((inputs.goals.length + inputs.targetJobs.length) / 50));
    score -= Math.min(10, Math.floor(inputs.takenClasses.length / 120));
    return Math.max(0, Math.min(100, score));
  }, [inputs]);

  const onGenerate = async () => {
    if (!token) {
      setPlanError("You must be signed in to generate a Deep Dive plan.");
      return;
    }

    try {
      setPlanLoading(true);
      setPlanError(null);

      const res = await fetch(`${API_BASE}/deepdive/student/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...inputs,
          uploadedFileName: fileName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || `Failed to generate plan (${res.status})`);
      }

      setPlan(typeof data?.text === "string" ? data.text : "");
      setPlanMeta({ model: data?.model, usage: data?.usage });
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-extrabold text-text flex items-center gap-2">
            <GraduationCap size={18} />
            Student Intake
          </h2>
          <span className="text-xs text-muted">Deep Dive • Student</span>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <div className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
              <Upload size={16} />
              Upload Graduation Plan (PDF/Doc/etc.)
            </div>
            <input
              type="file"
              className="block w-full text-sm"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            {fileName && <div className="text-xs text-text-secondary mt-2">Selected: {fileName}</div>}
            <div className="text-xs text-muted mt-1">
              Current backend prompt includes the uploaded filename; wire actual file parsing in next.
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-text mb-2">Taken classes (paste)</div>
            <textarea
              value={inputs.takenClasses}
              onChange={(e) => setInputs((p) => ({ ...p, takenClasses: e.target.value }))}
              className="w-full min-h-[90px] bg-surface-2 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
              placeholder="Example: CS1, Data Structures, Comp Org, Linear Algebra..."
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-text mb-2">Desires / specialization goals</div>
            <textarea
              value={inputs.goals}
              onChange={(e) => setInputs((p) => ({ ...p, goals: e.target.value }))}
              className="w-full min-h-[90px] bg-surface-2 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
              placeholder="What do you want to learn? What track? What domain?"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
              <Flame size={16} />
              Desired difficulty
            </div>
            <select
              value={inputs.intensity}
              onChange={(e) => setInputs((p) => ({ ...p, intensity: e.target.value as StudentInputs["intensity"] }))}
              className="w-full bg-surface-2 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
            >
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
              <Briefcase size={16} />
              Target jobs (paste)
            </div>
            <textarea
              value={inputs.targetJobs}
              onChange={(e) => setInputs((p) => ({ ...p, targetJobs: e.target.value }))}
              className="w-full min-h-[70px] bg-surface-2 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
              placeholder="Example: Cloud Security Engineer, ML Engineer, SWE..."
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
              <FileText size={16} />
              Notes about your graduation plan
            </div>
            <textarea
              value={inputs.graduationPlanNotes}
              onChange={(e) => setInputs((p) => ({ ...p, graduationPlanNotes: e.target.value }))}
              className="w-full min-h-[70px] bg-surface-2 border border-border rounded-xl p-3 text-sm outline-none focus:border-primary"
              placeholder="Constraints: time, credits, internship semester, commute, health, etc."
            />
          </label>

          <button
            onClick={onGenerate}
            disabled={planLoading}
            className="w-full bg-secondary hover:bg-secondary-hover text-white font-extrabold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Wand2 size={16} />
            {planLoading ? "Generating..." : "Generate AI Plan + Visuals"}
          </button>

          {planError && <div className="text-sm text-red-600">{planError}</div>}
        </div>
      </div>

      <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-5">
        <h2 className="font-extrabold text-text">Charts & Risk Signals</h2>
        <p className="text-sm text-text-secondary mt-1">
          Placeholder visuals for pacing and pressure while the backend focuses on the written plan.
        </p>

        <div className="mt-6 space-y-5">
          <div className="bg-surface-2 border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-text">Workload Pressure</div>
              <div className="text-sm font-extrabold text-text">{workloadScore}/100</div>
            </div>
            <div className="mt-3 h-3 rounded-full bg-surface border border-border overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${workloadScore}%` }} />
            </div>
            <div className="text-xs text-muted mt-2">
              Interprets your intensity + goals + course history before the AI plan is generated.
            </div>
          </div>

          <div className="bg-surface-2 border border-border rounded-2xl p-4">
            <div className="font-bold text-text">Plan Variants</div>
            <div className="grid grid-cols-1 gap-2 mt-3">
              {["Balanced Path", "Accelerated Path", "Internship-Optimized"].map((x) => (
                <button
                  key={x}
                  className="text-left px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-2 transition-all"
                  onClick={() =>
                    setPlan((p) => (p ? `${p}\n\nVariant focus: ${x}` : `Generate a plan first.\n\nVariant focus: ${x}`))
                  }
                >
                  <div className="font-semibold text-text">{x}</div>
                  <div className="text-xs text-text-secondary mt-1">Click to apply variant knobs to the current plan.</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-2 border border-border rounded-2xl p-4">
            <div className="font-bold text-text">Extra Tools (next)</div>
            <ul className="mt-2 text-sm text-text-secondary list-disc pl-5 space-y-1">
              <li>Resume analysis + job match scoring</li>
              <li>Course schedule optimizer (hours vs difficulty vs prerequisites)</li>
              <li>Internship timeline planner + reminders</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1 bg-surface border border-border rounded-2xl p-5">
        <h2 className="font-extrabold text-text">AI Output</h2>
        <p className="text-sm text-text-secondary mt-1">
          This is where your backend LLM response renders.
        </p>

        <div className="mt-4 bg-surface-2 border border-border rounded-2xl p-4">
          <pre className="whitespace-pre-wrap text-sm text-text leading-6">
            {plan || 'Click "Generate AI Plan + Visuals" to produce a personalized plan from your intake and current course context.'}
          </pre>
        </div>

        {planMeta?.model && (
          <div className="mt-4 text-xs text-muted">
            Model: {planMeta.model}
          </div>
        )}
      </div>
    </div>
  );
}
