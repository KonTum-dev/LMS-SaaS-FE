import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  buildGuardianQuery,
  guardianApi,
  guardianDirectoryUserId,
} from "@/lib/guardian-api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const mockedApiFetch = vi.mocked(apiFetch);
const context = { token: "tenant-token" };

beforeEach(() => {
  mockedApiFetch.mockReset();
  mockedApiFetch.mockResolvedValue({});
});

describe("guardianApi", () => {
  it("xây query trạng thái và chuẩn hóa identity id từ directory", () => {
    expect(buildGuardianQuery({ status: "INACTIVE" })).toBe(
      "?status=INACTIVE",
    );
    expect(buildGuardianQuery()).toBe("");
    expect(
      guardianDirectoryUserId({ _id: "identity-1", userId: "user-1" } as never),
    ).toBe("user-1");
    expect(guardianDirectoryUserId({ _id: "identity-2" } as never)).toBe(
      "identity-2",
    );
  });

  it("dùng endpoint riêng cho guardian hiện tại và learner-scoped reads", async () => {
    const signal = new AbortController().signal;
    await guardianApi.listForCurrentGuardian(
      context,
      { status: "ACTIVE" },
      { signal },
    );
    await guardianApi.listByLearner(
      context,
      "learner/one",
      { status: "INACTIVE" },
      { signal },
    );

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      1,
      "/guardians/me?status=ACTIVE",
      { cache: "no-store", signal, token: "tenant-token" },
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/guardians/learners/learner%2Fone?status=INACTIVE",
      { cache: "no-store", signal, token: "tenant-token" },
    );
  });

  it("đọc user directory đúng scope admin và instructor", async () => {
    await guardianApi.listDirectory(context);
    await guardianApi.listLearners(context);

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/users", {
      cache: "no-store",
      token: "tenant-token",
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, "/users/learners", {
      cache: "no-store",
      token: "tenant-token",
    });
  });

  it("tạo và cập nhật quan hệ đúng contract", async () => {
    const createInput = {
      canReceiveAcademicUpdates: true,
      canReceiveBillingUpdates: false,
      guardianId: "guardian-1",
      learnerId: "learner-1",
      primaryContact: true,
      relationshipType: "PARENT" as const,
    };
    const updateInput = {
      canReceiveBillingUpdates: true,
      relationshipType: "GUARDIAN" as const,
      status: "ACTIVE" as const,
    };

    await guardianApi.create(context, createInput);
    await guardianApi.update(context, "relationship/one", updateInput);

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/guardians", {
      body: JSON.stringify(createInput),
      method: "POST",
      token: "tenant-token",
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      "/guardians/relationship%2Fone",
      {
        body: JSON.stringify(updateInput),
        method: "PATCH",
        token: "tenant-token",
      },
    );
  });

  it("archive dùng DELETE và encode relationship id", async () => {
    await guardianApi.archive(context, "relationship/one");

    expect(mockedApiFetch).toHaveBeenCalledWith(
      "/guardians/relationship%2Fone",
      { method: "DELETE", token: "tenant-token" },
    );
  });
});
