import type { CatalogCourse, CourseMeeting } from "./catalog";

export type PlannerCourseItem = {
  type: "course";
  plannerItemId: string;
  source: "manual" | "ics";
  course: CatalogCourse;
  meetings: CourseMeeting[];
  crn?: string;
  section?: string;
};

export type PlannerCustomEvent = {
  type: "custom_event";
  plannerItemId: string;
  source: "manual" | "ics";
  title: string;
  description?: string;
  category?: string;
  meetings: CourseMeeting[];
};

export type PlannerItem = PlannerCourseItem | PlannerCustomEvent;

export type SavedPlan = {
  id: string;
  name: string;
  termCode: string;
  items: PlannerItem[];
  updatedAt: string;
  active?: boolean;
  notes?: string;
  summary?: {
    credits?: number;
    inClassHours?: number;
    outsideHours?: number;
    totalAcademicLoad?: number;
    riskWarnings?: string[];
  };
};

export type PlannerTotals = {
  totalCredits: number;
  totalOutsideHours: number;
  totalInClassHours: number;
  totalAcademicLoad: number;
};

export type PlannerConflict = {
  day: string;
  firstLabel: string;
  secondLabel: string;
  overlapMinutes: number;
};

export type PlannerCompressedDay = {
  day: string;
  totalMeetingHours: number;
  meetingCount: number;
  firstStart: number;
  lastEnd: number;
};

export type PlannerDiagnostics = PlannerTotals & {
  warnings: string[];
  conflicts: PlannerConflict[];
  compressedDays: PlannerCompressedDay[];
  scenarioScore: number;
  checkpointLabel: "Balanced" | "Heavy but manageable" | "High risk";
};

export type ScenarioComparison = {
  leftPlanId: string;
  rightPlanId: string;
  creditsDelta: number;
  outsideHoursDelta: number;
  totalLoadDelta: number;
  meetingsDelta: number;
  warningDelta: number;
  scoreDelta: number;
};

function hhmmToMinutes(value: number) {
  if (value < 0) return -1;
  return Math.floor(value / 100) * 60 + (value % 100);
}

export function getMeetingHours(meeting: CourseMeeting) {
  if (meeting.timeStart < 0 || meeting.timeEnd < 0 || meeting.days.length === 0) {
    return 0;
  }

  const startMinutes = Math.floor(meeting.timeStart / 100) * 60 + (meeting.timeStart % 100);
  const endMinutes = Math.floor(meeting.timeEnd / 100) * 60 + (meeting.timeEnd % 100);
  const duration = endMinutes - startMinutes;
  return (Math.max(duration, 0) / 60) * meeting.days.length;
}

function itemLabel(item: PlannerItem) {
  return item.type === "course" ? item.course.code : item.title;
}

export function getPlannerTotals(items: PlannerItem[]): PlannerTotals {
  const courseItems = items.filter((item): item is PlannerCourseItem => item.type === "course");
  const totalCredits = courseItems.reduce((sum, item) => sum + (item.course.credits ?? 0), 0);
  const totalOutsideHours = courseItems.reduce((sum, item) => sum + (item.course.avgHours ?? 0), 0);
  const totalInClassHours = items.reduce(
    (sum, item) => sum + item.meetings.reduce((meetingSum, meeting) => meetingSum + getMeetingHours(meeting), 0),
    0
  );

  return {
    totalCredits,
    totalOutsideHours,
    totalInClassHours,
    totalAcademicLoad: totalOutsideHours + totalInClassHours,
  };
}

export function getPlannerWarnings(items: PlannerItem[]) {
  const courseItems = items.filter((item): item is PlannerCourseItem => item.type === "course");
  const totals = getPlannerTotals(items);
  const warnings: string[] = [];
  const heavyCourses = courseItems.filter((item) => (item.course.avgHours ?? 0) >= 15);
  const highVarianceCourses = courseItems.filter((item) => (item.course.stdDev ?? 0) >= 4);

  if (totals.totalAcademicLoad >= 55) {
    warnings.push("Total weekly academic load is very high. Consider a lighter variant.");
  }

  if (heavyCourses.length >= 2) {
    warnings.push("You are stacking multiple heavy courses in the same plan.");
  }

  if (highVarianceCourses.length >= 2) {
    warnings.push("Several courses have high variability, so plan extra buffer time.");
  }

  return warnings;
}

export function getPlannerConflicts(items: PlannerItem[]) {
  const conflicts: PlannerConflict[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    const current = items[index];
    for (let compareIndex = index + 1; compareIndex < items.length; compareIndex += 1) {
      const compare = items[compareIndex];
      for (const leftMeeting of current.meetings) {
        for (const rightMeeting of compare.meetings) {
          const sharedDays = leftMeeting.days.filter((day) => rightMeeting.days.includes(day));
          if (!sharedDays.length) continue;
          const leftStart = hhmmToMinutes(leftMeeting.timeStart);
          const leftEnd = hhmmToMinutes(leftMeeting.timeEnd);
          const rightStart = hhmmToMinutes(rightMeeting.timeStart);
          const rightEnd = hhmmToMinutes(rightMeeting.timeEnd);
          if (leftStart < 0 || leftEnd < 0 || rightStart < 0 || rightEnd < 0) continue;
          const overlap = Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart);
          if (overlap <= 0) continue;
          for (const day of sharedDays) {
            const key = `${day}:${itemLabel(current)}:${itemLabel(compare)}:${overlap}`;
            if (seen.has(key)) continue;
            seen.add(key);
            conflicts.push({
              day,
              firstLabel: itemLabel(current),
              secondLabel: itemLabel(compare),
              overlapMinutes: overlap,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

export function getCompressedDays(items: PlannerItem[]) {
  const dayBuckets: Record<string, Array<{ start: number; end: number }>> = { M: [], T: [], W: [], R: [], F: [], S: [], U: [] };

  for (const item of items) {
    for (const meeting of item.meetings) {
      const start = hhmmToMinutes(meeting.timeStart);
      const end = hhmmToMinutes(meeting.timeEnd);
      if (start < 0 || end < 0 || end <= start) continue;
      for (const day of meeting.days) {
        if (dayBuckets[day]) dayBuckets[day].push({ start, end });
      }
    }
  }

  return Object.entries(dayBuckets)
    .map(([day, entries]) => {
      if (!entries.length) return null;
      const sorted = [...entries].sort((left, right) => left.start - right.start);
      const totalMinutes = sorted.reduce((sum, entry) => sum + (entry.end - entry.start), 0);
      const firstStart = sorted[0].start;
      const lastEnd = sorted[sorted.length - 1].end;
      return {
        day,
        totalMeetingHours: Number((totalMinutes / 60).toFixed(1)),
        meetingCount: sorted.length,
        firstStart,
        lastEnd,
      };
    })
    .filter((entry): entry is PlannerCompressedDay => Boolean(entry))
    .filter((entry) => entry.meetingCount >= 3 || entry.totalMeetingHours >= 5 || entry.lastEnd - entry.firstStart >= 8 * 60);
}

export function getScenarioScore(items: PlannerItem[]) {
  const totals = getPlannerTotals(items);
  const warnings = getPlannerWarnings(items);
  const conflicts = getPlannerConflicts(items);
  const compressedDays = getCompressedDays(items);
  const penalty = warnings.length * 12 + conflicts.length * 18 + compressedDays.length * 6 + Math.max(0, totals.totalAcademicLoad - 36) * 0.9;
  return Math.max(8, Math.min(100, Math.round(100 - penalty)));
}

export function getCheckpointLabel(items: PlannerItem[]) {
  const conflicts = getPlannerConflicts(items);
  const score = getScenarioScore(items);
  if (conflicts.length > 0 || score < 56) return "High risk";
  if (score < 78) return "Heavy but manageable";
  return "Balanced";
}

export function getPlannerDiagnostics(items: PlannerItem[]): PlannerDiagnostics {
  const totals = getPlannerTotals(items);
  const warnings = getPlannerWarnings(items);
  const conflicts = getPlannerConflicts(items);
  const compressedDays = getCompressedDays(items);
  const scenarioScore = getScenarioScore(items);
  return {
    ...totals,
    warnings,
    conflicts,
    compressedDays,
    scenarioScore,
    checkpointLabel: getCheckpointLabel(items),
  };
}

export function comparePlans(leftPlan: SavedPlan | null | undefined, rightPlan: SavedPlan | null | undefined): ScenarioComparison | null {
  if (!leftPlan || !rightPlan) return null;
  const left = getPlannerDiagnostics(leftPlan.items);
  const right = getPlannerDiagnostics(rightPlan.items);
  return {
    leftPlanId: leftPlan.id,
    rightPlanId: rightPlan.id,
    creditsDelta: Number((left.totalCredits - right.totalCredits).toFixed(1)),
    outsideHoursDelta: Number((left.totalOutsideHours - right.totalOutsideHours).toFixed(1)),
    totalLoadDelta: Number((left.totalAcademicLoad - right.totalAcademicLoad).toFixed(1)),
    meetingsDelta: leftPlan.items.reduce((sum, item) => sum + item.meetings.length, 0) - rightPlan.items.reduce((sum, item) => sum + item.meetings.length, 0),
    warningDelta: left.warnings.length - right.warnings.length,
    scoreDelta: left.scenarioScore - right.scenarioScore,
  };
}
