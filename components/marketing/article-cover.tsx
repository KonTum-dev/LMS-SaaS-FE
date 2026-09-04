"use client";

import {
  ApartmentOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleFilled,
  MobileOutlined,
  RiseOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import Image from "next/image";
import type { ReactNode } from "react";
import type { MarketingBlogPost, MarketingBlogSlug } from "@/lib/marketing-content";
import styles from "./article-cover.module.css";

type CoverSpec = {
  icon: ReactNode;
  metric: string;
  metricLabel: string;
  steps: readonly [string, string, string];
  tone: string;
};

const coverSpecs: Record<MarketingBlogSlug, CoverSpec> = {
  "a-guide-to-maximizing-your-potential": {
    icon: <RiseOutlined />,
    metric: "3 mốc",
    metricLabel: "để nhìn thấy tiến bộ",
    steps: ["Mục tiêu", "Nhịp học", "Phản hồi"],
    tone: "cyan",
  },
  "the-evolution-of-learning-with-eduvex": {
    icon: <ApartmentOutlined />,
    metric: "1 luồng",
    metricLabel: "kết nối toàn hành trình",
    steps: ["Tài liệu", "Lớp học", "Hệ sinh thái"],
    tone: "navy",
  },
  "eduvex-s-smart-learning-features": {
    icon: <BulbOutlined />,
    metric: "9 mô-đun",
    metricLabel: "đúng việc, đúng vai trò",
    steps: ["Khóa học", "Lớp học", "Báo cáo"],
    tone: "blue",
  },
  "trends-insights-from-eduvex": {
    icon: <BarChartOutlined />,
    metric: "4 tín hiệu",
    metricLabel: "để đọc đúng dữ liệu",
    steps: ["Thu thập", "Hiểu", "Hành động"],
    tone: "violet",
  },
  "short-lessons-with-big-impact": {
    icon: <ThunderboltOutlined />,
    metric: "10 phút",
    metricLabel: "cho một nhịp học gọn",
    steps: ["Khởi động", "Thực hành", "Ghi nhớ"],
    tone: "aqua",
  },
  "education-on-the-go-with-eduvex": {
    icon: <MobileOutlined />,
    metric: "Mọi nơi",
    metricLabel: "học đúng lúc cần",
    steps: ["Mở bài", "Tiếp tục", "Hoàn thành"],
    tone: "sky",
  },
  "blending-in-class-and-online-education": {
    icon: <BookOutlined />,
    metric: "2 không gian",
    metricLabel: "một trải nghiệm học",
    steps: ["Tại lớp", "Trực tuyến", "Đồng bộ"],
    tone: "indigo",
  },
  "boosting-motivation-through-play": {
    icon: <CheckCircleFilled />,
    metric: "+ động lực",
    metricLabel: "nhờ phản hồi đúng lúc",
    steps: ["Thử thách", "Phản hồi", "Tiến bộ"],
    tone: "mint",
  },
  "key-metrics-for-effective-e-learning": {
    icon: <BarChartOutlined />,
    metric: "5 chỉ số",
    metricLabel: "đủ để ra quyết định",
    steps: ["Tham gia", "Hoàn thành", "Kết quả"],
    tone: "blue",
  },
  "engaging-students-beyond-the-screen": {
    icon: <TeamOutlined />,
    metric: "1 cộng đồng",
    metricLabel: "học cùng nhau",
    steps: ["Kết nối", "Trao đổi", "Đồng hành"],
    tone: "cyan",
  },
};

export function ArticleCover({ post, large = false }: { post: MarketingBlogPost; large?: boolean }) {
  const spec = coverSpecs[post.slug];
  return (
    <div className={`${styles.articleVisual} ${large ? styles.articleVisualLarge : ""}`} data-tone={spec.tone}>
      <div className={styles.articleVisualTop}>
        <span className={styles.articleBrand}>
          <Image alt="" aria-hidden="true" height={192} src="/marketing/brand/dolphinx-dolphin-mark-192.webp" width={192} />
          <span><strong>DX LMS</strong><small>INSIGHTS</small></span>
        </span>
        <span className={styles.articleCategory}>{post.category}</span>
      </div>
      <div className={styles.articleVisualMain}>
        <span className={styles.articleVisualIcon}>{spec.icon}</span>
        <span><small>GÓC NHÌN THỰC HÀNH</small><strong>{spec.metric}</strong><p>{spec.metricLabel}</p></span>
      </div>
      <div className={styles.articleFlow}>
        {spec.steps.map((step, index) => (
          <span key={step}><i>{index + 1}</i><strong>{step}</strong></span>
        ))}
      </div>
    </div>
  );
}
