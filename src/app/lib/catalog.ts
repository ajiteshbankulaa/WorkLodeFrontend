export type TrustTier = "high" | "medium" | "limited" | "synthetic" | "manual" | "unavailable";

export type CourseMeeting = {
  days: string[];
  timeStart: number;
  timeEnd: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  location?: string;
  instructor?: string;
};

export type CatalogCourse = {
  id: string;
  courseCode: string;
  code: string;
  name: string;
  dept: string;
  courseNumber: number | null;
  level: string;
  credits: number | null;
  avgHours: number | null;
  stdDev: number | null;
  responses: number | null;
  statsSource: string;
  trustTier: TrustTier;
  trustLabel: string;
  meetsMinResponses: boolean;
  latestTerm: string;
  termsOffered: string[];
  attributes: string[];
  professor?: string;
  section?: string;
  crn?: string;
  meetings?: CourseMeeting[];
  matchedBy?: string;
  matchConfidence?: number;
};

export type ExploreResponse = {
  termsUsed: string[];
  count: number;
  total: number;
  offset: number;
  limit: number;
  availableFilters: {
    departments: string[];
    levels: string[];
    attributes: string[];
    terms: string[];
  };
  data: CatalogCourse[];
};

export type CourseDetailResponse = CatalogCourse & {
  description?: string;
  responseSummary?: string;
  departmentAverageHours?: number | null;
  departmentDeltaHours?: number | null;
  publishedAt?: string | null;
};
