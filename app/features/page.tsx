import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/marketing-v2.module.css";
import { FeatureExplorer } from "@/components/marketing/feature-explorer";
import { MarketingShell, PageHero, SectionHeading } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Tính năng",
  description: "Khám phá các mô-đun học tập, vận hành, báo cáo và quản trị đa chi nhánh của DX LMS.",
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Năng lực cho toàn bộ hành trình"
        line="Một hệ thống rõ ràng."
        strong="Đúng tính năng cho từng vai trò."
        lead="DX LMS không nhồi mọi thứ vào một màn hình. Mỗi vai trò thấy đúng mô-đun, dữ liệu và thao tác thuộc trách nhiệm của mình."
        visual="features"
        secondaryHref="/pricing"
        secondaryLabel="Xem gói dịch vụ"
      />
      <section className={styles.section} aria-labelledby="feature-grid-title">
        <div className={styles.container}>
          <SectionHeading
            eyebrow="Hệ thống đầy đủ"
            title="Chọn một nhóm việc, nhìn thấy ngay cách sản phẩm vận hành"
            copy="Các mô-đun được gom theo công việc thật. Chuyển tab để xem màn hình, trạng thái và kết quả mà từng nhóm mang lại."
            id="feature-grid-title"
          />
          <FeatureExplorer />
        </div>
      </section>
      <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="next-gen-title">
        <div className={styles.container}>
          <SectionHeading
            eyebrow="Quyền truy cập có ngữ cảnh"
            title="Mỗi thao tác đều đi qua đúng lớp kiểm soát"
            copy="Giao diện chỉ hiển thị hành động khi vai trò, phạm vi tổ chức và quyền mô-đun đều hợp lệ."
            id="next-gen-title"
          />
          <div className={styles.permissionFlow} data-reveal>
            {[
              ["01", "Vai trò", "Bạn đang là quản trị viên, giảng viên, học viên hay phụ huynh?"],
              ["02", "Phạm vi", "Bạn được làm việc trên toàn tổ chức hay tại một chi nhánh cụ thể?"],
              ["03", "Mô-đun", "Workspace đang được cấp quyền sử dụng những nhóm chức năng nào?"],
              ["04", "Hành động", "Tạo, sửa, xem hoặc xuất dữ liệu chỉ mở khi mọi điều kiện đều đúng."],
            ].map(([number, title, copy]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
            ))}
          </div>
          <div className={`${styles.heroActions} ${styles.heroActionsCenter}`}><Link className={styles.button} href="/register">Tạo workspace <span className={styles.buttonIcon}>→</span></Link></div>
        </div>
      </section>
    </MarketingShell>
  );
}
