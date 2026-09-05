// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import { AssessmentStatusTag, AttemptStatusTag, AvailabilityTag, formatAssessmentDate, formatAssessmentDuration, resultPendingMessage } from "./assessment-presenters";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("learning presentation localization", () => {
  it("localizes all coded status tags in English", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    render(<FeedbackLocaleProvider initialLocale="en"><AssessmentStatusTag status="PUBLISHED" /><AttemptStatusTag status="TIMED_OUT" /><AvailabilityTag availability="UPCOMING" /></FeedbackLocaleProvider>);
    expect(screen.getByText("Published")).toBeTruthy();
    expect(screen.getByText("Timed out")).toBeTruthy();
    expect(screen.getByText("Opening soon")).toBeTruthy();
  });

  it("formats duration/date and pending-result policy in the requested locale", () => {
    expect(formatAssessmentDuration(600, "vi")).toBe("10 phút");
    expect(formatAssessmentDuration(600, "en")).toBe("10 minutes");
    expect(formatAssessmentDate(null, "en")).toBe("Unlimited");
    expect(formatAssessmentDate("2030-08-21T08:00:00.000Z", "vi")).toBe("21/08/2030 15:00");
    expect(formatAssessmentDate("2030-08-21T08:00:00.000Z", "en")).toContain("08/21/2030");
    expect(resultPendingMessage("AFTER_CLOSE", null, "en")).toBe("Results will be released after the assessment closes.");
    expect(resultPendingMessage("AFTER_ATTEMPTS_EXHAUSTED", null, "en")).toContain("completed all allowed attempts");
  });
});
