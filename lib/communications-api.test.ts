import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAnnouncementQuery,
  communicationsApi,
  communicationsQueryKeys,
  type CreateAnnouncementInput,
} from "./communications-api";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: mocks.apiFetch }));

const context = { token: "tenant-token" };
const scope = {
  membershipId: "membership-1",
  role: "INSTRUCTOR" as const,
  tenantId: "tenant-1",
  viewerId: "instructor-1",
};
const createInput: CreateAnnouncementInput = {
  audience: "COHORT",
  body: "Lớp nghỉ học vào chiều thứ bảy.",
  cohortId: "cohort-1",
  recipientRoles: ["LEARNER", "GUARDIAN"],
  title: "Điều chỉnh lịch học",
};

describe("communicationsApi contract", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue(null);
  });

  it("xây query ổn định, trim và encode bộ lọc", () => {
    expect(
      buildAnnouncementQuery({
        audience: " ORG_UNIT ",
        ignored: " ",
        status: "PUBLISHED/ACTIVE",
      }),
    ).toBe("?audience=ORG_UNIT&status=PUBLISHED%2FACTIVE");
    expect(
      buildAnnouncementQuery({ status: "DRAFT", audience: "COHORT" }),
    ).toBe(buildAnnouncementQuery({ audience: "COHORT", status: "DRAFT" }));
  });

  it("scope cache theo tenant, viewer, membership và role", () => {
    expect(
      communicationsQueryKeys.list(scope, {
        audience: "COHORT",
        status: "PUBLISHED",
      }),
    ).toEqual([
      "lms",
      "tenant-1",
      "instructor-1",
      "membership-1",
      "INSTRUCTOR",
      "communications",
      "announcements",
      "list",
      "?audience=COHORT&status=PUBLISHED",
    ]);
  });

  it("list dùng no-store, chuyển AbortSignal và không thêm query rỗng", async () => {
    const signal = new AbortController().signal;
    await communicationsApi.list(
      context,
      { audience: "COHORT", status: "PUBLISHED" },
      { signal },
    );
    await communicationsApi.list(context);

    expect(mocks.apiFetch.mock.calls).toEqual([
      [
        "/communications/announcements?audience=COHORT&status=PUBLISHED",
        { cache: "no-store", signal, token: "tenant-token" },
      ],
      ["/communications/announcements", { cache: "no-store", token: "tenant-token" }],
    ]);
  });

  it("create, update, publish và archive dùng đúng target routes", async () => {
    await communicationsApi.create(context, createInput);
    await communicationsApi.update(context, "notice/one", {
      audience: "TENANT",
      body: "Nội dung đã sửa",
      cohortId: null,
      orgUnitId: null,
      recipientRoles: ["INSTRUCTOR"],
      title: "Tiêu đề đã sửa",
    });
    await communicationsApi.publish(context, "notice/one");
    await communicationsApi.archive(context, "notice/one");

    expect(mocks.apiFetch.mock.calls).toEqual([
      ["/communications/announcements", {
        body: JSON.stringify(createInput),
        method: "POST",
        token: "tenant-token",
      }],
      ["/communications/announcements/notice%2Fone", {
        body: JSON.stringify({
          audience: "TENANT",
          body: "Nội dung đã sửa",
          cohortId: null,
          orgUnitId: null,
          recipientRoles: ["INSTRUCTOR"],
          title: "Tiêu đề đã sửa",
        }),
        method: "PATCH",
        token: "tenant-token",
      }],
      ["/communications/announcements/notice%2Fone/publish", {
        method: "POST",
        token: "tenant-token",
      }],
      ["/communications/announcements/notice%2Fone/archive", {
        method: "POST",
        token: "tenant-token",
      }],
    ]);
  });
});
