// @vitest-environment jsdom

import { Button, Form, Input } from "antd";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useAntdTanStackForm } from "./use-antd-tanstack-form";

function Harness({
  onSubmit,
}: {
  onSubmit: (value: { title: string }) => void;
}) {
  const bridge = useAntdTanStackForm({ title: "" }, onSubmit);
  return (
    <button onClick={() => void bridge.submit({ title: "Bài tập tuần 1" })}>
      Lưu
    </button>
  );
}

function LoginHarness({
  onSubmit,
}: {
  onSubmit: (value: {
    email: string;
    password: string;
  }) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const bridge = useAntdTanStackForm({ email: "", password: "" }, onSubmit);
  return (
    <Form
      layout="vertical"
      onFinish={async (values) => {
        setBusy(true);
        try {
          await bridge.submit(values);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Form.Item
        label="Email"
        name="email"
        rules={[{ required: true }, { type: "email" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item label="Password" name="password" rules={[{ required: true }]}>
        <Input.Password />
      </Form.Item>
      <Button htmlType="submit" loading={busy}>
        Sign in
      </Button>
    </Form>
  );
}

function RerenderHarness({
  onSubmit,
  changingDefaults = false,
}: {
  onSubmit: (value: { title: string; startsAt: Date }) => void;
  changingDefaults?: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const bridge = useAntdTanStackForm(
    { title: "", startsAt: new Date(changingDefaults ? revision : 0) },
    onSubmit,
  );
  return (
    <button
      onClick={() => {
        const pending = bridge.submit({
          title: "Validated assignment",
          startsAt: new Date(2000),
        });
        // FormApi is awaiting submit validation here. Parent state changes must not
        // replace the AntD-validated payload with newly rendered default values.
        flushSync(() => setRevision((value) => value + 1));
        void pending;
      }}
    >
      Submit and rerender
    </button>
  );
}

function DefaultsHarness({
  initialTitle,
  onSubmit,
}: {
  initialTitle: string;
  onSubmit: (value: { title: string }) => void;
}) {
  const bridge = useAntdTanStackForm({ title: initialTitle }, onSubmit);
  return (
    <>
      <bridge.form.Subscribe selector={(state) => state.values.title}>
        {(value) => <output aria-label="Current default title">{value}</output>}
      </bridge.form.Subscribe>
      <button onClick={() => void bridge.submit({ title: "Submitted title" })}>
        Submit defaults
      </button>
      <button onClick={() => bridge.form.reset()}>Reset defaults</button>
    </>
  );
}

function RetryHarness({
  onSubmit,
}: {
  onSubmit: (value: { title: string }) => Promise<void>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState("");
  const bridge = useAntdTanStackForm({ title: "" }, onSubmit);
  return (
    <>
      <button
        onClick={async () => {
          const current = attempt + 1;
          setAttempt(current);
          try {
            await bridge.submit({ title: `Attempt ${current}` });
            setResult("Saved");
          } catch {
            setResult("Retry available");
          }
        }}
      >
        Retry submit
      </button>
      <output>{result}</output>
    </>
  );
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});
afterEach(cleanup);

describe("cầu nối TanStack Form và Ant Design", () => {
  it("does not reset or submit twice while the first validated snapshot is in flight", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onSubmit = vi.fn(() => pending);
    const { result, rerender } = renderHook(() =>
      useAntdTanStackForm({ title: "" }, onSubmit),
    );
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.submit({ title: "First validated snapshot" });
      second = result.current.submit({ title: "Duplicate click snapshot" });
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      title: "First validated snapshot",
    });
    expect(result.current.form.state.isSubmitting).toBe(true);
    rerender();
    let third!: Promise<void>;
    act(() => {
      third = result.current.submit({ title: "Rerender duplicate" });
    });
    expect(result.current.form.state.values).toEqual({
      title: "First validated snapshot",
    });
    await act(async () => {
      finish();
      await Promise.all([first, second, third]);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.form.state.isSubmitting).toBe(false);
    await act(async () => {
      await result.current.submit({ title: "Next intentional save" });
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({
      title: "Next intentional save",
    });
  });

  it("shares a concurrent rejection unchanged and unlocks for a corrected retry", async () => {
    let fail!: (reason: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
    const failure = new Error("Save rejected");
    const onSubmit = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAntdTanStackForm({ title: "" }, onSubmit),
    );
    let outcomes!: Promise<PromiseSettledResult<void>[]>;
    await act(async () => {
      outcomes = Promise.allSettled([
        result.current.submit({ title: "First" }),
        result.current.submit({ title: "Duplicate" }),
      ]);
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await act(async () => {
      fail(failure);
      await outcomes;
    });
    expect(await outcomes).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure },
    ]);
    await act(async () => {
      await result.current.submit({ title: "Corrected" });
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith({ title: "Corrected" });
  });

  it("does not block an independent form instance while another form submits", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const firstSubmit = vi.fn(() => pending);
    const secondSubmit = vi.fn();
    const first = renderHook(() =>
      useAntdTanStackForm({ title: "" }, firstSubmit),
    );
    const second = renderHook(() =>
      useAntdTanStackForm({ title: "" }, secondSubmit),
    );
    let firstResult!: Promise<void>;
    await act(async () => {
      firstResult = first.result.current.submit({ title: "First form" });
      await second.result.current.submit({ title: "Second form" });
    });
    expect(secondSubmit).toHaveBeenCalledWith({ title: "Second form" });
    expect(first.result.current.form.state.isSubmitting).toBe(true);
    await act(async () => {
      finish();
      await firstResult;
    });
  });
  it("chuyển đúng giá trị đã được Ant Design validate vào vòng đời submit", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: "Bài tập tuần 1" }),
    );
  });

  it("preserves real AntD login fields when submitting state rerenders the parent", async () => {
    const onSubmit = vi.fn();
    render(<LoginHarness onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "qa@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "MockPassword!123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "qa@example.test",
        password: "MockPassword!123",
      }),
    );
  });

  it.each([false, true])(
    "preserves validated values through a forced rerender (changing defaults: %s)",
    async (changingDefaults) => {
      const onSubmit = vi.fn();
      render(
        <RerenderHarness
          changingDefaults={changingDefaults}
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Submit and rerender" }),
      );
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Validated assignment",
          startsAt: new Date(2000),
        }),
      );
    },
  );

  it("keeps refreshed defaults usable for edit/reset consumers", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <DefaultsHarness initialTitle="First record" onSubmit={onSubmit} />,
    );
    expect(screen.getByLabelText("Current default title").textContent).toBe(
      "First record",
    );
    view.rerender(
      <DefaultsHarness initialTitle="Second record" onSubmit={onSubmit} />,
    );
    expect(screen.getByLabelText("Current default title").textContent).toBe(
      "Second record",
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit defaults" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: "Submitted title" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(screen.getByLabelText("Current default title").textContent).toBe(
      "Second record",
    );
  });

  it("uses the latest submit callback after rerender", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Harness onSubmit={first} />);
    view.rerender(<Harness onSubmit={second} />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(second).toHaveBeenCalledWith({ title: "Bài tập tuần 1" }),
    );
    expect(first).not.toHaveBeenCalled();
  });

  it("propagates failure and uses the corrected snapshot on retry", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Retryable failure"))
      .mockResolvedValueOnce(undefined);
    render(<RetryHarness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry submit" }));
    await screen.findByText("Retry available");
    fireEvent.click(screen.getByRole("button", { name: "Retry submit" }));
    await screen.findByText("Saved");
    expect(onSubmit).toHaveBeenNthCalledWith(1, { title: "Attempt 1" });
    expect(onSubmit).toHaveBeenNthCalledWith(2, { title: "Attempt 2" });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
