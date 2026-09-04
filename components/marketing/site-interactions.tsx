"use client";

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DollarOutlined,
  MailOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input, notification, Select, Tag } from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "@/app/marketing-v2.module.css";
import type { MarketingBlogPost, MarketingPricingTier } from "@/lib/marketing-content";
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
      { label: "Kiểm tra tổng quan", detail: "12 lớp đang hoạt động", state: "done" },
      { label: "Duyệt quyền chi nhánh", detail: "2 yêu cầu mới", state: "active" },
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
      { label: "Mở lớp hôm nay", detail: "IELTS 7.0 · Phòng A2", state: "done" },
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
      { label: "Tiếp tục bài học", detail: "Unit 08 · Listening", state: "done" },
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
      { label: "Xem lịch học tuần", detail: "3 buổi đã xác nhận", state: "done" },
      { label: "Kiểm tra chuyên cần", detail: "1 lần đi muộn", state: "active" },
      { label: "Theo dõi học phí", detail: "Kỳ tiếp theo 15/09", state: "next" },
    ],
  },
] as const;

export function TestimonialCarousel() {
  const [activeRole, setActiveRole] = useState<(typeof roleWorkflows)[number]["id"]>("admin");
  const item = roleWorkflows.find((role) => role.id === activeRole) ?? roleWorkflows[0];
  const ActiveIcon = item.icon;

  return (
    <div className={interactionStyles.workbench} data-reveal>
      <div className={interactionStyles.roleRail} role="group" aria-label="Chọn vai trò để xem luồng công việc">
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
              <span className={interactionStyles.roleIcon} aria-hidden="true"><RoleIcon /></span>
              <span><strong>{role.role}</strong><small aria-hidden="true">{role.initials}</small></span>
            </button>
          );
        })}
      </div>

      <section className={interactionStyles.workflowPanel} aria-live="polite" aria-labelledby={`role-workflow-${item.id}`}>
        <div className={interactionStyles.workflowHeader}>
          <span className={interactionStyles.workflowIdentity} aria-hidden="true"><ActiveIcon /></span>
          <div>
            <Tag color="cyan">Luồng công việc theo vai trò</Tag>
            <h3 id={`role-workflow-${item.id}`}>{item.headline}</h3>
            <p>{item.description}</p>
          </div>
        </div>

        <div className={interactionStyles.workflowBody}>
          <ol className={interactionStyles.workflowSteps} aria-label={`Các bước dành cho ${item.role}`}>
            {item.steps.map((step, stepIndex) => (
              <li className={interactionStyles.workflowStep} data-state={step.state} key={step.label}>
                <span className={interactionStyles.stepIcon} aria-hidden="true">
                  {step.state === "done" ? <CheckCircleFilled /> : <ClockCircleOutlined />}
                </span>
                <span className={interactionStyles.stepCopy}>
                  <small>Bước {stepIndex + 1}</small>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <aside className={interactionStyles.outcomeCard} aria-label="Kết quả đang theo dõi">
            <span>Kết quả đang theo dõi</span>
            <strong>{item.outcome}</strong>
            <small>Dữ liệu minh họa cách thông tin được trình bày trong workspace.</small>
          </aside>
        </div>
      </section>
    </div>
  );
}

export function PricingSelector({ tiers }: { tiers: readonly MarketingPricingTier[] }) {
  return (
    <>
      <div className={interactionStyles.pricingContext} role="note" aria-label="Thông tin dùng thử và báo giá">
        <div className={interactionStyles.pricingContextItem}>
          <span className={interactionStyles.contextIcon} aria-hidden="true"><ClockCircleOutlined /></span>
          <span><strong>14 ngày dùng thử miễn phí</strong><small>Khởi tạo workspace để kiểm tra quy trình trước khi chọn gói.</small></span>
        </div>
        <div className={interactionStyles.pricingContextItem}>
          <span className={interactionStyles.contextIcon} aria-hidden="true"><DollarOutlined /></span>
          <span><strong>Báo giá theo cấu hình thực tế</strong><small>Dựa trên quy mô người dùng, chi nhánh, mô-đun và mức hỗ trợ.</small></span>
        </div>
      </div>

      <div className={styles.pricingGrid}>
        {tiers.map((tier) => (
          <article className={`${styles.priceCard} ${tier.featured ? styles.priceFeatured : ""}`} data-reveal key={tier.id}>
            {tier.featured ? <span className={styles.popularChip}>Phù hợp trung tâm</span> : null}
            <h3>{tier.name}</h3>
            <span className={styles.priceAudience}>{tier.audience}</span>
            <div className={styles.priceLabel}>{tier.priceLabel}</div>
            <p className={styles.priceDescription}>{tier.description}</p>
            <ul className={styles.priceList}>{tier.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <Link className={tier.featured ? styles.buttonSecondary : styles.button} href={tier.cta.href}>{tier.cta.label}</Link>
          </article>
        ))}
      </div>
    </>
  );
}

export function BlogExplorer({ posts }: { posts: readonly MarketingBlogPost[] }) {
  const categories = useMemo(() => ["Tất cả", ...Array.from(new Set(posts.map((post) => post.category)))], [posts]);
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visiblePosts = posts.filter((post) => {
    const matchesCategory = category === "Tất cả" || post.category === category;
    const matchesQuery = !normalizedQuery || `${post.title} ${post.excerpt}`.toLocaleLowerCase("vi").includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  });

  return (
    <>
      <div className={styles.blogToolbar}>
        <div className={styles.filterRail} role="group" aria-label="Lọc bài viết theo danh mục">
          {categories.map((item) => {
            const selected = category === item;
            return (
              <button
                className={`${styles.filterButton} ${selected ? styles.filterButtonActive : ""}`}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(item)}
                key={item}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className={interactionStyles.blogSearch}>
          <label className={styles.visuallyHidden} htmlFor="marketing-blog-search">Tìm bài viết</label>
          <Input
            id="marketing-blog-search"
            type="search"
            size="large"
            allowClear
            prefix={<SearchOutlined aria-hidden="true" />}
            value={query}
            aria-controls="marketing-blog-results"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung"
          />
          <span className={interactionStyles.resultCount} aria-live="polite">{visiblePosts.length} bài viết</span>
        </div>
      </div>
      <div className={styles.blogGrid} id="marketing-blog-results">
        {visiblePosts.map((post) => (
          <article className={styles.blogCard} key={post.slug}>
            <Link href={`/blog/${post.slug}`}>
              <div className={styles.blogImageWrap}><ArticleCover post={post} /></div>
              <div className={styles.blogBody}>
                <div className={styles.blogMeta}><span>{post.category}</span><span>{post.readingTime}</span></div>
                <h3>{post.title}</h3><p>{post.excerpt}</p>
              </div>
            </Link>
          </article>
        ))}
        {visiblePosts.length === 0 ? <div className={styles.emptyState}>Không tìm thấy bài viết phù hợp. Hãy thử từ khóa hoặc danh mục khác.</div> : null}
      </div>
    </>
  );
}

type ContactValues = {
  email: string;
  message: string;
  name: string;
  organization: string;
  phone?: string;
  role: string;
  scale: string;
  topic: string;
};

export function ContactForm() {
  const [notificationApi, notificationContext] = notification.useNotification({
    maxCount: 1,
    placement: "topRight",
    top: 112,
  });

  function submit() {
    notificationApi.warning({
      title: "Chưa gửi được yêu cầu",
      description:
        "Kênh liên hệ đang được hoàn thiện nên thông tin chưa được gửi hoặc lưu. Bạn có thể tạo workspace dùng thử ngay.",
      actions: <Link className={interactionStyles.toastAction} href="/register">Tạo workspace dùng thử</Link>,
      duration: false,
      role: "alert",
      showProgress: false,
    });
  }

  return (
    <>
      {notificationContext}
      <div className={interactionStyles.contactCard}>
        <Alert
          id="contact-channel-status"
          className={interactionStyles.contactAlert}
          type="warning"
          showIcon
          title="Kênh tiếp nhận đang được cấu hình"
          description="Biểu mẫu hiện giúp bạn rà soát thông tin cần tư vấn; dữ liệu chưa được gửi hoặc lưu ở phiên bản này."
        />

        <Form<ContactValues>
          className={interactionStyles.contactForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={submit}
          aria-label="Thông tin nhu cầu triển khai DX LMS"
        >
          <div className={interactionStyles.contactFields}>
            <Form.Item
              label="Họ và tên"
              name="name"
              rules={[{ required: true, message: "Vui lòng nhập họ và tên." }]}
            >
              <Input prefix={<UserOutlined aria-hidden="true" />} autoComplete="name" placeholder="Nguyễn Minh Anh" />
            </Form.Item>

            <Form.Item
              label="Email công việc"
              name="email"
              rules={[
                { required: true, message: "Vui lòng nhập email." },
                { type: "email", message: "Email chưa đúng định dạng." },
              ]}
            >
              <Input prefix={<MailOutlined aria-hidden="true" />} type="email" autoComplete="email" placeholder="minhanh@trungtam.edu.vn" />
            </Form.Item>

            <Form.Item
              label="Tổ chức / trung tâm"
              name="organization"
              rules={[{ required: true, message: "Vui lòng nhập tên tổ chức." }]}
            >
              <Input prefix={<ApartmentOutlined aria-hidden="true" />} autoComplete="organization" placeholder="Tên tổ chức của bạn" />
            </Form.Item>

            <Form.Item label="Số điện thoại (không bắt buộc)" name="phone">
              <Input type="tel" autoComplete="tel" placeholder="090 000 0000" />
            </Form.Item>

            <Form.Item
              label="Vai trò của bạn"
              name="role"
              rules={[{ required: true, message: "Vui lòng chọn vai trò." }]}
            >
              <Select
                placeholder="Chọn vai trò"
                options={[
                  { value: "owner", label: "Chủ trung tâm / lãnh đạo" },
                  { value: "operations", label: "Quản lý vận hành" },
                  { value: "technology", label: "Phụ trách công nghệ" },
                  { value: "teacher", label: "Giảng viên" },
                  { value: "other", label: "Vai trò khác" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Quy mô hiện tại"
              name="scale"
              rules={[{ required: true, message: "Vui lòng chọn quy mô." }]}
            >
              <Select
                placeholder="Số học viên đang hoạt động"
                options={[
                  { value: "under-100", label: "Dưới 100 học viên" },
                  { value: "100-500", label: "100–500 học viên" },
                  { value: "501-2000", label: "501–2.000 học viên" },
                  { value: "over-2000", label: "Trên 2.000 học viên" },
                ]}
              />
            </Form.Item>

            <Form.Item
              className={interactionStyles.fullWidth}
              label="Nhu cầu chính"
              name="topic"
              rules={[{ required: true, message: "Vui lòng chọn nhu cầu." }]}
            >
              <Select
                placeholder="Chọn nội dung cần trao đổi"
                options={[
                  { value: "trial", label: "Thiết lập workspace dùng thử" },
                  { value: "implementation", label: "Tư vấn triển khai" },
                  { value: "pricing", label: "Tư vấn gói dịch vụ" },
                  { value: "migration", label: "Chuyển đổi dữ liệu" },
                  { value: "integration", label: "Tích hợp hệ thống" },
                ]}
              />
            </Form.Item>

            <Form.Item
              className={interactionStyles.fullWidth}
              label="Mô tả nhu cầu"
              name="message"
              rules={[
                { required: true, message: "Vui lòng mô tả nhu cầu." },
                { min: 20, message: "Hãy mô tả ít nhất 20 ký tự để chúng tôi hiểu đúng nhu cầu." },
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 4, maxRows: 8 }}
                maxLength={1000}
                showCount
                placeholder="Số chi nhánh, quy trình đang dùng và các mô-đun bạn muốn ưu tiên..."
              />
            </Form.Item>
          </div>

          <div className={interactionStyles.contactActions}>
            <span><SafetyCertificateOutlined aria-hidden="true" /> Dữ liệu chưa được lưu hoặc truyền đi ở phiên bản này.</span>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              aria-describedby="contact-channel-status"
            >
              Kiểm tra yêu cầu
            </Button>
          </div>
        </Form>
      </div>
    </>
  );
}
