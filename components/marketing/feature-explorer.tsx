"use client";

import { ApartmentOutlined, ArrowRightOutlined, BarChartOutlined, BellOutlined, BookOutlined, CalendarOutlined, CheckOutlined, FileDoneOutlined, TeamOutlined } from "@ant-design/icons";
import { Tabs } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import { marketingFeatures } from "@/lib/marketing-content";
import styles from "./feature-explorer.module.css";

type FeatureGroupId = "teaching" | "classroom" | "operations" | "organization";
interface FeatureGroup { id: FeatureGroupId; label: string; outcome: string; featureIds: readonly string[]; }

const groups: readonly FeatureGroup[] = [
  { id: "teaching", label: "Giảng dạy", outcome: "Dạy học có lộ trình", featureIds: ["courses-curriculum", "assignments-grading", "assessments-results"] },
  { id: "classroom", label: "Lớp học", outcome: "Theo sát từng buổi học", featureIds: ["cohorts-attendance", "guardians-learners", "communications-scope"] },
  { id: "operations", label: "Vận hành", outcome: "Nắm rõ việc cần xử lý", featureIds: ["tuition-payments", "operations-reports"] },
  { id: "organization", label: "Tổ chức", outcome: "Quản lý rõ từng chi nhánh", featureIds: ["organization-structure", "communications-scope", "operations-reports"] },
];
const summaries: Readonly<Record<string, { label: string; detail: string; icon: ReactNode }>> = {
  "courses-curriculum": { label: "Sắp xếp khóa học và bài học", detail: "Xây giáo trình theo chương, lưu nháp và công bố khi sẵn sàng.", icon: <BookOutlined /> },
  "assignments-grading": { label: "Giao bài, chấm bài tại một nơi", detail: "Nhận bài nộp, trả nhận xét và ghi nhận điểm.", icon: <FileDoneOutlined /> },
  "assessments-results": { label: "Theo dõi kết quả từng học viên", detail: "Tạo bài kiểm tra và xem kết quả theo khóa học.", icon: <BarChartOutlined /> },
  "cohorts-attendance": { label: "Lên lịch và điểm danh lớp học", detail: "Phân công giảng viên, tạo buổi học và theo dõi chuyên cần.", icon: <CalendarOutlined /> },
  "guardians-learners": { label: "Kết nối học viên với phụ huynh", detail: "Mỗi phụ huynh xem thông tin của học viên được liên kết.", icon: <TeamOutlined /> },
  "communications-scope": { label: "Gửi thông báo đúng người", detail: "Chọn người nhận theo tổ chức, đơn vị hoặc lớp học.", icon: <BellOutlined /> },
  "tuition-payments": { label: "Theo dõi học phí và công nợ", detail: "Lập hóa đơn, ghi nhận tiền đã thu và theo dõi số dư.", icon: <FileDoneOutlined /> },
  "operations-reports": { label: "Xem báo cáo theo từng đơn vị", detail: "Tổng hợp lớp học, chuyên cần và học phí trong phạm vi quản lý.", icon: <BarChartOutlined /> },
  "organization-structure": { label: "Sắp xếp cơ cấu và phân quyền", detail: "Quản lý trụ sở, chi nhánh và quyền truy cập của thành viên.", icon: <ApartmentOutlined /> },
};

function PreviewFrame({ title, label, status, icon, children }: { title: string; label: string; status?: string; icon: ReactNode; children: ReactNode }) {
  return <div className={styles.productPreview} aria-label={label}>
    <div className={styles.previewHeader}>
      <span className={styles.previewIcon} aria-hidden="true">{icon}</span>
      <div><strong>{title}</strong><span>{label}</span>{status && <small className={styles.status}>{status}</small>}</div>
    </div>
    {children}
  </div>;
}

function TeachingPreview() {
  const { t } = useI18n(marketingMessages);
  return <PreviewFrame title="IELTS Foundation" label={t("Khóa học")} status={t("Đã xuất bản")} icon={<BookOutlined />}>
    <ol className={styles.lessonStack}>
      {[["01", "Khởi động & mục tiêu", "4 bài học"], ["02", "Listening foundation", "6 bài học"], ["03", "Reading strategies", "5 bài học"]].map(([number, title, lessons]) => <li key={number}>
        <span className={styles.rowNumber}>{number}</span><strong>{t(title)}</strong><small>{t(lessons)}</small>
      </li>)}
    </ol>
  </PreviewFrame>;
}
function AttendancePreview() {
  const { t } = useI18n(marketingMessages);
  return <PreviewFrame title="IELTS Foundation · 19:00" label={t("Lớp học và điểm danh")} icon={<CalendarOutlined />}>
    <dl className={styles.metrics}>
      <div><dt>{t("Có mặt")}</dt><dd>28</dd></div><div><dt>{t("Vắng")}</dt><dd>2</dd></div><div><dt>{t("Chuyên cần")}</dt><dd>93%</dd></div>
    </dl>
    <ul className={styles.roster}>
      {["Nguyễn Minh Anh", "Trần Gia Huy", "Lê Hoàng Nam"].map((name, index) => <li key={name}>
        <span className={styles.avatar} aria-hidden="true">{name.split(" ").at(-1)?.slice(0, 1)}</span><strong>{name}</strong>
        <span className={index < 2 ? styles.present : styles.pending}>{index < 2 && <CheckOutlined aria-hidden="true" />}{t(index < 2 ? "Có mặt" : "Chưa xác nhận")}</span>
      </li>)}
    </ul>
  </PreviewFrame>;
}
function OperationsPreview() {
  const { t } = useI18n(marketingMessages);
  return <PreviewFrame title={t("Tổng quan trung tâm")} label={t("Báo cáo vận hành")} icon={<BarChartOutlined />}>
    <dl className={styles.metrics}>
      <div><dt>{t("Học phí đã thu")}</dt><dd>78%</dd></div><div><dt>{t("Lớp hoạt động")}</dt><dd>12</dd></div><div><dt>{t("Việc cần xử lý")}</dt><dd>7</dd></div>
    </dl>
    <div className={styles.collectionProgress}>
      <span>{t("Học phí đã thu")}</span><div role="img" aria-label={t("Học phí đã thu") + ": 78%"}><i /></div><p>{t("Theo dõi học phí và công nợ")}</p>
    </div>
  </PreviewFrame>;
}
function OrganizationPreview() {
  const { t } = useI18n(marketingMessages);
  return <PreviewFrame title="DX English Center" label={t("Cơ cấu nhiều chi nhánh")} icon={<ApartmentOutlined />}>
    <ul className={styles.branches}>
      {[["Cơ sở Quận 1", "82 học viên"], ["Cơ sở Thủ Đức", "96 học viên"], ["Lớp trực tuyến", "70 học viên"]].map(([name, count]) => <li key={name}>
        <TeamOutlined aria-hidden="true" /><strong>{t(name)}</strong><small>{t(count)}</small>
      </li>)}
    </ul>
  </PreviewFrame>;
}

function GroupPane({ group, compact }: { group: FeatureGroup; compact: boolean }) {
  const { t } = useI18n(marketingMessages);
  return <div className={styles.featurePane}>
    <div className={styles.copy}>
      <h3>{t(group.outcome)}</h3>
      <ul className={styles.capabilities}>
        {group.featureIds.filter(id => marketingFeatures.some(feature => feature.id === id)).map(id => {
          const feature = summaries[id];
          return <li key={id}><span className={styles.capabilityIcon} aria-hidden="true">{feature.icon}</span>
            <div><strong>{t(feature.label)}</strong>{!compact && <p>{t(feature.detail)}</p>}</div>
          </li>;
        })}
      </ul>
      {compact && <Link className={styles.featureLink} href="/features">{t("Xem tất cả tính năng")}<ArrowRightOutlined aria-hidden="true" /></Link>}
    </div>
    <figure className={styles.previewFigure}>
      {group.id === "teaching" ? <TeachingPreview /> : group.id === "classroom" ? <AttendancePreview /> : group.id === "operations" ? <OperationsPreview /> : <OrganizationPreview />}
      <figcaption>{t("Dữ liệu minh họa")}</figcaption>
    </figure>
  </div>;
}

export function FeatureExplorer({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n(marketingMessages);
  return <div className={styles.featureExplorer} data-reveal>
    <Tabs aria-label={t("Nhóm tính năng DX LMS")} defaultActiveKey="teaching" destroyOnHidden
      items={groups.map(group => ({ key: group.id, label: t(group.label), children: <GroupPane compact={compact} group={group} /> }))}
    />
  </div>;
}
