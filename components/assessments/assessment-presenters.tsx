"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { Tag } from "antd";
import { createTranslator, formatDate, formatNumber } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/locale";
import type {
  AssessmentAttemptStatus,
  AssessmentAvailability,
  AssessmentResultVisibility,
  AssessmentStatus,
} from "@/lib/assessment-api";

export const assessmentStatusLabels: Record<AssessmentStatus, string> = {
  ARCHIVED: "Đã lưu trữ",
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
};

export const assessmentAttemptStatusLabels: Record<AssessmentAttemptStatus, string> = {
  IN_PROGRESS: "Đang làm",
  SUBMITTED: "Đã nộp",
  TIMED_OUT: "Hết giờ",
};

export const assessmentAvailabilityLabels: Record<AssessmentAvailability, string> = {
  CLOSED: "Đã đóng",
  OPEN: "Đang mở",
  UPCOMING: "Sắp mở",
};

export const resultVisibilityLabels: Record<AssessmentResultVisibility, string> = {
  AFTER_ATTEMPTS_EXHAUSTED: "Sau khi hết lượt làm",
  AFTER_CLOSE: "Sau khi bài kiểm tra đóng",
  AFTER_SUBMIT: "Ngay sau khi nộp",
};

export function AssessmentStatusTag({ status }: { status: AssessmentStatus }) {
  const { t } = useI18n(learningMessages);
  return (
    <Tag color={status === "PUBLISHED" ? "green" : status === "DRAFT" ? "gold" : "default"}>
      {t(assessmentStatusLabels[status])}
    </Tag>
  );
}

export function AttemptStatusTag({ status }: { status: AssessmentAttemptStatus }) {
  const { t } = useI18n(learningMessages);
  return (
    <Tag color={status === "IN_PROGRESS" ? "blue" : status === "SUBMITTED" ? "green" : "orange"}>
      {t(assessmentAttemptStatusLabels[status])}
    </Tag>
  );
}

export function AvailabilityTag({ availability }: { availability: AssessmentAvailability }) {
  const { t } = useI18n(learningMessages);
  return (
    <Tag color={availability === "OPEN" ? "green" : availability === "UPCOMING" ? "blue" : "default"}>
      {t(assessmentAvailabilityLabels[availability])}
    </Tag>
  );
}

export function formatAssessmentDate(value: string | null, locale: Locale = "vi"): string {
  if (value && locale === "vi") return `${formatDate(value, locale, { day: "2-digit", month: "2-digit", year: "numeric" })} ${formatDate(value, locale, { hour: "2-digit", minute: "2-digit" })}`;
  return value ? formatDate(value, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : createTranslator(locale, learningMessages)("Không giới hạn");
}

export function formatAssessmentDuration(seconds: number | null, locale: Locale = "vi"): string {
  const t = createTranslator(locale, learningMessages);
  if (seconds === null) return t("Không giới hạn");
  const minutes = Math.round(seconds / 60);
  return t("{p0} phút", { p0: formatNumber(minutes, locale) });
}

export function resultPendingMessage(
  visibility: AssessmentResultVisibility,
  closesAt: string | null,
  locale: Locale = "vi",
): string {
  const t = createTranslator(locale, learningMessages);
  if (visibility === "AFTER_CLOSE") {
    return closesAt
      ? t("Kết quả sẽ được công bố sau {p0}.", { p0: formatAssessmentDate(closesAt, locale) })
      : t("Kết quả sẽ được công bố sau khi bài kiểm tra đóng.");
  }
  if (visibility === "AFTER_ATTEMPTS_EXHAUSTED") {
    return t("Kết quả sẽ được công bố khi bạn hoàn tất toàn bộ số lượt làm được cấp và không còn lượt đang mở.");
  }
  return t("Kết quả đang được xử lý. Vui lòng tải lại sau ít phút.");
}
