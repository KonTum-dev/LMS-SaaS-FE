import { apiFetch } from "@/lib/api";
import type {
  CourseCurriculum,
  CreateCurriculumLessonResult,
  CreateCurriculumSectionResult,
  CurriculumLessonResource,
  CurriculumSectionResource,
  CourseProgressSummary,
  LearnerProgressRow,
  LessonDetail,
  LessonProgress,
  LessonType,
  Paginated,
} from "@/lib/types";

export interface CurriculumApiContext {
  token: string;
}

export interface CurriculumListQuery {
  includeArchived?: boolean;
}

export interface LearnerProgressQuery {
  limit?: number;
  page?: number;
  search?: string;
}

export interface SetLessonProgressInput {
  completed: boolean;
  expectedRevision: number;
}

export interface CreateSectionInput {
  clientMutationId: string;
  description?: string;
  expectedCurriculumRevision: number;
  title: string;
}

export interface CreateLessonInput {
  clientMutationId: string;
  estimatedMinutes?: number;
  expectedCurriculumRevision: number;
  required?: boolean;
  sourceUrl?: string;
  summary?: string;
  textContent?: string;
  title: string;
  type: LessonType;
}

export interface ResourceTransitionInput {
  expectedRevision: number;
}

export interface ReplaceLessonAttachmentsInput extends ResourceTransitionInput {
  attachmentIds: string[];
}

export interface UpdateSectionInput extends ResourceTransitionInput {
  description?: string;
  title?: string;
}

export interface UpdateLessonInput extends ResourceTransitionInput {
  estimatedMinutes?: number | null;
  required?: boolean;
  sourceUrl?: string;
  summary?: string;
  textContent?: string;
  title?: string;
  type?: LessonType;
}

export function createCurriculumMutationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildCurriculumQuery(values: object = {}): string {
  const params = new URLSearchParams();
  const record = values as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(values).sort()) {
    const raw = record[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) params.set(key, value);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      params.set(key, String(raw));
    } else if (typeof raw === "boolean") {
      params.set(key, String(raw));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

const coursePath = (courseId: string) =>
  `/courses/${encodeURIComponent(courseId)}`;
const curriculumPath = (courseId: string) =>
  `${coursePath(courseId)}/curriculum`;
const sectionPath = (courseId: string, sectionId: string) =>
  `${curriculumPath(courseId)}/sections/${encodeURIComponent(sectionId)}`;
const lessonPath = (courseId: string, lessonId: string) =>
  `${coursePath(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
export const curriculumApi = {
  getCurriculum: (
    { token }: CurriculumApiContext,
    courseId: string,
    query: CurriculumListQuery = {},
  ) =>
    apiFetch<CourseCurriculum>(
      `${curriculumPath(courseId)}${buildCurriculumQuery(query)}`,
      { token },
    ),
  getLesson: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
  ) => apiFetch<LessonDetail>(lessonPath(courseId, lessonId), { token }),
  getMyProgress: ({ token }: CurriculumApiContext, courseId: string) =>
    apiFetch<CourseProgressSummary>(`${coursePath(courseId)}/my-progress`, {
      token,
    }),
  setLessonProgress: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
    input: SetLessonProgressInput,
  ) =>
    apiFetch<LessonProgress>(`${lessonPath(courseId, lessonId)}/my-progress`, {
      body: JSON.stringify(input),
      method: "PUT",
      token,
    }),
  getLearnerProgress: (
    { token }: CurriculumApiContext,
    courseId: string,
    query: LearnerProgressQuery = {},
  ) =>
    apiFetch<Paginated<LearnerProgressRow>>(
      `${coursePath(courseId)}/learner-progress${buildCurriculumQuery(query)}`,
      { token },
    ),
  createSection: (
    { token }: CurriculumApiContext,
    courseId: string,
    input: CreateSectionInput,
  ) =>
    apiFetch<CreateCurriculumSectionResult>(
      `${curriculumPath(courseId)}/sections`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
  createLesson: (
    { token }: CurriculumApiContext,
    courseId: string,
    sectionId: string,
    input: CreateLessonInput,
  ) =>
    apiFetch<CreateCurriculumLessonResult>(
      `${sectionPath(courseId, sectionId)}/lessons`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
  updateSection: (
    { token }: CurriculumApiContext,
    courseId: string,
    sectionId: string,
    input: UpdateSectionInput,
  ) =>
    apiFetch<CurriculumSectionResource>(sectionPath(courseId, sectionId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  publishSection: (
    { token }: CurriculumApiContext,
    courseId: string,
    sectionId: string,
    input: ResourceTransitionInput,
  ) =>
    apiFetch<CurriculumSectionResource>(
      `${sectionPath(courseId, sectionId)}/publish`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
  archiveSection: (
    { token }: CurriculumApiContext,
    courseId: string,
    sectionId: string,
    input: ResourceTransitionInput,
  ) =>
    apiFetch<CurriculumSectionResource>(
      `${sectionPath(courseId, sectionId)}/archive`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
  updateLesson: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
    input: UpdateLessonInput,
  ) =>
    apiFetch<CurriculumLessonResource>(lessonPath(courseId, lessonId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  replaceLessonAttachments: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
    input: ReplaceLessonAttachmentsInput,
  ) =>
    apiFetch<LessonDetail>(`${lessonPath(courseId, lessonId)}/attachments`, {
      body: JSON.stringify(input),
      method: "PUT",
      token,
    }),
  publishLesson: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
    input: ResourceTransitionInput,
  ) =>
    apiFetch<CurriculumLessonResource>(
      `${lessonPath(courseId, lessonId)}/publish`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
  archiveLesson: (
    { token }: CurriculumApiContext,
    courseId: string,
    lessonId: string,
    input: ResourceTransitionInput,
  ) =>
    apiFetch<CurriculumLessonResource>(
      `${lessonPath(courseId, lessonId)}/archive`,
      {
        body: JSON.stringify(input),
        method: "POST",
        token,
      },
    ),
};
