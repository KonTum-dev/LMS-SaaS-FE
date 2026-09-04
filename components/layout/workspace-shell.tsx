"use client";

import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ContactsOutlined,
  DownOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileDoneOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Result,
  Spin,
} from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DxBrandLockup } from "@/components/brand/dx-brand-lockup";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useAuth } from "@/components/providers/app-providers";
import type { UserRole } from "@/lib/types";
import {
  getSubscriptionAccessPresentation,
  lmsModuleLabels,
} from "@/lib/entitlements";
import { getNotificationViewerScope } from "@/lib/query-keys";
import {
  organizationDisplayName,
  organizationInitial,
  tenantPrimaryColor,
} from "@/lib/workspace";
import {
  canAccessWorkspaceRoute,
  getWorkspaceRouteAccess,
  type WorkspaceAccessDenied,
} from "@/lib/workspace-access";

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Quản trị nền tảng",
  TENANT_ADMIN: "Quản trị tổ chức",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
  GUARDIAN: "Phụ huynh",
};

function roleLabel(
  role: UserRole,
  orgUnitScopeMode?: "GLOBAL" | "SCOPED",
): string {
  return role === "TENANT_ADMIN" && orgUnitScopeMode === "SCOPED"
    ? "Quản lý đơn vị"
    : roleLabels[role];
}

const accessDate = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function accessDeniedMessage(decision: WorkspaceAccessDenied): string {
  switch (decision.reason) {
    case "MODULE_DISABLED":
      return `Tính năng ${decision.requiredModule ? lmsModuleLabels[decision.requiredModule] : "này"} không nằm trong quyền truy cập hiệu lực của tổ chức.`;
    case "ORGANIZATION_REQUIRED":
      return "Không tìm thấy cấu hình tổ chức cho phiên đăng nhập hiện tại.";
    case "GLOBAL_ADMIN_REQUIRED":
      return "Khu vực này chỉ dành cho quản trị viên toàn tổ chức; tài khoản của bạn đang được giới hạn theo đơn vị.";
    case "ROLE_NOT_ALLOWED":
      return "Vai trò của bạn không được phép truy cập khu vực này.";
    case "SUBSCRIPTION_REQUIRED":
      return "Tổ chức chưa có thuê bao hiệu lực cho khu vực học tập này.";
    case "UNKNOWN_ROUTE":
      return "Trang này chưa thuộc một khu vực làm việc được hỗ trợ.";
    case "SIGNED_OUT":
      return "Vui lòng đăng nhập lại để tiếp tục.";
  }
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const {
    effectiveAccess,
    loading,
    logout,
    organization,
    switchWorkspace,
    token,
    user,
    workspaces,
  } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(
    null,
  );
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const items = useMemo<MenuProps["items"]>(() => {
    if (!user) return [];
    const canOpen = (path: string) =>
      canAccessWorkspaceRoute({
        effectiveAccess,
        organization,
        pathname: path,
        user,
      });
    const menu: NonNullable<MenuProps["items"]> = [];
    if (canOpen("/dashboard")) {
      menu.push({
        key: "/dashboard",
        icon: <DashboardOutlined />,
        label: "Tổng quan",
      });
    }
    if (canOpen("/admin")) {
      menu.push({
        key: "/admin",
        icon: <ContactsOutlined />,
        label: "CRM nền tảng",
      });
    }
    if (canOpen("/admin/tenants")) {
      menu.push({
        key: "/admin/tenants",
        icon: <ApartmentOutlined />,
        label: "Tổ chức",
      });
    }
    if (canOpen("/admin/billing")) {
      menu.push({
        key: "/admin/billing",
        icon: <DollarOutlined />,
        label: "Thuê bao",
      });
    }
    if (canOpen("/admin/audit")) {
      menu.push({
        key: "/admin/audit",
        icon: <AuditOutlined />,
        label: "Nhật ký audit",
      });
    }
    if (canOpen("/admin/notification-events")) {
      menu.push({
        key: "/admin/notification-events",
        icon: <BellOutlined />,
        label: "Sự kiện thông báo",
      });
    }
    if (canOpen("/users")) {
      menu.push({ key: "/users", icon: <TeamOutlined />, label: "Người dùng" });
    }
    if (canOpen("/organization")) {
      menu.push({
        key: "/organization",
        icon: <ApartmentOutlined />,
        label: "Cơ cấu trung tâm",
      });
    }
    if (canOpen("/organization/access")) {
      menu.push({
        key: "/organization/access",
        icon: <SafetyCertificateOutlined />,
        label: "Phân quyền chi nhánh",
      });
    }
    if (canOpen("/courses")) {
      menu.push({
        key: "/courses",
        icon: <BookOutlined />,
        label: user.role === "LEARNER" ? "Khóa học của tôi" : "Khóa học",
      });
    }
    if (canOpen("/cohorts")) {
      menu.push({
        key: "/cohorts",
        icon: <CalendarOutlined />,
        label: "Lớp & điểm danh",
      });
    }
    if (canOpen("/guardians")) {
      menu.push({
        key: "/guardians",
        icon: <ContactsOutlined />,
        label: user.role === "GUARDIAN" ? "Học viên của tôi" : "Phụ huynh",
      });
    }
    if (canOpen("/tuition")) {
      menu.push({
        key: "/tuition",
        icon: <WalletOutlined />,
        label: "Học phí",
      });
    }
    if (canOpen("/reports")) {
      menu.push({
        key: "/reports",
        icon: <BarChartOutlined />,
        label: "Báo cáo vận hành",
      });
    }
    if (canOpen("/communications")) {
      menu.push({
        key: "/communications",
        icon: <BellOutlined />,
        label: "Thông báo trung tâm",
      });
    }
    if (canOpen("/assignments")) {
      menu.push({
        key: "/assignments",
        icon: <FileDoneOutlined />,
        label: "Bài tập",
      });
    }
    if (canOpen("/assignments/grading")) {
      menu.push({
        key: "/assignments/grading",
        icon: <FileDoneOutlined />,
        label: "Chấm bài",
      });
    }
    if (canOpen("/assessments")) {
      menu.push({
        key: "/assessments",
        icon: <CheckSquareOutlined />,
        label:
          user.role === "LEARNER" ? "Bài kiểm tra của tôi" : "Bài kiểm tra",
      });
    }
    if (canOpen("/billing")) {
      menu.push({
        key: "/billing",
        icon: <DollarOutlined />,
        label: "Gói & thanh toán",
      });
    }
    if (canOpen("/audit")) {
      menu.push({
        key: "/audit",
        icon: <AuditOutlined />,
        label: "Nhật ký audit",
      });
    }
    if (canOpen("/settings")) {
      menu.push({
        key: "/settings",
        icon: <SettingOutlined />,
        label: "Tùy biến",
      });
    }
    return menu;
  }, [effectiveAccess, organization, user]);

  const routes = useMemo(
    () =>
      (items ?? []).flatMap((item) => {
        if (!item || !("key" in item) || typeof item.key !== "string")
          return [];
        return [
          {
            key: item.key,
            label:
              "label" in item && typeof item.label === "string"
                ? item.label
                : "",
          },
        ];
      }),
    [items],
  );
  const activeRoute = useMemo(
    () =>
      [...routes]
        .sort((first, second) => second.key.length - first.key.length)
        .find(
          (route) =>
            pathname === route.key || pathname.startsWith(`${route.key}/`),
        ),
    [pathname, routes],
  );
  const access = useMemo(
    () =>
      getWorkspaceRouteAccess({
        effectiveAccess,
        organization,
        pathname,
        user,
      }),
    [effectiveAccess, organization, pathname, user],
  );
  const canSwitchWorkspace =
    user?.role !== "SUPER_ADMIN" && workspaces.length > 1;
  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.tenantId === user?.tenantId),
    [user?.tenantId, workspaces],
  );
  const isGlobalTenantAdmin =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode !== "SCOPED";
  const notificationScope = useMemo(
    () => getNotificationViewerScope(user),
    [user],
  );
  const workspaceItems = useMemo<MenuProps["items"]>(
    () =>
      workspaces.map((workspace) => ({
        disabled:
          Boolean(switchingTenantId) || workspace.tenantId === user?.tenantId,
        key: workspace.tenantId,
        label: (
          <span className="workspace-option">
            <strong>{workspace.name}</strong>
            <small>
              {roleLabel(workspace.role, workspace.orgUnitScopeMode)}
              {workspace.tenantId === user?.tenantId ? " · Hiện tại" : ""}
            </small>
          </span>
        ),
      })),
    [switchingTenantId, user?.tenantId, workspaces],
  );

  const selectWorkspace = async (tenantId: string) => {
    if (switchingRef.current || tenantId === user?.tenantId) return;
    switchingRef.current = true;
    setSwitchError("");
    setSwitchingTenantId(tenantId);
    try {
      await switchWorkspace(tenantId);
      setDrawerOpen(false);
      router.replace("/dashboard");
    } catch (caught) {
      setSwitchError(
        caught instanceof Error
          ? caught.message
          : "Không thể chuyển không gian làm việc",
      );
    } finally {
      switchingRef.current = false;
      setSwitchingTenantId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="workspace-loading">
        <Spin size="large" />
        <span>Đang mở không gian đào tạo...</span>
      </div>
    );
  }

  const organizationName = organizationDisplayName(organization?.name);
  const primaryColor = tenantPrimaryColor(organization);
  const accessState = effectiveAccess
    ? getSubscriptionAccessPresentation(effectiveAccess.state)
    : null;
  const accessBanner = effectiveAccess?.trial ? (
    <Alert
      action={
        isGlobalTenantAdmin ? (
          <Button onClick={() => router.push("/billing")} size="small">
            Xem gói trả phí
          </Button>
        ) : undefined
      }
      className="workspace-subscription-banner"
      description={`Bạn đang dùng thử miễn phí với quyền truy cập hiện được cấp cho workspace${effectiveAccess.trialEndsAt ? ` đến ${accessDate.format(new Date(effectiveAccess.trialEndsAt))}` : ""}.`}
      showIcon
      title="Dùng thử miễn phí"
      type="info"
    />
  ) : effectiveAccess?.state === "GRACE" ||
    effectiveAccess?.state === "READ_ONLY" ? (
    <Alert
      action={
        isGlobalTenantAdmin ? (
          <Button onClick={() => router.push("/billing")} size="small">
            Gia hạn thuê bao
          </Button>
        ) : undefined
      }
      className="workspace-subscription-banner"
      description={
        effectiveAccess.state === "GRACE"
          ? `Workspace vẫn hoạt động trong thời gian gia hạn${effectiveAccess.graceEndsAt ? ` đến ${accessDate.format(new Date(effectiveAccess.graceEndsAt))}` : ""}.`
          : "Bạn vẫn có thể xem dữ liệu; các thao tác tạo, sửa và xóa đã tạm khóa."
      }
      showIcon
      title={accessState?.label}
      type={effectiveAccess.state === "GRACE" ? "warning" : "error"}
    />
  ) : null;
  const menu = (
    <>
      <div className="sider-brand">
        <DxBrandLockup subtitle="Nền tảng đào tạo" />
      </div>
      {canSwitchWorkspace ? (
        <Dropdown
          menu={{
            items: workspaceItems,
            onClick: ({ key }) => void selectWorkspace(String(key)),
          }}
          placement="bottomLeft"
          trigger={["click"]}
        >
          <button
            aria-label="Chọn không gian làm việc"
            className="sider-tenant workspace-selector"
            disabled={Boolean(switchingTenantId)}
            type="button"
          >
            <Avatar
              shape="square"
              src={organization?.logoUrl || undefined}
              style={{ background: primaryColor }}
            >
              {organizationInitial(organization?.name)}
            </Avatar>
            <span>
              <small>Không gian hiện tại</small>
              <strong>{organization?.name ?? currentWorkspace?.name}</strong>
              <small>{roleLabel(user.role, user.orgUnitScopeMode)}</small>
            </span>
            {switchingTenantId ? (
              <Spin size="small" />
            ) : (
              <DownOutlined aria-hidden="true" />
            )}
          </button>
        </Dropdown>
      ) : (
        <div className="sider-tenant">
          <Avatar
            shape="square"
            src={organization?.logoUrl || undefined}
            style={{ background: primaryColor }}
          >
            {organizationInitial(organization?.name)}
          </Avatar>
          <span>
            <small>Không gian hiện tại</small>
            <strong>{organization?.name ?? "Toàn nền tảng"}</strong>
            <small>{roleLabel(user.role, user.orgUnitScopeMode)}</small>
          </span>
        </div>
      )}
      <Menu
        aria-label="Điều hướng chính"
        className="workspace-menu"
        items={items}
        mode="inline"
        onClick={({ key }) => {
          router.push(key);
          setDrawerOpen(false);
        }}
        selectedKeys={[activeRoute?.key ?? pathname]}
      />
    </>
  );

  const profileItems: MenuProps["items"] = [
    {
      key: "account-profile",
      icon: <UserOutlined />,
      label: "Hồ sơ cá nhân",
      onClick: () => router.push("/account/profile"),
    },
    {
      key: "account-security",
      icon: <SafetyCertificateOutlined />,
      label: "Bảo mật tài khoản",
      onClick: () => router.push("/account/security"),
    },
    {
      key: "account-integrations",
      icon: <AppstoreOutlined />,
      label: "Ứng dụng kết nối",
      onClick: () => router.push("/account/integrations"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: () => {
        logout();
        router.replace("/login");
      },
    },
  ];

  return (
    <>
      <a className="workspace-skip-link" href="#workspace-main">
        Bỏ qua menu
      </a>
      <Layout className="workspace-layout">
        <Layout.Sider
          className="workspace-sider desktop-sider"
          theme="light"
          width={232}
        >
          {menu}
        </Layout.Sider>
        <Drawer
          className="workspace-drawer"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size={280}
          styles={{ body: { padding: 0 } }}
        >
          {menu}
        </Drawer>
        <Layout>
          <Layout.Header className="workspace-header">
            <Button
              aria-label="Mở menu điều hướng"
              className="mobile-menu-button"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              type="text"
            />
            <div className="workspace-header-context">
              <span>{organizationName}</span>
              <strong>{activeRoute?.label || "Không gian làm việc"}</strong>
            </div>
            <div className="workspace-header-actions">
              {notificationScope && token ? (
                <NotificationCenter
                  key={`${notificationScope.tenantId}:${notificationScope.membershipId}:${notificationScope.role}`}
                  scope={notificationScope}
                  token={token}
                />
              ) : null}
              <Dropdown
                menu={{ items: profileItems }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <button
                  aria-label="Mở menu tài khoản"
                  className="header-profile"
                  type="button"
                >
                  <div className="header-profile-copy">
                    <strong>{user.fullName}</strong>
                    <span>{roleLabel(user.role, user.orgUnitScopeMode)}</span>
                  </div>
                  <Avatar
                    alt={`Ảnh đại diện của ${user.fullName}`}
                    src={user.avatarUrl || undefined}
                    style={{ background: primaryColor }}
                  >
                    {Array.from(user.fullName.trim())[0]?.toLocaleUpperCase(
                      "vi",
                    ) || "DX"}
                  </Avatar>
                </button>
              </Dropdown>
            </div>
          </Layout.Header>
          <div className="workspace-content" id="workspace-main" tabIndex={-1}>
            {switchError && (
              <Alert
                closable
                onClose={() => setSwitchError("")}
                showIcon
                title={switchError}
                type="error"
              />
            )}
            {accessBanner}
            {access.allowed ? (
              children
            ) : (
              <section aria-live="polite" className="workspace-access-denied">
                <Result
                  extra={
                    <Button
                      onClick={() => router.push("/dashboard")}
                      type="primary"
                    >
                      Về tổng quan
                    </Button>
                  }
                  status="403"
                  subTitle={accessDeniedMessage(access)}
                  title="Không thể mở trang này"
                />
              </section>
            )}
          </div>
        </Layout>
      </Layout>
    </>
  );
}
