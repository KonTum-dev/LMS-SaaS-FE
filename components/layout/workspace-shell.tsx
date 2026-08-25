"use client";

import {
  ApartmentOutlined,
  BookOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Spin } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import type { LmsModule, UserRole } from "@/lib/types";
import { organizationDisplayName, organizationInitial, tenantModuleEnabled, tenantPrimaryColor } from "@/lib/workspace";

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Quản trị nền tảng",
  TENANT_ADMIN: "Quản trị tổ chức",
  INSTRUCTOR: "Giảng viên",
  LEARNER: "Học viên",
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { loading, logout, organization, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  const items = useMemo<MenuProps["items"]>(() => {
    if (!user) return [];
    const enabled = (module: LmsModule) => tenantModuleEnabled(organization, module);
    const menu: NonNullable<MenuProps["items"]> = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Tổng quan" },
    ];
    if (user.role === "SUPER_ADMIN") {
      menu.push({ key: "/admin/tenants", icon: <ApartmentOutlined />, label: "Tổ chức" });
      return menu;
    }
    if (user.role === "TENANT_ADMIN" && enabled("USERS")) {
      menu.push({ key: "/users", icon: <TeamOutlined />, label: "Người dùng" });
    }
    if (enabled("COURSES")) {
      menu.push({ key: "/courses", icon: <BookOutlined />, label: user.role === "LEARNER" ? "Khóa học của tôi" : "Khóa học" });
    }
    if (enabled("ASSIGNMENTS")) {
      menu.push({ key: "/assignments", icon: <FileDoneOutlined />, label: "Bài tập" });
    }
    if (user.role === "TENANT_ADMIN") {
      menu.push({ key: "/settings", icon: <SettingOutlined />, label: "Tùy biến" });
    }
    return menu;
  }, [organization, user]);

  if (loading || !user) {
    return <div style={{ display: "grid", minHeight: "100vh", placeItems: "center" }}><Spin size="large" tip="Đang mở workspace..." /></div>;
  }

  const organizationName = organizationDisplayName(organization?.name);
  const primaryColor = tenantPrimaryColor(organization);
  const menu = (
    <>
      <div className="sider-brand">
        <div className="brand-lockup"><Avatar shape="square" src={organization?.logoUrl || undefined} style={{ background: primaryColor }}>{organizationInitial(organization?.name)}</Avatar><span>{organizationName}</span></div>
      </div>
      <div className="sider-tenant">
        <strong>{organization?.name ?? "Toàn nền tảng"}</strong>
        <span>{organization?.slug ?? "Platform workspace"}</span>
      </div>
      <Menu
        items={items}
        mode="inline"
        onClick={({ key }) => { router.push(key); setDrawerOpen(false); }}
        selectedKeys={[pathname.startsWith("/courses/") ? "/courses" : pathname]}
        style={{ borderInlineEnd: 0, padding: "0 10px" }}
      />
    </>
  );

  const profileItems: MenuProps["items"] = [
    { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true, onClick: () => { logout(); router.replace("/login"); } },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider className="workspace-sider desktop-sider" theme="light" width={250}>{menu}</Layout.Sider>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left" styles={{ body: { padding: 0 } }} width={270}>{menu}</Drawer>
      <Layout>
        <Layout.Header className="workspace-header">
          <Button className="mobile-menu-button" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} type="text" />
          <span className="table-muted">Không gian làm việc</span>
          <Dropdown menu={{ items: profileItems }} placement="bottomRight" trigger={["click"]}>
            <button className="header-profile" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} type="button">
              <div className="header-profile-copy"><strong>{user.fullName}</strong><span>{roleLabels[user.role]}</span></div>
              <Avatar style={{ background: primaryColor }}>{Array.from(user.fullName.trim())[0]?.toLocaleUpperCase("vi") || "DX"}</Avatar>
            </button>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="workspace-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
