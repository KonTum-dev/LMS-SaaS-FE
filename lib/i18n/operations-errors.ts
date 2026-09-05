import { describeFeedbackError } from "@/lib/feedback-errors";
import { commonMessages } from "./common-messages";
import type { Locale } from "./locale";
import { operationsMessages } from "./operations-messages";
import { createTranslator } from "./translate";

const reviewedCopy = new Set([
  ...Object.keys(operationsMessages),
  ...Object.values(operationsMessages),
  ...Object.keys(commonMessages),
  ...Object.values(commonMessages),
]);

/** Localize reviewed client validation; server errors stay code/status driven. */
export function describeOperationsError(
  error: unknown,
  locale: Locale,
  fallback?: string,
): string {
  // These two exact messages originate in the transport/response validators.
  // Their write result is unknown even though they are plain Error objects.
  if (error instanceof Error && !("status" in error) && !("code" in error)) {
    if (error.message === "Mất kết nối") {
      return describeFeedbackError({ status: 0 }, locale).message;
    }
    if (error.message === "Máy chủ trả trạng thái tạo tenant không hợp lệ") {
      return describeFeedbackError(
        { code: "TENANT_PROVISIONING_RESPONSE_INVALID" },
        locale,
      ).message;
    }
  }
  if (
    error instanceof Error &&
    !("status" in error) &&
    !("code" in error) &&
    reviewedCopy.has(error.message)
  ) {
    return createTranslator(locale, operationsMessages)(error.message);
  }
  return describeFeedbackError(error, locale, fallback).message;
}
