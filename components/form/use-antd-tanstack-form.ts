"use client";

import { useForm } from "@tanstack/react-form";
import { useRef } from "react";

/**
 * Cầu nối giữ nguyên cách Ant Design render/validate field hiện có, trong khi
 * TanStack Form sở hữu vòng đời submit và trạng thái đang gửi của biểu mẫu.
 */
export function useAntdTanStackForm<TValues>(
  initialValues: TValues,
  onSubmit: (values: TValues) => Promise<void> | void,
) {
  const inFlight = useRef<Promise<void> | null>(null);
  const form = useForm({
    defaultValues: initialValues,
    onSubmitMeta: undefined as { validatedValues: TValues } | undefined,
    onSubmit: async ({ value, meta }) =>
      onSubmit(meta ? meta.validatedValues : value),
  });

  return {
    form,
    submit: async (values: TValues) => {
      // Repeated clicks/Enter share the existing result; reset() must not clear
      // TanStack's submitting state or replace the validated in-flight snapshot.
      if (inFlight.current) return inFlight.current;
      // AntD owns field validation. Keep its submitted snapshot separate from
      // defaults, which useForm may refresh during async submit validation.
      form.reset(values, { keepDefaultValues: true });
      const pending = form.handleSubmit({ validatedValues: values });
      inFlight.current = pending;
      try {
        await pending;
      } finally {
        // Both success and failure release the lock without swallowing rejection.
        if (inFlight.current === pending) inFlight.current = null;
      }
    },
  };
}
