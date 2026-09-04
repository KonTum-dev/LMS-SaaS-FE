import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import {
  buildPublicRegistrationRequest,
  clearPublicRegistrationAttempt,
  createPublicRegistrationIdempotencyKey,
  loadPublicRegistrationAttempt,
  PUBLIC_REGISTRATION_ATTEMPT_TTL_MS,
  publicRegistrationApi,
  publicRegistrationFingerprint,
  rememberPublicRegistrationAttempt,
  registrationErrorPresentation,
  workspaceSlugFromName,
} from "./public-registration";

describe("public registration contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("chuẩn hóa đúng body owner/workspace và không gửi trường UI", () => {
    expect(
      buildPublicRegistrationRequest({
        email: " Owner@Bright.EDU.VN ",
        fullName: " Nguyễn Minh Anh ",
        password: "Owner@123",
        workspaceName: " Bright Academy ",
        workspaceSlug: " bright-academy ",
      }),
    ).toEqual({
      owner: {
        email: "owner@bright.edu.vn",
        fullName: "Nguyễn Minh Anh",
        password: "Owner@123",
      },
      workspace: { name: "Bright Academy", slug: "bright-academy" },
    });
  });

  it.each([
    ["Trung tâm Ánh Dương", "trung-tam-anh-duong"],
    ["  Lớp Cô Đào  ", "lop-co-dao"],
    ["DX LMS @ Quận 1", "dx-lms-quan-1"],
  ])("tạo slug dễ đọc từ tên tiếng Việt: %s", (name, expected) => {
    expect(workspaceSlugFromName(name)).toBe(expected);
  });

  it("tạo UUID v4 bằng CSPRNG và fail closed khi browser không hỗ trợ", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });
    expect(createPublicRegistrationIdempotencyKey()).toBe(
      "abababab-abab-4bab-abab-abababababab",
    );

    vi.stubGlobal("crypto", undefined);
    expect(() => createPublicRegistrationIdempotencyKey()).toThrow(
      "không hỗ trợ tạo khóa đăng ký an toàn",
    );
  });

  it("khôi phục retry bằng SHA-256 nhưng không lưu payload hoặc mật khẩu", async () => {
    const values = new Map<string, string>();
    const storage = {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: () => null,
      get length() { return values.size; },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: storage });
    const request = buildPublicRegistrationRequest({
      email: "owner@example.com",
      fullName: "Owner",
      password: "Owner@123",
      workspaceName: "Bright Academy",
      workspaceSlug: "bright-academy",
    });
    const fingerprint = await publicRegistrationFingerprint(request);
    const now = Date.now();
    const attempt = {
      createdAt: now,
      fingerprint,
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      version: 1 as const,
    };

    expect(rememberPublicRegistrationAttempt(attempt)).toBe(true);
    expect(loadPublicRegistrationAttempt(fingerprint, now)).toEqual(attempt);
    expect([...values.values()].join(" ")).not.toMatch(
      /Owner@123|owner@example|Bright Academy|bright-academy/,
    );
    expect(
      loadPublicRegistrationAttempt("f".repeat(64), now),
    ).toBeNull();
    expect(loadPublicRegistrationAttempt(fingerprint, now)).toEqual(attempt);
    clearPublicRegistrationAttempt();
    expect(storage.length).toBe(0);
  });

  it("loại bỏ attempt hết hạn hoặc có thêm dữ liệu ngoài contract", () => {
    const fingerprint = "a".repeat(64);
    const values = new Map<string, string>();
    const storage = {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { sessionStorage: storage });
    const key = "dx-lms:public-registration:v1";
    storage.setItem(key, JSON.stringify({
      createdAt: Date.now() - PUBLIC_REGISTRATION_ATTEMPT_TTL_MS - 1,
      fingerprint,
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      version: 1,
    }));
    expect(loadPublicRegistrationAttempt(fingerprint)).toBeNull();
    expect(values.size).toBe(0);

    storage.setItem(key, JSON.stringify({
      createdAt: Date.now(),
      fingerprint,
      idempotencyKey: "abababab-abab-4bab-abab-abababababab",
      password: "must-not-be-stored",
      version: 1,
    }));
    expect(loadPublicRegistrationAttempt(fingerprint)).toBeNull();
    expect(values.size).toBe(0);
  });

  it("gọi đúng endpoint public với Idempotency-Key và không gửi token", async () => {
    const response = {
      accessToken: "signup-token",
      effectiveAccess: null,
      organization: null,
      user: {
        email: "owner@example.com",
        fullName: "Owner",
        role: "TENANT_ADMIN" as const,
        sub: "owner-id",
      },
      workspaces: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
    const request = buildPublicRegistrationRequest({
      email: "owner@example.com",
      fullName: "Owner",
      password: "Owner@123",
      workspaceName: "Bright Academy",
      workspaceSlug: "bright-academy",
    });

    await expect(
      publicRegistrationApi.register(
        request,
        "abababab-abab-4bab-abab-abababababab",
      ),
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/auth/register",
      expect.objectContaining({
        body: JSON.stringify(request),
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Idempotency-Key": "abababab-abab-4bab-abab-abababababab",
        }),
        method: "POST",
        referrerPolicy: "no-referrer",
      }),
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("biến lỗi retry thành hướng dẫn giữ nguyên payload", () => {
    expect(
      registrationErrorPresentation(
        new ApiError("pending", 409, "SIGNUP_IN_PROGRESS", undefined, 6),
      ),
    ).toEqual({
      description:
        "Workspace đang được khởi tạo. Giữ nguyên thông tin và thử lại sau khoảng 6 giây; hệ thống sẽ không tạo trùng.",
      title: "Đăng ký đang được xử lý",
      type: "warning",
    });
    expect(
      registrationErrorPresentation(
        new ApiError("retry", 503, "SIGNUP_RETRYABLE"),
      ).title,
    ).toBe("Chưa xác nhận được kết quả đăng ký");
    expect(
      registrationErrorPresentation(
        new ApiError("disabled", 503, "PUBLIC_SIGNUP_DISABLED"),
      ).title,
    ).toBe("Đăng ký đang tạm đóng");
  });

  it("không làm lộ email hay slug nào đã xung đột", () => {
    const presentation = registrationErrorPresentation(
      new ApiError(
        "Email owner@example.com đã tồn tại ở bright-academy",
        409,
        "SIGNUP_UNAVAILABLE",
      ),
    );

    expect(`${presentation.title} ${presentation.description}`).not.toMatch(
      /owner@example|bright-academy/,
    );
  });
});
