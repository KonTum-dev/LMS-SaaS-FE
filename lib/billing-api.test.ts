// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { billingApi, submitCheckoutForm } from "./api";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("billing API contract", () => {
  it("gửi Idempotency-Key và chỉ gửi plan/chu kỳ, không gửi giá", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ checkout: {}, order: {} }), {
      headers: { "Content-Type": "application/json" }, status: 201,
    }));
    vi.stubGlobal("fetch", fetch);

    await billingApi.createCheckout(
      { token: "tenant-token" },
      { billingCycle: "MONTHLY", idempotencyKey: "checkout-001", planId: "plan-1" },
    );

    const [, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer tenant-token",
      "Idempotency-Key": "checkout-001",
    });
    expect(JSON.parse(String(request.body))).toEqual({ billingCycle: "MONTHLY", planId: "plan-1" });
    expect(String(request.body)).not.toContain("price");
  });

  it("dựng và submit đúng form POST do backend ký mà không cần secret", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    submitCheckoutForm({
      action: "https://pay-sandbox.sepay.vn/v1/checkout/init",
      fields: {
        currency: "VND",
        merchant: "merchant-id",
        order_amount: "499000",
        signature: "signed-value",
      },
      method: "POST",
      mode: "SEPAY",
    });

    const form = document.querySelector("form")!;
    expect(form.action).toBe("https://pay-sandbox.sepay.vn/v1/checkout/init");
    expect(form.method).toBe("post");
    expect([...form.querySelectorAll("input")].map((input) => [input.name, input.value])).toEqual([
      ["currency", "VND"],
      ["merchant", "merchant-id"],
      ["order_amount", "499000"],
      ["signature", "signed-value"],
    ]);
    expect(form.textContent).not.toContain("secret");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("gọi downgrade không kèm giá và encode bộ lọc admin", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ items: [], limit: 10, page: 2, total: 0 }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    })));
    vi.stubGlobal("fetch", fetch);

    await billingApi.scheduleDowngrade({ token: "tenant-token" }, "plan-basic");
    await billingApi.adminListOrders(
      { token: "root-token" },
      { limit: 10, page: 2, search: "DX LMS/01", status: "REVIEW_REQUIRED", type: "UPGRADE" },
    );

    expect(JSON.parse(String((fetch.mock.calls[0][1] as RequestInit).body))).toEqual({ planId: "plan-basic" });
    expect(fetch.mock.calls[1][0]).toContain("page=2");
    expect(fetch.mock.calls[1][0]).toContain("status=REVIEW_REQUIRED");
    expect(fetch.mock.calls[1][0]).toContain("type=UPGRADE");
    expect(fetch.mock.calls[1][0]).toContain("search=DX+LMS%2F01");
  });
});
