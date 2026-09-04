import { describe, expect, it } from "vitest";
import {
  adminTenantMemberEndpoint,
  buildInvitationAcceptUrl,
  buildInvitationPayload,
  buildCreateUserPayload,
  buildUpdateUserPayload,
  buildUserOrgUnitOptions,
  canManageInvitation,
  sanitizeInvitationList,
  userIdentityId,
  userRoleLabels,
} from "./user-management";

describe("user management payloads", () => {
  it("chuẩn hóa tài khoản mới và chỉ gửi các trường backend cho phép", () => {
    expect(buildCreateUserPayload({
      email: "  LEARNER@BRIGHT.LOCAL ",
      fullName: "  Học viên mới  ",
      password: "Student@123",
      role: "LEARNER",
      status: "INACTIVE",
    })).toEqual({
      email: "learner@bright.local",
      fullName: "Học viên mới",
      password: "Student@123",
      role: "LEARNER",
    });
  });

  it("không để email hoặc mật khẩu cũ lọt vào thao tác cập nhật", () => {
    expect(buildUpdateUserPayload({
      email: "old@bright.local",
      fullName: "  Quản trị mới  ",
      password: "MustNotLeak",
      role: "TENANT_ADMIN",
      status: "ACTIVE",
    })).toEqual({
      displayName: "Quản trị mới",
      role: "TENANT_ADMIN",
      status: "ACTIVE",
    });
  });

  it("chuẩn hóa cơ sở chính cho create, update và invitation", () => {
    expect(
      buildCreateUserPayload({
        email: "learner@bright.local",
        fullName: "Học viên mới",
        orgUnitId: "  branch-1  ",
        password: "Student@123",
        role: "LEARNER",
      }),
    ).toMatchObject({ orgUnitId: "branch-1" });
    expect(
      buildUpdateUserPayload({
        email: "learner@bright.local",
        fullName: "Học viên mới",
        orgUnitId: null,
        role: "LEARNER",
      }),
    ).toMatchObject({ orgUnitId: null });
    expect(
      buildInvitationPayload({
        email: "learner@bright.local",
        orgUnitId: " branch-1 ",
        role: "LEARNER",
      }),
    ).toMatchObject({ orgUnitId: "branch-1" });
  });

  it("tạo danh sách cơ sở theo đường dẫn và bỏ đơn vị đã lưu trữ", () => {
    expect(
      buildUserOrgUnitOptions([
        {
          _id: "root-1",
          ancestorIds: [],
          archivedAt: null,
          archivedBy: null,
          children: [
            {
              _id: "branch-1",
              ancestorIds: ["root-1"],
              archivedAt: null,
              archivedBy: null,
              children: [],
              code: "q1",
              createdBy: "owner-1",
              depth: 1,
              name: "Cơ sở Quận 1",
              parentId: "root-1",
              path: ["root-1"],
              policyOverrides: {},
              revision: 1,
              status: "ACTIVE",
              tenantId: "tenant-1",
              timezone: "Asia/Ho_Chi_Minh",
              type: "BRANCH",
              updatedBy: "owner-1",
            },
          ],
          code: "bright",
          createdBy: "owner-1",
          depth: 0,
          name: "Bright Academy",
          parentId: null,
          path: [],
          policyOverrides: {},
          revision: 1,
          status: "ACTIVE",
          tenantId: "tenant-1",
          timezone: "Asia/Ho_Chi_Minh",
          type: "ROOT",
          updatedBy: "owner-1",
        },
        {
          _id: "archived-1",
          ancestorIds: [],
          archivedAt: "2026-01-01T00:00:00.000Z",
          archivedBy: "owner-1",
          children: [],
          code: "old",
          createdBy: "owner-1",
          depth: 0,
          name: "Cơ sở cũ",
          parentId: null,
          path: [],
          policyOverrides: {},
          revision: 2,
          status: "ARCHIVED",
          tenantId: "tenant-1",
          timezone: "Asia/Ho_Chi_Minh",
          type: "BRANCH",
          updatedBy: "owner-1",
        },
      ]),
    ).toEqual([
      { label: "Bright Academy · Trung tâm", value: "root-1" },
      {
        label: "Bright Academy / Cơ sở Quận 1 · Chi nhánh",
        value: "branch-1",
      },
    ]);
  });

  it("dùng global userId cho tenant member và giữ _id cho learner legacy", () => {
    expect(userIdentityId({ _id: "membership-1", userId: "user-1" })).toBe("user-1");
    expect(userIdentityId({ _id: "user-2" })).toBe("user-2");
  });

  it("có nhãn tiếng Việt cho mọi vai trò có thể quản lý trong tenant", () => {
    expect(userRoleLabels).toEqual({
      GUARDIAN: "Phụ huynh",
      INSTRUCTOR: "Giảng viên",
      LEARNER: "Học viên",
      TENANT_ADMIN: "Quản trị tổ chức",
    });
  });

  it("chuẩn hóa invitation và bỏ tên hiển thị rỗng", () => {
    expect(buildInvitationPayload({
      displayName: "  Học viên mời  ",
      email: "  INVITED@BRIGHT.TEST ",
      role: "LEARNER",
    })).toEqual({
      displayName: "Học viên mời",
      email: "invited@bright.test",
      role: "LEARNER",
    });
    expect(buildInvitationPayload({ email: "a@b.test", displayName: "  ", role: "INSTRUCTOR" }))
      .toEqual({ email: "a@b.test", role: "INSTRUCTOR" });
  });

  it("cho gửi lại invitation pending/expired nhưng khóa claimed và trạng thái cuối", () => {
    expect(canManageInvitation("PENDING")).toBe(true);
    expect(canManageInvitation("EXPIRED")).toBe(true);
    for (const status of ["CLAIMED", "ACCEPTED", "REVOKED"] as const) {
      expect(canManageInvitation(status)).toBe(false);
    }
  });

  it("chỉ tin acceptPath cùng origin và fallback sang token server", () => {
    const response = {
      acceptPath: "/invite/new-token",
      invitation: {} as never,
      token: "new-token",
    };
    expect(buildInvitationAcceptUrl(response, "https://lms.example"))
      .toBe("https://lms.example/invite/new-token");
    expect(buildInvitationAcceptUrl({ ...response, acceptPath: "https://evil.test/steal" }, "https://lms.example"))
      .toBe("https://lms.example/invite/new-token");
  });

  it("tạo endpoint super-admin bằng membershipId thay vì global userId", () => {
    expect(adminTenantMemberEndpoint("tenant-1", "membership-1"))
      .toBe("/users/tenants/tenant-1/membership-1");
  });

  it("không cho token hoặc tokenHash từ list response lọt vào React Query cache", () => {
    const unsafe = {
      _id: "invite-1",
      createdAt: "2026-08-01T00:00:00.000Z",
      email: "learner@example.test",
      expiresAt: "2026-09-01T00:00:00.000Z",
      invitedBy: "owner-1",
      orgUnitId: "branch-1",
      role: "LEARNER" as const,
      status: "PENDING" as const,
      tenantId: "tenant-1",
      token: "must-not-cache",
      tokenHash: "must-not-cache-either",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };

    const [safe] = sanitizeInvitationList([unsafe]);

    expect(safe).not.toHaveProperty("token");
    expect(safe).not.toHaveProperty("tokenHash");
    expect(safe).toMatchObject({
      _id: "invite-1",
      email: "learner@example.test",
      orgUnitId: "branch-1",
    });
  });
});
