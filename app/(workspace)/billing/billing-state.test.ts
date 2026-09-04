import { describe, expect, it } from "vitest";
import { billingRefetchInterval, getBillingStatusPresentation } from "./billing-state";

describe("billing status UI", () => {
  it.each([
    ["PENDING", false, "Đang chờ"],
    ["PAID", true, "Đã thanh toán"],
    ["CANCELED", true, "Đã hủy"],
    ["EXPIRED", true, "Đã hết hạn"],
    ["REVIEW_REQUIRED", true, "Cần đối soát"],
    ["REFUND_REQUIRED", true, "Cần hoàn tiền"],
  ] as const)("hiển thị %s và chỉ poll trạng thái chưa terminal", (status, terminal, label) => {
    expect(getBillingStatusPresentation(status)).toMatchObject({ label, terminal });
  });

  it("mô tả trạng thái đã thanh toán bằng ngôn ngữ dễ hiểu", () => {
    expect(getBillingStatusPresentation("PAID").description).toContain("đã được xác nhận");
  });

  it("poll nhanh pending, poll chậm expired và chỉ dừng lỗi ban đầu/terminal khác", () => {
    expect(billingRefetchInterval("PENDING")).toBe(2000);
    expect(billingRefetchInterval("PENDING", true)).toBe(2000);
    expect(billingRefetchInterval("EXPIRED")).toBe(10000);
    expect(billingRefetchInterval("EXPIRED", true)).toBe(10000);
    expect(billingRefetchInterval("PAID")).toBe(false);
    expect(billingRefetchInterval(undefined, true)).toBe(false);
  });
});
