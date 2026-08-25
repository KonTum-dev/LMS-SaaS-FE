import styles from "@/app/marketing.module.css";
import { MarketingIcon } from "./marketing-icon";

const capabilities = [
  { icon: "team" as const, title: "Người dùng", copy: "Quản lý thành viên trong tổ chức và đặt đúng vai trò cho từng người." },
  { icon: "book" as const, title: "Khóa học", copy: "Tổ chức nội dung đào tạo theo khóa học, có trang chi tiết rõ ràng." },
  { icon: "userSwitch" as const, title: "Ghi danh", copy: "Kết nối học viên với khóa học để theo dõi đúng phạm vi tham gia." },
  { icon: "fileDone" as const, title: "Bài tập", copy: "Giao và quản lý bài tập trong cùng không gian học tập của tổ chức." },
  { icon: "dashboard" as const, title: "Dashboard", copy: "Tổng hợp dữ liệu vận hành quan trọng ngay khi mở workspace." },
  { icon: "bgColors" as const, title: "Tùy biến tenant", copy: "Áp dụng tên, logo, màu sắc và module phù hợp với từng tổ chức." },
];

const roles = [
  { code: "01", title: "Quản trị nền tảng", copy: "Theo dõi và quản lý các tổ chức trên toàn hệ thống." },
  { code: "02", title: "Quản trị tổ chức", copy: "Quản lý người dùng, khóa học và cấu hình workspace của đơn vị." },
  { code: "03", title: "Giảng viên", copy: "Tiếp cận khóa học và bài tập cần thiết cho công việc giảng dạy." },
  { code: "04", title: "Học viên", copy: "Tập trung vào khóa học, nội dung và bài tập thuộc phạm vi của mình." },
];

export function ProblemSection() {
  return (
    <section className={`${styles.section} ${styles.problemSection}`} id="van-hanh" aria-labelledby="problem-title">
      <div className={styles.container}>
        <div className={styles.problemGrid}>
          <div>
            <span className={styles.eyebrowDark}>Một workspace, một luồng vận hành</span>
            <h2 id="problem-title">Khi dữ liệu đào tạo rời rạc, mỗi thao tác đều khó nhìn toàn cảnh.</h2>
          </div>
          <div className={styles.problemPoints}>
            <article><span>01</span><div><strong>Thông tin thiếu kết nối</strong><p>Người dùng, khóa học và bài tập nằm ở nhiều nơi khiến đội ngũ khó theo cùng một ngữ cảnh.</p></div></article>
            <article><span>02</span><div><strong>Vai trò chưa rõ ràng</strong><p>Mỗi người cần một phạm vi thao tác phù hợp thay vì cùng nhìn thấy mọi chức năng.</p></div></article>
            <article><span>03</span><div><strong>Trải nghiệm thiếu bản sắc</strong><p>Không gian số của trung tâm cần phản ánh tên, màu sắc và module đang vận hành.</p></div></article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CapabilitiesSection() {
  return (
    <section className={styles.section} id="san-pham" aria-labelledby="capabilities-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Năng lực cốt lõi"
          title="Đủ gọn để bắt đầu. Đủ rõ để cùng vận hành."
          copy="DX LMS tập trung vào những module Web đang có, giúp trung tâm tổ chức công việc đào tạo trên một nền tảng thống nhất."
          id="capabilities-title"
        />
        <div className={styles.capabilityGrid}>
          {capabilities.map(({ icon, title, copy }, index) => (
            <article className={styles.capabilityCard} key={title}>
              <div className={styles.cardTop}><span className={styles.iconBox}><MarketingIcon name={icon} /></span><span aria-hidden="true">0{index + 1}</span></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RolesSection() {
  return (
    <section className={`${styles.section} ${styles.rolesSection}`} id="vai-tro" aria-labelledby="roles-title">
      <div className={styles.container}>
        <div className={styles.rolesIntro}>
          <SectionHeading
            eyebrow="Đúng người, đúng việc"
            title="Mỗi vai trò thấy điều họ cần."
            copy="RBAC giúp DX LMS trình bày menu và chức năng theo trách nhiệm của từng người trong hệ thống."
            id="roles-title"
          />
          <div className={styles.roleSignal} aria-label="Bốn vai trò hiện có">
            <span><strong>4</strong> vai trò</span>
            <i aria-hidden="true" />
            <span>Một hệ thống quyền rõ ràng</span>
          </div>
        </div>
        <div className={styles.roleList}>
          {roles.map((role) => (
            <article key={role.code}>
              <span>{role.code}</span>
              <h3>{role.title}</h3>
              <p>{role.copy}</p>
              <MarketingIcon className={styles.roleCheck} name="check" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section className={`${styles.section} ${styles.trustSection}`} id="bao-mat" aria-labelledby="trust-title">
      <div className={styles.container}>
        <div className={styles.trustGrid}>
          <div className={styles.trustCopy}>
            <span className={styles.eyebrow}>Tùy biến đi cùng kiểm soát</span>
            <h2 id="trust-title">Bản sắc của trung tâm ở bên ngoài. Phạm vi truy cập rõ ràng ở bên trong.</h2>
            <p>DX LMS giữ từng tổ chức trong workspace riêng, đồng thời áp dụng cấu hình thương hiệu và module theo tenant.</p>
            <a href="#trien-khai">Xem cách triển khai <span aria-hidden="true">↘</span></a>
          </div>
          <div className={styles.trustCards}>
            <article><MarketingIcon className={styles.trustIcon} name="apartment" /><div><strong>Workspace theo tổ chức</strong><p>Ngữ cảnh tenant được duy trì trong trải nghiệm quản trị và học tập.</p></div></article>
            <article><MarketingIcon className={styles.trustIcon} name="control" /><div><strong>Phân quyền theo vai trò</strong><p>Menu và module hiển thị dựa trên vai trò cùng cấu hình của tổ chức.</p></div></article>
            <article><MarketingIcon className={styles.trustIcon} name="safety" /><div><strong>Phiên đăng nhập được xác thực</strong><p>Workspace riêng yêu cầu đăng nhập và xác thực lại phiên JWT khi tải trang.</p></div></article>
            <article><MarketingIcon className={styles.trustIcon} name="setting" /><div><strong>Tùy biến có phạm vi</strong><p>Tên, logo, màu chủ đạo và module được cấu hình theo từng tenant.</p></div></article>
          </div>
        </div>
        <div className={styles.trustBand}>
          <MarketingIcon className={styles.trustBandIcon} name="lock" />
          <p><strong>Nguyên tắc của DX LMS:</strong> chỉ đưa người dùng tới các khu vực và module phù hợp với quyền của họ.</p>
        </div>
      </div>
    </section>
  );
}

export function RolloutSection() {
  const steps = [
    { number: "01", title: "Xác định phạm vi", copy: "Chọn vai trò, module và cách tổ chức khóa học phù hợp cho giai đoạn đầu." },
    { number: "02", title: "Thiết lập tenant", copy: "Cấu hình tên, nhận diện, tài khoản quản trị và các module cần dùng." },
    { number: "03", title: "Vận hành trên workspace", copy: "Đưa người dùng, khóa học, ghi danh và bài tập vào cùng một luồng quản lý." },
  ];

  return (
    <section className={styles.section} id="trien-khai" aria-labelledby="rollout-title">
      <div className={styles.container}>
        <SectionHeading
          eyebrow="Triển khai có trọng tâm"
          title="Bắt đầu từ quy trình cần thiết nhất."
          copy="Mỗi trung tâm có thể khởi đầu với phạm vi vừa đủ, sau đó bật thêm module khi cách vận hành đã rõ."
          id="rollout-title"
        />
        <ol className={styles.rolloutSteps}>
          {steps.map((step) => (
            <li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SectionHeading({ copy, eyebrow, id, title }: { copy: string; eyebrow: string; id: string; title: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.eyebrowDark}>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}
