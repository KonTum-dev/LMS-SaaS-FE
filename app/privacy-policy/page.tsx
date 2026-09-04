import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { MarketingShell, PageHero } from "@/components/marketing/site";

export const metadata: Metadata = { title: "Chính sách riêng tư", description: "Cách DX LMS xử lý và bảo vệ dữ liệu cá nhân." };

const sections = [
  ["1. Thông tin chúng tôi xử lý", "Tùy vai trò và mô-đun, hệ thống có thể xử lý thông tin tài khoản, thành viên, khóa học, lớp học, chuyên cần, bài tập, kết quả đánh giá, quan hệ phụ huynh, học phí và nhật ký bảo mật."],
  ["2. Mục đích sử dụng", "Dữ liệu được dùng để cung cấp tính năng, xác thực người dùng, thực thi phân quyền, vận hành workspace, xử lý yêu cầu hỗ trợ, bảo vệ hệ thống và đáp ứng nghĩa vụ pháp lý."],
  ["3. Căn cứ và vai trò xử lý", "Tổ chức sử dụng DX LMS thường quyết định mục đích xử lý dữ liệu học viên và thành viên. Vai trò cụ thể của mỗi bên được xác định trong hợp đồng và quy định pháp luật áp dụng."],
  ["4. Chia sẻ dữ liệu", "Dữ liệu chỉ được chia sẻ với nhà cung cấp phụ trợ cần thiết, cơ quan có thẩm quyền khi có căn cứ hợp pháp, hoặc bên khác theo chỉ dẫn hợp lệ của tổ chức. DX LMS không bán dữ liệu cá nhân."],
  ["5. Bảo mật", "Hệ thống áp dụng tách biệt tenant, kiểm soát vai trò và phạm vi, bí mật ứng dụng, nhật ký kiểm toán cùng các biện pháp vận hành phù hợp. Không có biện pháp nào loại bỏ tuyệt đối mọi rủi ro."],
  ["6. Cookie và theo dõi", "Website hiện ưu tiên chức năng thiết yếu. Nếu bổ sung phân tích hoặc tiếp thị, cơ chế thông báo và lựa chọn phù hợp phải được triển khai trước khi thu thập dữ liệu không thiết yếu."],
  ["7. Lưu trữ và xóa", "Thời hạn lưu dữ liệu phụ thuộc mục đích xử lý, trạng thái dịch vụ, nghĩa vụ pháp lý và thỏa thuận với tổ chức. Yêu cầu xóa phải được xác minh và xử lý trong phạm vi pháp luật cho phép."],
  ["8. Quyền và lựa chọn", "Tùy nơi cư trú, bạn có thể có quyền truy cập, chỉnh sửa, hạn chế, phản đối, nhận bản sao hoặc yêu cầu xóa dữ liệu. Một số yêu cầu cần gửi qua tổ chức đang quản lý workspace."],
  ["9. Dữ liệu trẻ em", "Tổ chức phải có căn cứ phù hợp khi xử lý dữ liệu người học vị thành niên và chỉ thu thập thông tin cần thiết cho hoạt động đào tạo đã được chấp thuận."],
  ["10. Thay đổi và liên hệ", "Chính sách có thể được cập nhật khi sản phẩm hoặc yêu cầu pháp lý thay đổi. Kênh liên hệ riêng tư chính thức sẽ được công bố trước khi website production tiếp nhận dữ liệu qua biểu mẫu."],
];

export default function PrivacyPage() {
  return <MarketingShell includeNewsletter={false}><PageHero eyebrow="Dữ liệu & niềm tin" line="Chính sách" strong="riêng tư rõ ràng" lead="Giải thích những nhóm dữ liệu DX LMS có thể xử lý, lý do xử lý và lựa chọn của người dùng. Ngày cập nhật: 04/09/2026." primaryHref="/contact-us" primaryLabel="Hỏi về dữ liệu" /><div className={styles.legal}><p className={styles.legalIntro}>Bản chính sách này cần được rà soát pháp lý và bổ sung thông tin pháp nhân, địa chỉ cùng kênh liên hệ trước khi dùng làm văn bản production chính thức.</p>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></MarketingShell>;
}
