import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

const principles = [
  {
    icon: "apartment" as const,
    title: "Một workspace cho mỗi tổ chức",
    copy: "Ngữ cảnh, nhận diện và module được giữ đúng theo từng tenant.",
  },
  {
    icon: "control" as const,
    title: "Đúng quyền cho đúng vai trò",
    copy: "Mỗi người nhìn thấy chức năng phù hợp với trách nhiệm của mình.",
  },
  {
    icon: "setting" as const,
    title: "Tập trung vào vận hành thật",
    copy: "Thông tin cốt lõi được nối liền thay vì nằm rời rạc ở nhiều nơi.",
  },
];

const services = [
  {
    icon: "team" as const,
    title: "Người dùng",
    copy: "Quản lý thành viên trong tổ chức và đặt vai trò phù hợp cho từng người.",
  },
  {
    icon: "book" as const,
    title: "Khóa học",
    copy: "Tổ chức khóa học và nội dung đào tạo trong cùng một workspace.",
  },
  {
    icon: "userSwitch" as const,
    title: "Ghi danh",
    copy: "Kết nối học viên với đúng khóa học và phạm vi tham gia.",
  },
  {
    icon: "fileDone" as const,
    title: "Bài tập",
    copy: "Giao và quản lý bài tập bên cạnh nội dung học tập liên quan.",
  },
  {
    icon: "dashboard" as const,
    title: "Dashboard",
    copy: "Đưa thông tin vận hành cần thiết về một màn hình tổng quan.",
  },
  {
    icon: "bgColors" as const,
    title: "Tùy biến tenant",
    copy: "Áp dụng tên, logo, màu chủ đạo và module theo từng tổ chức.",
  },
];

export function AboutSection() {
  return (
    <section
      className={`${styles.section} ${styles.aboutSection}`}
      id="gioi-thieu"
      aria-labelledby="about-title"
      data-section="about"
    >
      <div className={`${styles.container} ${styles.aboutGrid}`}>
        <div className={styles.sectionLead}>
          <span className={styles.sectionLabel}>DX LMS là gì?</span>
          <h2 id="about-title">Gọn để bắt đầu. Rõ để cùng vận hành.</h2>
        </div>
        <div className={styles.aboutCopy}>
          <p className={styles.aboutStatement}>
            Một nền tảng Web giúp trung tâm đào tạo đưa các phần việc cốt lõi
            về cùng một không gian số.
          </p>
          <p>
            Người dùng, khóa học, ghi danh và bài tập chia sẻ cùng ngữ cảnh tổ
            chức. Dashboard, phân quyền và tùy biến tenant giúp mỗi workspace
            phản ánh đúng cách đơn vị đang vận hành.
          </p>
          <ul className={styles.aboutFeatures} aria-label="Nền tảng DX LMS">
            <li><span aria-hidden="true" /> Multi-tenant</li>
            <li><span aria-hidden="true" /> Phân quyền theo vai trò</li>
            <li><span aria-hidden="true" /> Tùy biến theo tổ chức</li>
            <li><span aria-hidden="true" /> Trải nghiệm Web thống nhất</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function MotivationSection() {
  return (
    <section
      className={`${styles.section} ${styles.motivationSection}`}
      id="gia-tri"
      aria-labelledby="motivation-title"
      data-section="motivation"
    >
      <div className={styles.container}>
        <div className={styles.motivationHeading}>
          <span className={styles.sectionLabel}>Vì sao DX LMS</span>
          <h2 id="motivation-title">Bớt phân mảnh. Thêm một nhịp làm việc chung.</h2>
          <p>
            DX LMS ưu tiên sự mạch lạc trong vận hành thay vì những cam kết
            bằng số chưa được kiểm chứng.
          </p>
        </div>
        <div className={styles.valueGrid}>
          {principles.map((principle) => (
            <article className={styles.valueCard} key={principle.title}>
              <span className={styles.valueIcon}><MarketingIcon name={principle.icon} /></span>
              <h3>{principle.title}</h3>
              <p>{principle.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServicesSection() {
  return (
    <section
      className={`${styles.section} ${styles.servicesSection}`}
      id="nang-luc"
      aria-labelledby="services-title"
      data-section="services"
    >
      <div className={styles.serviceDecorationOne} aria-hidden="true" />
      <div className={styles.serviceDecorationTwo} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.servicesHeading}>
          <span className={styles.sectionLabelLight}>Năng lực đang có</span>
          <h2 id="services-title">Những module Web tạo nên DX LMS.</h2>
          <p>
            Sáu năng lực đang hiện diện trong sản phẩm, được thiết kế để làm
            việc cùng nhau trong phạm vi của một tổ chức.
          </p>
        </div>
        <div className={styles.serviceGrid}>
          {services.map((service) => (
            <article className={styles.serviceCard} key={service.title}>
              <span className={styles.serviceIcon}><MarketingIcon name={service.icon} /></span>
              <h3>{service.title}</h3>
              <p>{service.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
