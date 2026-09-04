import { ApiError } from "@/lib/api";
import type {
  AssignmentSubmissionMode,
  CourseReport,
  GradingHistoryEntry,
  GradingSubmissionDetail,
  GradingSubmissionRow,
  GradingSubmissionStatus,
  LearnerSubmission,
  MyResult,
  Paginated,
  SubmissionStatus,
} from "@/lib/types";

const SUBMISSION_MODES = new Set<AssignmentSubmissionMode>([
  "TEXT",
  "HTTPS_LINK",
  "FILES",
]);
const SUBMISSION_STATUSES = new Set<SubmissionStatus>([
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "GRADED",
]);
const GRADING_STATUSES = new Set<GradingSubmissionStatus>([
  "SUBMITTED",
  "RETURNED",
  "GRADED",
]);
const HISTORY_ACTIONS = new Set<GradingHistoryEntry["action"]>([
  "SUBMIT",
  "RETURN",
  "GRADE",
]);
const MAX_ATTACHMENT_IDS = 5;
const MAX_CONTENT_LENGTH = 51_200;
const MAX_HISTORY_ENTRIES = 100;
const MAX_LINK_LENGTH = 2_048;
const MAX_TEXT_BYTES = 50 * 1_024;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/iu;

function invalidSubmissionResponse(): never {
  throw new ApiError(
    "Máy chủ trả dữ liệu bài nộp không hợp lệ",
    502,
    "SUBMISSION_RESPONSE_INVALID",
  );
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidSubmissionResponse();
  }
  return value as Record<string, unknown>;
}

function boundedString(
  value: unknown,
  maximumLength: number,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
) {
  if (
    typeof value !== "string" ||
    value.length > maximumLength ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    (!allowEmpty && !value.trim())
  ) {
    invalidSubmissionResponse();
  }
  return value;
}

function nullableText(value: unknown, maximumLength: number) {
  if (
    value !== null &&
    (typeof value !== "string" || value.length > maximumLength)
  ) {
    invalidSubmissionResponse();
  }
  return value as string | null;
}

function nullableFeedback(value: unknown) {
  const feedback = nullableText(value, 4_000);
  if (feedback !== null && (!feedback || feedback.trim() !== feedback)) {
    invalidSubmissionResponse();
  }
  return feedback;
}

function identifier(value: unknown) {
  return boundedString(value, 256);
}

function dateString(value: unknown) {
  const parsed = boundedString(value, 64);
  if (!Number.isFinite(Date.parse(parsed))) invalidSubmissionResponse();
  return parsed;
}

function nullableDateString(value: unknown) {
  return value === null ? null : dateString(value);
}

function safeInteger(value: unknown, minimum = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum) {
    invalidSubmissionResponse();
  }
  return value as number;
}

function finiteNumber(value: unknown, minimum = 0, maximum = Infinity) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    invalidSubmissionResponse();
  }
  return value;
}

function nullableNumber(value: unknown, minimum = 0, maximum = Infinity) {
  return value === null ? null : finiteNumber(value, minimum, maximum);
}

function booleanValue(value: unknown) {
  if (typeof value !== "boolean") invalidSubmissionResponse();
  return value;
}

function submissionMode(value: unknown): AssignmentSubmissionMode {
  if (
    typeof value !== "string" ||
    !SUBMISSION_MODES.has(value as AssignmentSubmissionMode)
  ) {
    invalidSubmissionResponse();
  }
  return value as AssignmentSubmissionMode;
}

function submissionStatus(value: unknown): SubmissionStatus {
  if (
    typeof value !== "string" ||
    !SUBMISSION_STATUSES.has(value as SubmissionStatus)
  ) {
    invalidSubmissionResponse();
  }
  return value as SubmissionStatus;
}

function gradingStatus(value: unknown): GradingSubmissionStatus {
  if (
    typeof value !== "string" ||
    !GRADING_STATUSES.has(value as GradingSubmissionStatus)
  ) {
    invalidSubmissionResponse();
  }
  return value as GradingSubmissionStatus;
}

function attachmentIds(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENT_IDS) {
    invalidSubmissionResponse();
  }
  const ids = value.map(identifier);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !OBJECT_ID_PATTERN.test(id))
  ) {
    invalidSubmissionResponse();
  }
  return ids;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function assertSubmittedContent(
  mode: Exclude<AssignmentSubmissionMode, "FILES">,
  content: string | null,
) {
  if (content === null || !content || content.trim() !== content) {
    invalidSubmissionResponse();
  }
  if (mode === "TEXT") {
    if (byteLength(content) > MAX_TEXT_BYTES) invalidSubmissionResponse();
    return;
  }
  if (content.length > MAX_LINK_LENGTH) invalidSubmissionResponse();
  let parsed: URL;
  try {
    parsed = new URL(content);
  } catch {
    invalidSubmissionResponse();
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.toString() !== content
  ) {
    invalidSubmissionResponse();
  }
}

function assertSubmittedPayload(
  mode: AssignmentSubmissionMode,
  submittedContent: string | null,
  submittedIds: string[],
) {
  if (mode === "FILES") {
    if (submittedContent !== null || submittedIds.length < 1) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (submittedIds.length) invalidSubmissionResponse();
  assertSubmittedContent(mode, submittedContent);
}

function assertModePayload(
  mode: AssignmentSubmissionMode,
  draftContent: string | null,
  draftAttachmentIds: string[],
  submittedContent: string | null,
  submittedAttachmentIds: string[],
) {
  if (mode === "FILES") {
    if (draftContent !== null || submittedContent !== null) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (draftAttachmentIds.length || submittedAttachmentIds.length) {
    invalidSubmissionResponse();
  }
}

function assertLearnerSubmissionLifecycle(submission: LearnerSubmission): void {
  const {
    attemptCount,
    dueAt,
    firstSubmittedAt,
    gradedAt,
    gradingFeedback,
    returnFeedback,
    returnedAt,
    score,
    status,
    submissionMode,
    submittedAttachmentIds,
    submittedAt,
    submittedContent,
    wasLate,
  } = submission;
  if (status === "DRAFT") {
    if (
      attemptCount !== 0 ||
      firstSubmittedAt !== null ||
      gradedAt !== null ||
      gradingFeedback !== null ||
      returnFeedback !== null ||
      returnedAt !== null ||
      score !== null ||
      submittedAt !== null ||
      submittedAttachmentIds.length > 0 ||
      submittedContent !== null ||
      wasLate
    ) {
      invalidSubmissionResponse();
    }
    return;
  }

  if (attemptCount < 1 || firstSubmittedAt === null || submittedAt === null) {
    invalidSubmissionResponse();
  }
  assertSubmittedPayload(
    submissionMode,
    submittedContent,
    submittedAttachmentIds,
  );
  const expectedLate =
    dueAt !== null && Date.parse(submittedAt) > Date.parse(dueAt);
  if (wasLate !== expectedLate) invalidSubmissionResponse();

  if (status === "SUBMITTED") {
    if (
      gradedAt !== null ||
      gradingFeedback !== null ||
      returnFeedback !== null ||
      returnedAt !== null ||
      score !== null
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (status === "RETURNED") {
    if (
      gradedAt !== null ||
      gradingFeedback !== null ||
      returnFeedback === null ||
      returnedAt === null ||
      score !== null
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (
    gradedAt === null ||
    gradingFeedback === null ||
    score === null ||
    (returnFeedback === null) !== (returnedAt === null)
  ) {
    invalidSubmissionResponse();
  }
}

export function parseLearnerSubmission(value: unknown): LearnerSubmission {
  const source = record(value);
  const mode = submissionMode(source.submissionMode);
  const maxPoints = safeInteger(source.maxPoints, 1);
  if (maxPoints > 10_000) invalidSubmissionResponse();
  const draftContent = nullableText(source.draftContent, MAX_CONTENT_LENGTH);
  const draftIds = attachmentIds(source.draftAttachmentIds);
  const submittedContent = nullableText(
    source.submittedContent,
    MAX_CONTENT_LENGTH,
  );
  const submittedIds = attachmentIds(source.submittedAttachmentIds);
  assertModePayload(
    mode,
    draftContent,
    draftIds,
    submittedContent,
    submittedIds,
  );
  const submission: LearnerSubmission = {
    _id: identifier(source._id),
    assignmentId: identifier(source.assignmentId),
    attemptCount: safeInteger(source.attemptCount),
    draftAttachmentIds: draftIds,
    draftContent,
    draftUpdatedAt: dateString(source.draftUpdatedAt),
    dueAt: nullableDateString(source.dueAt),
    firstSubmittedAt: nullableDateString(source.firstSubmittedAt),
    gradedAt: nullableDateString(source.gradedAt),
    gradingFeedback: nullableFeedback(source.gradingFeedback),
    maxPoints,
    returnFeedback: nullableFeedback(source.returnFeedback),
    returnedAt: nullableDateString(source.returnedAt),
    revision: safeInteger(source.revision, 1),
    score: nullableNumber(source.score, 0, maxPoints),
    status: submissionStatus(source.status),
    submissionMode: mode,
    submittedAttachmentIds: submittedIds,
    submittedAt: nullableDateString(source.submittedAt),
    submittedContent,
    wasLate: booleanValue(source.wasLate),
  };
  assertLearnerSubmissionLifecycle(submission);
  return submission;
}

export function parseOptionalLearnerSubmission(
  value: unknown,
): LearnerSubmission | null {
  return value === null ? null : parseLearnerSubmission(value);
}

function submissionPercentage(score: number, maxPoints: number) {
  return Math.round((score / maxPoints) * 10_000) / 100;
}

function assertMyResultLifecycle(result: MyResult): void {
  const {
    attemptCount,
    result: grade,
    returnFeedback,
    state,
    submissionId,
    submissionMode,
    submittedAttachmentIds,
    submittedAt,
    wasLate,
  } = result;
  if (state === "NOT_STARTED") {
    if (
      attemptCount !== 0 ||
      grade !== null ||
      returnFeedback !== null ||
      submissionId !== null ||
      submittedAttachmentIds.length > 0 ||
      submittedAt !== null ||
      wasLate
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (submissionId === null) invalidSubmissionResponse();
  if (state === "DRAFT") {
    if (
      attemptCount !== 0 ||
      grade !== null ||
      returnFeedback !== null ||
      submittedAttachmentIds.length > 0 ||
      submittedAt !== null ||
      wasLate
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (attemptCount < 1 || submittedAt === null) {
    invalidSubmissionResponse();
  }
  if (submissionMode === "FILES" && submittedAttachmentIds.length < 1) {
    invalidSubmissionResponse();
  }
  if (state === "SUBMITTED") {
    if (grade !== null || returnFeedback !== null) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (state === "RETURNED") {
    if (grade !== null || returnFeedback === null) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (grade === null) invalidSubmissionResponse();
}

export function parseMyResult(value: unknown): MyResult {
  const source = record(value);
  const mode = submissionMode(source.submissionMode);
  const state =
    source.state === "NOT_STARTED"
      ? "NOT_STARTED"
      : submissionStatus(source.state);
  const submittedIds = attachmentIds(source.submittedAttachmentIds);
  if (mode !== "FILES" && submittedIds.length) invalidSubmissionResponse();
  const resultSource = source.result === null ? null : record(source.result);
  const result = resultSource
    ? (() => {
        const maxPoints = safeInteger(resultSource.maxPoints, 1);
        if (maxPoints > 10_000) invalidSubmissionResponse();
        const score = finiteNumber(resultSource.score, 0, maxPoints);
        const percentage = finiteNumber(resultSource.percentage, 0, 100);
        const feedback = nullableFeedback(resultSource.feedback);
        if (
          feedback === null ||
          percentage !== submissionPercentage(score, maxPoints)
        ) {
          invalidSubmissionResponse();
        }
        return {
          feedback,
          gradedAt: dateString(resultSource.gradedAt),
          maxPoints,
          percentage,
          score,
        };
      })()
    : null;
  const parsed: MyResult = {
    attemptCount: safeInteger(source.attemptCount),
    result,
    returnFeedback: nullableFeedback(source.returnFeedback),
    state,
    submissionId:
      source.submissionId === null ? null : identifier(source.submissionId),
    submissionMode: mode,
    submittedAttachmentIds: submittedIds,
    submittedAt: nullableDateString(source.submittedAt),
    wasLate: booleanValue(source.wasLate),
  };
  assertMyResultLifecycle(parsed);
  return parsed;
}

function parseSummary(value: unknown, includeEmail = false) {
  const source = record(value);
  return {
    _id: identifier(source._id),
    ...(includeEmail ? { email: boundedString(source.email, 320) } : {}),
    ...(includeEmail
      ? { fullName: boundedString(source.fullName, 300) }
      : { title: boundedString(source.title, 500) }),
  };
}

export function parseGradingSubmissionRow(
  value: unknown,
): GradingSubmissionRow {
  const source = record(value);
  const mode = submissionMode(source.submissionMode);
  const submittedIds = attachmentIds(source.submittedAttachmentIds);
  if (mode !== "FILES" && submittedIds.length) invalidSubmissionResponse();
  if (mode === "FILES" && !submittedIds.length) invalidSubmissionResponse();
  const maxPoints = safeInteger(source.maxPoints, 1);
  if (maxPoints > 10_000) invalidSubmissionResponse();
  const status = gradingStatus(source.status);
  const score = nullableNumber(source.score, 0, maxPoints);
  if (
    (status === "GRADED" && score === null) ||
    (status === "SUBMITTED" && score !== null)
  ) {
    invalidSubmissionResponse();
  }
  return {
    _id: identifier(source._id),
    assignment: parseSummary(
      source.assignment,
    ) as GradingSubmissionRow["assignment"],
    attemptCount: safeInteger(source.attemptCount, 1),
    course: parseSummary(source.course) as GradingSubmissionRow["course"],
    learner: parseSummary(
      source.learner,
      true,
    ) as GradingSubmissionRow["learner"],
    maxPoints,
    revision: safeInteger(source.revision, 1),
    score,
    status,
    submissionMode: mode,
    submittedAttachmentIds: submittedIds,
    submittedAt: dateString(source.submittedAt),
    wasLate: booleanValue(source.wasLate),
  };
}

function parseHistoryEntry(
  value: unknown,
  maxPoints: number,
): GradingHistoryEntry {
  const source = record(value);
  if (
    typeof source.action !== "string" ||
    !HISTORY_ACTIONS.has(source.action as GradingHistoryEntry["action"])
  ) {
    invalidSubmissionResponse();
  }
  const action = source.action as GradingHistoryEntry["action"];
  const hasScore = source.score !== undefined;
  if ((action === "GRADE") !== hasScore) invalidSubmissionResponse();
  return {
    action,
    actorId: identifier(source.actorId),
    at: dateString(source.at),
    revision: safeInteger(source.revision, 1),
    ...(!hasScore ? {} : { score: finiteNumber(source.score, 0, maxPoints) }),
  };
}

function assertGradingDetailLifecycle(detail: GradingSubmissionDetail): void {
  const {
    gradedAt,
    gradingFeedback,
    history,
    returnFeedback,
    revision,
    score,
    status,
    submittedAt,
  } = detail;
  if (!history.length) invalidSubmissionResponse();
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    const previous = history[index - 1];
    if (
      entry.revision > revision ||
      (previous !== undefined && entry.revision <= previous.revision)
    ) {
      invalidSubmissionResponse();
    }
  }
  let latestSubmit: GradingHistoryEntry | undefined;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].action === "SUBMIT") {
      latestSubmit = history[index];
      break;
    }
  }
  if (latestSubmit !== undefined && latestSubmit.at !== submittedAt) {
    invalidSubmissionResponse();
  }
  const latest = history[history.length - 1];
  if (latest === undefined) invalidSubmissionResponse();

  if (status === "SUBMITTED") {
    if (
      gradedAt !== null ||
      gradingFeedback !== null ||
      latest.action !== "SUBMIT" ||
      latest.at !== submittedAt ||
      latest.revision !== revision ||
      returnFeedback !== null ||
      score !== null
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (status === "RETURNED") {
    if (
      latest.action !== "RETURN" ||
      returnFeedback === null
    ) {
      invalidSubmissionResponse();
    }
    // A manager may return a previously graded attempt for revision. Preserve
    // the last grade snapshot when all three grade fields are present; a
    // partial grade is never accepted.
    if (
      (score === null) !== (gradedAt === null) ||
      (score === null) !== (gradingFeedback === null)
    ) {
      invalidSubmissionResponse();
    }
    return;
  }
  if (
    gradedAt === null ||
    gradingFeedback === null ||
    latest.action !== "GRADE" ||
    latest.at !== gradedAt ||
    latest.revision !== revision ||
    latest.score !== score ||
    score === null
  ) {
    invalidSubmissionResponse();
  }
}

export function parseGradingSubmissionDetail(
  value: unknown,
): GradingSubmissionDetail {
  const source = record(value);
  const row = parseGradingSubmissionRow(source);
  if (
    !Array.isArray(source.history) ||
    source.history.length > MAX_HISTORY_ENTRIES
  ) {
    invalidSubmissionResponse();
  }
  const submittedContent = nullableText(
    source.submittedContent,
    MAX_CONTENT_LENGTH,
  );
  assertSubmittedPayload(
    row.submissionMode,
    submittedContent,
    row.submittedAttachmentIds,
  );
  const detail: GradingSubmissionDetail = {
    ...row,
    gradedAt: nullableDateString(source.gradedAt),
    gradingFeedback: nullableFeedback(source.gradingFeedback),
    history: source.history.map((entry) =>
      parseHistoryEntry(entry, row.maxPoints),
    ),
    returnFeedback: nullableFeedback(source.returnFeedback),
    submittedContent,
  };
  assertGradingDetailLifecycle(detail);
  return detail;
}

export function parseGradingPage(
  value: unknown,
): Paginated<GradingSubmissionRow> {
  const source = record(value);
  if (!Array.isArray(source.items) || source.items.length > 100) {
    invalidSubmissionResponse();
  }
  const page = safeInteger(source.page, 1);
  const limit = safeInteger(source.limit, 1);
  if (limit > 100 || source.items.length > limit) invalidSubmissionResponse();
  return {
    items: source.items.map(parseGradingSubmissionRow),
    limit,
    page,
    total: safeInteger(source.total),
  };
}

function reportCount(value: unknown) {
  return safeInteger(value);
}

function nullablePercentage(value: unknown) {
  return value === null ? null : finiteNumber(value, 0, 100);
}

function safeSum(values: readonly number[]) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) invalidSubmissionResponse();
  }
  return total;
}

function courseReportPercentage(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  const percentage = Math.round((numerator / denominator) * 10_000) / 100;
  return Math.min(100, Math.max(0, percentage));
}

function assertCourseReportArithmetic(report: CourseReport): void {
  const {
    activeLearners,
    completionPercent,
    counts,
    expectedSubmissions,
    gradedAveragePercent,
    lateSubmissions,
    publishedAssignments,
  } = report;
  const expectedProduct = activeLearners * publishedAssignments;
  if (
    !Number.isSafeInteger(expectedProduct) ||
    expectedSubmissions !== expectedProduct
  ) {
    invalidSubmissionResponse();
  }
  const knownSubmissions = safeSum([
    counts.draft,
    counts.submitted,
    counts.returned,
    counts.graded,
  ]);
  const completedSubmissions = safeSum([
    counts.submitted,
    counts.returned,
    counts.graded,
  ]);
  if (
    counts.notStarted !== Math.max(expectedSubmissions - knownSubmissions, 0) ||
    lateSubmissions > completedSubmissions ||
    completionPercent !==
      courseReportPercentage(completedSubmissions, expectedSubmissions) ||
    (counts.graded === 0 && gradedAveragePercent !== null) ||
    (gradedAveragePercent !== null &&
      gradedAveragePercent !== Math.round(gradedAveragePercent * 100) / 100)
  ) {
    invalidSubmissionResponse();
  }
}

export function parseCourseReport(value: unknown): CourseReport {
  const source = record(value);
  const course = record(source.course);
  const counts = record(source.counts);
  if (
    source.scope !== "CURRENT_ACTIVE_ROSTER" ||
    course.status !== "PUBLISHED"
  ) {
    invalidSubmissionResponse();
  }
  const report: CourseReport = {
    activeLearners: reportCount(source.activeLearners),
    completionPercent: nullablePercentage(source.completionPercent),
    counts: {
      draft: reportCount(counts.draft),
      graded: reportCount(counts.graded),
      notStarted: reportCount(counts.notStarted),
      returned: reportCount(counts.returned),
      submitted: reportCount(counts.submitted),
    },
    course: {
      _id: identifier(course._id),
      status: "PUBLISHED",
      title: boundedString(course.title, 500),
    },
    expectedSubmissions: reportCount(source.expectedSubmissions),
    generatedAt: dateString(source.generatedAt),
    gradedAveragePercent: nullablePercentage(source.gradedAveragePercent),
    lateSubmissions: reportCount(source.lateSubmissions),
    publishedAssignments: reportCount(source.publishedAssignments),
    scope: "CURRENT_ACTIVE_ROSTER",
  };
  assertCourseReportArithmetic(report);
  return report;
}
