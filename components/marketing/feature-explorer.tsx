"use client";

import {
  ApartmentOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  DollarOutlined,
  FileDoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Progress, Tabs, Tag } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import { marketingFeatures, type MarketingFeature } from "@/lib/marketing-content";
import styles from "./feature-explorer.module.css";

type FeatureGroupId = "teaching" | "classroom" | "operations" | "organization";

interface FeatureGroup {
  description: string;
  featureIds: readonly string[];
  icon: ReactNode;
  id: FeatureGroupId;
  label: string;
  outcome: string;
}

const featureGroups: readonly FeatureGroup[] = [
  {
    id: "teaching",
    label: "Giảng dạy",
    description: "Từ giáo trình đến bài tập và bài kiểm tra trong cùng một mạch nội dung.",
    outcome: "Soạn một lần, triển khai cho nhiều lớp",
    icon: <BookOutlined />,
    featureIds: ["courses-curriculum", "assignments-grading", "assessments-results"],
  },
  {
    id: "classroom",
    label: "Lớp học",
    description: "Lịch học, điểm danh, học viên và phụ huynh được cập nhật theo đúng lớp.",
    outcome: "Mỗi buổi học đều có trạng thái rõ ràng",
    icon: <CalendarOutlined />,
    featureIds: ["cohorts-attendance", "guardians-learners", "communications-scope"],
  },
  {
    id: "operations",
    label: "Vận hành",
    description: "Theo dõi học phí và báo cáo để biết việc gì cần xử lý tiếp theo.",
    outcome: "Dữ liệu vận hành trở thành hành động",
    icon: <BarChartOutlined />,
    featureIds: ["tuition-payments", "operations-reports"],
  },
  {
    id: "organization",
    label: "Tổ chức & dữ liệu",
    description: "Phân quyền theo vai trò, workspace và chi nhánh mà không trộn phạm vi.",
    outcome: "Mở rộng tổ chức nhưng vẫn kiểm soát được quyền",
    icon: <ApartmentOutlined />,
    featureIds: ["organization-structure", "communications-scope", "operations-reports"],
  },
];

function featuresFor(group: FeatureGroup): readonly MarketingFeature[] {
  return group.featureIds
    .map((id) => marketingFeatures.find((feature) => feature.id === id))
    .filter((feature) => feature !== undefined);
}

function AttendancePreview() {
  return (
    <div className={styles.productPreview} aria-label="Xem trước màn hình điểm danh">
      <PreviewHeader eyebrow="LỚP HỌC HÔM NAY" title="IELTS Foundation · 19:00" action="Đang diễn ra" />
      <div className={styles.previewStats}>
        <PreviewMetric label="Có mặt" value="28" tone="success" />
        <PreviewMetric label="Vắng" value="2" tone="warning" />
        <PreviewMetric label="Chuyên cần" value="93%" tone="primary" />
      </div>
      <div className={styles.previewProgress}>
        <span><strong>Tiến độ điểm danh</strong><small>28/30 học viên đã ghi nhận</small></span>
        <Progress percent={93} showInfo={false} strokeColor="#0877dd" trailColor="#e7eef7" />
      </div>
      <div className={styles.previewRoster}>
        {[
          ["Nguyễn Minh Anh", "Có mặt", "success"],
          ["Trần Gia Huy", "Có mặt", "success"],
          ["Lê Hoàng Nam", "Chưa xác nhận", "warning"],
        ].map(([name, status, tone]) => (
          <div key={name}>
            <span className={styles.previewAvatar}>{name.split(" ").at(-1)?.slice(0, 1)}</span>
            <span><strong>{name}</strong><small>Học viên</small></span>
            <Tag color={tone === "success" ? "success" : "warning"}>{status}</Tag>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeachingPreview() {
  return (
    <div className={styles.productPreview} aria-label="Xem trước trình xây dựng khóa học">
      <PreviewHeader eyebrow="TRÌNH XÂY DỰNG KHÓA HỌC" title="IELTS Foundation" action="Đã xuất bản" />
      <div className={styles.curriculumSummary}>
        <div><BookOutlined /><span><strong>6 chương</strong><small>Cấu trúc giáo trình</small></span></div>
        <div><FileDoneOutlined /><span><strong>24 bài học</strong><small>Nội dung đã sắp xếp</small></span></div>
        <div><CheckCircleFilled /><span><strong>3 bài kiểm tra</strong><small>Đánh giá theo mốc</small></span></div>
      </div>
      <div className={styles.lessonStack}>
        {[
          ["01", "Khởi động & mục tiêu", "4 bài học", "100%"],
          ["02", "Listening foundation", "6 bài học", "75%"],
          ["03", "Reading strategies", "5 bài học", "48%"],
        ].map(([number, title, lessons, progress]) => (
          <div key={number}>
            <span>{number}</span>
            <span><strong>{title}</strong><small>{lessons}</small></span>
            <b>{progress}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsPreview() {
  return (
    <div className={styles.productPreview} aria-label="Xem trước báo cáo vận hành">
      <PreviewHeader eyebrow="VẬN HÀNH THÁNG 9" title="Tổng quan trung tâm" action="Đã đồng bộ" />
      <div className={styles.previewStats}>
        <PreviewMetric label="Học phí đã thu" value="78%" tone="primary" />
        <PreviewMetric label="Lớp hoạt động" value="12" tone="success" />
        <PreviewMetric label="Việc cần xử lý" value="7" tone="warning" />
      </div>
      <div className={styles.revenuePanel}>
        <div>
          <span><strong>Hiệu suất theo tuần</strong><small>Dữ liệu mẫu trong giao diện giới thiệu</small></span>
          <Tag color="blue">Toàn tổ chức</Tag>
        </div>
        <div className={styles.revenueBars} aria-hidden="true">
          {[44, 58, 52, 72, 67, 86, 78].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
        </div>
        <div className={styles.revenueLegend}><span>Chuyên cần</span><span>Hoàn thành bài</span><span>Học phí</span></div>
      </div>
    </div>
  );
}

function OrganizationPreview() {
  return (
    <div className={styles.productPreview} aria-label="Xem trước cơ cấu tổ chức">
      <PreviewHeader eyebrow="PHẠM VI WORKSPACE" title="Cơ cấu nhiều chi nhánh" action="4 đơn vị" />
      <div className={styles.orgTree}>
        <div className={styles.orgRoot}><span className={styles.orgIcon}><ApartmentOutlined /></span><span><strong>DX English Center</strong><small>Toàn tổ chức · 248 thành viên</small></span></div>
        <div className={styles.orgBranches}>
          {[
            ["Cơ sở Quận 1", "82 học viên"],
            ["Cơ sở Thủ Đức", "96 học viên"],
            ["Lớp trực tuyến", "70 học viên"],
          ].map(([name, count]) => (
            <div key={name}><span className={styles.orgIcon}><TeamOutlined /></span><span><strong>{name}</strong><small>{count}</small></span></div>
          ))}
        </div>
      </div>
      <div className={styles.permissionStrip}>
        <SafetyCertificateOutlined />
        <span><strong>Quyền được kiểm tra theo vai trò và đơn vị</strong><small>Không trộn dữ liệu giữa các workspace</small></span>
        <Tag color="success">Đang bảo vệ</Tag>
      </div>
    </div>
  );
}

function PreviewHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) {
  return (
    <div className={styles.previewHeader}>
      <span><small>{eyebrow}</small><strong>{title}</strong></span>
      <Tag color="processing">{action}</Tag>
    </div>
  );
}

function PreviewMetric({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "warning" }) {
  const icons = {
    primary: <DollarOutlined />,
    success: <CheckCircleFilled />,
    warning: <BellOutlined />,
  };
  return <div data-tone={tone}><span>{icons[tone]}</span><small>{label}</small><strong>{value}</strong></div>;
}

function FeaturePreview({ id }: { id: FeatureGroupId }) {
  if (id === "teaching") return <TeachingPreview />;
  if (id === "classroom") return <AttendancePreview />;
  if (id === "operations") return <OperationsPreview />;
  return <OrganizationPreview />;
}

function GroupPane({ group, compact }: { group: FeatureGroup; compact: boolean }) {
  return (
    <div className={styles.featurePane}>
      <div className={styles.featurePaneCopy}>
        <span className={styles.featureOutcome}><CheckCircleFilled /> {group.outcome}</span>
        <h3>{group.label}</h3>
        <p>{group.description}</p>
        <div className={styles.featureCapabilityList}>
          {featuresFor(group).map((feature) => (
            <div key={feature.id}>
              <span className={styles.featureCapabilityIcon} aria-hidden="true">
                {feature.capability === "TUITION" ? <DollarOutlined /> : feature.capability === "REPORTS" ? <BarChartOutlined /> : feature.capability === "COMMUNICATIONS" ? <BellOutlined /> : group.icon}
              </span>
              <span><strong>{feature.title}</strong>{compact ? null : <small>{feature.description}</small>}</span>
            </div>
          ))}
        </div>
        <Link className={styles.featureLink} href="/features">Khám phá nhóm tính năng <span>→</span></Link>
      </div>
      <FeaturePreview id={group.id} />
    </div>
  );
}

export function FeatureExplorer({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.featureExplorer} ${compact ? styles.featureExplorerCompact : ""}`} data-reveal>
      <Tabs
        aria-label="Nhóm tính năng DX LMS"
        defaultActiveKey="teaching"
        items={featureGroups.map((group) => ({
          key: group.id,
          label: <span className={styles.featureTabLabel}><i>{group.icon}</i><span>{group.label}</span></span>,
          children: <GroupPane compact={compact} group={group} />,
        }))}
        tabPlacement="start"
      />
    </div>
  );
}
