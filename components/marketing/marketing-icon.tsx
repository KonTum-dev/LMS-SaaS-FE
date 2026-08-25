"use client";

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BgColorsOutlined,
  BookOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  LockOutlined,
  MenuOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";

const icons = {
  apartment: ApartmentOutlined,
  arrowRight: ArrowRightOutlined,
  bgColors: BgColorsOutlined,
  book: BookOutlined,
  check: CheckOutlined,
  checkCircle: CheckCircleFilled,
  control: ControlOutlined,
  dashboard: DashboardOutlined,
  fileDone: FileDoneOutlined,
  lock: LockOutlined,
  menu: MenuOutlined,
  right: RightOutlined,
  safety: SafetyCertificateOutlined,
  setting: SettingOutlined,
  team: TeamOutlined,
  userSwitch: UserSwitchOutlined,
};

export function MarketingIcon({ className, name }: { className?: string; name: keyof typeof icons }) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" className={className} />;
}
