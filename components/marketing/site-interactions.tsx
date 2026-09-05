"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";

import {
  ApartmentOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ReadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Input, Tag } from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "@/app/marketing-v2.module.css";
import type {
  MarketingBlogPost,
  MarketingPricingTier,
} from "@/lib/marketing-content";
import { ArticleCover } from "./article-cover";
import interactionStyles from "./site-interactions.module.css";

const roleWorkflows = [
  {
    id: "admin",
    initials: "QT",
    role: "Quản trị tổ chức",
    icon: ApartmentOutlined,
    headline: "Điều hành nhiều cơ sở trong một workspace",
    description:
      "Theo dõi lớp học, doanh thu và quyền truy cập theo đúng phạm vi chi nhánh.",
    outcome: "3 cảnh báo cần xử lý",
    steps: [
      {
        label: "Kiểm tra tổng quan",
        detail: "12 lớp đang hoạt động",
        state: "done",
      },
      {
        label: "Duyệt quyền chi nhánh",
        detail: "2 yêu cầu mới",
        state: "active",
      },
      { label: "Đối soát học phí", detail: "Báo cáo tháng 09", state: "next" },
    ],
  },
  {
    id: "teacher",
    initials: "GV",
    role: "Giảng viên",
    icon: ReadOutlined,
    headline: "Đi từ lịch dạy đến hoàn tất buổi học",
    description:
      "Danh sách lớp, điểm danh, tài liệu và bài cần chấm nằm trong cùng một luồng.",
    outcome: "2 bài đang chờ chấm",
    steps: [
      {
        label: "Mở lớp hôm nay",
        detail: "IELTS 7.0 · Phòng A2",
        state: "done",
      },
      { label: "Chốt điểm danh", detail: "28/30 học viên", state: "active" },
      { label: "Phản hồi bài tập", detail: "Hạn trước 18:00", state: "next" },
    ],
  },
  {
    id: "learner",
    initials: "HV",
    role: "Học viên",
    icon: BookOutlined,
    headline: "Biết chính xác việc cần làm tiếp theo",
    description:
      "Tiến độ khóa học, hạn nộp và phản hồi của giảng viên được sắp theo ưu tiên.",
    outcome: "68% lộ trình đã hoàn thành",
    steps: [
      {
        label: "Tiếp tục bài học",
        detail: "Unit 08 · Listening",
        state: "done",
      },
      { label: "Nộp bài luyện tập", detail: "Còn 01 ngày", state: "active" },
      { label: "Xem phản hồi", detail: "Writing task 2", state: "next" },
    ],
  },
  {
    id: "guardian",
    initials: "PH",
    role: "Phụ huynh",
    icon: TeamOutlined,
    headline: "Theo dõi đúng học viên được liên kết",
    description:
      "Xem lịch học, chuyên cần và học phí mà không truy cập dữ liệu ngoài phạm vi.",
    outcome: "Chuyên cần tháng này 96%",
    steps: [
      {
        label: "Xem lịch học tuần",
        detail: "3 buổi đã xác nhận",
        state: "done",
      },
      {
        label: "Kiểm tra chuyên cần",
        detail: "1 lần đi muộn",
        state: "active",
      },
      {
        label: "Theo dõi học phí",
        detail: "Kỳ tiếp theo 15/09",
        state: "next",
      },
    ],
  },
] as const;

export function TestimonialCarousel() {
  const { t } = useI18n(marketingMessages);
  const [activeRole, setActiveRole] =
    useState<(typeof roleWorkflows)[number]["id"]>("admin");
  const item =
    roleWorkflows.find((role) => role.id === activeRole) ?? roleWorkflows[0];
  const ActiveIcon = item.icon;

  return (
    <div className={interactionStyles.workbench} data-reveal>
      <div
        className={interactionStyles.roleRail}
        role="group"
        aria-label={t("Chọn vai trò để xem luồng công việc")}
      >
        {roleWorkflows.map((role) => {
          const RoleIcon = role.icon;
          const selected = activeRole === role.id;
          return (
            <button
              className={interactionStyles.roleButton}
              data-active={selected}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveRole(role.id)}
              key={role.id}
            >
              <span className={interactionStyles.roleIcon} aria-hidden="true">
                <RoleIcon />
              </span>
              <span>
                <strong>{t(role.role)}</strong>
                <small aria-hidden="true">{role.initials}</small>
              </span>
            </button>
          );
        })}
      </div>

      <section
        className={interactionStyles.workflowPanel}
        aria-live="polite"
        aria-labelledby={`role-workflow-${item.id}`}
      >
        <div className={interactionStyles.workflowHeader}>
          <span
            className={interactionStyles.workflowIdentity}
            aria-hidden="true"
          >
            <ActiveIcon />
          </span>
          <div>
            <Tag color="cyan">{t("Luồng công việc theo vai trò")}</Tag>
            <h3 id={`role-workflow-${item.id}`}>{t(item.headline)}</h3>
            <p>{t(item.description)}</p>
          </div>
        </div>

        <div className={interactionStyles.workflowBody}>
          <ol
            className={interactionStyles.workflowSteps}
            aria-label={t("Các bước dành cho {role}", { role: t(item.role) })}
          >
            {item.steps.map((step, stepIndex) => (
              <li
                className={interactionStyles.workflowStep}
                data-state={step.state}
                key={step.label}
              >
                <span className={interactionStyles.stepIcon} aria-hidden="true">
                  {step.state === "done" ? (
                    <CheckCircleFilled />
                  ) : (
                    <ClockCircleOutlined />
                  )}
                </span>
                <span className={interactionStyles.stepCopy}>
                  <small>
                    {t("Bước")} {stepIndex + 1}
                  </small>
                  <strong>{t(step.label)}</strong>
                  <span>{t(step.detail)}</span>
                </span>
              </li>
            ))}
          </ol>
          <aside
            className={interactionStyles.outcomeCard}
            aria-label={t("Kết quả đang theo dõi")}
          >
            <span>{t("Kết quả đang theo dõi")}</span>
            <strong>{t(item.outcome)}</strong>
            <small>
              {t(
                "Dữ liệu minh họa cách thông tin được trình bày trong workspace.",
              )}
            </small>
          </aside>
        </div>
      </section>
    </div>
  );
}

export function PricingSelector({
  tiers,
}: {
  tiers: readonly MarketingPricingTier[];
}) {
  const { t, formatNumber } = useI18n(marketingMessages);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  return (
    <>
      <div className={styles.pricingCycle}>
        <div className={styles.pricingToggle} role="group" aria-label={t("Chu kỳ thanh toán")}>
          {(["monthly", "yearly"] as const).map((value) => <button
            type="button"
            key={value}
            aria-pressed={cycle === value}
            className={`${styles.toggleButton} ${cycle === value ? styles.toggleActive : ""}`}
            onClick={() => setCycle(value)}
          >{t(value === "monthly" ? "Theo tháng" : "Theo năm")}</button>)}
        </div>
        <span className={styles.pricingSaving}>{t("Theo năm tiết kiệm 2 tháng")}</span>
      </div>
      <div className={styles.pricingGrid}>
        {tiers.filter((tier) => tier.id !== "trial").map((tier) => (
          <article
            className={`${styles.priceCard} ${tier.featured ? styles.priceFeatured : ""}`}
            data-reveal
            key={tier.id}
          >
            <h3>{tier.name}</h3>
            <span className={styles.priceAudience}>{t(tier.audience)}</span>
            <div className={styles.priceLabel}>
              {tier.priceVnd ? <>{t("{amount}đ", { amount: formatNumber(tier.priceVnd[cycle]) })} <small>{t(cycle === "monthly" ? "/ tháng" : "/ năm")}</small></> : t("Liên hệ")}
            </div>
            <ul className={styles.priceList}>
              {tier.features.map((feature) => (
                <li key={feature}><CheckCircleFilled aria-hidden />{t(feature)}</li>
              ))}
            </ul>
            <Link
              className={tier.id === "enterprise" ? styles.buttonSecondary : styles.button}
              href={tier.cta.href}
            >
              {t(tier.cta.label)}
            </Link>
          </article>
        ))}
      </div>
      <p className={styles.pricingTrial}>{t("Dùng thử với hạn mức Center · Không cần thẻ thanh toán")}</p>
    </>
  );
}

export function BlogExplorer({
  posts,
}: {
  posts: readonly MarketingBlogPost[];
}) {
  const { t, locale, formatNumber } = useI18n(marketingMessages);
  const categories = useMemo(
    () => [
      "Tất cả",
      ...Array.from(new Set(posts.map((post) => post.category))),
    ],
    [posts],
  );
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visiblePosts = posts.filter((post) => {
    const matchesCategory = category === "Tất cả" || post.category === category;
    const matchesQuery =
      !normalizedQuery ||
      `${t(post.title)} ${t(post.excerpt)}`
        .toLocaleLowerCase(locale)
        .includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  return (
    <>
      <div className={styles.blogToolbar}>
        <select
          className={styles.blogCategory}
          aria-label={t("Lọc bài viết theo danh mục")}
          aria-controls="marketing-blog-results"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((item) => <option value={item} key={item}>{t(item)}</option>)}
        </select>
        <div className={interactionStyles.blogSearch}>
          <label
            className={styles.visuallyHidden}
            htmlFor="marketing-blog-search"
          >
            {t("Tìm bài viết")}
          </label>
          <Input
            id="marketing-blog-search"
            type="search"
            size="large"
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            value={query}
            aria-controls="marketing-blog-results"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Tìm theo tiêu đề hoặc nội dung")}
          />
          <span className={interactionStyles.resultCount} aria-live="polite">
            {t(
              visiblePosts.length === 1
                ? "{count} bài viết"
                : "{count} bài viết tìm thấy",
              { count: formatNumber(visiblePosts.length) },
            )}
          </span>
        </div>
      </div>
      <div className={styles.blogGrid} id="marketing-blog-results">
        {visiblePosts.map((post) => (
          <article className={styles.blogCard} key={post.slug}>
            <Link href={`/blog/${post.slug}`}>
              <div className={styles.blogImageWrap}>
                <ArticleCover post={post} />
              </div>
              <div className={styles.blogBody}>
                <div className={styles.blogMeta}>
                  <span>{t(post.category)}</span>
                  <span>{t(post.readingTime)}</span>
                </div>
                <h3>{t(post.title)}</h3>
              </div>
            </Link>
          </article>
        ))}
        {visiblePosts.length === 0 ? (
          <div className={styles.emptyState}>
            {t(
              "Không tìm thấy bài viết phù hợp. Hãy thử từ khóa hoặc danh mục khác.",
            )}
            <button type="button" className={styles.buttonGhost} onClick={() => { setQuery(""); setCategory("Tất cả"); }}>{t("Xóa bộ lọc")}</button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export { ContactDraft as ContactForm } from "./contact-draft";
