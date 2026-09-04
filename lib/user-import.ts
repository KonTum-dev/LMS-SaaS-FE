import { apiFetch } from "@/lib/api";
import type { InvitationIssueResponse, UserRole } from "@/lib/types";
import { buildInvitationAcceptUrl } from "@/lib/user-management";

export type ImportableUserRole = Exclude<UserRole, "SUPER_ADMIN">;

export interface UserImportPreviewRow {
  displayName: string;
  email: string;
  errors: string[];
  role: ImportableUserRole;
  rowNumber: number;
  valid: boolean;
}

export interface UserImportPreview {
  errors: string[];
  invalidCount: number;
  rows: UserImportPreviewRow[];
  totalCount: number;
  validCount: number;
}

export interface UserImportResultRow extends UserImportPreviewRow {
  acceptUrl?: string;
  error?: string;
  status: "CREATED" | "FAILED";
}

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BYTES = 1_000_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const roleAliases: Record<string, ImportableUserRole> = {
  admin: "TENANT_ADMIN",
  giao_vien: "INSTRUCTOR",
  giang_vien: "INSTRUCTOR",
  guardian: "GUARDIAN",
  hoc_vien: "LEARNER",
  instructor: "INSTRUCTOR",
  learner: "LEARNER",
  phu_huynh: "GUARDIAN",
  quan_tri: "TENANT_ADMIN",
  tenant_admin: "TENANT_ADMIN",
};

const headerAliases = {
  displayName: new Set(["display_name", "full_name", "fullname", "ho_ten", "hoten", "name", "ten"]),
  email: new Set(["email", "email_address"]),
  role: new Set(["role", "vai_tro", "vaitro"]),
};

export function parseUserImportCsv(input: string): UserImportPreview {
  const globalErrors: string[] = [];
  if (new TextEncoder().encode(input).byteLength > MAX_IMPORT_BYTES) {
    globalErrors.push("Tệp CSV không được vượt quá 1 MB");
  }
  const records = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  const [rawHeaders = [], ...rawRows] = records;
  const headers = rawHeaders.map(normalizeKey);
  const emailIndex = headers.findIndex((header) => headerAliases.email.has(header));
  const nameIndex = headers.findIndex((header) =>
    headerAliases.displayName.has(header),
  );
  const roleIndex = headers.findIndex((header) => headerAliases.role.has(header));
  if (emailIndex < 0) globalErrors.push("Thiếu cột email");
  if (nameIndex < 0) globalErrors.push("Thiếu cột fullName (hoặc name/ho_ten)");

  const nonBlankRows = rawRows.filter((cells) =>
    cells.some((cell) => cell.trim().length > 0),
  );
  if (nonBlankRows.length > MAX_IMPORT_ROWS) {
    globalErrors.push(`Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng`);
  }
  const seenEmails = new Set<string>();
  const rows = nonBlankRows.slice(0, MAX_IMPORT_ROWS).map((cells, index) => {
    const rowNumber = index + 2;
    const email = (emailIndex >= 0 ? cells[emailIndex] : "")
      ?.trim()
      .toLocaleLowerCase("en") ?? "";
    const displayName =
      (nameIndex >= 0 ? cells[nameIndex] : "")?.trim() ?? "";
    const rawRole = (roleIndex >= 0 ? cells[roleIndex] : "")?.trim();
    const role = resolveImportRole(rawRole);
    const errors: string[] = [];
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      errors.push("Email không hợp lệ");
    }
    if (displayName.length < 2 || displayName.length > 160) {
      errors.push("Họ tên phải từ 2 đến 160 ký tự");
    }
    if (!role) errors.push("Vai trò không hợp lệ");
    if (email && seenEmails.has(email)) errors.push("Email bị trùng trong tệp");
    if (email) seenEmails.add(email);
    return {
      displayName,
      email,
      errors,
      role: role ?? "LEARNER",
      rowNumber,
      valid: globalErrors.length === 0 && errors.length === 0,
    };
  });

  return {
    errors: globalErrors,
    invalidCount: rows.filter((row) => !row.valid).length,
    rows,
    totalCount: rows.length,
    validCount: rows.filter((row) => row.valid).length,
  };
}

export async function createImportedInvitations(
  rows: readonly UserImportPreviewRow[],
  token: string,
  origin: string,
  orgUnitId?: string,
): Promise<UserImportResultRow[]> {
  const normalizedOrgUnitId = orgUnitId?.trim();
  const results: UserImportResultRow[] = [];
  for (const row of rows) {
    if (!row.valid) continue;
    try {
      const response = await apiFetch<InvitationIssueResponse>(
        "/users/invitations",
        {
          body: JSON.stringify({
            displayName: row.displayName,
            email: row.email,
            ...(normalizedOrgUnitId ? { orgUnitId: normalizedOrgUnitId } : {}),
            role: row.role,
          }),
          method: "POST",
          token,
        },
      );
      results.push({
        ...row,
        acceptUrl: buildInvitationAcceptUrl(response, origin),
        status: "CREATED",
      });
    } catch (caught) {
      results.push({
        ...row,
        error: caught instanceof Error ? caught.message : "Không thể tạo lời mời",
        status: "FAILED",
      });
    }
  }
  return results;
}

export function userImportResultsCsv(
  rows: readonly UserImportResultRow[],
): string {
  const values = [
    ["row", "email", "fullName", "role", "status", "acceptUrl", "error"],
    ...rows.map((row) => [
      String(row.rowNumber),
      row.email,
      row.displayName,
      row.role,
      row.status,
      row.acceptUrl ?? "",
      row.error ?? "",
    ]),
  ];
  return values.map((row) => row.map(quoteCsvCell).join(",")).join("\n");
}

function parseCsvRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      if (character === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      value += character;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveImportRole(value?: string): ImportableUserRole | null {
  if (!value) return "LEARNER";
  const normalized = normalizeKey(value);
  if (
    normalized === "tenant_admin" ||
    normalized === "instructor" ||
    normalized === "learner" ||
    normalized === "guardian"
  ) {
    return normalized.toUpperCase() as ImportableUserRole;
  }
  return roleAliases[normalized] ?? null;
}

function quoteCsvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe)
    ? `"${safe.replaceAll('"', '""')}"`
    : safe;
}
