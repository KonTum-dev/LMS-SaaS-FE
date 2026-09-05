// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { billingApi, submitCheckoutForm } from "./api";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("billing API contract", () => {
  it("forwards directory cancellation to the bounded transport signal", async () => {
    let finishFetch!: (response: Response) => void;
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const pending = billingApi.listOrdersDirectory(
      { token: "tenant-token" },
      { page: 1, limit: 20 },
      { signal: controller.signal },
    );
    const transport = (fetch.mock.calls[0] as [string, RequestInit])[1].signal;
    expect(transport?.aborted).toBe(false);
    controller.abort();
    expect(transport?.aborted).toBe(true);
    finishFetch(
      new Response(
        JSON.stringify({ items: [], page: 1, limit: 20, total: 0 }),
        { status: 200 },
      ),
    );
    await pending;
  });
  it("uses a separate tenant order directory with read-only bounded filters and cancellation", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ items: [], page: 4, limit: 20, total: 121 }),
            { status: 200 },
          ),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const result = await billingApi.listOrdersDirectory(
      { token: "tenant-token" },
      {
        page: 4,
        limit: 20,
        search: "DX LMS/01",
        status: "EXPIRED",
        type: "NEW",
      },
      { signal },
    );
    const [url, request] = fetch.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url, "https://lms.test");
    expect(parsed.pathname).toMatch(/\/billing\/orders\/directory$/);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      page: "4",
      limit: "20",
      search: "DX LMS/01",
      status: "EXPIRED",
      type: "NEW",
    });
    expect(request.headers).toMatchObject({
      Authorization: "Bearer tenant-token",
    });
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.body).toBeUndefined();
    expect(result).toEqual({ items: [], page: 4, limit: 20, total: 121 });
  });
  it("gọi detail, soft-delete và restore gói bằng endpoint riêng", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ _id: "plan-1" }), { status: 200 }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await billingApi.adminGetPlan({ token: "root-token" }, "plan-1");
    await billingApi.adminDisablePlan({ token: "root-token" }, "plan-1");
    await billingApi.adminRestorePlan({ token: "root-token" }, "plan-1");
    expect(fetch.mock.calls[0][0]).toMatch(/\/admin\/billing\/plans\/plan-1$/);
    expect(fetch.mock.calls[1][0]).toMatch(/\/admin\/billing\/plans\/plan-1$/);
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      headers: { Authorization: "Bearer root-token" },
    });
    expect(fetch.mock.calls[2][0]).toMatch(
      /\/admin\/billing\/plans\/plan-1\/restore$/,
    );
    expect(fetch.mock.calls[2][1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer root-token" },
    });
    expect(fetch.mock.calls.every(([, request]) => !request.body)).toBe(true);
  });

  it("gửi Idempotency-Key và chỉ gửi plan/chu kỳ, không gửi giá", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ checkout: {}, order: {} }), {
        headers: { "Content-Type": "application/json" },
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await billingApi.createCheckout(
      { token: "tenant-token" },
      {
        billingCycle: "MONTHLY",
        idempotencyKey: "checkout-001",
        planId: "plan-1",
      },
    );

    const [, request] = fetch.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer tenant-token",
      "Idempotency-Key": "checkout-001",
    });
    expect(JSON.parse(String(request.body))).toEqual({
      billingCycle: "MONTHLY",
      planId: "plan-1",
    });
    expect(String(request.body)).not.toContain("price");
  });

  it("dựng và submit đúng form POST do backend ký mà không cần secret", () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);
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
    expect(
      [...form.querySelectorAll("input")].map((input) => [
        input.name,
        input.value,
      ]),
    ).toEqual([
      ["currency", "VND"],
      ["merchant", "merchant-id"],
      ["order_amount", "499000"],
      ["signature", "signed-value"],
    ]);
    expect(form.textContent).not.toContain("secret");
    expect(submit).toHaveBeenCalledOnce();
  });

  it("gọi downgrade không kèm giá và encode bộ lọc admin", async () => {
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ items: [], limit: 10, page: 2, total: 0 }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await billingApi.scheduleDowngrade({ token: "tenant-token" }, "plan-basic");
    await billingApi.adminListOrders(
      { token: "root-token" },
      {
        limit: 10,
        page: 2,
        search: "DX LMS/01",
        status: "REVIEW_REQUIRED",
        type: "UPGRADE",
      },
    );

    expect(
      JSON.parse(String((fetch.mock.calls[0][1] as RequestInit).body)),
    ).toEqual({ planId: "plan-basic" });
    expect(fetch.mock.calls[1][0]).toContain("page=2");
    expect(fetch.mock.calls[1][0]).toContain("status=REVIEW_REQUIRED");
    expect(fetch.mock.calls[1][0]).toContain("type=UPGRADE");
    expect(fetch.mock.calls[1][0]).toContain("search=DX+LMS%2F01");
  });
});
