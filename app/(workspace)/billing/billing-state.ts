import type { PaymentOrderStatus } from "@/lib/types";

export interface BillingStatusPresentation {
  color: "blue" | "green" | "red" | "orange" | "gold" | "default";
  description: string;
  label: string;
  terminal: boolean;
}

export function getBillingStatusPresentation(status: PaymentOrderStatus): BillingStatusPresentation {
  if (status === "PAID") {
    return { color: "green", description: "Thanh toán đã được xác nhận và gói thuê bao đã cập nhật.", label: "Đã thanh toán", terminal: true };
  }
  if (status === "CANCELED") {
    return { color: "red", description: "Đơn đã hủy và không làm thay đổi thuê bao.", label: "Đã hủy", terminal: true };
  }
  if (status === "EXPIRED") {
    return { color: "default", description: "Yêu cầu thanh toán đã hết hạn sau 30 phút. Giao dịch đến muộn vẫn sẽ được hệ thống kiểm tra.", label: "Đã hết hạn", terminal: true };
  }
  if (status === "REVIEW_REQUIRED") {
    return { color: "orange", description: "Cổng thanh toán đã xác nhận giao dịch nhưng thông tin thuê bao đã thay đổi. Quản trị nền tảng cần kiểm tra.", label: "Cần đối soát", terminal: true };
  }
  if (status === "REFUND_REQUIRED") {
    return { color: "gold", description: "Giao dịch cần được hoàn tiền thủ công; hệ thống chưa tự động hoàn tiền.", label: "Cần hoàn tiền", terminal: true };
  }
  return { color: "blue", description: "Đang chờ cổng thanh toán xác nhận. Bạn có thể giữ trang này mở.", label: "Đang chờ", terminal: false };
}

export function billingRefetchInterval(status?: PaymentOrderStatus, hasError = false): number | false {
  if (status === "PENDING") return 2000;
  if (status === "EXPIRED") return 10000;
  if (hasError || status) return false;
  return 2000;
}
