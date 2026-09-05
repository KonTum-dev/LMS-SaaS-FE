import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  guardianPortalApi,
  guardianPortalAccessLost,
} from "./guardian-portal-api";
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
const fetch = vi.mocked(apiFetch);
beforeEach(() => {
  fetch.mockReset();
  fetch.mockResolvedValue({});
});

describe("guardian portal API", () => {
  it("uses the authenticated guardian endpoint without tenant or parent identifiers", async () => {
    const signal = new AbortController().signal;
    await guardianPortalApi.children("guardian-token", 2, signal);
    expect(fetch).toHaveBeenCalledWith(
      "/guardians/portal/children?page=2&limit=20",
      { token: "guardian-token", cache: "no-store", signal },
    );
  });
  it("encodes child identity and uses separately bounded pagination", async () => {
    const signal = new AbortController().signal;
    await guardianPortalApi.learning(
      "token",
      "child/one",
      { coursesPage: 2, resultsPage: 3, assessmentsPage: 4 },
      signal,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/guardians/portal/children/child%2Fone/learning?coursesPage=2&coursesLimit=10&resultsPage=3&resultsLimit=10&assessmentsPage=4&assessmentsLimit=10",
      { token: "token", signal, cache: "no-store" },
    );
  });
  it.each([401, 403, 404])("clears private state after status %s", (status) => {
    expect(guardianPortalAccessLost({ status })).toBe(true);
  });
  it("allows retry for transient network and service errors", () => {
    expect(guardianPortalAccessLost(new Error("Offline"))).toBe(false);
    expect(guardianPortalAccessLost({ status: 503 })).toBe(false);
  });
});
