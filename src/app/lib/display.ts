type SubjectTone = {
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  accentGlow: string;
};

const SUBJECT_BASES: Record<string, string> = {
  ADMN: "#c97316",
  CSCI: "#2f6fed",
  ECSE: "#1f8f74",
  ENGR: "#6f55e5",
  ITWS: "#5567e8",
  MATH: "#b54acc",
};

const SUBJECT_FALLBACKS = [
  "#2f6fed",
  "#1f8f74",
  "#c97316",
  "#b54acc",
  "#0f9bb7",
  "#6f55e5",
  "#8ba61c",
  "#cc5a43",
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((part) => part + part)
        .join("")
    : normalized;

  const int = Number.parseInt(value, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getSubjectTone(dept: string): SubjectTone {
  const key = dept.trim().toUpperCase();
  const seededBase =
    SUBJECT_BASES[key] ??
    SUBJECT_FALLBACKS[
      key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % SUBJECT_FALLBACKS.length
    ];

  return {
    accent: seededBase,
    accentSoft: rgba(seededBase, 0.08),
    accentBorder: rgba(seededBase, 0.22),
    accentText: seededBase,
    accentGlow: rgba(seededBase, 0.14),
  };
}

export function formatTermLabel(termCode: string) {
  if (!termCode) return "Latest term";
  if (!/^\d{6}$/.test(termCode)) return termCode;

  const year = termCode.slice(0, 4);
  const monthCode = Number.parseInt(termCode.slice(4), 10);

  if (Number.isNaN(monthCode)) {
    return termCode;
  }

  const season =
    monthCode <= 4 ? "Spring" : monthCode <= 8 ? "Summer" : "Fall";

  return `${season} ${year}`;
}

export function formatCourseSignal(trustTier: string, trustLabel: string) {
  if (trustTier === "synthetic") return "Estimated workload signal";
  if (trustTier === "manual") return "Manual workload signal";
  return trustLabel;
}

export function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  if (valid.length === 0) return null;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1));
}

export function formatMetric(value: number | null, suffix = "") {
  return value === null || Number.isNaN(value) ? "N/A" : `${value}${suffix}`;
}

export function getBarWidth(value: number | null, max: number) {
  if (value === null || value <= 0) return 6;
  return Math.max(6, Math.min(100, (value / max) * 100));
}

export const formatAcademicTerm = formatTermLabel;
export const getSubjectTheme = getSubjectTone;
