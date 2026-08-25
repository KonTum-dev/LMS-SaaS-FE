"use client";

import { useForm } from "@tanstack/react-form";

/**
 * Cầu nối giữ nguyên cách Ant Design render/validate field hiện có, trong khi
 * TanStack Form sở hữu vòng đời submit và trạng thái đang gửi của biểu mẫu.
 */
export function useAntdTanStackForm<TValues>(
  initialValues: TValues,
  onSubmit: (values: TValues) => Promise<void> | void,
) {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => onSubmit(value),
  });

  return {
    form,
    submit: async (values: TValues) => {
      form.reset(values);
      await form.handleSubmit();
    },
  };
}
