import { learningMessages } from "./learning-messages";
import { operationsMessages } from "./operations-messages";

const polish: Readonly<Record<string, string>> = {
  "Tùy chọn khóa học {name}": "Options for {name}",
  "Thông tin lớp": "Class details",
  "Lịch học và giảng viên": "Schedule and instructors",
  "Địa chỉ và liên hệ (không bắt buộc)": "Address and contact (optional)",
  "Tính năng và giới hạn sử dụng": "Features and usage limits",
  "JPEG, PNG hoặc WebP · tối đa 5 MB.": "JPEG, PNG or WebP · up to 5 MB.",
  "Liên kết kênh để xuất bản video bài học khi bạn sẵn sàng.": "Connect a channel to publish lesson videos when you are ready.",
  "Video chỉ được xuất bản khi bạn yêu cầu.": "Videos are published only when you choose to publish them.",
  "Kênh đã kết nối. Tính năng xuất bản hiện chưa sẵn sàng.": "Your channel is connected. Publishing is not available yet.",
  "Nội dung đã thay đổi. Tải bản mới nhất rồi thử lưu lại.": "The content has changed. Load the latest version, then save again.",
  "Bài đã lưu trữ chỉ có thể xem.": "Archived assessments are view-only.",
  "Nội dung đang nhập được giữ nguyên khi tải bản mới nhất.": "Your current work is kept when loading the latest version.",
  "Tệp đã nộp vẫn hiển thị. Các thao tác với tệp đang tạm khóa.": "Submitted files remain visible. File actions are temporarily unavailable.",
  "Bài nộp trước": "Previous submission",
  "Theo dõi kết quả làm bài theo khóa học.": "Track assessment results by course.",
  "Múi giờ: UTC": "Time zone: UTC",
  "Tổng số hóa đơn": "Total invoices",
  "Số liệu trang hiện tại": "Current page totals",
  "{count} quan hệ": "{count} relationships",
  "Soạn câu hỏi, giao bài kiểm tra và theo dõi kết quả.": "Create questions, publish assessments and track results.",
  "Thiết lập nộp bài": "Submission settings",
  "Tổng quan bài tập": "Assignment overview",
  "Xem thêm số liệu": "More statistics",
};

export const learningPolishMessages = { ...learningMessages, ...polish };
export const operationsPolishMessages = { ...operationsMessages, ...polish };
