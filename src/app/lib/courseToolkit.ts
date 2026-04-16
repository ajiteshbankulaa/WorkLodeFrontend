import type { CatalogCourse } from "./catalog";

const SHORTLIST_KEY = "worklode_shortlist_v1";
const COMPARE_KEY = "worklode_compare_v1";

export type ShortlistEntry = {
  courseCode: string;
  code: string;
  name: string;
  dept: string;
  avgHours: number | null;
  stdDev: number | null;
};

export type CompareSelection = {
  courseCode: string;
  code: string;
  name: string;
  avgHours: number | null;
  stdDev: number | null;
  responses: number | null;
};

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadShortlist() {
  return readList<ShortlistEntry>(SHORTLIST_KEY);
}

export function saveShortlist(value: ShortlistEntry[]) {
  writeList(SHORTLIST_KEY, value);
}

export function loadCompareSelection() {
  return readList<CompareSelection>(COMPARE_KEY);
}

export function saveCompareSelection(value: CompareSelection[]) {
  writeList(COMPARE_KEY, value.slice(0, 3));
}

export function toShortlistEntry(course: CatalogCourse): ShortlistEntry {
  return {
    courseCode: course.courseCode || course.id,
    code: course.code,
    name: course.name,
    dept: course.dept,
    avgHours: course.avgHours,
    stdDev: course.stdDev,
  };
}

export function toCompareSelection(course: CatalogCourse): CompareSelection {
  return {
    courseCode: course.courseCode || course.id,
    code: course.code,
    name: course.name,
    avgHours: course.avgHours,
    stdDev: course.stdDev,
    responses: course.responses,
  };
}
