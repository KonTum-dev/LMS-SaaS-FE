"use client";

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import styles from "./marketing-visuals.module.css";

export type MarketingVisualKind = "features" | "about" | "pricing" | "blog" | "contact";

function VisualFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.visualFrame}>
      <div className={styles.visualTopbar}>
        <span><i /><i /><i /></span>
        <strong>{label}</strong>
        <span className={styles.visualLive}><i /> LIVE</span>
      </div>
      <div className={styles.visualBody}>{children}</div>
    </div>
  );
}

function FeaturesVisual() {
  return (
    <VisualFrame label="Trung tâm điều hành học tập">
      <div className={styles.visualFeatureHeader}>
        <span><small>KHÔNG GIAN ĐÀO TẠO</small><strong>Mọi công việc trong một luồng</strong></span>
        <span className={styles.visualPill}>9 mô-đun</span>
      </div>
      <div className={styles.visualModuleGrid}>
        {[
          [<BookOutlined key="course" />, "Khóa học", "24 nội dung", "active"],
          [<TeamOutlined key="class" />, "Lớp học", "12 đang chạy", ""],
          [<CheckCircleFilled key="attendance" />, "Điểm danh", "93% hôm nay", ""],
          [<FileTextOutlined key="assignment" />, "Bài tập", "7 cần chấm", ""],
        ].map(([icon, title, meta, state]) => (
          <div data-active={state === "active" || undefined} key={String(title)}>
            <span>{icon}</span><strong>{title}</strong><small>{meta}</small>
          </div>
        ))}
      </div>
      <div className={styles.visualActivity}>
        <span className={styles.visualAvatar}>AN</span>
        <span><strong>Nguyễn Minh Anh vừa hoàn thành bài học</strong><small>Listening foundation · 2 phút trước</small></span>
        <span className={styles.visualStatus}>Hoàn thành</span>
      </div>
    </VisualFrame>
  );
}

function AboutVisual() {
  return (
    <VisualFrame label="Kiến trúc tăng trưởng">
      <div className={styles.scaleFlow}>
        {[
          ["01", "Lớp riêng", "1 giáo viên", <BookOutlined key="one" />],
          ["02", "Trung tâm", "Nhiều lớp", <TeamOutlined key="two" />],
          ["03", "Đa chi nhánh", "Một hệ thống", <ApartmentOutlined key="three" />],
        ].map(([number, title, meta, icon], index) => (
          <div className={styles.scaleNode} key={String(title)}>
            <span className={styles.scaleNumber}>{number}</span>
            <span className={styles.scaleIcon}>{icon}</span>
            <strong>{title}</strong><small>{meta}</small>
            {index < 2 ? <ArrowRightOutlined className={styles.scaleArrow} /> : null}
          </div>
        ))}
      </div>
      <div className={styles.visualPromise}>
        <SafetyCertificateOutlined />
        <span><strong>Dữ liệu đi cùng tổ chức</strong><small>Vai trò và phạm vi được giữ nhất quán khi mở rộng.</small></span>
      </div>
    </VisualFrame>
  );
}

function PricingVisual() {
  return (
    <VisualFrame label="Vòng đời workspace">
      <div className={styles.subscriptionCard}>
        <span className={styles.subscriptionEyebrow}>GÓI HIỆN TẠI</span>
        <div><span><strong>Dùng thử đầy đủ</strong><small>Không yêu cầu thẻ thanh toán</small></span><b>14 ngày</b></div>
        <span className={styles.subscriptionProgress}><i /></span>
        <div className={styles.subscriptionMeta}><span>Ngày bắt đầu<strong>04/09/2026</strong></span><span>Trạng thái<strong>TRIAL</strong></span></div>
      </div>
      <div className={styles.lifecycle}>
        {[
          ["TRIAL", "Khám phá", "current"],
          ["ACTIVE", "Vận hành", ""],
          ["GRACE", "Gia hạn", ""],
          ["READ ONLY", "Bảo toàn dữ liệu", ""],
        ].map(([state, label, current], index) => (
          <div data-current={current === "current" || undefined} key={state}>
            <span>{index + 1}</span><strong>{state}</strong><small>{label}</small>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function BlogVisual() {
  const articles = [
    ["DỮ LIỆU HỌC TẬP", "Đọc tín hiệu nào để cải thiện một khóa học?", "6 phút"],
    ["VẬN HÀNH", "Từ một lớp học đến hệ thống nhiều chi nhánh", "8 phút"],
    ["TRẢI NGHIỆM", "Thiết kế nhịp học ngắn nhưng có tác động", "5 phút"],
  ];
  return (
    <VisualFrame label="Thư viện DX LMS">
      <div className={styles.editorialHeader}><span><small>GÓC NHÌN DX LMS</small><strong>Ý tưởng có thể áp dụng</strong></span><span className={styles.visualPill}>10 bài viết</span></div>
      <div className={styles.editorialList}>
        {articles.map(([category, title, time], index) => (
          <article key={title}>
            <span className={styles.editorialIndex}>0{index + 1}</span>
            <span><small>{category}</small><strong>{title}</strong></span>
            <span className={styles.editorialTime}><ClockCircleOutlined /> {time}</span>
          </article>
        ))}
      </div>
    </VisualFrame>
  );
}

function ContactVisual() {
  return (
    <VisualFrame label="Hành trình tư vấn">
      <div className={styles.contactPipeline}>
        {[
          ["01", "Mô tả nhu cầu", "Quy mô · vai trò · mô-đun"],
          ["02", "Làm rõ bối cảnh", "Luồng hiện tại và mục tiêu"],
          ["03", "Demo theo tình huống", "Trải nghiệm đúng vai trò"],
          ["04", "Cấu hình & khởi chạy", "Workspace sẵn sàng sử dụng"],
        ].map(([number, title, copy], index) => (
          <div key={number}>
            <span className={styles.pipelineNumber}>{number}</span>
            <span><strong>{title}</strong><small>{copy}</small></span>
            {index < 3 ? <i aria-hidden="true" /> : <CheckCircleFilled className={styles.pipelineDone} />}
          </div>
        ))}
      </div>
      <div className={styles.contactResponse}>
        <MailOutlined /><span><small>KÊNH TIẾP NHẬN</small><strong>Thông tin được xác nhận trước khi hẹn demo</strong></span>
      </div>
    </VisualFrame>
  );
}

export function MarketingVisual({ kind }: { kind: MarketingVisualKind }) {
  if (kind === "features") return <FeaturesVisual />;
  if (kind === "about") return <AboutVisual />;
  if (kind === "pricing") return <PricingVisual />;
  if (kind === "blog") return <BlogVisual />;
  return <ContactVisual />;
}
