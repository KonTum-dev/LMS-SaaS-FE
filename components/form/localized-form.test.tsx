// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Form as AntdForm, Input, type FormInstance } from "antd";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FeedbackLanguageSwitcher,
  FeedbackLocaleProvider,
  useFeedbackLocale,
} from "@/components/feedback/feedback-locale";
import { Form } from "./localized-form";

type Values = { invalid?: string; draft?: string; untouched?: string };
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LocalizedForm", () => {
  it("focuses the first invalid field on submit while preserving failure details and draft values", async () => {
    const finish = vi.fn();
    const finishFailed = vi.fn();
    render(
      <Form<Values>
        initialValues={{ draft: "Keep my draft" }}
        onFinish={finish}
        onFinishFailed={finishFailed}
      >
        <Form.Item
          label="Invalid"
          name="invalid"
          rules={[{ required: true, message: "First error" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Draft" name="draft">
          <Input />
        </Form.Item>
        <Form.Item
          label="Untouched"
          name="untouched"
          rules={[{ required: true, message: "Second error" }]}
        >
          <Input />
        </Form.Item>
        <button type="submit">Submit</button>
      </Form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Invalid")),
    );
    expect(finishFailed).toHaveBeenCalledTimes(1);
    expect(finishFailed.mock.calls[0][0]).toMatchObject({
      values: { draft: "Keep my draft" },
      errorFields: [
        { name: ["invalid"], errors: ["First error"] },
        { name: ["untouched"], errors: ["Second error"] },
      ],
    });
    expect(finish).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe(
      "Keep my draft",
    );
  });

  it("honors an explicit scroll/focus opt-out without altering validation callbacks", async () => {
    const finishFailed = vi.fn();
    render(
      <Form<Values> scrollToFirstError={false} onFinishFailed={finishFailed}>
        <Form.Item
          label="Invalid"
          name="invalid"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input />
        </Form.Item>
        <button type="submit">Submit</button>
      </Form>,
    );
    const submit = screen.getByRole("button", { name: "Submit" });
    submit.focus();
    fireEvent.click(submit);
    await waitFor(() => expect(finishFailed).toHaveBeenCalledTimes(1));
    expect(document.activeElement).toBe(submit);
  });

  it("passes explicit scroll options through to AntD unchanged", async () => {
    let instance!: FormInstance<Values>;
    function Surface() {
      const [form] = Form.useForm<Values>();
      instance = form;
      return (
        <Form
          form={form}
          scrollToFirstError={{
            behavior: "smooth",
            block: "center",
            focus: false,
          }}
        >
          <Form.Item
            label="Invalid"
            name="invalid"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <button type="submit">Submit</button>
        </Form>
      );
    }
    render(<Surface />);
    const scroll = vi
      .spyOn(instance, "scrollToField")
      .mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(scroll).toHaveBeenCalledWith(["invalid"], {
        behavior: "smooth",
        block: "center",
        focus: false,
      }),
    );
    scroll.mockRestore();
  });
  it("preserves the complete compound API", () => {
    for (const name of [
      "Item",
      "List",
      "ErrorList",
      "Provider",
      "useForm",
      "useFormInstance",
      "useWatch",
    ] as const) {
      expect(Form[name]).toBe(AntdForm[name]);
    }
  });

  it("only refreshes fields with errors and preserves the forwarded instance, inputs and draft values", async () => {
    const ref = createRef<FormInstance<Values>>();
    const finish = vi.fn();
    const untouchedValidator = vi.fn(() => Promise.resolve());
    let providedInstance: FormInstance<Values> | undefined;
    function Surface() {
      const { locale } = useFeedbackLocale();
      const [form] = Form.useForm<Values>();
      providedInstance = form;
      return (
        <>
          <FeedbackLanguageSwitcher />
          <Form<Values>
            ref={ref}
            form={form}
            initialValues={{ draft: "User data {name}" }}
            onFinish={finish}
          >
            <Form.Item
              label="Invalid"
              name="invalid"
              rules={[
                {
                  required: true,
                  message: locale === "vi" ? "Lỗi tiếng Việt" : "English error",
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Draft" name="draft">
              <Input />
            </Form.Item>
            <Form.Item
              label="Untouched"
              name="untouched"
              rules={[{ validator: untouchedValidator }]}
            >
              <Input />
            </Form.Item>
          </Form>
        </>
      );
    }
    render(
      <FeedbackLocaleProvider>
        <Surface />
      </FeedbackLocaleProvider>,
    );
    const draft = screen.getByLabelText("Draft");
    const firstRef = ref.current;
    const firstInstance = providedInstance;
    expect(ref.current?.getFieldValue).toBe(providedInstance?.getFieldValue);
    await act(async () => {
      await ref.current!.validateFields(["invalid"]).catch(() => undefined);
    });
    expect(await screen.findByText("Lỗi tiếng Việt")).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText("Invalid"));
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByText("English error")).toBeTruthy();
    expect(providedInstance).toBe(firstInstance);
    // AntD may recreate its imperative handle; the underlying API stays intact.
    expect(ref.current?.getFieldValue).toBe(firstRef?.getFieldValue);
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect(ref.current!.getFieldValue("draft")).toBe("User data {name}");
    expect(untouchedValidator).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(screen.getByLabelText("Invalid"));
  });

  it("waits for explicit async submit validation instead of invalidating or duplicating the submit", async () => {
    const validation = deferred();
    const finish = vi.fn();
    const finishFailed = vi.fn();
    const validator = vi.fn(() => validation.promise);
    render(
      <FeedbackLocaleProvider>
        <FeedbackLanguageSwitcher />
        <Form<Values>
          initialValues={{ draft: "kept" }}
          onFinish={finish}
          onFinishFailed={finishFailed}
        >
          <Form.Item label="Draft" name="draft" rules={[{ validator }]}>
            <Input />
          </Form.Item>
          <button type="submit">Submit</button>
        </Form>
      </FeedbackLocaleProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(validator).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      validation.resolve();
    });
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    expect(finish.mock.calls[0][0]).toEqual({ draft: "kept" });
    expect(finishFailed).not.toHaveBeenCalled();
    expect(validator).toHaveBeenCalledTimes(1);
  });

  it("keeps the latest locale after rapidly switching during async error validation", async () => {
    const ref = createRef<FormInstance<Values>>();
    const english = deferred();
    const vietnamese = deferred();
    let hold = false;
    const validations: string[] = [];
    function Surface() {
      const { locale } = useFeedbackLocale();
      return (
        <>
          <FeedbackLanguageSwitcher />
          <Form<Values> ref={ref}>
            <Form.Item
              label="Invalid"
              name="invalid"
              rules={[
                {
                  validator: () => {
                    validations.push(locale);
                    return hold
                      ? locale === "en"
                        ? english.promise
                        : vietnamese.promise
                      : Promise.reject(new Error("Lỗi tiếng Việt"));
                  },
                },
              ]}
            >
              <Input />
            </Form.Item>
          </Form>
        </>
      );
    }
    render(
      <FeedbackLocaleProvider>
        <Surface />
      </FeedbackLocaleProvider>,
    );
    await act(async () => {
      await ref.current!.validateFields(["invalid"]).catch(() => undefined);
    });
    expect(await screen.findByText("Lỗi tiếng Việt")).toBeTruthy();
    hold = true;
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await waitFor(() => expect(validations).toEqual(["vi", "en"]));
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    await act(async () => {
      english.reject(new Error("English error"));
    });
    await waitFor(() => expect(validations).toEqual(["vi", "en", "vi"]));
    await act(async () => {
      vietnamese.reject(new Error("Lỗi tiếng Việt"));
    });
    expect(await screen.findByText("Lỗi tiếng Việt")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("English error")).toBeNull());
  });

  it("does not revalidate a reset field or continue its deferred work after unmount", async () => {
    const ref = createRef<FormInstance<Values>>();
    const validator = vi.fn(() => Promise.reject(new Error("Error")));
    const view = render(
      <FeedbackLocaleProvider>
        <FeedbackLanguageSwitcher />
        <Form<Values> ref={ref}>
          <Form.Item label="Invalid" name="invalid" rules={[{ validator }]}>
            <Input />
          </Form.Item>
        </Form>
      </FeedbackLocaleProvider>,
    );
    await act(async () => {
      await ref.current!.validateFields(["invalid"]).catch(() => undefined);
    });
    expect(await screen.findByText("Error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    act(() => ref.current!.resetFields());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(validator).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    view.unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(validator).toHaveBeenCalledTimes(1);
  });
});
