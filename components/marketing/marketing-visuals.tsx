"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";

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

export type MarketingVisualKind =
  "features" | "about" | "pricing" | "blog" | "contact";

function VisualFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const { t } = useI18n(marketingMessages);
  return (
    <div className={styles.visualFrame}>
      <div className={styles.visualTopbar}>
        <span>
          <i />
          <i />
          <i />
        </span>
        <strong>{t(label)}</strong>
        <span className={styles.visualLive}>
          <i /> {t("Trực tiếp")}
        </span>
      </div>
      <div className={styles.visualBody}>{children}</div>
    </div>
  );
}

function FeaturesVisual() {
  const { t } = useI18n(marketingMessages);
  return (
    <VisualFrame label={t("Trung tâm điều hành học tập")}>
      <div className={styles.visualFeatureHeader}>
        <span>
          <small>{t("KHÔNG GIAN ĐÀO TẠO")}</small>
          <strong>{t("Mọi công việc trong một luồng")}</strong>
        </span>
        <span className={styles.visualPill}>{t("9 mô-đun")}</span>
      </div>
      <div className={styles.visualModuleGrid}>
        {[
          [
            <BookOutlined key="course" />,
            t("Khóa học"),
            t("24 nội dung"),
            "active",
          ],
          [<TeamOutlined key="class" />, t("Lớp học"), t("12 đang chạy"), ""],
          [
            <CheckCircleFilled key="attendance" />,
            t("Điểm danh"),
            t("93% hôm nay"),
            "",
          ],
          [
            <FileTextOutlined key="assignment" />,
            t("Bài tập"),
            t("7 cần chấm"),
            "",
          ],
        ].map(([icon, title, meta, state]) => (
          <div
            data-active={state === "active" || undefined}
            key={String(title)}
          >
            <span>{icon}</span>
            <strong>{title}</strong>
            <small>{meta}</small>
          </div>
        ))}
      </div>
      <div className={styles.visualActivity}>
        <span className={styles.visualAvatar}>AN</span>
        <span>
          <strong>{t("Nguyễn Minh Anh vừa hoàn thành bài học")}</strong>
          <small>{t("Listening foundation · 2 phút trước")}</small>
        </span>
        <span className={styles.visualStatus}>{t("Hoàn thành")}</span>
      </div>
    </VisualFrame>
  );
}

function AboutVisual() {
  const { t } = useI18n(marketingMessages);
  return (
    <VisualFrame label={t("Kiến trúc tăng trưởng")}>
      <div className={styles.scaleFlow}>
        {[
          ["01", t("Lớp riêng"), t("1 giáo viên"), <BookOutlined key="one" />],
          ["02", t("Trung tâm"), t("Nhiều lớp"), <TeamOutlined key="two" />],
          [
            "03",
            t("Đa chi nhánh"),
            t("Một hệ thống"),
            <ApartmentOutlined key="three" />,
          ],
        ].map(([number, title, meta, icon], index) => (
          <div className={styles.scaleNode} key={String(title)}>
            <span className={styles.scaleNumber}>{number}</span>
            <span className={styles.scaleIcon}>{icon}</span>
            <strong>{title}</strong>
            <small>{meta}</small>
            {index < 2 ? (
              <ArrowRightOutlined className={styles.scaleArrow} />
            ) : null}
          </div>
        ))}
      </div>
      <div className={styles.visualPromise}>
        <SafetyCertificateOutlined />
        <span>
          <strong>{t("Dữ liệu đi cùng tổ chức")}</strong>
          <small>
            {t("Vai trò và phạm vi được giữ nhất quán khi mở rộng.")}
          </small>
        </span>
      </div>
    </VisualFrame>
  );
}

function PricingVisual() {
  const { t, formatDate } = useI18n(marketingMessages);
  return (
    <VisualFrame label={t("Vòng đời workspace")}>
      <div className={styles.subscriptionCard}>
        <span className={styles.subscriptionEyebrow}>{t("GÓI HIỆN TẠI")}</span>
        <div>
          <span>
            <strong>{t("Dùng thử đầy đủ")}</strong>
            <small>{t("Không yêu cầu thẻ thanh toán")}</small>
          </span>
          <b>{t("30 ngày")}</b>
        </div>
        <span className={styles.subscriptionProgress}>
          <i />
        </span>
        <div className={styles.subscriptionMeta}>
          <span>
            {t("Ngày bắt đầu")}
            <strong>
              {formatDate("2026-09-04T00:00:00Z", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                timeZone: "UTC",
              })}
            </strong>
          </span>
          <span>
            {t("Trạng thái")}
            <strong>{t("Dùng thử")}</strong>
          </span>
        </div>
      </div>
      <div className={styles.lifecycle}>
        {[
          [t("Dùng thử"), t("Khám phá"), "current"],
          [t("Hoạt động"), t("Vận hành"), ""],
          [t("Gia hạn thanh toán"), t("Gia hạn"), ""],
          [t("Chỉ đọc"), t("Bảo toàn dữ liệu"), ""],
        ].map(([state, label, current], index) => (
          <div data-current={current === "current" || undefined} key={state}>
            <span>{index + 1}</span>
            <strong>{state}</strong>
            <small>{t(label)}</small>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function BlogVisual() {
  const { t } = useI18n(marketingMessages);
  const articles = [
    [
      "DỮ LIỆU HỌC TẬP",
      "Đọc tín hiệu nào để cải thiện một khóa học?",
      "6 phút",
    ],
    ["VẬN HÀNH", "Từ một lớp học đến hệ thống nhiều chi nhánh", "8 phút"],
    ["TRẢI NGHIỆM", "Thiết kế nhịp học ngắn nhưng có tác động", "5 phút"],
  ];
  return (
    <VisualFrame label={t("Thư viện DX LMS")}>
      <div className={styles.editorialHeader}>
        <span>
          <small>{t("GÓC NHÌN DX LMS")}</small>
          <strong>{t("Ý tưởng có thể áp dụng")}</strong>
        </span>
        <span className={styles.visualPill}>{t("10 bài viết")}</span>
      </div>
      <div className={styles.editorialList}>
        {articles.map(([category, title, time], index) => (
          <article key={title}>
            <span className={styles.editorialIndex}>0{index + 1}</span>
            <span>
              <small>{t(category)}</small>
              <strong>{t(title)}</strong>
            </span>
            <span className={styles.editorialTime}>
              <ClockCircleOutlined /> {t(time)}
            </span>
          </article>
        ))}
      </div>
    </VisualFrame>
  );
}

function ContactVisual() {
  const { t } = useI18n(marketingMessages);
  return (
    <VisualFrame label={t("Hành trình tư vấn")}>
      <div className={styles.contactPipeline}>
        {[
          ["01", t("Mô tả nhu cầu"), t("Quy mô · vai trò · mô-đun")],
          ["02", t("Làm rõ bối cảnh"), t("Luồng hiện tại và mục tiêu")],
          ["03", t("Demo theo tình huống"), t("Trải nghiệm đúng vai trò")],
          ["04", t("Cấu hình & khởi chạy"), t("Workspace sẵn sàng sử dụng")],
        ].map(([number, title, copy], index) => (
          <div key={number}>
            <span className={styles.pipelineNumber}>{number}</span>
            <span>
              <strong>{t(title)}</strong>
              <small>{t(copy)}</small>
            </span>
            {index < 3 ? (
              <i aria-hidden="true" />
            ) : (
              <CheckCircleFilled className={styles.pipelineDone} />
            )}
          </div>
        ))}
      </div>
      <div className={styles.contactResponse}>
        <MailOutlined />
        <span>
          <small>{t("KÊNH TIẾP NHẬN")}</small>
          <strong>{t("Thông tin được xác nhận trước khi hẹn demo")}</strong>
        </span>
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
