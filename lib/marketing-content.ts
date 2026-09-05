import type { LmsModule } from "@/lib/types";

export const marketingBlogSlugs = [
  "a-guide-to-maximizing-your-potential",
  "the-evolution-of-learning-with-eduvex",
  "eduvex-s-smart-learning-features",
  "trends-insights-from-eduvex",
  "short-lessons-with-big-impact",
  "education-on-the-go-with-eduvex",
  "blending-in-class-and-online-education",
  "boosting-motivation-through-play",
  "key-metrics-for-effective-e-learning",
  "engaging-students-beyond-the-screen",
] as const;

export type MarketingBlogSlug = (typeof marketingBlogSlugs)[number];

export type MarketingPageHref =
  | "/"
  | "/about-us"
  | "/blog"
  | `/blog/${MarketingBlogSlug}`
  | "/contact-us"
  | "/features"
  | "/forgot-password"
  | "/login"
  | "/pricing"
  | "/privacy-policy"
  | "/register"
  | "/terms-of-use";

export type ProductRoute =
  | "/assessments"
  | "/assignments"
  | "/cohorts"
  | "/communications"
  | "/courses"
  | "/guardians"
  | "/organization"
  | "/reports"
  | "/settings"
  | "/tuition";

export interface MarketingLink {
  href: MarketingPageHref;
  label: string;
}

export interface MarketingNavigation {
  items: readonly MarketingLink[];
  entryCta: { href: "/dashboard"; label: string };
}

export interface MarketingFooterGroup {
  links: readonly MarketingLink[];
  title: string;
}

export interface MarketingFooterContent {
  groups: readonly MarketingFooterGroup[];
  note: string;
  tagline: string;
}

export interface MarketingFeature {
  capability: LmsModule;
  description: string;
  href: ProductRoute;
  id: string;
  title: string;
}

export interface MarketingOnboardingStep {
  description: string;
  href: ProductRoute | MarketingPageHref;
  id: string;
  step: 1 | 2 | 3;
  title: string;
}

export interface MarketingBenefit {
  description: string;
  id: string;
  title: string;
}

export interface MarketingCapabilityMetric {
  description: string;
  id: string;
  label: string;
  value: string;
}

export type MarketingPricingTierId =
  | "trial"
  | "center"
  | "business"
  | "enterprise";

export interface MarketingPricingTier {
  audience: string;
  cta: MarketingLink;
  description: string;
  featured: boolean;
  features: readonly string[];
  id: MarketingPricingTierId;
  name: string;
  priceLabel: string;
  priceVnd?: { monthly: number; yearly: number };
  trialDays?: 30;
}

export interface MarketingFaqItem {
  answer: string;
  id: string;
  question: string;
}

export interface MarketingBlogSection {
  heading: string;
  paragraphs: readonly string[];
  points?: readonly string[];
}

export interface MarketingBlogPost {
  category: string;
  excerpt: string;
  hero: `/marketing/blog/${string}.webp`;
  publishedAt: `${number}-${number}-${number}`;
  readingTime: `${number} phút đọc`;
  sections: readonly MarketingBlogSection[];
  slug: MarketingBlogSlug;
  title: string;
}

export const marketingNavigation = {
  items: [
    { href: "/features", label: "Tính năng" },
    { href: "/pricing", label: "Gói dịch vụ" },
    { href: "/blog", label: "Bài viết" },
  ],
  entryCta: { href: "/dashboard", label: "Vào LMS" },
} as const satisfies MarketingNavigation;

export const marketingFooterContent = {
  tagline:
    "Một không gian thống nhất để tổ chức khóa học, lớp học, học viên và vận hành trung tâm.",
  groups: [
    {
      title: "Sản phẩm",
      links: [
        { href: "/features", label: "Tính năng" },
        { href: "/pricing", label: "Gói dịch vụ" },
        { href: "/register", label: "Dùng thử 30 ngày" },
      ],
    },
    {
      title: "DX LMS",
      links: [
        { href: "/about-us", label: "Về chúng tôi" },
        { href: "/blog", label: "Bài viết" },
        { href: "/contact-us", label: "Liên hệ" },
      ],
    },
    {
      title: "Tài khoản",
      links: [
        { href: "/login", label: "Đăng nhập" },
        { href: "/register", label: "Tạo workspace" },
        { href: "/forgot-password", label: "Khôi phục mật khẩu" },
      ],
    },
    {
      title: "Pháp lý",
      links: [
        { href: "/terms-of-use", label: "Điều khoản sử dụng" },
        { href: "/privacy-policy", label: "Chính sách riêng tư" },
      ],
    },
  ],
  note: "DX LMS · Một sản phẩm của DolphinX Studio.",
} as const satisfies MarketingFooterContent;

export const marketingFeatures = [
  {
    id: "courses-curriculum",
    capability: "COURSES",
    href: "/courses",
    title: "Khóa học và giáo trình",
    description:
      "Xây cấu trúc chương, bài học và nội dung theo từng khóa học; quản lý trạng thái nháp, xuất bản và lưu trữ rõ ràng.",
  },
  {
    id: "cohorts-attendance",
    capability: "COHORTS",
    href: "/cohorts",
    title: "Lớp học và điểm danh",
    description:
      "Tổ chức lớp từ khóa học, phân công giảng viên, lên lịch buổi học và ghi nhận chuyên cần trên đúng danh sách học viên.",
  },
  {
    id: "assignments-grading",
    capability: "ASSIGNMENTS",
    href: "/assignments",
    title: "Bài tập và chấm bài",
    description:
      "Giao bài theo khóa học, tiếp nhận phần nộp và giúp giảng viên theo dõi hàng đợi chấm trong một luồng công việc.",
  },
  {
    id: "assessments-results",
    capability: "ASSESSMENTS",
    href: "/assessments",
    title: "Bài kiểm tra và kết quả",
    description:
      "Soạn bài kiểm tra, tổ chức lượt làm, lưu câu trả lời và trả kết quả theo quyền của giảng viên hoặc học viên.",
  },
  {
    id: "guardians-learners",
    capability: "GUARDIANS",
    href: "/guardians",
    title: "Học viên và phụ huynh",
    description:
      "Liên kết người giám hộ với đúng học viên để mỗi bên xem thông tin phù hợp mà không mở rộng quyền ngoài phạm vi.",
  },
  {
    id: "tuition-payments",
    capability: "TUITION",
    href: "/tuition",
    title: "Học phí và thanh toán",
    description:
      "Lập khoản phải thu, theo dõi số tiền đã nhận, số dư và trạng thái thanh toán trong workspace của tổ chức.",
  },
  {
    id: "organization-structure",
    capability: "ORGANIZATION_STRUCTURE",
    href: "/organization",
    title: "Cơ cấu nhiều chi nhánh",
    description:
      "Mô hình hóa trụ sở, chi nhánh và đơn vị con; giao phạm vi vận hành cho thành viên theo đúng cơ cấu thực tế.",
  },
  {
    id: "operations-reports",
    capability: "REPORTS",
    href: "/reports",
    title: "Báo cáo vận hành",
    description:
      "Tổng hợp lớp học, học viên, tiến độ, chuyên cần và học phí ở cấp tổ chức hoặc theo từng đơn vị được phép xem.",
  },
  {
    id: "communications-scope",
    capability: "COMMUNICATIONS",
    href: "/communications",
    title: "Thông báo đúng phạm vi",
    description:
      "Soạn và gửi thông báo tới đúng nhóm người nhận, đồng thời theo dõi trạng thái xử lý trong trung tâm thông báo.",
  },
] as const satisfies readonly MarketingFeature[];

export const marketingOnboardingSteps = [
  {
    id: "create-account",
    step: 1,
    href: "/register",
    title: "Tạo tài khoản",
    description:
      "Đăng ký bằng email và đặt tên cho trung tâm của bạn.",
  },
  {
    id: "personalize-workspace",
    step: 2,
    href: "/settings",
    title: "Mời đội ngũ",
    description:
      "Mời giáo viên, học viên và chọn vai trò cho từng người.",
  },
  {
    id: "launch-learning",
    step: 3,
    href: "/courses",
    title: "Mở khóa học đầu tiên",
    description:
      "Thêm nội dung, tạo lớp và bắt đầu theo dõi việc học.",
  },
] as const satisfies readonly MarketingOnboardingStep[];

export const marketingBenefits = [
  {
    id: "one-operating-flow",
    title: "Một mạch vận hành xuyên suốt",
    description:
      "Khóa học, lớp, bài tập, kiểm tra, học phí và báo cáo dùng chung ngữ cảnh thay vì nằm ở nhiều bảng tính rời rạc.",
  },
  {
    id: "role-aware-experience",
    title: "Mỗi vai trò thấy đúng phần việc",
    description:
      "Quản trị viên, giảng viên, học viên và phụ huynh nhận giao diện cùng quyền thao tác phù hợp với trách nhiệm.",
  },
  {
    id: "tenant-isolation",
    title: "Dữ liệu tách biệt theo tổ chức",
    description:
      "Mỗi workspace giữ dữ liệu và cấu hình riêng; thành viên có thể chuyển workspace mà không trộn lẫn phạm vi.",
  },
  {
    id: "grow-by-branch",
    title: "Mở rộng theo cơ cấu thực tế",
    description:
      "Bắt đầu với một lớp nhỏ rồi bổ sung phòng ban, chi nhánh và quyền theo đơn vị khi tổ chức phát triển.",
  },
] as const satisfies readonly MarketingBenefit[];

export const marketingCapabilityMetrics = [
  {
    id: "roles",
    value: "5 vai trò",
    label: "Phân tách trách nhiệm",
    description:
      "Quản trị nền tảng, quản trị tổ chức, giảng viên, học viên và phụ huynh.",
  },
  {
    id: "modules",
    value: "12 mô-đun",
    label: "Quyền truy cập theo gói",
    description:
      "Các mô-đun nghiệp vụ được bật theo quyền hiệu lực của từng workspace.",
  },
  {
    id: "workspaces",
    value: "Đa workspace",
    label: "Một tài khoản, nhiều tổ chức",
    description:
      "Thành viên có thể chuyển giữa các workspace mà họ đã được cấp quyền tham gia.",
  },
  {
    id: "organization-scope",
    value: "Theo chi nhánh",
    label: "Phạm vi vận hành rõ ràng",
    description:
      "Quyền có thể áp dụng toàn tổ chức hoặc giới hạn tại một đơn vị và các đơn vị con.",
  },
] as const satisfies readonly MarketingCapabilityMetric[];

export const marketingPricingTiers = [
  {
    id: "trial",
    name: "Dùng thử 30 ngày",
    audience: "Dành cho workspace mới",
    description:
      "Trải nghiệm quyền và hạn mức của gói Center trước khi quyết định tiếp tục sử dụng.",
    priceLabel: "Miễn phí trong 30 ngày",
    trialDays: 30,
    featured: false,
    features: [
      "Không yêu cầu thông tin thanh toán khi đăng ký",
      "Hạn mức kích hoạt đồng thời 1.000 học viên",
      "Một kỳ dùng thử cho mỗi workspace mới",
    ],
    cta: { href: "/register", label: "Tạo workspace" },
  },
  {
    id: "center",
    name: "Center",
    audience: "Dành cho lớp học và trung tâm vừa",
    description:
      "Một mức giá cố định để vận hành khóa học, lớp học và đội ngũ trong cùng workspace.",
    priceLabel: "299.000đ / tháng",
    priceVnd: { monthly: 299000, yearly: 2990000 },
    featured: true,
    features: [
      "Hạn mức kích hoạt đồng thời 1.000 học viên",
      "Khóa học, lớp học và đánh giá",
      "Học phí, phụ huynh và báo cáo",
    ],
    cta: { href: "/register", label: "Dùng thử gói Center" },
  },
  {
    id: "business",
    name: "Business",
    audience: "Dành cho trung tâm và chuỗi đang mở rộng",
    description:
      "Tăng hạn mức học viên cho mô hình có nhiều lớp, đội ngũ và đơn vị cùng vận hành.",
    priceLabel: "799.000đ / tháng",
    priceVnd: { monthly: 799000, yearly: 7990000 },
    featured: false,
    features: [
      "Hạn mức kích hoạt đồng thời 5.000 học viên",
      "Đầy đủ tính năng của Center",
      "Cơ cấu đơn vị và phân quyền theo phạm vi",
    ],
    cta: { href: "/register", label: "Dùng thử rồi nâng cấp" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "Dành cho tổ chức cần trên 5.000 học viên",
    description:
      "Enterprise chưa mở tự phục vụ; hạn mức và lộ trình triển khai được xác định theo quy mô thực tế sau giai đoạn dùng thử Center.",
    priceLabel: "Theo phương án triển khai",
    featured: false,
    features: [
      "Hạn mức kích hoạt đồng thời trên 5.000 học viên",
      "Phạm vi truy cập theo cơ cấu tổ chức",
      "Chưa mở đăng ký và nâng cấp tự phục vụ",
    ],
    cta: { href: "/contact-us", label: "Trao đổi nhu cầu" },
  },
] as const satisfies readonly MarketingPricingTier[];

export const marketingFaqItems = [
  {
    id: "trial-duration",
    question: "Kỳ dùng thử của DX LMS kéo dài bao lâu?",
    answer:
      "Workspace mới được kích hoạt dùng thử 30 ngày. Ngày kết thúc cụ thể được hiển thị trong khu vực gói và thanh toán sau khi đăng ký.",
  },
  {
    id: "trial-payment-details",
    question: "Tôi có phải nhập thông tin thanh toán khi dùng thử không?",
    answer:
      "Không. Luồng tạo workspace dùng thử không yêu cầu thông tin thanh toán. Bạn chỉ chọn gói khi đã sẵn sàng tiếp tục sử dụng.",
  },
  {
    id: "trial-per-workspace",
    question: "Mời thêm thành viên có tạo thêm trial không?",
    answer:
      "Không. Trial được cấp một lần cho workspace mới, không cấp lại theo từng tài khoản hoặc lời mời thành viên.",
  },
  {
    id: "active-learners",
    question: "Học viên đang hoạt động được tính như thế nào?",
    answer:
      "Một học viên được tính khi họ có membership đang hoạt động với vai trò học viên trong workspace (tương ứng trạng thái ACTIVE và vai trò LEARNER). Hạn mức được kiểm tra khi kích hoạt học viên mới; chuyển xuống gói thấp hơn không tự động vô hiệu hóa học viên đang hoạt động. Đây không phải số lượt đăng nhập theo tháng.",
  },
  {
    id: "roles",
    question: "DX LMS hỗ trợ những vai trò nào?",
    answer:
      "Hệ thống phân biệt quản trị nền tảng, quản trị tổ chức, giảng viên, học viên và phụ huynh. Menu cùng thao tác được giới hạn theo vai trò hiệu lực.",
  },
  {
    id: "branches",
    question: "Một trung tâm nhiều chi nhánh có dùng chung được không?",
    answer:
      "Có. Tổ chức có thể tạo cây đơn vị, gắn hoạt động vào đúng chi nhánh và giao quyền toàn cục hoặc theo một phạm vi đơn vị.",
  },
  {
    id: "modules",
    question: "Tất cả workspace có cùng bộ tính năng không?",
    answer:
      "Không nhất thiết. Mô-đun và hạn mức được xác định bởi quyền truy cập hiệu lực của gói; giao diện chỉ mở những khu vực workspace được phép dùng.",
  },
  {
    id: "subscription-expiry",
    question: "Điều gì xảy ra khi quyền thuê bao không còn hiệu lực?",
    answer:
      "Tùy trạng thái thuê bao, workspace có thể chuyển sang chỉ đọc: thành viên vẫn xem khu vực được phép nhưng thao tác thay đổi dữ liệu bị khóa cho tới khi quyền ghi được khôi phục.",
  },
] as const satisfies readonly MarketingFaqItem[];

export const marketingBlogPosts = [
  {
    slug: "a-guide-to-maximizing-your-potential",
    title: "Tối đa hóa tiềm năng học tập bằng một lộ trình có thể đo lường",
    excerpt:
      "Biến mục tiêu lớn thành nhịp học rõ ràng, theo dõi tiến độ thật và điều chỉnh dựa trên dữ liệu thay vì cảm giác.",
    category: "Phát triển học tập",
    readingTime: "6 phút đọc",
    publishedAt: "2026-08-28",
    hero: "/marketing/blog/learning-path-v2.webp",
    sections: [
      {
        heading: "Bắt đầu từ kết quả cần đạt",
        paragraphs: [
          "Một lộ trình tốt không bắt đầu bằng danh sách thật dài các bài học. Nó bắt đầu bằng việc xác định người học cần làm được gì, trong bối cảnh nào và bằng tiêu chí nào có thể quan sát.",
          "Khi kết quả được diễn đạt rõ, người dạy có thể chọn nội dung vừa đủ và người học hiểu vì sao mỗi hoạt động xuất hiện trong khóa học.",
        ],
        points: [
          "Mô tả năng lực đầu ra bằng hành động cụ thể",
          "Chia mục tiêu thành các mốc có thể hoàn thành",
          "Gắn từng mốc với bài học, bài tập hoặc bài kiểm tra",
        ],
      },
      {
        heading: "Thiết kế nhịp học bền vững",
        paragraphs: [
          "Tiến bộ thường đến từ những phiên học đều đặn hơn là một lần học kéo dài. Hãy sắp xếp nội dung theo các chặng ngắn, xen kẽ phần giải thích, thực hành và phản hồi.",
          "Trong DX LMS, cấu trúc chương và bài học giúp người dạy giữ mạch nội dung, còn tiến độ giúp người học nhìn thấy phần đã hoàn thành và bước tiếp theo.",
        ],
      },
      {
        heading: "Dùng dữ liệu để điều chỉnh",
        paragraphs: [
          "Điểm số chỉ là một tín hiệu. Chuyên cần, tỷ lệ hoàn thành bài học, chất lượng bài nộp và những câu hỏi thường bị bỏ lỡ mới tạo nên bức tranh có ích.",
          "Định kỳ xem lại các tín hiệu này để thu gọn nội dung gây nhiễu, bổ sung hỗ trợ đúng lúc và giữ mục tiêu học tập trong tầm với.",
        ],
        points: [
          "Kiểm tra tiến độ theo mốc thay vì đợi cuối khóa",
          "Phản hồi vào hành vi có thể cải thiện",
          "Cập nhật lộ trình khi dữ liệu cho thấy người học đang mắc kẹt",
        ],
      },
      {
        heading: "Biến tiến bộ thành thói quen",
        paragraphs: [
          "Một hệ thống chỉ hữu ích khi nó giúp hành động tiếp theo trở nên rõ ràng. Kết thúc mỗi tuần bằng việc ghi nhận phần đã hoàn thành, chọn một ưu tiên mới và dành sẵn thời gian cho ưu tiên đó.",
        ],
      },
    ],
  },
  {
    slug: "the-evolution-of-learning-with-eduvex",
    title: "Từ lớp học rời rạc đến hệ sinh thái học tập liền mạch",
    excerpt:
      "Nhìn lại cách công nghệ học tập chuyển từ kho tài liệu sang một hệ thống kết nối nội dung, vận hành và trải nghiệm người học.",
    category: "Xu hướng giáo dục",
    readingTime: "7 phút đọc",
    publishedAt: "2026-08-21",
    hero: "/marketing/blog/blended-class-v2.webp",
    sections: [
      {
        heading: "Giai đoạn số hóa tài liệu",
        paragraphs: [
          "Những nền tảng học tập đầu tiên chủ yếu giải quyết việc đưa tài liệu lên mạng. Giá trị rất rõ: người học có thể truy cập nội dung mà không phụ thuộc vào tập giấy hay một phòng học cụ thể.",
          "Tuy nhiên, tài liệu số chưa tự tạo thành trải nghiệm học tập. Lịch học, ghi danh, phản hồi và theo dõi vẫn thường nằm ở những công cụ khác nhau.",
        ],
      },
      {
        heading: "Kết nối nội dung với vận hành",
        paragraphs: [
          "Bước tiến quan trọng của LMS hiện đại là kết nối giáo trình với lớp học thực tế. Một khóa học có thể được dùng cho nhiều lớp, mỗi lớp có lịch, giảng viên và danh sách học viên riêng.",
          "Khi điểm danh, bài tập và kết quả kiểm tra nằm cùng ngữ cảnh, đội ngũ bớt thời gian đối chiếu thủ công và có thể tập trung vào hỗ trợ người học.",
        ],
        points: [
          "Một nguồn giáo trình cho nhiều lớp triển khai",
          "Dữ liệu tiến độ đi cùng đúng học viên và khóa học",
          "Báo cáo được tổng hợp từ hoạt động thực thay vì nhập lại",
        ],
      },
      {
        heading: "Cá nhân hóa bằng quyền và phạm vi",
        paragraphs: [
          "Cá nhân hóa không chỉ là đề xuất nội dung. Trong vận hành, đó còn là việc mỗi người thấy đúng lớp, đúng học viên và đúng thao tác thuộc trách nhiệm của mình.",
          "Một nền tảng đa tổ chức cần tách dữ liệu theo workspace, sau đó áp dụng vai trò và phạm vi đơn vị để trải nghiệm vừa gọn vừa an toàn.",
        ],
      },
      {
        heading: "Tương lai là khả năng thích nghi",
        paragraphs: [
          "Tổ chức giáo dục thay đổi liên tục về quy mô, chương trình và cách phối hợp. Hệ thống bền vững là hệ thống cho phép bắt đầu nhỏ, mở thêm mô-đun và phân quyền sâu hơn mà không phải chuyển dữ liệu sang một nền tảng khác.",
        ],
      },
    ],
  },
  {
    slug: "eduvex-s-smart-learning-features",
    title: "Những tính năng LMS thông minh bắt đầu từ quy trình rõ ràng",
    excerpt:
      "Một tính năng chỉ thực sự thông minh khi giảm thao tác lặp lại, đưa đúng thông tin tới đúng vai trò và giữ dữ liệu nhất quán.",
    category: "Vận hành LMS",
    readingTime: "6 phút đọc",
    publishedAt: "2026-08-14",
    hero: "/marketing/blog/teaching-workflow-v2.webp",
    sections: [
      {
        heading: "Thông minh không đồng nghĩa với phức tạp",
        paragraphs: [
          "Người dùng không cần nhìn thấy mọi khả năng của hệ thống trong cùng một màn hình. Một trải nghiệm tốt ưu tiên công việc hiện tại và ẩn những khu vực không thuộc vai trò hoặc gói đang sử dụng.",
          "Đó là lý do quyền theo mô-đun, vai trò và phạm vi tổ chức phải được xem là nền tảng của sản phẩm chứ không phải phần cấu hình bổ sung.",
        ],
      },
      {
        heading: "Ba luồng tạo ra khác biệt hằng ngày",
        paragraphs: [
          "Khóa học và giáo trình giúp nội dung có cấu trúc. Lớp học và điểm danh biến cấu trúc đó thành hoạt động thực tế. Bài tập cùng bài kiểm tra tạo vòng phản hồi cho người dạy và người học.",
        ],
        points: [
          "Tái sử dụng giáo trình mà vẫn tách từng lớp vận hành",
          "Ghi nhận chuyên cần trên đúng buổi học",
          "Theo dõi bài nộp, chấm điểm và kết quả theo quyền",
        ],
      },
      {
        heading: "Dữ liệu chung, góc nhìn khác nhau",
        paragraphs: [
          "Quản trị viên cần bức tranh toàn tổ chức, giảng viên cần lớp mình phụ trách, học viên cần việc phải hoàn thành và phụ huynh cần thông tin của đúng người học liên kết.",
          "DX LMS sử dụng cùng nguồn dữ liệu nhưng trình bày theo ngữ cảnh, nhờ đó giảm bản sao và hạn chế sai lệch giữa các bộ phận.",
        ],
      },
      {
        heading: "Tự động hóa phải có trạng thái rõ ràng",
        paragraphs: [
          "Thông báo, thanh toán hay nhập dữ liệu hàng loạt đều có thể thất bại. Một quy trình đáng tin cậy cần hiển thị trạng thái, lỗi có thể hành động và khả năng thử lại thay vì chỉ báo rằng yêu cầu đã được gửi.",
        ],
      },
    ],
  },
  {
    slug: "trends-insights-from-eduvex",
    title: "Bốn xu hướng đang định hình cách trung tâm đào tạo vận hành",
    excerpt:
      "Đa thiết bị, dữ liệu theo thời gian, quản trị theo phạm vi và trải nghiệm theo vai trò đang trở thành nền tảng của LMS hiện đại.",
    category: "Phân tích xu hướng",
    readingTime: "8 phút đọc",
    publishedAt: "2026-08-07",
    hero: "/marketing/blog/trends-insights.webp",
    sections: [
      {
        heading: "Trải nghiệm theo ngữ cảnh thay cho một giao diện chung",
        paragraphs: [
          "LMS đang rời khỏi mô hình một bảng điều khiển giống nhau cho tất cả. Người dùng kỳ vọng trang đầu tiên phản ánh đúng công việc của họ và loại bỏ những lựa chọn không liên quan.",
          "Vai trò, mô-đun và phạm vi đơn vị là ba lớp giúp tạo ra trải nghiệm theo ngữ cảnh mà vẫn dùng chung một hệ thống.",
        ],
      },
      {
        heading: "Dữ liệu vận hành trở thành tín hiệu sớm",
        paragraphs: [
          "Báo cáo không còn chỉ dành cho tổng kết cuối kỳ. Chuyên cần, tiến độ và trạng thái học phí có thể cho thấy vấn đề khi vẫn còn thời gian để can thiệp.",
        ],
        points: [
          "Theo dõi lớp đang hoạt động và buổi đã hoàn thành",
          "Nhận diện học viên có tiến độ chậm",
          "Xem khoản đã thu và phần còn phải thu theo phạm vi",
        ],
      },
      {
        heading: "Tổ chức đa chi nhánh cần quản trị phân tán",
        paragraphs: [
          "Trụ sở cần tiêu chuẩn và tầm nhìn chung, trong khi chi nhánh cần đủ quyền để xử lý công việc tại chỗ. Cấp toàn quyền cho mọi quản lý hoặc tách từng chi nhánh thành hệ thống riêng đều tạo ra rủi ro.",
          "Mô hình cây đơn vị và quyền theo phạm vi giúp cân bằng hai nhu cầu: dữ liệu vẫn liền mạch nhưng trách nhiệm được giới hạn rõ.",
        ],
      },
      {
        heading: "Khả năng phục hồi là một phần của trải nghiệm",
        paragraphs: [
          "Kết nối mạng không ổn định, thao tác lặp và lỗi tích hợp là điều khó tránh. Sản phẩm học tập hiện đại cần chống gửi trùng, cho phép thử lại có kiểm soát và nói rõ điều gì đã hoặc chưa hoàn tất.",
        ],
      },
    ],
  },
  {
    slug: "short-lessons-with-big-impact",
    title: "Bài học ngắn, tác động lớn: thiết kế nội dung vừa đủ để hoàn thành",
    excerpt:
      "Cách chia nội dung thành những đơn vị nhỏ có mục tiêu, hoạt động và điểm kiểm tra rõ ràng mà không làm mất mạch kiến thức.",
    category: "Thiết kế bài học",
    readingTime: "5 phút đọc",
    publishedAt: "2026-07-31",
    hero: "/marketing/blog/short-lessons.webp",
    sections: [
      {
        heading: "Một bài học, một thay đổi có thể quan sát",
        paragraphs: [
          "Bài học ngắn hiệu quả không phải là bài dài bị cắt thành nhiều trang. Mỗi bài cần một kết quả nhỏ nhưng trọn vẹn: hiểu một khái niệm, thực hiện một thao tác hoặc đưa ra một quyết định.",
          "Tiêu đề, phần tóm tắt và thời lượng ước tính nên giúp người học biết chính xác mình sắp làm gì trước khi bắt đầu.",
        ],
      },
      {
        heading: "Giữ cấu trúc nhất quán",
        paragraphs: [
          "Một nhịp lặp quen thuộc làm giảm tải nhận thức. Người dạy có thể mở đầu bằng ngữ cảnh, trình bày điểm chính, đưa một ví dụ rồi kết thúc bằng hoạt động kiểm tra ngắn.",
        ],
        points: [
          "Mục tiêu cụ thể và có thể kiểm tra",
          "Nội dung tập trung vào một chủ đề",
          "Hoạt động áp dụng ngay sau phần giải thích",
          "Phản hồi chỉ ra bước tiếp theo",
        ],
      },
      {
        heading: "Kết nối các bài ngắn thành một lộ trình",
        paragraphs: [
          "Chương học tạo mạch liên kết giữa các bài ngắn. Thứ tự rõ ràng, trạng thái xuất bản và yêu cầu hoàn thành giúp người học tiến lên mà không phải tự đoán đường đi.",
          "Khi nội dung thay đổi, theo dõi phiên bản và tiến độ giúp đội ngũ nhận biết phần nào cần được học lại hoặc cập nhật.",
        ],
      },
      {
        heading: "Đo tác động bằng hành vi học tập",
        paragraphs: [
          "Thay vì chỉ nhìn thời lượng xem, hãy quan sát tỷ lệ hoàn thành, chất lượng bài nộp và khả năng vận dụng trong bài kiểm tra. Những tín hiệu này cho biết bài ngắn có thực sự tạo ra tiến bộ hay không.",
        ],
      },
    ],
  },
  {
    slug: "education-on-the-go-with-eduvex",
    title: "Học tập trên mọi thiết bị mà không đánh mất mạch tiến độ",
    excerpt:
      "Thiết kế trải nghiệm linh hoạt cho người học di chuyển giữa điện thoại, máy tính bảng và máy tính mà vẫn biết mình đang ở đâu.",
    category: "Học tập linh hoạt",
    readingTime: "6 phút đọc",
    publishedAt: "2026-07-24",
    hero: "/marketing/blog/learning-on-the-go.webp",
    sections: [
      {
        heading: "Di động trước hết là khả năng tiếp tục",
        paragraphs: [
          "Một giao diện vừa màn hình chưa đủ để gọi là học tập di động. Người học cần mở đúng khóa học, nhận ra bài đang thực hiện và tiếp tục mà không phải tìm lại ngữ cảnh.",
          "Tiến độ được lưu theo tài khoản và nội dung có cấu trúc rõ là hai điều kiện để quá trình chuyển thiết bị diễn ra tự nhiên.",
        ],
      },
      {
        heading: "Ưu tiên thao tác quan trọng trên màn hình nhỏ",
        paragraphs: [
          "Trên điện thoại, không gian hiển thị hạn chế buộc sản phẩm phải xếp hạng ưu tiên. Tiêu đề, trạng thái, nội dung chính và hành động tiếp theo cần xuất hiện trước những thông tin quản trị phụ.",
        ],
        points: [
          "Nút thao tác đủ lớn và có nhãn rõ",
          "Nội dung đọc được mà không cuộn ngang",
          "Trạng thái tải, lỗi và hoàn thành luôn dễ nhận biết",
        ],
      },
      {
        heading: "Thiết kế cho kết nối không ổn định",
        paragraphs: [
          "Người học di động thường gặp thay đổi mạng giữa Wi-Fi và dữ liệu di động. Yêu cầu cần có thời hạn chờ hợp lý, lỗi cần giải thích được và thao tác gửi lại không được tạo dữ liệu trùng.",
          "Với bài kiểm tra, việc giữ câu trả lời đang làm và khôi phục sau gián đoạn đặc biệt quan trọng đối với niềm tin của người học.",
        ],
      },
      {
        heading: "Trải nghiệm nhất quán không có nghĩa là giống hệt",
        paragraphs: [
          "Mục tiêu là giữ cùng dữ liệu, ngôn ngữ và hành vi cốt lõi trên mọi thiết bị. Bố cục có thể thay đổi để phù hợp màn hình, miễn là người học luôn hiểu trạng thái hiện tại và bước kế tiếp.",
        ],
      },
    ],
  },
  {
    slug: "blending-in-class-and-online-education",
    title: "Kết hợp lớp học trực tiếp và trực tuyến mà không đứt mạch",
    excerpt:
      "Thiết kế một hành trình thống nhất để hoạt động tại lớp, nội dung trực tuyến và phản hồi của giảng viên bổ trợ lẫn nhau.",
    category: "Dạy học kết hợp",
    readingTime: "6 phút đọc",
    publishedAt: "2026-07-17",
    hero: "/marketing/blog/blended-learning.webp",
    sections: [
      {
        heading: "Một hành trình học, hai không gian",
        paragraphs: [
          "Dạy học kết hợp hiệu quả không phải là phát trực tuyến toàn bộ buổi học trực tiếp. Mỗi không gian nên đảm nhiệm phần việc phù hợp: lớp học dành cho tương tác sâu, còn môi trường số giúp chuẩn bị, luyện tập và tiếp tục sau buổi học.",
          "Người học cần nhìn thấy hai phần này trong cùng một lộ trình để hiểu hoạt động nào diễn ra trước, trong và sau mỗi buổi.",
        ],
      },
      {
        heading: "Thiết kế điểm chuyển tiếp rõ ràng",
        paragraphs: [
          "Điểm dễ gây gián đoạn nhất là lúc người học chuyển từ nội dung trực tuyến sang hoạt động tại lớp hoặc ngược lại. Hãy kết thúc mỗi chặng bằng một hướng dẫn cụ thể về bước tiếp theo.",
        ],
        points: [
          "Giao phần chuẩn bị ngắn trước buổi học",
          "Dùng hoạt động tại lớp để áp dụng thay vì lặp lại nội dung",
          "Gửi bài tập hoặc tài liệu củng cố ngay sau buổi",
        ],
      },
      {
        heading: "Giữ dữ liệu trong cùng ngữ cảnh",
        paragraphs: [
          "Lịch học, điểm danh, bài học và bài nộp cần gắn với đúng lớp cùng khóa học. Khi dữ liệu nằm chung một ngữ cảnh, giảng viên có thể nhận biết người học vắng buổi nào và phần trực tuyến nào còn thiếu mà không phải ghép nhiều danh sách.",
          "DX LMS tổ chức giáo trình ở cấp khóa học và hoạt động ở cấp lớp, nhờ đó một nội dung có thể được triển khai cho nhiều nhóm mà vẫn theo dõi riêng từng nhóm.",
        ],
      },
      {
        heading: "Điều chỉnh theo nhịp của từng lớp",
        paragraphs: [
          "Không có một tỷ lệ trực tiếp và trực tuyến phù hợp cho mọi chương trình. Đội ngũ nên xem lại chuyên cần, tiến độ, bài nộp và phản hồi để quyết định phần nào cần thêm thời gian tại lớp hoặc cần được chuyển thành nội dung tự học.",
        ],
      },
    ],
  },
  {
    slug: "boosting-motivation-through-play",
    title: "Tăng động lực học tập bằng yếu tố trò chơi có mục đích",
    excerpt:
      "Dùng thử thách, phản hồi và cảm giác tiến bộ để khuyến khích người học mà không biến điểm thưởng thành mục tiêu duy nhất.",
    category: "Động lực học tập",
    readingTime: "6 phút đọc",
    publishedAt: "2026-07-10",
    hero: "/marketing/blog/gamified-motivation.webp",
    sections: [
      {
        heading: "Bắt đầu bằng hành vi học tập mong muốn",
        paragraphs: [
          "Yếu tố trò chơi chỉ có ích khi nó củng cố một hành vi có giá trị như luyện tập đều, hoàn thành phản hồi hoặc hỗ trợ bạn học. Thêm huy hiệu mà không xác định mục tiêu dễ khiến người học tập trung vào phần thưởng hơn là năng lực cần hình thành.",
          "Trước khi thiết kế thử thách, hãy mô tả hành vi nào cần được lặp lại và vì sao hành vi đó giúp người học tiến bộ.",
        ],
      },
      {
        heading: "Tạo vòng lặp thử thách và phản hồi",
        paragraphs: [
          "Một vòng lặp tốt gồm nhiệm vụ vừa sức, tín hiệu tiến độ dễ hiểu và phản hồi đủ nhanh để người học biết cách cải thiện. Mức khó có thể tăng dần khi kỹ năng đã ổn định.",
        ],
        points: [
          "Chia nhiệm vụ lớn thành các mốc có thể hoàn thành",
          "Cho phép thử lại khi mục tiêu là luyện tập",
          "Giải thích điều cần sửa thay vì chỉ hiển thị điểm",
        ],
      },
      {
        heading: "Giữ trải nghiệm công bằng và bao hàm",
        paragraphs: [
          "Bảng xếp hạng công khai có thể thúc đẩy một số người nhưng làm nản lòng những người khác. So sánh với tiến bộ của chính người học, mục tiêu nhóm hoặc chuỗi hoạt động cá nhân thường tạo không gian an toàn hơn.",
          "Người dạy cũng cần tránh thưởng cho tốc độ khi chất lượng, sự kiên trì hoặc khả năng hợp tác mới là điều chương trình muốn phát triển.",
        ],
      },
      {
        heading: "Đánh giá động lực bằng hành động thật",
        paragraphs: [
          "Số lượt nhấp vào phần thưởng không chứng minh việc học tốt hơn. Hãy theo dõi mức độ hoàn thành nội dung, chất lượng bài làm, khả năng quay lại sau phản hồi và sự tham gia qua nhiều tuần để biết thiết kế có đang hỗ trợ động lực bền vững hay không.",
        ],
      },
    ],
  },
  {
    slug: "key-metrics-for-effective-e-learning",
    title: "Các chỉ số cốt lõi để đánh giá một chương trình học trực tuyến",
    excerpt:
      "Chọn tín hiệu gắn với quyết định thực tế, kết hợp tiến độ và chất lượng thay vì phụ thuộc vào một con số tổng hợp.",
    category: "Đo lường học tập",
    readingTime: "7 phút đọc",
    publishedAt: "2026-07-03",
    hero: "/marketing/blog/learning-metrics.webp",
    sections: [
      {
        heading: "Mỗi chỉ số cần trả lời một câu hỏi",
        paragraphs: [
          "Đo lường bắt đầu từ quyết định mà đội ngũ cần đưa ra. Nếu câu hỏi là người học có theo kịp hay không, tiến độ và bài nộp phù hợp hơn số lượt đăng nhập. Nếu câu hỏi là nội dung có rõ hay không, mẫu câu trả lời sai và phản hồi định tính sẽ hữu ích hơn.",
          "Một chỉ số không dẫn tới hành động thường chỉ làm báo cáo dài hơn mà không giúp chương trình tốt lên.",
        ],
      },
      {
        heading: "Kết hợp mức độ tham gia và kết quả",
        paragraphs: [
          "Chuyên cần, tỷ lệ hoàn thành bài học và việc nộp bài cho biết người học có tham gia. Kết quả bài kiểm tra cùng chất lượng bài làm cho biết hoạt động đó có chuyển thành năng lực hay chưa.",
        ],
        points: [
          "Tiến độ bài học bắt buộc theo khóa",
          "Chuyên cần theo lớp và từng buổi",
          "Trạng thái bài nộp và phản hồi chấm",
          "Kết quả kiểm tra theo lượt làm",
        ],
      },
      {
        heading: "Đọc dữ liệu trong đúng phạm vi",
        paragraphs: [
          "Một con số trung bình toàn tổ chức có thể che khuất khác biệt giữa lớp, chi nhánh hoặc giai đoạn học. Báo cáo cần cho phép người có quyền xem từ bức tranh chung đến đúng đơn vị họ phụ trách.",
          "Khi so sánh, cần giữ cùng định nghĩa, khoảng thời gian và nhóm người học để tránh kết luận từ những tập dữ liệu không tương đương.",
        ],
      },
      {
        heading: "Biến báo cáo thành nhịp cải tiến",
        paragraphs: [
          "Hãy chọn một lịch xem lại phù hợp với tốc độ của chương trình, ghi nhận tín hiệu bất thường và giao rõ người chịu trách nhiệm phản hồi. Sau thay đổi, dùng cùng định nghĩa chỉ số để kiểm tra vấn đề đã được cải thiện hay chỉ chuyển sang nơi khác.",
        ],
      },
    ],
  },
  {
    slug: "engaging-students-beyond-the-screen",
    title: "Gắn kết học viên vượt ra ngoài màn hình",
    excerpt:
      "Kết nối bài học số với thảo luận, thực hành và phản hồi trong đời thực để người học chủ động tham gia lâu dài.",
    category: "Gắn kết người học",
    readingTime: "6 phút đọc",
    publishedAt: "2026-06-26",
    hero: "/marketing/blog/beyond-the-screen.webp",
    sections: [
      {
        heading: "Màn hình là điểm kết nối, không phải toàn bộ trải nghiệm",
        paragraphs: [
          "Nội dung trực tuyến giúp phân phối kiến thức nhất quán, nhưng sự gắn kết thường được hình thành khi người học áp dụng điều vừa học vào một tình huống có ý nghĩa. Hoạt động nên mời họ quan sát, trao đổi, thử nghiệm hoặc tạo ra một sản phẩm ngoài giao diện LMS.",
          "Nền tảng lúc này đóng vai trò chỉ đường, lưu bằng chứng và đưa phản hồi trở lại đúng người học.",
        ],
      },
      {
        heading: "Thiết kế nhiệm vụ có liên hệ thực tế",
        paragraphs: [
          "Một bài tập tốt nêu rõ bối cảnh, kết quả cần nộp và tiêu chí phản hồi. Người học có thể phỏng vấn, ghi chép quan sát, giải quyết một vấn đề tại nơi làm việc hoặc hợp tác để tạo sản phẩm chung.",
        ],
        points: [
          "Cho phép nhiều hình thức bằng chứng phù hợp mục tiêu",
          "Chia nhiệm vụ dài thành các mốc phản hồi",
          "Kết nối kết quả thực hành với bài học tiếp theo",
        ],
      },
      {
        heading: "Duy trì kết nối bằng thông báo có chọn lọc",
        paragraphs: [
          "Thông báo quá dày dễ trở thành nhiễu. Mỗi thông điệp nên có đúng nhóm người nhận, một lý do rõ và hành động tiếp theo cụ thể như chuẩn bị tài liệu, hoàn thành bài tập hoặc xem phản hồi.",
          "Với người học nhỏ tuổi, liên kết phụ huynh với đúng học viên giúp thông tin hỗ trợ đến đúng gia đình mà không mở rộng quyền xem ngoài phạm vi.",
        ],
      },
      {
        heading: "Quan sát chất lượng tham gia",
        paragraphs: [
          "Gắn kết không đồng nghĩa với ở trực tuyến thật lâu. Dấu hiệu có ý nghĩa hơn là người học hoàn thành hoạt động, đặt câu hỏi cụ thể, áp dụng phản hồi và quay lại với phiên bản tốt hơn của bài làm.",
        ],
      },
    ],
  },
] as const satisfies readonly MarketingBlogPost[];

export function getMarketingBlogPost(
  slug: string,
): MarketingBlogPost | undefined {
  return marketingBlogPosts.find((post) => post.slug === slug);
}
