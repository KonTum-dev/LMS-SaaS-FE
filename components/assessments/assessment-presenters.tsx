import { Tag } from "antd";
import dayjs from "dayjs";
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
  return (
    <Tag color={status === "PUBLISHED" ? "green" : status === "DRAFT" ? "gold" : "default"}>
      {assessmentStatusLabels[status]}
    </Tag>
  );
}

export function AttemptStatusTag({ status }: { status: AssessmentAttemptStatus }) {
  return (
    <Tag color={status === "IN_PROGRESS" ? "blue" : status === "SUBMITTED" ? "green" : "orange"}>
      {assessmentAttemptStatusLabels[status]}
    </Tag>
  );
}

export function AvailabilityTag({ availability }: { availability: AssessmentAvailability }) {
  return (
    <Tag color={availability === "OPEN" ? "green" : availability === "UPCOMING" ? "blue" : "default"}>
      {assessmentAvailabilityLabels[availability]}
    </Tag>
  );
}

export function formatAssessmentDate(value: string | null): string {
  return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "Không giới hạn";
}

export function formatAssessmentDuration(seconds: number | null): string {
  if (seconds === null) return "Không giới hạn";
  const minutes = Math.round(seconds / 60);
  return `${minutes.toLocaleString("vi-VN")} phút`;
}

export function resultPendingMessage(
  visibility: AssessmentResultVisibility,
  closesAt: string | null,
): string {
  if (visibility === "AFTER_CLOSE") {
    return closesAt
      ? `Kết quả sẽ được công bố sau ${formatAssessmentDate(closesAt)}.`
      : "Kết quả sẽ được công bố sau khi bài kiểm tra đóng.";
  }
  if (visibility === "AFTER_ATTEMPTS_EXHAUSTED") {
    return "Kết quả sẽ được công bố khi bạn hoàn tất toàn bộ số lượt làm được cấp và không còn lượt đang mở.";
  }
  return "Kết quả đang được xử lý. Vui lòng tải lại sau ít phút.";
}
