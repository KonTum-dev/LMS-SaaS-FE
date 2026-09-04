// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  rememberTenantProvisioningAttempt,
  TENANT_PROVISIONING_ATTEMPT_TTL_MS,
} from "@/lib/tenant-management";
import type { Organization, UserRole } from "@/lib/types";
import TenantsPage from "./page";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  authGeneration: 1,
  formApi: {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
  },
  formValues: {
    adminEmail: "owner@bright.local",
    adminFullName: "Bright Owner",
    adminPassword: "Owner@123",
    enabledModules: ["USERS", "COURSES"],
    name: "Bright Academy Two",
    primaryColor: "#176BFF",
    slug: "bright-academy-two",
  },
  onValuesChange: null as (() => void) | null,
  message: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
  role: "SUPER_ADMIN" as UserRole,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: mocks.apiFetch };
});
vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () =>
    mocks.role === "SUPER_ADMIN"
      ? {
          captureAuthGeneration: () => mocks.authGeneration,
          organization: null,
          token: "platform-token",
          user: {
            email: "admin@dx.test",
            fullName: "Platform Admin",
            role: "SUPER_ADMIN",
            sub: "platform-admin",
          },
        }
      : {
          captureAuthGeneration: () => mocks.authGeneration,
          organization: {
            _id: "64b000000000000000000001",
            enabledModules: ["USERS", "COURSES"],
            logoUrl: null,
            name: "Bright Academy",
            primaryColor: "#176BFF",
            slug: "bright-academy",
            status: "ACTIVE",
          },
          token: "tenant-token",
          user: {
            email: "owner@bright.test",
            fullName: "Bright Owner",
            membershipId: "membership-owner",
            role: mocks.role,
            sub: "owner-1",
            tenantId: "64b000000000000000000001",
          },
        },
}));
vi.mock("@/components/table/data-table", () => ({
  DataTable: ({
    ariaLabel,
    data,
  }: {
    ariaLabel: string;
    data: Organization[];
  }) => (
    <section aria-label={ariaLabel}>
      {data.map((tenant) => (
        <article key={tenant._id}>
          <span>{tenant.name}</span>
          <span>{tenant.enabledModules.length} module</span>
        </article>
      ))}
    </section>
  ),
}));
vi.mock("@/components/users/tenant-members-manager", () => ({
  TenantMembersManager: () => null,
}));
vi.mock("@ant-design/icons", () => ({ PlusOutlined: () => null }));
vi.mock("antd", async () => {
  const { lightweightAntd } = await import("@/test-utils/lightweight-antd");
  const TestApp = ({ children }: { children?: ReactNode }) => <>{children}</>;
  TestApp.useApp = () => ({ message: mocks.message, modal: { confirm() {} } });

  const TestForm = ({
    children,
    disabled = false,
    onValuesChange,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onValuesChange?: () => void;
  }) => {
    mocks.onValuesChange = onValuesChange ?? null;
    return <fieldset disabled={disabled}>{children}</fieldset>;
  };
  const Form = Object.assign(TestForm, {
    Item: lightweightAntd.Form.Item,
    useForm: () => [mocks.formApi],
  });

  return {
    ...lightweightAntd,
    App: TestApp,
    ColorPicker: (props: { value?: string }) => (
      <input
        aria-label="Bộ chọn màu thương hiệu"
        readOnly
        value={props.value ?? ""}
      />
    ),
    Form,
  };
});

const OPERATION_ID = "64b000000000000000000042";
const ORGANIZATION_ID = "64b000000000000000000043";
const COMPLETED_AT = "2030-01-02T03:04:05.000Z";
const RECOVERY_KEY = "abababab-abab-4bab-abab-abababababab";

const tenant: Organization = {
  _id: ORGANIZATION_ID,
  enabledModules: [
    "USERS",
    "COURSES",
    "ENROLLMENTS",
    "ASSIGNMENTS",
    "ASSESSMENTS",
    "MEDIA",
  ],
  logoUrl: null,
  name: "Bright Academy",
  primaryColor: "#176BFF",
  slug: "bright-academy",
  status: "ACTIVE",
};

const succeededOperation = {
  attemptCount: 1,
  completedAt: COMPLETED_AT,
  operationId: OPERATION_ID,
  organization: tenant,
  phase: "SUCCEEDED",
  status: "SUCCEEDED",
} as const;

const pendingOperation = {
  attemptCount: 1,
  operationId: OPERATION_ID,
  organization: null,
  phase: "ORGANIZATION_CREATED",
  status: "PENDING",
} as const;

const failedOperation = {
  attemptCount: 1,
  completedAt: COMPLETED_AT,
  failureCode: "ADMIN_EMAIL_CONFLICT",
  operationId: OPERATION_ID,
  organization: null,
  phase: "ORGANIZATION_CREATED",
  status: "FAILED",
} as const;

function renderPage({ strict = false }: { strict?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  const page = (
    <QueryClientProvider client={client}>
      <TenantsPage />
    </QueryClientProvider>
  );
  const rendered = render(strict ? <StrictMode>{page}</StrictMode> : page);
  return { ...rendered, client };
}

function organizationPostCalls() {
  return mocks.apiFetch.mock.calls.filter(
    ([path, options]) =>
      path === "/organizations" && options?.method === "POST",
  );
}

function statusGetCalls() {
  return mocks.apiFetch.mock.calls.filter(([path]) =>
    String(path).startsWith("/organizations/provisioning/"),
  );
}

function idempotencyKey(call: unknown[]) {
  const options = call[1] as RequestInit;
  return (options.headers as Record<string, string>)["Idempotency-Key"];
}

function storedAttempt(): Record<string, unknown> | null {
  if (window.sessionStorage.length === 0) return null;
  expect(window.sessionStorage.length).toBe(1);
  const key = window.sessionStorage.key(0);
  expect(key).toBeTruthy();
  return JSON.parse(
    window.sessionStorage.getItem(key as string) as string,
  ) as Record<string, unknown>;
}

function seedRecovery(
  operationId: string | undefined = OPERATION_ID,
  expiresAt = Date.now() + TENANT_PROVISIONING_ATTEMPT_TTL_MS,
) {
  expect(
    rememberTenantProvisioningAttempt({
      actorId: "platform-admin",
      expiresAt,
      idempotencyKey: RECOVERY_KEY,
      ...(operationId ? { operationId } : {}),
      version: 1,
    }),
  ).toBe(true);
}

async function openCreateModal() {
  await screen.findByText("Bright Academy");
  fireEvent.click(screen.getByRole("button", { name: "Thêm tổ chức" }));
  return screen.getByRole("dialog", { name: "Tạo tổ chức mới" });
}

describe("TenantsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockImplementation(() => Promise.resolve([tenant]));
    mocks.formApi.resetFields.mockReset();
    mocks.formApi.setFieldsValue.mockReset();
    mocks.formApi.validateFields.mockReset();
    mocks.formApi.validateFields.mockImplementation(async () => ({
      ...mocks.formValues,
      enabledModules: [...mocks.formValues.enabledModules],
    }));
    Object.assign(mocks.formValues, {
      adminEmail: "owner@bright.local",
      adminFullName: "Bright Owner",
      adminPassword: "Owner@123",
      enabledModules: ["USERS", "COURSES"],
      name: "Bright Academy Two",
      primaryColor: "#176BFF",
      slug: "bright-academy-two",
    });
    mocks.message.error.mockReset();
    mocks.message.info.mockReset();
    mocks.message.success.mockReset();
    mocks.onValuesChange = null;
    mocks.authGeneration = 1;
    mocks.role = "SUPER_ADMIN";
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chỉ tải danh sách tổ chức bằng phiên quản trị nền tảng", async () => {
    renderPage();

    expect(await screen.findByText("Bright Academy")).toBeTruthy();
    expect(screen.getByText("6 module")).toBeTruthy();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/organizations", {
      token: "platform-token",
    });
  });

  it("fail closed cho quản trị tenant và không gọi API nền tảng", async () => {
    mocks.role = "TENANT_ADMIN";
    renderPage();

    expect(screen.getByRole("alert").textContent).toContain(
      "Bạn không có quyền truy cập khu vực quản trị nền tảng",
    );
    await waitFor(() => expect(mocks.apiFetch).not.toHaveBeenCalled());
  });

  it("hiển thị module mới, dependency và đủ trường quản trị đầu tiên", async () => {
    renderPage();
    const dialog = await openCreateModal();

    expect(dialog.textContent).toContain("Bài kiểm tra");
    expect(dialog.textContent).toContain("Tài liệu riêng tư");
    expect(dialog.textContent).toContain(
      "Bài tập và Bài kiểm tra cần cả Ghi danh lẫn Khóa học",
    );
    expect(screen.getByLabelText("Tên tổ chức")).toBeTruthy();
    expect(screen.getByLabelText("Email quản trị viên")).toBeTruthy();
    expect(screen.getByLabelText("Mật khẩu ban đầu")).toBeTruthy();
    expect(screen.queryByLabelText("Đường dẫn ảnh logo")).toBeNull();
    expect(dialog.textContent).toContain(
      "Logo có thể tải lên sau khi tổ chức được tạo",
    );
  });

  it("retry cùng payload dùng cùng key và không đưa secret vào cache, storage hay log", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    let postAttempt = 0;
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/organizations" && options?.method === "POST") {
        postAttempt += 1;
        return postAttempt === 1
          ? Promise.reject(new Error("Mất kết nối"))
          : Promise.resolve(succeededOperation);
      }
      return Promise.resolve([tenant]);
    });
    const { client } = renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    expect(await screen.findByText("Mất kết nối")).toBeTruthy();
    expect(organizationPostCalls()).toHaveLength(1);

    const firstKey = idempotencyKey(organizationPostCalls()[0]);
    const recovery = storedAttempt();
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(recovery ?? {}).sort()).toEqual([
      "actorId",
      "expiresAt",
      "idempotencyKey",
      "version",
    ]);
    const secretNeedles = [
      "Owner@123",
      "owner@bright.local",
      "Bright Academy Two",
      "platform-token",
      "adminPassword",
      "payload",
    ];
    const cacheSnapshot = JSON.stringify({
      mutations: client
        .getMutationCache()
        .getAll()
        .map((mutation) => mutation.state),
      queries: client
        .getQueryCache()
        .getAll()
        .map((query) => ({ queryKey: query.queryKey, state: query.state })),
    });
    const storageSnapshot = JSON.stringify(recovery);
    const logSnapshot = JSON.stringify([
      ...consoleError.mock.calls,
      ...consoleLog.mock.calls,
      ...mocks.message.error.mock.calls,
      ...mocks.message.info.mock.calls,
      ...mocks.message.success.mock.calls,
    ]);
    for (const secret of secretNeedles) {
      expect(cacheSnapshot).not.toContain(secret);
      expect(storageSnapshot).not.toContain(secret);
      expect(logSnapshot).not.toContain(secret);
    }
    expect(client.getMutationCache().getAll()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Tạo tổ chức mới" }),
      ).toBeNull(),
    );
    expect(organizationPostCalls()).toHaveLength(2);
    expect(idempotencyKey(organizationPostCalls()[1])).toBe(firstKey);
    expect(storedAttempt()).toBeNull();
  });

  it("đổi dữ liệu hoặc hủy attempt sẽ cấp key mới cho lần gửi sau", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) =>
      path === "/organizations" && options?.method === "POST"
        ? Promise.reject(new Error("Mất kết nối"))
        : Promise.resolve([tenant]),
    );
    renderPage();
    await openCreateModal();

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() => expect(organizationPostCalls()).toHaveLength(1));
    const firstKey = idempotencyKey(organizationPostCalls()[0]);

    await act(async () => mocks.onValuesChange?.());
    await waitFor(() => expect(storedAttempt()).toBeNull());
    mocks.formValues.name = "Bright Academy Changed";
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() => expect(organizationPostCalls()).toHaveLength(2));
    const secondKey = idempotencyKey(organizationPostCalls()[1]);
    expect(secondKey).not.toBe(firstKey);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(storedAttempt()).toBeNull();
    await openCreateModal();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() => expect(organizationPostCalls()).toHaveLength(3));
    expect(idempotencyKey(organizationPostCalls()[2])).not.toBe(secondKey);
  });

  it("chặn double-submit và không cho hủy trong khi POST đang chạy", async () => {
    let finishPost!: () => void;
    const pendingPost = new Promise<void>((resolve) => {
      finishPost = resolve;
    });
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) =>
      path === "/organizations" && options?.method === "POST"
        ? pendingPost.then(() => succeededOperation)
        : Promise.resolve([tenant]),
    );
    renderPage();
    await openCreateModal();
    const submit = screen.getByRole("button", { name: "Tạo tổ chức" });

    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(organizationPostCalls()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(
      screen.getByRole("dialog", { name: "Tạo tổ chức mới" }),
    ).toBeTruthy();

    finishPost();
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Tạo tổ chức mới" }),
      ).toBeNull(),
    );
  });

  it("503 đối soát một lần, không POST lại và báo thành công trung lập", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/organizations" && options?.method === "POST") {
        return Promise.reject(
          new ApiError(
            "Chưa hoàn tất",
            503,
            "TENANT_PROVISIONING_RETRYABLE",
            OPERATION_ID,
          ),
        );
      }
      if (path === `/organizations/provisioning/${OPERATION_ID}`) {
        return Promise.resolve(succeededOperation);
      }
      return Promise.resolve([tenant]);
    });
    renderPage();
    const resetsBeforeSubmit = mocks.formApi.resetFields.mock.calls.length;
    await openCreateModal();

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() =>
      expect(mocks.message.success).toHaveBeenCalledWith(
        "Đã tạo tổ chức và tài khoản quản trị",
      ),
    );
    expect(mocks.message.success).not.toHaveBeenCalledWith(
      expect.stringMatching(/dùng thử/i),
    );

    expect(organizationPostCalls()).toHaveLength(1);
    expect(statusGetCalls()).toHaveLength(1);
    expect(storedAttempt()).toBeNull();
    expect(mocks.formApi.resetFields.mock.calls.length).toBeGreaterThan(
      resetsBeforeSubmit,
    );
  });

  it("503 đối soát FAILED sẽ kết thúc attempt, xóa form và hiện lỗi bền vững", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/organizations" && options?.method === "POST") {
        return Promise.reject(
          new ApiError(
            "Chưa hoàn tất",
            503,
            "TENANT_PROVISIONING_RETRYABLE",
            OPERATION_ID,
          ),
        );
      }
      if (path === `/organizations/provisioning/${OPERATION_ID}`) {
        return Promise.resolve(failedOperation);
      }
      return Promise.resolve([tenant]);
    });
    renderPage();
    await openCreateModal();
    const resetsBeforeSubmit = mocks.formApi.resetFields.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    expect(await screen.findByText("Không thể tạo tenant")).toBeTruthy();

    expect(statusGetCalls()).toHaveLength(1);
    expect(storedAttempt()).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Tạo tổ chức mới" }),
    ).toBeNull();
    expect(mocks.formApi.resetFields.mock.calls.length).toBeGreaterThan(
      resetsBeforeSubmit,
    );
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("409 in-progress chờ Retry-After rồi đối soát đúng một lần thành PENDING", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path === "/organizations" && options?.method === "POST") {
        return Promise.reject(
          new ApiError(
            "Đang xử lý",
            409,
            "TENANT_PROVISIONING_IN_PROGRESS",
            OPERATION_ID,
            1,
          ),
        );
      }
      if (path === `/organizations/provisioning/${OPERATION_ID}`) {
        return Promise.resolve(pendingOperation);
      }
      return Promise.resolve([tenant]);
    });
    renderPage();
    await openCreateModal();
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(organizationPostCalls()).toHaveLength(1);
    expect(statusGetCalls()).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(statusGetCalls()).toHaveLength(1);
    expect(screen.getByText("Tenant vẫn đang được xử lý")).toBeTruthy();
    expect(storedAttempt()).toMatchObject({ operationId: OPERATION_ID });
    expect(organizationPostCalls()).toHaveLength(1);
  });

  it("reload đúng actor chỉ GET khi người dùng bấm kiểm tra và không tự POST", async () => {
    seedRecovery();
    mocks.apiFetch.mockImplementation((path: string) =>
      path === `/organizations/provisioning/${OPERATION_ID}`
        ? Promise.resolve(pendingOperation)
        : Promise.resolve([tenant]),
    );
    renderPage();

    expect(
      await screen.findByText("Có thao tác tạo tenant chưa được đối soát"),
    ).toBeTruthy();
    expect(statusGetCalls()).toHaveLength(0);
    expect(organizationPostCalls()).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Kiểm tra trạng thái" }),
    );
    expect(await screen.findByText("Tenant vẫn đang được xử lý")).toBeTruthy();
    expect(statusGetCalls()).toHaveLength(1);
    expect(organizationPostCalls()).toHaveLength(0);
  });

  it("recovery chưa xử lý chặn POST mới cho tới khi người dùng chọn rõ", async () => {
    seedRecovery();
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) =>
      path === "/organizations" && options?.method === "POST"
        ? Promise.reject(new Error("Mất kết nối"))
        : Promise.resolve([tenant]),
    );
    renderPage();
    await openCreateModal();
    const create = screen.getByRole("button", { name: "Tạo tổ chức" });

    expect((create as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(create);
    expect(organizationPostCalls()).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Bỏ khóa và bắt đầu mới" }),
    );
    expect(storedAttempt()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    await waitFor(() => expect(organizationPostCalls()).toHaveLength(1));
    expect(idempotencyKey(organizationPostCalls()[0])).not.toBe(RECOVERY_KEY);
  });

  it("không tiếp tục bằng retry key đã hết hạn khi tab mở lâu", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    seedRecovery(OPERATION_ID, now + 1_000);
    renderPage();
    await screen.findByText("Có thao tác tạo tenant chưa được đối soát");

    now += 1_001;
    fireEvent.click(
      screen.getByRole("button", { name: "Tiếp tục bằng đúng dữ liệu cũ" }),
    );

    expect(
      await screen.findByText("Thao tác khôi phục đã hết hạn"),
    ).toBeTruthy();
    expect(storedAttempt()).toBeNull();
    expect(
      screen.queryByRole("dialog", { name: "Tạo tổ chức mới" }),
    ).toBeNull();
    expect(organizationPostCalls()).toHaveLength(0);
  });

  it("terminal conflict đóng modal, xóa recovery và reset mật khẩu", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) =>
      path === "/organizations" && options?.method === "POST"
        ? Promise.reject(
            new ApiError(
              "Email quản trị đã được sử dụng",
              409,
              "ADMIN_EMAIL_CONFLICT",
              OPERATION_ID,
            ),
          )
        : Promise.resolve([tenant]),
    );
    renderPage();
    await openCreateModal();
    const resetsBeforeSubmit = mocks.formApi.resetFields.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    expect(await screen.findByText("Không thể tạo tenant")).toBeTruthy();
    expect(screen.getByText(OPERATION_ID)).toBeTruthy();

    expect(
      screen.queryByRole("dialog", { name: "Tạo tổ chức mới" }),
    ).toBeNull();
    expect(storedAttempt()).toBeNull();
    expect(mocks.formApi.resetFields.mock.calls.length).toBeGreaterThan(
      resetsBeforeSubmit,
    );
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("không coi envelope success giả là tenant đã tạo", async () => {
    mocks.apiFetch.mockImplementation((path: string, options?: RequestInit) =>
      path === "/organizations" && options?.method === "POST"
        ? Promise.resolve({ ...succeededOperation, organization: null })
        : Promise.resolve([tenant]),
    );
    renderPage();
    await openCreateModal();
    const resetsBeforeSubmit = mocks.formApi.resetFields.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Tạo tổ chức" }));
    expect(
      await screen.findByText("Máy chủ trả trạng thái tạo tenant không hợp lệ"),
    ).toBeTruthy();

    expect(
      screen.getByRole("dialog", { name: "Tạo tổ chức mới" }),
    ).toBeTruthy();
    expect(storedAttempt()).not.toBeNull();
    expect(mocks.formApi.resetFields).toHaveBeenCalledTimes(resetsBeforeSubmit);
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("StrictMode + unmount hủy status GET và không phát side effect muộn", async () => {
    seedRecovery();
    let finishStatus!: (value: typeof succeededOperation) => void;
    const pendingStatus = new Promise<typeof succeededOperation>((resolve) => {
      finishStatus = resolve;
    });
    mocks.apiFetch.mockImplementation((path: string) =>
      path === `/organizations/provisioning/${OPERATION_ID}`
        ? pendingStatus
        : Promise.resolve([tenant]),
    );
    const { client, unmount } = renderPage({ strict: true });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByText("Có thao tác tạo tenant chưa được đối soát");

    fireEvent.click(
      screen.getByRole("button", { name: "Kiểm tra trạng thái" }),
    );
    await waitFor(() => expect(statusGetCalls()).toHaveLength(1));
    const statusSignal = (statusGetCalls()[0][1] as RequestInit).signal;
    unmount();
    finishStatus(succeededOperation);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(statusSignal?.aborted).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
    expect(mocks.message.success).not.toHaveBeenCalled();
    expect(storedAttempt()).toMatchObject({ operationId: OPERATION_ID });
  });
});
