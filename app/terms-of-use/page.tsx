import type { Metadata } from "next";
import styles from "@/app/marketing-v2.module.css";
import { MarketingShell, PageHero } from "@/components/marketing/site";

export const metadata: Metadata = { title: "Điều khoản sử dụng", description: "Điều khoản sử dụng nền tảng DX LMS." };

const sections = [
  ["1. Phạm vi áp dụng", "Điều khoản này điều chỉnh việc truy cập và sử dụng website cùng nền tảng DX LMS. Hợp đồng dịch vụ hoặc phụ lục riêng, nếu có, sẽ bổ sung các điều kiện áp dụng cho từng tổ chức."],
  ["2. Điều kiện người dùng", "Bạn phải có năng lực pháp lý phù hợp và được tổ chức của mình cho phép khi sử dụng workspace. Tài khoản dành cho trẻ em hoặc người học vị thành niên phải tuân theo quy định và sự đồng ý cần thiết."],
  ["3. Đăng ký và bảo mật tài khoản", "Bạn chịu trách nhiệm cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và thông báo khi nghi ngờ tài khoản bị truy cập trái phép. Không chia sẻ tài khoản cho người không được phép."],
  ["4. Sử dụng nền tảng", "Bạn chỉ được sử dụng DX LMS cho mục đích đào tạo hợp pháp, trong đúng quyền và phạm vi được cấp. Không can thiệp hệ thống, vượt quyền, quét lỗ hổng trái phép hoặc gây ảnh hưởng đến người dùng khác."],
  ["5. Nội dung và quyền sở hữu", "Tổ chức giữ quyền đối với nội dung do mình tải lên. DX LMS và các thành phần do DolphinX phát triển được bảo vệ theo pháp luật sở hữu trí tuệ; việc sử dụng dịch vụ không chuyển giao quyền sở hữu mã nguồn hay thương hiệu."],
  ["6. Nội dung do người dùng tạo", "Tổ chức chịu trách nhiệm về tính hợp pháp, quyền sử dụng và độ chính xác của tài liệu, bài học, bài nộp và dữ liệu được đưa lên workspace."],
  ["7. Gói dịch vụ và thanh toán", "Quyền truy cập mô-đun, hạn mức, chu kỳ và mức phí được xác định trong báo giá hoặc đơn hàng đã chấp thuận. Kỳ dùng thử được cấp một lần cho workspace mới theo chính sách đang hiển thị trong sản phẩm."],
  ["8. Hoàn tiền và chấm dứt", "Điều kiện hoàn tiền, gia hạn hoặc chấm dứt được áp dụng theo thỏa thuận dịch vụ cụ thể và pháp luật có liên quan. Hãy kiểm tra trạng thái đơn hàng trước khi thanh toán."],
  ["9. Quy tắc ứng xử", "Không đăng tải nội dung xâm phạm quyền của người khác, mã độc, nội dung gian lận hoặc dữ liệu mà bạn không có căn cứ xử lý."],
  ["10. Dịch vụ bên thứ ba", "Một số chức năng có thể dựa trên nhà cung cấp xác thực, thanh toán, hạ tầng hoặc truyền thông. Điều kiện của bên thứ ba có thể đồng thời áp dụng cho phần dịch vụ tương ứng."],
  ["11. Thay đổi và khả dụng", "DX LMS có thể cải tiến tính năng, thay đổi giao diện hoặc thực hiện bảo trì. Những thay đổi ảnh hưởng đáng kể đến quyền lợi sẽ được thông báo qua kênh phù hợp khi có thể."],
  ["12. Quyền riêng tư", "Việc xử lý dữ liệu cá nhân được mô tả trong Chính sách riêng tư và các thỏa thuận xử lý dữ liệu áp dụng cho từng tổ chức."],
  ["13. Giới hạn trách nhiệm", "Trong phạm vi pháp luật cho phép, trách nhiệm của các bên được xác định theo thiệt hại trực tiếp, thỏa thuận dịch vụ và các giới hạn đã được thống nhất bằng văn bản."],
  ["14. Luật áp dụng và liên hệ", "Điều khoản được giải thích theo pháp luật áp dụng được nêu trong hợp đồng dịch vụ. Kênh liên hệ pháp lý sẽ được công bố trước khi website chính thức nhận giao dịch."],
];

export default function TermsPage() {
  return <MarketingShell includeNewsletter={false}><PageHero eyebrow="Pháp lý DX LMS" line="Điều khoản" strong="sử dụng nền tảng" lead="Bản điều khoản minh bạch cho website và dịch vụ DX LMS. Ngày cập nhật: 04/09/2026." primaryHref="/contact-us" primaryLabel="Liên hệ về điều khoản" /><div className={styles.legal}><p className={styles.legalIntro}>Đây là nội dung sản phẩm đang được hoàn thiện, không thay thế tư vấn pháp lý riêng cho tổ chức của bạn. Các điều kiện thương mại chính thức phải được xác nhận trong hợp đồng hoặc đơn hàng.</p>{sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div></MarketingShell>;
}
