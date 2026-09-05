// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Button, type FormInstance } from "antd";
import { createRef, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackLanguageSwitcher, FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";
import { useI18n } from "@/components/i18n/i18n-provider";
import { ALL_LMS_MODULES, includeLmsModulePrerequisites, lmsModuleOptions } from "@/lib/entitlements";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import type { LmsModule } from "@/lib/types";
import { Form } from "./localized-form";
import { ModulePicker } from "./module-picker";

type Values = { modules: LmsModule[] };

const englishLabels = [
  "Users", "Courses", "Enrollments", "Assignments", "Assessments", "Private resources",
  "Classes & attendance", "Guardian", "Tuition", "Branch structure", "Operations reports", "Center announcements",
];

function FormSurface({
  disabled,
  fieldRef,
  formRef,
  initialModules = [],
  normalize = true,
  onFinish,
  onFinishFailed,
}: {
  disabled?: boolean;
  fieldRef?: Ref<HTMLDivElement>;
  formRef?: Ref<FormInstance<Values>>;
  initialModules?: LmsModule[];
  normalize?: boolean;
  onFinish?: (values: Values) => void;
  onFinishFailed?: () => void;
}) {
  const { t } = useI18n(operationsMessages);
  return <>
    <FeedbackLanguageSwitcher />
    <Form<Values>
      disabled={disabled}
      initialValues={{ modules: initialModules }}
      name="module_form"
      onFinish={onFinish}
      onFinishFailed={onFinishFailed}
      ref={formRef}
    >
      <Form.Item
        extra={t("Tính năng phụ thuộc sẽ được tự động chọn.")}
        label={t("Tính năng được phép")}
        name="modules"
        normalize={normalize ? (modules: LmsModule[] | undefined) => includeLmsModulePrerequisites(modules ?? []) : undefined}
        rules={[{ required: true, message: t("Chọn ít nhất một module") }]}
      >
        <ModulePicker
          aria-label={t("Tính năng được phép")}
          options={lmsModuleOptions.map(option => ({ ...option, label: t(option.label) }))}
          ref={fieldRef}
        />
      </Form.Item>
      <Button htmlType="submit">{t("Lưu")}</Button>
    </Form>
  </>;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ModulePicker with real Ant Design Form", () => {
  it("shows all 12 labels and checked counts in VI/EN without losing the form selection on language change", () => {
    const formRef = createRef<FormInstance<Values>>();
    render(<FeedbackLocaleProvider><FormSurface formRef={formRef} initialModules={["USERS", "COURSES"]} /></FeedbackLocaleProvider>);
    const group = screen.getByRole("group", { name: "Tính năng được phép" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(12);
    for (const option of lmsModuleOptions) {
      expect(within(group).getByRole("checkbox", { name: option.label })).toHaveProperty("checked", ["USERS", "COURSES"].includes(option.value));
    }
    expect(within(group).getByText("Đã chọn 2/12").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    const englishGroup = screen.getByRole("group", { name: "Allowed features" });
    expect(englishGroup).toBe(group);
    for (const label of englishLabels) expect(within(englishGroup).getByRole("checkbox", { name: label })).toBeTruthy();
    expect(within(englishGroup).getByText("2/12 selected")).toBeTruthy();
    expect(within(englishGroup).getByRole("button", { name: "Select all" })).toBeTruthy();
    expect(within(englishGroup).getByRole("button", { name: "Clear selection" })).toBeTruthy();
    expect(formRef.current!.getFieldValue("modules")).toEqual(["USERS", "COURSES"]);
  });

  it("selects and clears every option through the form without submitting from either bulk button", async () => {
    const finish = vi.fn();
    const finishFailed = vi.fn();
    const formRef = createRef<FormInstance<Values>>();
    render(<FeedbackLocaleProvider initialLocale="en"><FormSurface formRef={formRef} onFinish={finish} onFinishFailed={finishFailed} /></FeedbackLocaleProvider>);
    const group = screen.getByRole("group", { name: "Allowed features" });
    const selectAll = within(group).getByRole("button", { name: "Select all" });
    const clear = within(group).getByRole("button", { name: "Clear selection" });
    expect(selectAll.getAttribute("type")).toBe("button");
    expect(clear.getAttribute("type")).toBe("button");
    fireEvent.click(selectAll);
    expect(formRef.current!.getFieldValue("modules")).toEqual(ALL_LMS_MODULES);
    expect(within(group).getAllByRole("checkbox", { checked: true })).toHaveLength(12);
    expect(within(group).getByText("12/12 selected")).toBeTruthy();
    fireEvent.click(clear);
    expect(formRef.current!.getFieldValue("modules")).toEqual([]);
    expect(within(group).getAllByRole("checkbox", { checked: false })).toHaveLength(12);
    expect(within(group).getByText("0/12 selected")).toBeTruthy();
    await screen.findByText("Select at least one feature");
    expect(finish).not.toHaveBeenCalled();
    expect(finishFailed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(finishFailed).toHaveBeenCalledTimes(1));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(selectAll);
    await waitFor(() => expect(screen.queryByText("Select at least one feature")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(finish).toHaveBeenCalledWith({ modules: ALL_LMS_MODULES }));
  });

  it("keeps prerequisite normalization with Form.Item and restores a deselected prerequisite while its dependent remains selected", () => {
    const formRef = createRef<FormInstance<Values>>();
    render(<FormSurface formRef={formRef} />);
    const group = screen.getByRole("group", { name: "Tính năng được phép" });
    fireEvent.click(within(group).getByRole("checkbox", { name: "Báo cáo vận hành" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["COURSES", "ENROLLMENTS", "COHORTS", "REPORTS"]);
    expect(within(group).getByText("Đã chọn 4/12")).toBeTruthy();
    fireEvent.click(within(group).getByRole("checkbox", { name: "Khóa học" }));
    expect(within(group).getByRole("checkbox", { name: "Khóa học" })).toHaveProperty("checked", true);
    expect(formRef.current!.getFieldValue("modules")).toEqual(["COURSES", "ENROLLMENTS", "COHORTS", "REPORTS"]);
    fireEvent.click(within(group).getByRole("checkbox", { name: "Báo cáo vận hành" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["COURSES", "ENROLLMENTS", "COHORTS"]);
    fireEvent.click(within(group).getByRole("button", { name: "Bỏ chọn tất cả" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Phụ huynh" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["USERS", "GUARDIANS"]);
    fireEvent.click(within(group).getByRole("checkbox", { name: "Người dùng" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["USERS", "GUARDIANS"]);
  });

  it("does not silently normalize values itself and follows external controlled form updates", async () => {
    const formRef = createRef<FormInstance<Values>>();
    render(<FormSurface formRef={formRef} normalize={false} />);
    const group = screen.getByRole("group", { name: "Tính năng được phép" });
    fireEvent.click(within(group).getByRole("checkbox", { name: "Báo cáo vận hành" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["REPORTS"]);
    expect(within(group).getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    await act(async () => formRef.current!.setFieldsValue({ modules: ["USERS", "COURSES"] }));
    expect(within(group).getByText("Đã chọn 2/12")).toBeTruthy();
    expect(within(group).getByRole("checkbox", { name: "Báo cáo vận hành" })).toHaveProperty("checked", false);
  });

  it("inherits disabled Form context for all checkboxes and both bulk actions", () => {
    const formRef = createRef<FormInstance<Values>>();
    const finish = vi.fn();
    render(<FormSurface disabled formRef={formRef} initialModules={["USERS"]} onFinish={finish} />);
    const group = screen.getByRole("group", { name: "Tính năng được phép" });
    for (const checkbox of within(group).getAllByRole("checkbox")) expect(checkbox).toHaveProperty("disabled", true);
    for (const button of within(group).getAllByRole("button")) {
      expect(button).toHaveProperty("disabled", true);
      fireEvent.click(button);
    }
    fireEvent.click(within(group).getByRole("checkbox", { name: "Khóa học" }));
    expect(formRef.current!.getFieldValue("modules")).toEqual(["USERS"]);
    expect(finish).not.toHaveBeenCalled();
  });

  it("supports an explicit disabled prop outside Form", () => {
    const change = vi.fn();
    render(<ModulePicker aria-label="Explicit disabled" disabled onChange={change} options={lmsModuleOptions} value={["COURSES"]} />);
    const group = screen.getByRole("group", { name: "Explicit disabled" });
    for (const control of [...within(group).getAllByRole("checkbox"), ...within(group).getAllByRole("button")]) {
      expect(control).toHaveProperty("disabled", true);
      fireEvent.click(control);
    }
    expect(change).not.toHaveBeenCalled();
  });

  it("forwards the field id/ref and validation aria attributes so the real Form can focus the invalid group", async () => {
    const fieldRef = createRef<HTMLDivElement>();
    const formRef = createRef<FormInstance<Values>>();
    const finishFailed = vi.fn();
    render(<FormSurface fieldRef={fieldRef} formRef={formRef} onFinishFailed={finishFailed} />);
    const group = screen.getByRole("group", { name: "Tính năng được phép" });
    expect(group.id).toBe("module_form_modules");
    expect(fieldRef.current).toBe(group);
    expect(formRef.current!.getFieldInstance("modules")).toBe(group);
    expect(group.getAttribute("tabindex")).toBe("-1");
    expect(group.getAttribute("aria-required")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(finishFailed).toHaveBeenCalledTimes(1));
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(group.getAttribute("aria-describedby")?.split(" ")).toContain("module_form_modules_help");
    await waitFor(() => expect(document.getElementById("module_form_modules_help")?.textContent).toContain("Chọn ít nhất một module"));
    await waitFor(() => expect(document.activeElement).toBe(group));
  });
});
