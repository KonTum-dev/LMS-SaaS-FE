"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";
import { SectionMascot } from "./section-mascot";

const principles = [
  {
    icon: "book" as const,
    title: "Nhẹ cho việc dạy hằng ngày",
    copy: "Mở lớp, xếp buổi, ghi danh và điểm danh mà không cần dựng một bộ máy phức tạp.",
  },
  {
    icon: "control" as const,
    title: "Rõ cho đội ngũ vận hành",
    copy: "Giáo viên, quản trị, học viên và phụ huynh chỉ thấy phần việc đúng với vai trò.",
  },
  {
    icon: "apartment" as const,
    title: "Vững khi mở thêm cơ sở",
    copy: "Phân quyền theo chi nhánh, tổng hợp báo cáo và giữ dữ liệu trong cùng một tổ chức.",
  },
];

const services = [
  {
    icon: "book" as const,
    title: "Lớp học & lịch học",
    copy: "Tạo lớp từ khóa học, phân công nhiều giáo viên và quản lý từng buổi học.",
  },
  {
    icon: "checkCircle" as const,
    title: "Điểm danh theo buổi",
    copy: "Ghi nhận có mặt, đi muộn, vắng và có phép trên đúng danh sách của lớp.",
  },
  {
    icon: "userSwitch" as const,
    title: "Học viên & phụ huynh",
    copy: "Liên kết phụ huynh với đúng học viên và tách rõ quyền xem học tập, học phí.",
  },
  {
    icon: "fileDone" as const,
    title: "Học phí & thu tiền",
    copy: "Lập phiếu học phí, phát hành, ghi nhận thanh toán và theo dõi số dư còn lại.",
  },
  {
    icon: "apartment" as const,
    title: "Cơ cấu nhiều chi nhánh",
    copy: "Tổ chức trụ sở, chi nhánh, phòng ban và gắn lớp học vào đúng đơn vị.",
  },
  {
    icon: "safety" as const,
    title: "Phân quyền theo phạm vi",
    copy: "Giao quyền xem, vận hành hoặc quản lý một đơn vị và các đơn vị con.",
  },
  {
    icon: "dashboard" as const,
    title: "Báo cáo vận hành",
    copy: "Theo dõi lớp, học viên, điểm danh và học phí theo toàn trung tâm hoặc từng nhánh.",
  },
  {
    icon: "team" as const,
    title: "Thông báo & nhập dữ liệu",
    copy: "Gửi thông báo đúng nhóm và nhập danh sách thành viên hàng loạt từ CSV có kiểm tra.",
  },
];

export function AboutSection() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.aboutSection}`}
      id="gioi-thieu"
      aria-labelledby="about-title"
      data-section="about"
    >
      <div className={`${styles.container} ${styles.aboutGrid}`}>
        <div className={styles.sectionLead} data-reveal>
          <span className={styles.sectionLabel}>{t("DX LMS là gì?")}</span>
          <h2 id="about-title">
            {t("Bắt đầu gọn. Mở rộng mà không phải đổi hệ thống.")}
          </h2>
        </div>
        <SectionMascot variant="about" />
        <div className={styles.aboutCopy} data-reveal>
          <p className={styles.aboutStatement}>
            {t(
              "DX LMS phù hợp từ lớp học do một giáo viên tự vận hành đến trung tâm có nhiều phòng ban và chi nhánh.",
            )}
          </p>
          <p>
            {t(
              "Bạn dùng đúng phần mình cần ở hiện tại. Khi quy mô thay đổi, dữ liệu lớp học, học viên, phụ huynh và học phí vẫn nằm trong một mạch vận hành, không phải chuyển sang hệ thống khác.",
            )}
          </p>
          <ul
            className={styles.aboutFeatures}
            aria-label={t("Nền tảng DX LMS")}
          >
            <li>
              <span aria-hidden="true" />{" "}
              {t("Không bắt buộc tạo chi nhánh cho lớp nhỏ")}
            </li>
            <li>
              <span aria-hidden="true" />{" "}
              {t("Nhiều giáo viên trong cùng một lớp")}
            </li>
            <li>
              <span aria-hidden="true" />{" "}
              {t("Phân quyền theo vai trò và đơn vị")}
            </li>
            <li>
              <span aria-hidden="true" /> {t("Dữ liệu xuyên suốt khi mở rộng")}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function MotivationSection() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.motivationSection}`}
      id="gia-tri"
      aria-labelledby="motivation-title"
      data-section="motivation"
    >
      <div className={`${styles.container} ${styles.mascotContainer}`}>
        <div className={styles.motivationHeading} data-reveal>
          <span className={styles.sectionLabel}>{t("Vì sao DX LMS")}</span>
          <h2 id="motivation-title">
            {t("Việc hôm nay đơn giản. Quy mô ngày mai vẫn kiểm soát được.")}
          </h2>
          <p>
            {t(
              "Mỗi vai trò có một góc nhìn vừa đủ, còn chủ trung tâm vẫn nắm được bức tranh chung từ lớp học đến từng chi nhánh.",
            )}
          </p>
        </div>
        <SectionMascot variant="motivation" />
        <div className={styles.valueGrid}>
          {principles.map((principle) => (
            <article
              className={styles.valueCard}
              data-reveal
              key={principle.title}
            >
              <span className={styles.valueIcon}>
                <MarketingIcon name={principle.icon} />
              </span>
              <h3>{t(principle.title)}</h3>
              <p>{t(principle.copy)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  const { t } = useI18n(marketingMessages);
  return (
    <section
      className={`${styles.section} ${styles.servicesSection}`}
      id="nang-luc"
      aria-labelledby="services-title"
      data-section="services"
    >
      <div className={styles.serviceDecorationOne} aria-hidden="true" />
      <div className={styles.serviceDecorationTwo} aria-hidden="true" />
      <div className={`${styles.container} ${styles.mascotContainer}`}>
        <div className={styles.servicesHeading} data-reveal>
          <span className={styles.sectionLabelLight}>
            {t("Năng lực đã triển khai")}
          </span>
          <h2 id="services-title">
            {t("Đủ cho lớp học. Có chiều sâu cho trung tâm.")}
          </h2>
          <p>
            {t(
              "Các phần học tập, vận hành và quản trị dùng chung dữ liệu, nhưng luôn giữ đúng tenant, vai trò và phạm vi đơn vị.",
            )}
          </p>
        </div>
        <SectionMascot variant="services" />
        <div className={styles.serviceGrid}>
          {services.map((service) => (
            <article
              className={styles.serviceCard}
              data-reveal
              key={service.title}
            >
              <span className={styles.serviceIcon}>
                <MarketingIcon name={service.icon} />
              </span>
              <h3>{t(service.title)}</h3>
              <p>{t(service.copy)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
