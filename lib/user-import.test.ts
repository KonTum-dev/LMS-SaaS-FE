import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  createImportedInvitations,
  parseUserImportCsv,
  userImportResultsCsv,
} from "./user-import";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

describe("user CSV import", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it("normalizes Vietnamese headers, quoted names, roles and default learner", () => {
    const preview = parseUserImportCsv(
      '\uFEFFEmail,Họ tên,Vai trò\r\nAN@EXAMPLE.COM,"Nguyễn, Văn An",học viên\r\nparent@example.com,Nguyễn Thị Mai,phụ huynh\r\nteacher@example.com,Thầy Nam,',
    );

    expect(preview.errors).toEqual([]);
    expect(preview.invalidCount).toBe(0);
    expect(preview.rows).toEqual([
      expect.objectContaining({
        displayName: "Nguyễn, Văn An",
        email: "an@example.com",
        role: "LEARNER",
        valid: true,
      }),
      expect.objectContaining({ role: "GUARDIAN", valid: true }),
      expect.objectContaining({ role: "LEARNER", valid: true }),
    ]);
  });

  it("reports duplicate emails and row-level validation", () => {
    const preview = parseUserImportCsv(
      "email,fullName,role\nwrong,T,alien\nDUP@example.com,Nguyễn Văn A,LEARNER\ndup@example.com,Nguyễn Văn B,LEARNER",
    );

    expect(preview.totalCount).toBe(3);
    expect(preview.validCount).toBe(1);
    expect(preview.invalidCount).toBe(2);
    expect(preview.rows[0].errors).toEqual([
      "Email không hợp lệ",
      "Họ tên phải từ 2 đến 160 ký tự",
      "Vai trò không hợp lệ",
    ]);
    expect(preview.rows[2].errors).toContain("Email bị trùng trong tệp");
  });

  it("fails the preview closed when required headers are missing", () => {
    const preview = parseUserImportCsv("mail,nickname\na@example.com,An");

    expect(preview.errors).toEqual([
      "Thiếu cột email",
      "Thiếu cột fullName (hoặc name/ho_ten)",
    ]);
    expect(preview.validCount).toBe(0);
  });

  it("creates invitations sequentially and keeps per-row failures", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        acceptPath: "/invite/secret-a",
        invitation: { _id: "invite-a" },
        token: "secret-a",
      } as never)
      .mockRejectedValueOnce(new Error("Email đã tồn tại"));
    const rows = parseUserImportCsv(
      "email,fullName,role\na@example.com,Nguyễn Văn A,LEARNER\nb@example.com,Nguyễn Văn B,GUARDIAN",
    ).rows;

    const result = await createImportedInvitations(
      rows,
      "tenant-token",
      "https://lms.example.com",
      " branch-1 ",
    );

    expect(apiFetch).toHaveBeenNthCalledWith(1, "/users/invitations", {
      body: JSON.stringify({
        displayName: "Nguyễn Văn A",
        email: "a@example.com",
        orgUnitId: "branch-1",
        role: "LEARNER",
      }),
      method: "POST",
      token: "tenant-token",
    });
    expect(result[0]).toMatchObject({
      acceptUrl: "https://lms.example.com/invite/secret-a",
      status: "CREATED",
    });
    expect(result[1]).toMatchObject({
      error: "Email đã tồn tại",
      status: "FAILED",
    });
  });

  it("quotes result CSV and neutralizes spreadsheet formulas", () => {
    const csv = userImportResultsCsv([
      {
        displayName: "=IMPORTXML(1)",
        email: "safe@example.com",
        errors: [],
        role: "LEARNER",
        rowNumber: 2,
        status: "CREATED",
        valid: true,
      },
    ]);

    expect(csv).toContain("'=IMPORTXML(1)");
    expect(csv.split("\n")).toHaveLength(2);
  });
});
