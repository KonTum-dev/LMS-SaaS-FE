import type { PaymentOrderStatus } from "@/lib/types";

export interface BillingStatusPresentation {
  color: "blue" | "green" | "red" | "orange" | "gold" | "default";
  description: string;
  label: string;
  terminal: boolean;
}

export function getBillingStatusPresentation(status: PaymentOrderStatus): BillingStatusPresentation {
  if (status === "PAID") {
    return { color: "green", description: "Thanh toán đã được IPN xác nhận và thuê bao đã cập nhật.", label: "Đã thanh toán", terminal: true };
  }
  if (status === "CANCELED") {
    return { color: "red", description: "Đơn đã hủy và không làm thay đổi thuê bao.", label: "Đã hủy", terminal: true };
  }
  if (status === "EXPIRED") {
    return { color: "default", description: "Checkout đã hết hạn sau 30 phút. IPN đến muộn vẫn sẽ được backend xác minh.", label: "Đã hết hạn", terminal: true };
  }
  if (status === "REVIEW_REQUIRED") {
    return { color: "orange", description: "SePay đã xác nhận giao dịch nhưng snapshot thuê bao đã thay đổi. Quản trị nền tảng cần đối soát.", label: "Cần đối soát", terminal: true };
  }
  if (status === "REFUND_REQUIRED") {
    return { color: "gold", description: "Giao dịch đã được gắn cờ cần hoàn tiền thủ công; hệ thống chưa thực hiện refund.", label: "Cần hoàn tiền", terminal: true };
  }
  return { color: "blue", description: "Đang chờ SePay gửi xác nhận. Bạn có thể giữ trang này mở.", label: "Đang chờ", terminal: false };
}

export function billingRefetchInterval(status?: PaymentOrderStatus, hasError = false): number | false {
  if (status === "PENDING") return 2000;
  if (status === "EXPIRED") return 10000;
  if (hasError || status) return false;
  return 2000;
}
