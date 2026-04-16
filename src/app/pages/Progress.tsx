import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Sparkles, Target, Trash2 } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { useProgress } from "../context/ProgressContext";
import { formatAcademicTerm, formatMetric } from "../lib/display";
import type { ProgressAlert, ProgressMilestone, ProgressRequirementGroup, ProgressRequirementItem } from "../context/ProgressContext";

type AlertSuggestion = {
  title: string;
  message: string;
  severity: ProgressAlert["severity"];
};

function termRank(termCode: string) {
  if (!/^\d{6}$/.test(termCode)) return null;
  const year = Number(termCode.slice(0, 4));
  const month = Number(termCode.slice(4));
  const season = month <= 4 ? 0 : month <= 8 ? 1 : 2;
  return year * 10 + season;
}

export function Progress() {
  const { activePlan, plans, getPlanSummary } = usePlan();
  const {
    profile,
    requirementGroups,
    milestones,
    alerts,
    setProfile,
    addRequirementGroup,
    updateRequirementGroup,
    removeRequirementGroup,
    addRequirementItem,
    updateRequirementItem,
    removeRequirementItem,
    addMilestone,
    updateMilestone,
    removeMilestone,
    addAlert,
    updateAlert,
    removeAlert,
    resetProgress,
  } = useProgress();

  const activePlanSummary = useMemo(() => getPlanSummary(activePlan), [activePlan, getPlanSummary]);
  const planCourses = useMemo(
    () => (activePlan?.items ?? []).filter((item) => item.type === "course").map((item) => item.course),
    [activePlan]
  );
  const currentRank = termRank(activePlan?.termCode || profile.targetTerm);

  const groupStats = useMemo(() => {
    const totalItems = requirementGroups.reduce((sum, group) => sum + group.items.length, 0);
    const doneItems = requirementGroups.reduce((sum, group) => sum + group.items.filter((item) => item.status === "done").length, 0);
    return {
      groups: requirementGroups.length,
      items: totalItems,
      done: doneItems,
      open: Math.max(totalItems - doneItems, 0),
    };
  }, [requirementGroups]);

  const milestoneStats = useMemo(
    () => ({
      total: milestones.length,
      active: milestones.filter((milestone) => milestone.status !== "done").length,
    }),
    [milestones]
  );

  const alertSuggestions = useMemo<AlertSuggestion[]>(() => {
    const suggestions: AlertSuggestion[] = [];

    if (planCourses.length === 0) {
      suggestions.push({
        title: "No courses in the active plan",
        message: "Add at least one course to make progress checks more actionable.",
        severity: "warning",
      });
    }

    if (activePlanSummary.totalAcademicLoad >= 55) {
      suggestions.push({
        title: "High workload",
        message: "The current active plan is at the top end of what this view treats as manageable.",
        severity: "danger",
      });
    } else if (activePlanSummary.totalAcademicLoad >= 35) {
      suggestions.push({
        title: "Moderate workload",
        message: "The current plan looks workable, but it still benefits from a deliberate pacing check.",
        severity: "warning",
      });
    }

    const nextMilestone = milestones.find((milestone) => milestone.status !== "done" && termRank(milestone.targetTerm) !== null);
    if (nextMilestone && currentRank !== null) {
      const gap = (termRank(nextMilestone.targetTerm) || 0) - currentRank;
      if (gap <= 1) {
        suggestions.push({
          title: "Milestone approaching",
          message: `${nextMilestone.title} is due soon relative to the current planning term.`,
          severity: "warning",
        });
      }
    }

    if (activePlanSummary.warnings.length > 0) {
      suggestions.push({
        title: "Plan warning",
        message: activePlanSummary.warnings[0],
        severity: "warning",
      });
    }

    return suggestions.slice(0, 4);
  }, [activePlanSummary.totalAcademicLoad, activePlanSummary.warnings, milestones, planCourses.length, currentRank]);

  return (
    <div className="min-h-screen bg-background pb-16" style={{ backgroundImage: "var(--page-gradient)" }}>
      <section className="border-b border-border bg-[var(--hero-gradient)]">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Progress</div>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-text">Requirement blocks, milestones, and alerts in one place</h1>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Keep progress local-first and editable while still grounded in the active plan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/plan" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text">
                Open planner
                <ArrowRight size={15} />
              </Link>
              <button type="button" onClick={resetProgress} className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-bold text-text">
                Reset local progress
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Requirement groups" value={groupStats.groups} note={`${groupStats.done} completed / ${groupStats.open} open items`} icon={<BookOpen size={15} />} />
            <StatCard label="Milestones" value={milestoneStats.total} note={`${milestoneStats.active} still active`} icon={<Target size={15} />} />
            <StatCard label="Alerts" value={alerts.length} note={`${alertSuggestions.length} suggested signals`} icon={<AlertTriangle size={15} />} />
            <StatCard label="Planner terms" value={plans.length} note={activePlan ? `Active: ${activePlan.name}` : "No active plan"} icon={<CalendarDays size={15} />} />
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <SectionHeader icon={<Sparkles size={15} />} title="Profile" description="Editable local-first context for your degree direction." />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Program name">
                  <input value={profile.programName} onChange={(event) => setProfile({ programName: event.target.value })} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </Field>
                <Field label="Target term">
                  <input value={profile.targetTerm} onChange={(event) => setProfile({ targetTerm: event.target.value })} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </Field>
                <Field label="Target credits">
                  <input type="number" min="0" value={profile.targetCredits} onChange={(event) => setProfile({ targetCredits: Number(event.target.value || 0) })} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </Field>
                <Field label="Notes">
                  <input value={profile.notes} onChange={(event) => setProfile({ notes: event.target.value })} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </Field>
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader icon={<CheckCircle2 size={15} />} title="Requirement groups" description="Editable blocks with course-linked items and simple completion states." />
                <button type="button" onClick={addRequirementGroup} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-text">
                  Add group
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {requirementGroups.map((group) => (
                  <RequirementGroupCard
                    key={group.id}
                    group={group}
                    planCourses={planCourses}
                    onUpdate={(patch) => updateRequirementGroup(group.id, patch)}
                    onRemove={() => removeRequirementGroup(group.id)}
                    onAddItem={() => addRequirementItem(group.id)}
                    onUpdateItem={(itemId, patch) => updateRequirementItem(group.id, itemId, patch)}
                    onRemoveItem={(itemId) => removeRequirementItem(group.id, itemId)}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <SectionHeader icon={<Clock3 size={15} />} title="Current plan" description="Pulled from the active planner so progress stays grounded in the current scenario." />
              <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                <div className="text-sm font-black text-text">{activePlan?.name || "No active plan"}</div>
                <div className="mt-1 text-sm text-text-secondary">{activePlan ? formatAcademicTerm(activePlan.termCode) : "Open Plan to add a scenario first."}</div>
                <div className="mt-4 grid gap-2 text-sm text-text-secondary">
                  <div>Total load: <span className="font-bold text-text">{formatMetric(activePlanSummary.totalAcademicLoad, "h")}</span></div>
                  <div>Credits: <span className="font-bold text-text">{activePlanSummary.totalCredits}</span></div>
                  <div>Warnings: <span className="font-bold text-text">{activePlanSummary.warnings.length}</span></div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {planCourses.length > 0 ? planCourses.map((course) => (
                  <span key={course.courseCode} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-secondary">
                    {course.code}
                  </span>
                )) : <div className="text-sm text-text-secondary">Add courses to the active plan to make progress checks more useful.</div>}
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <SectionHeader icon={<AlertTriangle size={15} />} title="Suggested alerts" description="Auto-generated signals from the current plan and milestones." />
              <div className="mt-4 space-y-3">
                {alertSuggestions.length > 0 ? alertSuggestions.map((alert) => (
                  <div key={`${alert.title}-${alert.message}`} className="rounded-2xl border border-border bg-surface p-3">
                    <div className="text-sm font-black text-text">{alert.title}</div>
                    <div className="mt-1 text-sm text-text-secondary">{alert.message}</div>
                    <button
                      type="button"
                      onClick={() => addAlert({ title: alert.title, message: alert.message, severity: alert.severity })}
                      className="mt-3 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text"
                    >
                      Save alert
                    </button>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">No suggestions right now.</div>}
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader icon={<CalendarDays size={15} />} title="Milestones" description="Track the checkpoints that matter this term." />
                <button type="button" onClick={() => addMilestone()} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-text">
                  Add milestone
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {milestones.map((milestone) => (
                  <MilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    onUpdate={(patch) => updateMilestone(milestone.id, patch)}
                    onRemove={() => removeMilestone(milestone.id)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader icon={<AlertTriangle size={15} />} title="Saved alerts" description="Local alerts you can edit, dismiss, or remove." />
                <button type="button" onClick={() => addAlert()} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-text">
                  Add alert
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onUpdate={(patch) => updateAlert(alert.id, patch)}
                    onRemove={() => removeAlert(alert.id)}
                  />
                ))}
                {alerts.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">No saved alerts yet.</div>}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function RequirementGroupCard({
  group,
  planCourses,
  onUpdate,
  onRemove,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: {
  group: ProgressRequirementGroup;
  planCourses: Array<{ courseCode: string; code: string }>;
  onUpdate: (patch: Partial<Omit<ProgressRequirementGroup, "id" | "items">>) => void;
  onRemove: () => void;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, patch: Partial<Omit<ProgressRequirementItem, "id">>) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const completed = group.items.filter((item) => item.status === "done").length;

  return (
    <div className="rounded-[24px] border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input value={group.title} onChange={(event) => onUpdate({ title: event.target.value })} className="w-full bg-transparent text-lg font-black tracking-tight text-text outline-none" />
          <textarea
            value={group.description}
            onChange={(event) => onUpdate({ description: event.target.value })}
            rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary outline-none focus:border-primary"
          />
        </div>
        <button type="button" onClick={onRemove} className="rounded-xl border border-border bg-white p-2 text-text-secondary">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-text-secondary">
        <span className="rounded-full border border-border bg-white px-2.5 py-1">{completed} complete</span>
        <span className="rounded-full border border-border bg-white px-2.5 py-1">{group.items.length} items</span>
        <span className="rounded-full border border-border bg-white px-2.5 py-1">Target {group.requiredCount}</span>
        <label className="flex items-center gap-2 rounded-full border border-border bg-white px-2.5 py-1">
          Required
          <input type="number" min="0" value={group.requiredCount} onChange={(event) => onUpdate({ requiredCount: Number(event.target.value || 0) })} className="w-14 bg-transparent text-right outline-none" />
        </label>
        <button type="button" onClick={onAddItem} className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-bold text-text">
          Add item
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-border bg-white p-3">
            <div className="grid gap-3 md:grid-cols-[1.1fr,0.9fr]">
              <Field label="Label">
                <input
                  value={item.label}
                  onChange={(event) => onUpdateItem(item.id, { label: event.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>
              <Field label="Linked course">
                <select
                  value={item.courseCode}
                  onChange={(event) => onUpdateItem(item.id, { courseCode: event.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">No link</option>
                  {planCourses.map((course) => (
                    <option key={course.courseCode} value={course.courseCode}>
                      {course.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr,1fr]">
              <Field label="Status">
                <select value={item.status} onChange={(event) => onUpdateItem(item.id, { status: event.target.value as ProgressRequirementItem["status"] })} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </Field>
              <Field label="Notes">
                <input
                  value={item.notes}
                  onChange={(event) => onUpdateItem(item.id, { notes: event.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">{item.courseCode ? `Linked to ${item.courseCode}` : "Not linked to a course yet"}</span>
              <button type="button" onClick={() => onRemoveItem(item.id)} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-secondary">
                Remove item
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneCard({ milestone, onUpdate, onRemove }: { milestone: ProgressMilestone; onUpdate: (patch: Partial<Omit<ProgressMilestone, "id">>) => void; onRemove: () => void; }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input value={milestone.title} onChange={(event) => onUpdate({ title: event.target.value })} className="w-full bg-transparent text-sm font-black tracking-tight text-text outline-none" />
          <textarea value={milestone.notes} onChange={(event) => onUpdate({ notes: event.target.value })} rows={2} className="mt-2 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary outline-none focus:border-primary" />
        </div>
        <button type="button" onClick={onRemove} className="rounded-xl border border-border bg-white p-2 text-text-secondary">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label="Target term">
          <input value={milestone.targetTerm} onChange={(event) => onUpdate({ targetTerm: event.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
        </Field>
        <Field label="Status">
          <select value={milestone.status} onChange={(event) => onUpdate({ status: event.target.value as ProgressMilestone["status"] })} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="done">Done</option>
          </select>
        </Field>
        <Field label="Priority">
          <select value={milestone.priority} onChange={(event) => onUpdate({ priority: event.target.value as ProgressMilestone["priority"] })} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function AlertCard({ alert, onUpdate, onRemove }: { alert: ProgressAlert; onUpdate: (patch: Partial<Omit<ProgressAlert, "id">>) => void; onRemove: () => void; }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input value={alert.title} onChange={(event) => onUpdate({ title: event.target.value })} className="w-full bg-transparent text-sm font-black tracking-tight text-text outline-none" />
          <textarea value={alert.message} onChange={(event) => onUpdate({ message: event.target.value })} rows={2} className="mt-2 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-secondary outline-none focus:border-primary" />
        </div>
        <button type="button" onClick={onRemove} className="rounded-xl border border-border bg-white p-2 text-text-secondary">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Severity">
          <select value={alert.severity} onChange={(event) => onUpdate({ severity: event.target.value as ProgressAlert["severity"] })} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </select>
        </Field>
        <Field label="Notes">
          <input value={alert.notes} onChange={(event) => onUpdate({ notes: event.target.value })} className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
        </Field>
      </div>
    </div>
  );
}

function StatCard({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">{icon}{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-text">{value}</div>
      <div className="mt-1 text-sm text-text-secondary">{note}</div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">
      {icon}
      <div>
        <div>{title}</div>
        <div className="mt-1 text-sm font-normal normal-case tracking-normal text-text-secondary">{description}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
      {children}
    </label>
  );
}
