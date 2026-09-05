import { ApiError, apiFetch } from "@/lib/api";

export type PlatformAccountRole = "SUPER_ADMIN" | null;
export type PlatformAccountStatus = "ACTIVE" | "INACTIVE";

export interface AdminAccount {
  _id: string;
  email: string;
  fullName: string;
  status: PlatformAccountStatus;
  platformRole: PlatformAccountRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccountDetail extends AdminAccount {
  memberships: Array<{
    membershipId: string;
    tenantId: string;
    tenantName: string | null;
    tenantSlug: string | null;
    role: "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER" | "GUARDIAN";
    status: PlatformAccountStatus;
  }>;
  audit: Array<{
    _id: string;
    action: string;
    actorId: string;
    reason: string;
    status: "PENDING" | "SUCCEEDED" | "FAILED";
    createdAt: string;
    completedAt?: string | null;
    failureCode?: string | null;
  }>;
}

export interface AdminAccountsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: PlatformAccountStatus;
  platformRole?: "SUPER_ADMIN" | "USER";
}

export interface AdminAccountsPage {
  items: AdminAccount[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAdminAccountInput {
  email: string;
  fullName: string;
  password: string;
  platformRole: PlatformAccountRole;
  reason: string;
}

export interface UpdateAdminAccountInput {
  fullName?: string;
  platformRole?: PlatformAccountRole;
  reason: string;
}

interface Context {
  token: string;
  signal?: AbortSignal;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;
const membershipRoles = new Set([
  "TENANT_ADMIN",
  "INSTRUCTOR",
  "LEARNER",
  "GUARDIAN",
]);

function invalidResponse(): never {
  throw new ApiError(
    "Dữ liệu tài khoản trả về không hợp lệ. Hãy tải lại trước khi thao tác tiếp.",
    502,
    "ADMIN_ACCOUNTS_RESPONSE_INVALID",
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalidResponse();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") return invalidResponse();
  return value;
}

function id(value: unknown): string {
  const result = text(value);
  if (!OBJECT_ID.test(result)) return invalidResponse();
  return result.toLowerCase();
}

function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) return invalidResponse();
  return result;
}

function status(value: unknown): PlatformAccountStatus {
  if (value !== "ACTIVE" && value !== "INACTIVE") return invalidResponse();
  return value;
}

export function parseAdminAccount(value: unknown): AdminAccount {
  const item = record(value);
  if (item.platformRole !== null && item.platformRole !== "SUPER_ADMIN")
    return invalidResponse();
  return {
    _id: id(item._id),
    email: text(item.email),
    fullName: text(item.fullName),
    status: status(item.status),
    platformRole: item.platformRole,
    createdAt: date(item.createdAt),
    updatedAt: date(item.updatedAt),
  };
}

export function parseAdminAccountDetail(value: unknown): AdminAccountDetail {
  const item = record(value);
  if (!Array.isArray(item.memberships) || !Array.isArray(item.audit))
    return invalidResponse();
  return {
    ...parseAdminAccount(item),
    memberships: item.memberships.map((value) => {
      const membership = record(value);
      const role = text(membership.role);
      if (!membershipRoles.has(role)) return invalidResponse();
      return {
        membershipId: id(membership.membershipId),
        tenantId: id(membership.tenantId),
        tenantName:
          membership.tenantName === null ? null : text(membership.tenantName),
        tenantSlug:
          membership.tenantSlug === null ? null : text(membership.tenantSlug),
        role: role as AdminAccountDetail["memberships"][number]["role"],
        status: status(membership.status),
      };
    }),
    audit: item.audit.map((value) => {
      const audit = record(value);
      if (!["PENDING", "SUCCEEDED", "FAILED"].includes(text(audit.status)))
        return invalidResponse();
      return {
        _id: id(audit._id),
        action: text(audit.action),
        actorId: id(audit.actorId),
        reason: text(audit.reason),
        status: audit.status as AdminAccountDetail["audit"][number]["status"],
        createdAt: date(audit.createdAt),
        ...(audit.completedAt === undefined
          ? {}
          : {
              completedAt:
                audit.completedAt === null ? null : date(audit.completedAt),
            }),
        ...(audit.failureCode === undefined
          ? {}
          : {
              failureCode:
                audit.failureCode === null ? null : text(audit.failureCode),
            }),
      };
    }),
  };
}

function invalidInput(message: string): never {
  throw new ApiError(message, 400, "ADMIN_ACCOUNTS_INPUT_INVALID");
}

function accountPath(accountId: string): string {
  if (!OBJECT_ID.test(accountId))
    return invalidInput("Mã tài khoản không hợp lệ");
  return `/admin/accounts/${accountId.toLowerCase()}`;
}

export function buildAdminAccountsPath(query: AdminAccountsQuery): string {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    query.page > 100000 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100
  ) {
    return invalidInput("Phân trang không hợp lệ");
  }
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  const search = query.search?.trim();
  if (search) {
    if (search.length > 100) return invalidInput("Từ khóa tối đa 100 ký tự");
    params.set("search", search);
  }
  if (query.status) {
    if (!["ACTIVE", "INACTIVE"].includes(query.status))
      return invalidInput("Trạng thái không hợp lệ");
    params.set("status", query.status);
  }
  if (query.platformRole) {
    if (!["SUPER_ADMIN", "USER"].includes(query.platformRole))
      return invalidInput("Vai trò không hợp lệ");
    params.set("platformRole", query.platformRole);
  }
  return `/admin/accounts?${params}`;
}

export function parseAdminAccountsPage(
  value: unknown,
  query: AdminAccountsQuery,
): AdminAccountsPage {
  const result = record(value);
  if (
    !Array.isArray(result.items) ||
    !Number.isSafeInteger(result.total) ||
    Number(result.total) < 0 ||
    result.page !== query.page ||
    result.limit !== query.limit ||
    result.items.length > query.limit
  )
    return invalidResponse();
  const items = result.items.map(parseAdminAccount);
  if (
    items.some(
      (item) =>
        (query.status && item.status !== query.status) ||
        (query.platformRole === "SUPER_ADMIN" &&
          item.platformRole !== "SUPER_ADMIN") ||
        (query.platformRole === "USER" && item.platformRole !== null),
    )
  )
    return invalidResponse();
  return {
    items,
    total: Number(result.total),
    page: query.page,
    limit: query.limit,
  };
}

export function adminAccountPasswordError(password: string): string | null {
  if (Array.from(password).length < 12)
    return "Mật khẩu phải có ít nhất 12 ký tự";
  if (new TextEncoder().encode(password).byteLength > 72)
    return "Mật khẩu không được vượt quá 72 byte UTF-8";
  return null;
}

function reasonInput(reason: string): { reason: string } {
  const normalized = reason.trim();
  if (normalized.length < 5 || normalized.length > 500)
    return invalidInput("Lý do phải có từ 5 đến 500 ký tự");
  return { reason: normalized };
}

function nameInput(fullName: string): string {
  const normalized = fullName.trim();
  if (normalized.length < 2 || normalized.length > 160)
    return invalidInput("Họ tên phải có từ 2 đến 160 ký tự");
  return normalized;
}

function roleInput(role: PlatformAccountRole): PlatformAccountRole {
  if (role !== null && role !== "SUPER_ADMIN")
    return invalidInput("Vai trò không hợp lệ");
  return role;
}

async function mutate(
  context: Context,
  path: string,
  method: string,
  body: object,
): Promise<AdminAccountDetail> {
  const result = parseAdminAccountDetail(
    await apiFetch<unknown>(path, {
      ...context,
      cache: "no-store",
      referrerPolicy: "no-referrer",
      method,
      body: JSON.stringify(body),
    }),
  );
  const targetId = path.split("/")[3];
  if (targetId && result._id !== targetId) return invalidResponse();
  return result;
}

export const adminAccountsApi = {
  async list(
    context: Context,
    query: AdminAccountsQuery,
  ): Promise<AdminAccountsPage> {
    return parseAdminAccountsPage(
      await apiFetch<unknown>(buildAdminAccountsPath(query), {
        ...context,
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
      query,
    );
  },
  async get(context: Context, accountId: string): Promise<AdminAccountDetail> {
    const result = parseAdminAccountDetail(
      await apiFetch<unknown>(accountPath(accountId), {
        ...context,
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
    if (result._id !== accountId.toLowerCase()) return invalidResponse();
    return result;
  },
  async create(
    context: Context,
    input: CreateAdminAccountInput,
  ): Promise<AdminAccountDetail> {
    const passwordError = adminAccountPasswordError(input.password);
    if (passwordError) return invalidInput(passwordError);
    const email = input.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return invalidInput("Email không hợp lệ");
    return mutate(context, "/admin/accounts", "POST", {
      email,
      fullName: nameInput(input.fullName),
      password: input.password,
      platformRole: roleInput(input.platformRole),
      ...reasonInput(input.reason),
    });
  },
  async update(
    context: Context,
    accountId: string,
    input: UpdateAdminAccountInput,
  ): Promise<AdminAccountDetail> {
    if (input.fullName === undefined && input.platformRole === undefined)
      return invalidInput("Cần thay đổi họ tên hoặc vai trò");
    return mutate(context, accountPath(accountId), "PATCH", {
      ...(input.fullName === undefined
        ? {}
        : { fullName: nameInput(input.fullName) }),
      ...(input.platformRole === undefined
        ? {}
        : { platformRole: roleInput(input.platformRole) }),
      ...reasonInput(input.reason),
    });
  },
  async disable(
    context: Context,
    accountId: string,
    reason: string,
  ): Promise<AdminAccountDetail> {
    return mutate(
      context,
      accountPath(accountId),
      "DELETE",
      reasonInput(reason),
    );
  },
  async restore(
    context: Context,
    accountId: string,
    reason: string,
  ): Promise<AdminAccountDetail> {
    return mutate(
      context,
      `${accountPath(accountId)}/restore`,
      "POST",
      reasonInput(reason),
    );
  },
};
