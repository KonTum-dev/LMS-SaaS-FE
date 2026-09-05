"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { authMessages } from "@/lib/i18n/auth-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";
import type { Translator } from "@/lib/i18n/translate";


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
import { FeedbackLanguageSwitcher } from "@/components/feedback/feedback-locale";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useAuth } from "@/components/providers/app-providers";
import type { UserRole } from "@/lib/types";
import { resolveSafeInternalPath } from "@/lib/safe-navigation";
import {
  getSubscriptionAccessPresentation,
  lmsModuleLabels,
} from "@/lib/entitlements";
import { getNotificationViewerScope } from "@/lib/query-keys";
import {
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
const shellMessages = { ...authMessages, ...workspacePolishMessages };

function roleLabel(
  role: UserRole,
  orgUnitScopeMode?: "GLOBAL" | "SCOPED",
): string {
  return role === "TENANT_ADMIN" && orgUnitScopeMode === "SCOPED"
    ? "Quản lý đơn vị"
    : roleLabels[role];
}

function accessDeniedMessage(decision: WorkspaceAccessDenied, t: Translator): string {
  switch (decision.reason) {
    case "MODULE_DISABLED":
      return t("Tính năng {name} không nằm trong quyền truy cập hiệu lực của tổ chức.", { name: t(decision.requiredModule ? lmsModuleLabels[decision.requiredModule] : "này") });
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
  const { t, locale, formatDate } = useI18n(shellMessages);
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
  const [switchError, setSwitchError] = useState<{ cause: unknown } | null>(null);
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(
    null,
  );
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      // Preserve the protected page, without carrying transient query credentials.
      const destination = resolveSafeInternalPath(pathname);
      router.replace(`/login?next=${encodeURIComponent(destination)}`);
    }
  }, [loading, pathname, router, user]);

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
        label: t("Tổng quan"),
      });
    }
    if (canOpen("/admin")) {
      menu.push({
        key: "/admin",
        icon: <ContactsOutlined />,
        label: t("CRM nền tảng"),
      });
    }
    if (canOpen("/admin/tenants")) {
      menu.push({
        key: "/admin/tenants",
        icon: <ApartmentOutlined />,
        label: t("Tổ chức"),
      });
    }
    if (canOpen("/admin/billing")) {
      menu.push({
        key: "/admin/billing",
        icon: <DollarOutlined />,
        label: t("Thuê bao"),
      });
    }
    if (canOpen("/admin/accounts")) {
      menu.push({
        key: "/admin/accounts",
        icon: <TeamOutlined />,
        label: t("Tài khoản nền tảng"),
      });
    }
    if (canOpen("/admin/audit")) {
      menu.push({
        key: "/admin/audit",
        icon: <AuditOutlined />,
        label: t("Nhật ký audit"),
      });
    }
    if (canOpen("/admin/notification-events")) {
      menu.push({
        key: "/admin/notification-events",
        icon: <BellOutlined />,
        label: t("Sự kiện thông báo"),
      });
    }
    if (canOpen("/users")) {
      menu.push({ key: "/users", icon: <TeamOutlined />, label: t("Người dùng") });
    }
    if (canOpen("/crm")) {
      menu.push({ key: "/crm", icon: <ContactsOutlined />, label: t("CRM / Khách hàng") });
    }
    if (canOpen("/organization")) {
      menu.push({
        key: "/organization",
        icon: <ApartmentOutlined />,
        label: t("Cơ cấu trung tâm"),
      });
    }
    if (canOpen("/organization/access")) {
      menu.push({
        key: "/organization/access",
        icon: <SafetyCertificateOutlined />,
        label: t("Phân quyền chi nhánh"),
      });
    }
    if (canOpen("/courses")) {
      menu.push({
        key: "/courses",
        icon: <BookOutlined />,
        label: user.role === "LEARNER" ? t("Khóa học của tôi") : t("Khóa học"),
      });
    }
    if (canOpen("/cohorts")) {
      menu.push({
        key: "/cohorts",
        icon: <CalendarOutlined />,
        label: t("Lớp & điểm danh"),
      });
    }
    if (canOpen("/family")) {
      menu.push({ key: "/family", icon: <BookOutlined />, label: t("Học viên của tôi") });
    }
    if (canOpen("/guardians") && user.role !== "GUARDIAN") {
      menu.push({
        key: "/guardians",
        icon: <ContactsOutlined />,
        label: t("Phụ huynh"),
      });
    }
    if (canOpen("/tuition")) {
      menu.push({
        key: "/tuition",
        icon: <WalletOutlined />,
        label: t("Học phí"),
      });
    }
    if (canOpen("/reports")) {
      menu.push({
        key: "/reports",
        icon: <BarChartOutlined />,
        label: t("Báo cáo vận hành"),
      });
    }
    if (canOpen("/communications")) {
      menu.push({
        key: "/communications",
        icon: <BellOutlined />,
        label: t("Thông báo trung tâm"),
      });
    }
    if (canOpen("/assignments")) {
      menu.push({
        key: "/assignments",
        icon: <FileDoneOutlined />,
        label: t("Bài tập"),
      });
    }
    if (canOpen("/assignments/grading")) {
      menu.push({
        key: "/assignments/grading",
        icon: <FileDoneOutlined />,
        label: t("Chấm bài"),
      });
    }
    if (canOpen("/assessments")) {
      menu.push({
        key: "/assessments",
        icon: <CheckSquareOutlined />,
        label:
          user.role === "LEARNER" ? t("Bài kiểm tra của tôi") : t("Bài kiểm tra"),
      });
    }
    if (canOpen("/billing")) {
      menu.push({
        key: "/billing",
        icon: <DollarOutlined />,
        label: t("Gói & thanh toán"),
      });
    }
    if (canOpen("/audit")) {
      menu.push({
        key: "/audit",
        icon: <AuditOutlined />,
        label: t("Nhật ký audit"),
      });
    }
    if (canOpen("/settings")) {
      menu.push({
        key: "/settings",
        icon: <SettingOutlined />,
        label: t("Tùy biến"),
      });
    }
    return menu;
  }, [effectiveAccess, organization, user, t]);

  const groupedItems = useMemo<MenuProps["items"]>(() => {
    const menu = items ?? [];
    const overview = menu.filter((item) => item?.key === "/dashboard");
    const groups = user?.role === "SUPER_ADMIN"
      ? [
          { label: t("Quản lý"), paths: ["/admin", "/admin/tenants", "/admin/billing", "/admin/accounts"] },
          { label: t("Hệ thống"), paths: ["/admin/audit", "/admin/notification-events"] },
        ]
      : [
          { label: t("Đào tạo"), paths: ["/family", "/courses", "/cohorts", "/assignments", "/assignments/grading", "/assessments"] },
          { label: t("Vận hành"), paths: ["/crm", "/guardians", "/tuition", "/reports", "/communications"] },
          { label: t("Quản trị"), paths: ["/users", "/organization", "/organization/access", "/billing", "/audit", "/settings"] },
        ];
    return [
      ...overview,
      ...groups.flatMap(({ label, paths }, index) => {
        const children = paths.flatMap((path) => menu.filter((item) => item?.key === path));
        return children.length ? [{ key: `group-${index}`, type: "group" as const, label, children }] : [];
      }),
    ];
  }, [items, t, user?.role]);

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
              {t(roleLabel(workspace.role, workspace.orgUnitScopeMode))}
              {workspace.tenantId === user?.tenantId ? ` ${t("· Hiện tại")}` : ""}
            </small>
          </span>
        ),
      })),
    [switchingTenantId, user?.tenantId, workspaces, t],
  );

  const selectWorkspace = async (tenantId: string) => {
    if (switchingRef.current || tenantId === user?.tenantId) return;
    switchingRef.current = true;
    setSwitchError(null);
    setSwitchingTenantId(tenantId);
    try {
      await switchWorkspace(tenantId);
      setDrawerOpen(false);
      router.replace("/dashboard");
    } catch (caught) {
      setSwitchError({ cause: caught });
    } finally {
      switchingRef.current = false;
      setSwitchingTenantId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="workspace-loading">
        <Spin size="large" />
        <span>{t("Đang mở không gian đào tạo...")}</span>
      </div>
    );
  }

  const primaryColor = tenantPrimaryColor(organization);
  const workspaceIdentity = (
    <Avatar
      aria-hidden="true"
      className="sider-tenant-avatar"
      data-workspace-identity={user.role === "SUPER_ADMIN" ? "platform" : "organization"}
      icon={user.role === "SUPER_ADMIN" ? <AppstoreOutlined /> : <ApartmentOutlined />}
      shape="square"
      size={34}
      src={organization?.logoUrl || undefined}
    />
  );
  const accessState = effectiveAccess
    ? getSubscriptionAccessPresentation(effectiveAccess.state)
    : null;
  const accessBanner = effectiveAccess?.trial ? (
    <Alert
      action={
        isGlobalTenantAdmin ? (
          <Button onClick={() => router.push("/billing")} size="small">
            {t("Xem gói trả phí")}</Button>
        ) : undefined
      }
      className="workspace-subscription-banner workspace-subscription-banner--compact"
      showIcon
      title={effectiveAccess.trialEndsAt ? t("Dùng thử đến {date}", { date: formatDate(effectiveAccess.trialEndsAt, { dateStyle: "medium" }) }) : t("Dùng thử miễn phí")}
      type="info"
    />
  ) : effectiveAccess?.state === "GRACE" ||
    effectiveAccess?.state === "READ_ONLY" ? (
    <Alert
      action={
        isGlobalTenantAdmin ? (
          <Button onClick={() => router.push("/billing")} size="small">
            {t("Gia hạn thuê bao")}</Button>
        ) : undefined
      }
      className="workspace-subscription-banner"
      description={
        effectiveAccess.state === "GRACE"
          ? t("Workspace vẫn hoạt động trong thời gian gia hạn{until}.", { until: effectiveAccess.graceEndsAt ? t(" đến {date}", { date: formatDate(effectiveAccess.graceEndsAt, { dateStyle: "medium", timeStyle: "short" }) }) : "" })
          : t("Bạn vẫn có thể xem dữ liệu; các thao tác tạo, sửa và xóa đã tạm khóa.")
      }
      showIcon
      title={accessState ? t(accessState.label) : undefined}
      type={effectiveAccess.state === "GRACE" ? "warning" : "error"}
    />
  ) : null;
  const menu = (
    <>
      <div className="sider-brand">
        <DxBrandLockup />
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
            aria-label={t("Chọn không gian làm việc")}
            className="sider-tenant workspace-selector"
            disabled={Boolean(switchingTenantId)}
            type="button"
          >
            {workspaceIdentity}
            <span className="sider-tenant-copy">
              <strong>{organization?.name ?? currentWorkspace?.name}</strong>
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
          {workspaceIdentity}
          <span className="sider-tenant-copy">
            <strong>{organization?.name ?? t("Toàn nền tảng")}</strong>
          </span>
        </div>
      )}
      <Menu
        aria-label={t("Điều hướng chính")}
        className="workspace-menu"
        items={groupedItems}
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
    { key: "account-role", disabled: true, label: t(roleLabel(user.role, user.orgUnitScopeMode)) },
    { type: "divider" },
    {
      key: "account-profile",
      icon: <UserOutlined />,
      label: t("Hồ sơ cá nhân"),
      onClick: () => router.push("/account/profile"),
    },
    {
      key: "account-security",
      icon: <SafetyCertificateOutlined />,
      label: t("Bảo mật tài khoản"),
      onClick: () => router.push("/account/security"),
    },
    {
      key: "account-integrations",
      icon: <AppstoreOutlined />,
      label: t("Kết nối dữ liệu"),
      onClick: () => router.push("/account/integrations"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t("Đăng xuất"),
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
        {t("Bỏ qua menu")}</a>
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
              aria-label={t("Mở menu điều hướng")}
              className="mobile-menu-button"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              type="text"
            />
            <div className="workspace-header-context">
              <span>{user.role === "SUPER_ADMIN" ? t("Quản trị") : t("Không gian làm việc")}</span>
              <strong>{activeRoute?.label || t("Không gian làm việc")}</strong>
            </div>
            <div className="workspace-header-actions">
              <FeedbackLanguageSwitcher />
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
                  aria-label={t("Mở menu tài khoản")}
                  className="header-profile"
                  type="button"
                >
                  <div className="header-profile-copy">
                    <strong>{user.fullName}</strong>
                  </div>
                  <Avatar
                    alt={t("Ảnh đại diện của {name}", { name: user.fullName })}
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
                onClose={() => setSwitchError(null)}
                showIcon
                title={describeFeedbackError(switchError.cause, locale, t("Không thể chuyển không gian làm việc")).message}
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
                      {t("Về tổng quan")}</Button>
                  }
                  status="403"
                  subTitle={t(accessDeniedMessage(access, t))}
                  title={t("Không thể mở trang này")}
                />
              </section>
            )}
          </div>
        </Layout>
      </Layout>
    </>
  );
}
