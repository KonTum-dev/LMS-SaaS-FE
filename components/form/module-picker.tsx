"use client";

import { Button, Checkbox } from "antd";
import { forwardRef, type AriaAttributes } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { LmsModule } from "@/lib/types";
import styles from "./module-picker.module.css";

export interface ModulePickerProps extends AriaAttributes {
  disabled?: boolean;
  id?: string;
  onChange?: (value: LmsModule[]) => void;
  options: readonly { label: string; value: LmsModule }[];
  value?: LmsModule[];
}

/** Controlled form field: prerequisite normalization stays with the caller. */
export const ModulePicker = forwardRef<HTMLDivElement, ModulePickerProps>(
  function ModulePicker({ disabled, id, onChange, options, value = [], ...aria }, ref) {
    const { t } = useI18n();
    const selected = options.filter((option) => value.includes(option.value)).length;
    return (
      <div {...aria} className={styles.picker} id={id} ref={ref} role="group" tabIndex={-1}>
        <div className={styles.toolbar}>
          <span className={styles.count} aria-live="polite">
            {t("Đã chọn {count}/{total}", { count: selected, total: options.length })}
          </span>
          <div className={styles.actions}>
            <Button disabled={disabled} htmlType="button" onClick={() => onChange?.(options.map((option) => option.value))} size="small" type="text">{t("Chọn tất cả")}</Button>
            <Button disabled={disabled} htmlType="button" onClick={() => onChange?.([])} size="small" type="text">{t("Bỏ chọn tất cả")}</Button>
          </div>
        </div>
        <Checkbox.Group<LmsModule>
          className={styles.grid}
          disabled={disabled}
          onChange={onChange}
          options={options.map((option) => ({ ...option }))}
          value={value}
        />
      </div>
    );
  },
);
