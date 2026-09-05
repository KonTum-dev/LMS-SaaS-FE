"use client";

import { Form as AntdForm } from "antd";
import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentRef,
  type ComponentPropsWithoutRef,
} from "react";
import { useFeedbackLocale } from "@/components/feedback/feedback-locale";

const FIRST_ERROR_SCROLL = {
  behavior: "auto",
  block: "nearest",
  focus: true,
} as const;

const FormWithLocale = forwardRef<
  ComponentRef<typeof AntdForm>,
  ComponentPropsWithoutRef<typeof AntdForm>
>(function LocalizedForm(
  { form: providedForm, scrollToFirstError = FIRST_ERROR_SCROLL, ...props },
  ref,
) {
  const [form] = AntdForm.useForm(providedForm);
  const { locale } = useFeedbackLocale();
  const previous = useRef({ form, locale });

  useEffect(() => {
    if (previous.current.form !== form) {
      previous.current = { form, locale };
      return;
    }
    if (previous.current.locale === locale) return;
    previous.current = { form, locale };

    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refreshErrors = () => {
      if (!active) return;
      // AntD shares a validation promise with submit(). Wait for any existing
      // validation to settle so changing locale cannot invalidate a submission.
      if (form.isFieldsValidating()) {
        timer = setTimeout(refreshErrors, 50);
        return;
      }
      const names = form
        .getFieldsError()
        .filter((field) => field.errors.length > 0)
        .map((field) => field.name);
      // Re-read errors after waiting: reset, fixed and removed fields stay alone.
      if (names.length) void form.validateFields(names).catch(() => undefined);
    };
    // Start after the current validation/submit microtasks have completed.
    timer = setTimeout(refreshErrors, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form, locale]);

  return (
    <AntdForm
      {...props}
      form={form}
      ref={ref}
      scrollToFirstError={scrollToFirstError}
    />
  );
});

// Keep Ant Design's complete public compound API, generic props and form ref.
export const LocalizedForm = Object.assign(FormWithLocale, {
  Item: AntdForm.Item,
  List: AntdForm.List,
  ErrorList: AntdForm.ErrorList,
  Provider: AntdForm.Provider,
  useForm: AntdForm.useForm,
  useFormInstance: AntdForm.useFormInstance,
  useWatch: AntdForm.useWatch,
}) as typeof AntdForm;

export { LocalizedForm as Form };
