import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ChangeEventHandler,
  type FormEvent,
  type FormEventHandler,
  type Key,
  type KeyboardEventHandler,
  type ReactElement,
  type MouseEventHandler,
  type ReactNode,
} from "react";

interface LooseProps {
  children?: ReactNode;
  className?: string;
}

function LightweightApp({ children }: LooseProps) {
  return <>{children}</>;
}

LightweightApp.useApp = () => ({
  message: { error() {}, info() {}, success() {} },
  modal: { confirm() {} },
});

function LightweightButton(
  props: LooseProps & {
    "aria-label"?: string;
    disabled?: boolean;
    htmlType?: "button" | "reset" | "submit";
    loading?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    title?: string;
  },
) {
  const { children, className, disabled, htmlType, loading, onClick, title } = props;
  return (
    <button
      aria-label={props["aria-label"]}
      className={[className, loading ? "ant-btn-loading" : ""].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      type={htmlType ?? "button"}
    >
      {children}
    </button>
  );
}

function LightweightCard({ children, extra, title }: LooseProps & { extra?: ReactNode; title?: ReactNode }) {
  return <section>{title && <h2>{title}</h2>}{extra}{children}</section>;
}

function LightweightInput(props: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  allowClear?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  max?: number;
  maxLength?: number;
  min?: number;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onPressEnter?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  prefix?: ReactNode;
  type?: string;
  value?: string;
}) {
  const { allowClear, onPressEnter, prefix, ...inputProps } = props;
  void allowClear;
  return <>{prefix}<input {...inputProps} onKeyDown={(event) => { if (event.key === "Enter") onPressEnter?.(event); }} /></>;
}

function LightweightTextArea({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  disabled,
  maxLength,
  onChange,
  placeholder,
  rows,
  value,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  autoSize?: unknown;
  disabled?: boolean;
  maxLength?: number;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
  value?: string;
}) {
  return <textarea aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} aria-label={ariaLabel} disabled={disabled} maxLength={maxLength} onChange={onChange} placeholder={placeholder} rows={rows} value={value} />;
}

function LightweightSearch({ enterButton, onPressEnter, onSearch, ...props }: Parameters<typeof LightweightInput>[0] & {
  className?: string;
  enterButton?: ReactNode;
  onSearch?: (value: string) => void;
}) {
  return <>
    <LightweightInput {...props} onPressEnter={(event) => {
      onPressEnter?.(event);
      onSearch?.(event.currentTarget.value);
    }} />
    {enterButton ? <button type="button" onClick={() => onSearch?.(props.value ?? "")}>{enterButton}</button> : null}
  </>;
}

const LightweightInputNamespace = Object.assign(LightweightInput, {
  Password: function LightweightPassword(props: Parameters<typeof LightweightInput>[0]) {
    return <LightweightInput {...props} type="password" />;
  },
  Search: LightweightSearch,
  TextArea: LightweightTextArea,
});

interface LightweightFormContextValue {
  disabled: boolean;
  setValue(name: string, value: unknown): void;
  values: Record<string, unknown>;
}

const LightweightFormContext = createContext<LightweightFormContextValue | null>(null);

function LightweightForm({
  children,
  disabled = false,
  onFinish,
}: LooseProps & { disabled?: boolean; onFinish?: (values: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const submit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    onFinish?.(values);
  };
  return (
    <LightweightFormContext.Provider
      value={{
        disabled,
        setValue: (name, value) => setValues((current) => ({ ...current, [name]: value })),
        values,
      }}
    >
      <form onSubmit={submit}>{children}</form>
    </LightweightFormContext.Provider>
  );
}

function LightweightFormItem({
  children,
  extra,
  label,
  name,
  valuePropName,
}: LooseProps & { extra?: ReactNode; label?: ReactNode; name?: string; valuePropName?: "checked" | "value" }) {
  const form = useContext(LightweightFormContext);
  let control = children;
  if (form && name && isValidElement(children)) {
    const child = children as ReactElement<{
      checked?: boolean;
      disabled?: boolean;
      onChange?: (event: FormEvent<HTMLInputElement>) => void;
      value?: unknown;
    }>;
    const propName = valuePropName ?? "value";
    const originalOnChange = child.props.onChange;
    control = cloneElement(child, {
      disabled: form.disabled || child.props.disabled,
      [propName]: form.values[name] ?? (propName === "checked" ? false : ""),
      onChange: (event: FormEvent<HTMLInputElement>) => {
        const target = event.currentTarget;
        form.setValue(name, propName === "checked" ? target.checked : target.value);
        originalOnChange?.(event);
      },
    });
  }
  return <div><label>{label}{control}</label>{extra && <span>{extra}</span>}</div>;
}

function useLightweightForm<Values extends Record<string, unknown>>() {
  return [{
    resetFields() {},
    setFieldsValue(values: Partial<Values>) { void values; },
    validateFields: async () => ({}) as Values,
  }];
}

const LightweightFormNamespace = Object.assign(LightweightForm, {
  Item: LightweightFormItem,
  useForm: useLightweightForm,
});

function LightweightSelect(props: {
  "aria-label"?: string;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  options?: Array<{ label?: ReactNode; value?: string }>;
  value?: string;
}) {
  return (
    <select aria-label={props["aria-label"]} disabled={props.disabled} onChange={props.onChange} value={props.value}>
      {props.options?.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function LightweightSegmented({
  onChange,
  options = [],
  value,
}: {
  onChange?: (value: string) => void;
  options?: Array<{ label?: ReactNode; value: string }>;
  value?: string;
}) {
  return <div>{options.map((option) => <button aria-pressed={option.value === value} key={option.value} onClick={() => onChange?.(option.value)} type="button">{option.label}</button>)}</div>;
}

function LightweightAlert({ action, description, title }: { action?: ReactNode; description?: ReactNode; title?: ReactNode }) {
  return <section role="alert"><strong>{title}</strong>{description}{action}</section>;
}

function LightweightEmpty({ children, description }: { children?: ReactNode; description?: ReactNode }) {
  return <div>{description}{children}</div>;
}

LightweightEmpty.PRESENTED_IMAGE_SIMPLE = null;

function LightweightSwitch(props: { "aria-label"?: string; disabled?: boolean }) {
  return <input aria-label={props["aria-label"]} disabled={props.disabled} type="checkbox" />;
}

function LightweightStatistic({ title, value }: { title?: ReactNode; value?: ReactNode }) {
  return <div>{title}<strong>{value}</strong></div>;
}

function LightweightCheckboxGroup({
  children,
  disabled,
  onChange,
  options = [],
  value = [],
}: {
  children?: ReactNode;
  disabled?: boolean;
  onChange?: (values: string[]) => void;
  options?: Array<{ label?: ReactNode; value?: string }>;
  value?: string[];
}) {
  const toggle = (itemValue: string, checked: boolean) => onChange?.(
    checked ? [...value, itemValue] : value.filter((item) => item !== itemValue),
  );
  return <div>{options.map((option) => <label key={option.value}><input checked={value.includes(option.value ?? "")} disabled={disabled} onChange={(event) => toggle(option.value ?? "", event.target.checked)} type="checkbox" value={option.value} />{option.label}</label>)}{isValidElement(children) || Array.isArray(children) ? (Array.isArray(children) ? children : [children]).map((child, index) => isValidElement(child) ? cloneElement(child as ReactElement<{ checked?: boolean; disabled?: boolean; onChange?: ChangeEventHandler<HTMLInputElement>; value?: string }>, {
    checked: value.includes(String((child.props as { value?: string }).value ?? "")),
    disabled,
    key: child.key ?? index,
    onChange: (event) => toggle(String((child.props as { value?: string }).value ?? ""), event.target.checked),
  }) : child) : children}</div>;
}

function LightweightCheckbox(props: LooseProps & {
  "aria-label"?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string;
}) {
  return <label className={props.className}><input aria-label={props["aria-label"]} checked={props.checked} disabled={props.disabled} onChange={props.onChange} type="checkbox" value={props.value} />{props.children}</label>;
}

const LightweightCheckboxNamespace = Object.assign(LightweightCheckbox, { Group: LightweightCheckboxGroup });

function LightweightRadioGroup({
  children,
  disabled,
  onChange,
  value,
}: LooseProps & {
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string | null;
}) {
  const childList = Array.isArray(children) ? children : [children];
  return <div>{childList.map((child, index) => isValidElement(child) ? cloneElement(child as ReactElement<{ checked?: boolean; disabled?: boolean; onChange?: ChangeEventHandler<HTMLInputElement>; value?: string }>, {
    checked: String((child.props as { value?: string }).value ?? "") === value,
    disabled,
    key: child.key ?? index,
    onChange,
  }) : child)}</div>;
}

function LightweightRadio(props: LooseProps & {
  "aria-label"?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string;
}) {
  return <label className={props.className}><input aria-label={props["aria-label"]} checked={props.checked} disabled={props.disabled} onChange={props.onChange} type="radio" value={props.value} />{props.children}</label>;
}

const LightweightRadioNamespace = Object.assign(LightweightRadio, { Group: LightweightRadioGroup });

function LightweightResult({ extra, subTitle, title }: { extra?: ReactNode; subTitle?: ReactNode; title?: ReactNode }) {
  return <section>{title && <h1>{title}</h1>}{subTitle && <p>{subTitle}</p>}{extra}</section>;
}

function LightweightProgress({ percent }: { percent?: number }) {
  return <div aria-label="progress">{percent ?? 0}%</div>;
}

const LightweightSpace = Object.assign(
  function LightweightSpace({ children }: LooseProps) { return <div>{children}</div>; },
  { Compact: function LightweightCompact({ children }: LooseProps) { return <div>{children}</div>; } },
);

const LightweightTypography = {
  Paragraph: function LightweightParagraph({ children }: LooseProps) { return <p>{children}</p>; },
  Text: function LightweightText({ children }: LooseProps) { return <span>{children}</span>; },
  Title: function LightweightTitle({ children }: LooseProps) { return <h3>{children}</h3>; },
};

function LightweightPagination({ current = 1, total = 0, pageSize = 10, onChange, showSizeChanger, pageSizeOptions = [10, 20, 50, 100], ...props }: {
  "aria-label"?: string;
  current?: number;
  total?: number;
  pageSize?: number;
  onChange?: (page: number, pageSize: number) => void;
  showSizeChanger?: boolean | { "aria-label"?: string };
  pageSizeOptions?: Array<string | number>;
}) {
  return <nav aria-label={props["aria-label"] ?? "Phân trang"}>
    Trang {current} · {total}
    {onChange ? <>
      <button type="button" aria-label="Trang trước" disabled={current <= 1} onClick={() => onChange(current - 1, pageSize)}>Trước</button>
      <button type="button" aria-label="Trang sau" disabled={current * pageSize >= total} onClick={() => onChange(current + 1, pageSize)}>Sau</button>
      {showSizeChanger ? <select aria-label={typeof showSizeChanger === "object" ? showSizeChanger["aria-label"] ?? "Số dòng mỗi trang" : "Số dòng mỗi trang"} value={pageSize} onChange={(event) => onChange(current, Number(event.target.value))}>
        {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
      </select> : null}
    </> : null}
  </nav>;
}

function LightweightPopconfirm({
  children,
  disabled,
  okText,
  onConfirm,
  title,
}: LooseProps & {
  disabled?: boolean;
  okText?: ReactNode;
  onConfirm?: () => Promise<unknown> | unknown;
  title?: ReactNode;
}) {
  return <div>{title}{children}{onConfirm && <button disabled={disabled} onClick={() => void onConfirm()} type="button">{okText ?? "Xác nhận"}</button>}</div>;
}

interface TestColumn<RecordType extends Record<string, unknown>> {
  dataIndex?: keyof RecordType;
  key?: Key;
  render?: (
    value: unknown,
    record: RecordType,
    index: number,
  ) => ReactNode;
  title?: ReactNode;
}

interface LightweightTableProps<RecordType extends Record<string, unknown>> {
  columns?: TestColumn<RecordType>[];
  dataSource?: RecordType[];
  locale?: { emptyText?: ReactNode };
  pagination?: {
    current?: number;
    onChange?: (page: number, pageSize: number) => void;
    pageSize?: number;
    pageSizeOptions?: Array<number | string>;
    showSizeChanger?: boolean | { "aria-label"?: string };
    total?: number;
  };
  rowKey?: keyof RecordType | ((record: RecordType) => Key);
}

export function LightweightTable<RecordType extends Record<string, unknown>>({
  columns = [],
  dataSource = [],
  locale,
  pagination,
  rowKey,
}: LightweightTableProps<RecordType>) {
  const recordKey = (record: RecordType, index: number): Key => {
    if (typeof rowKey === "function") return rowKey(record);
    if (rowKey && typeof record[rowKey] === "string") {
      return record[rowKey] as string;
    }
    return index;
  };

  return (
    <>
      <table>
        <tbody>
          {dataSource.length === 0 && locale?.emptyText ? (
            <tr><td colSpan={Math.max(1, columns.length)}>{locale.emptyText}</td></tr>
          ) : null}
          {dataSource.map((record, rowIndex) => (
            <tr key={recordKey(record, rowIndex)}>
              {columns.map((column, columnIndex) => {
                const value = column.dataIndex ? record[column.dataIndex] : undefined;
                return (
                  <td key={column.key ?? columnIndex}>
                    {column.render
                      ? column.render(value, record, rowIndex)
                      : typeof value === "string" || typeof value === "number"
                        ? value
                        : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination?.onChange && <nav aria-label="Phân trang bảng">
        <button
          aria-label="Trang trước"
          disabled={(pagination.current ?? 1) <= 1}
          onClick={() => pagination.onChange?.((pagination.current ?? 1) - 1, pagination.pageSize ?? 10)}
          type="button"
        >Trước</button>
        <span>Trang {pagination.current ?? 1}</span>
        <button
          aria-label="Trang sau"
          disabled={(pagination.current ?? 1) * (pagination.pageSize ?? 10) >= (pagination.total ?? 0)}
          onClick={() => pagination.onChange?.((pagination.current ?? 1) + 1, pagination.pageSize ?? 10)}
          type="button"
        >Sau</button>
        {pagination.showSizeChanger && (
          <select
            aria-label={typeof pagination.showSizeChanger === "object"
              ? pagination.showSizeChanger["aria-label"] ?? "Số dòng mỗi trang"
              : "Số dòng mỗi trang"}
            onChange={(event) => pagination.onChange?.(pagination.current ?? 1, Number(event.target.value))}
            value={pagination.pageSize ?? 10}
          >
            {(pagination.pageSizeOptions ?? [10, 20, 50, 100]).map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        )}
      </nav>}
    </>
  );
}

interface TestTabItem {
  children?: ReactNode;
  key: string;
  label?: ReactNode;
}

export function LightweightTabs({ items = [] }: { items?: TestTabItem[] }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key);
  const active = items.find((item) => item.key === activeKey);

  return (
    <div>
      <div role="tablist">
        {items.map((item) => (
          <button
            aria-selected={item.key === activeKey}
            key={item.key}
            onClick={() => setActiveKey(item.key)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active?.children}</div>
    </div>
  );
}

interface LightweightModalProps {
  cancelText?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  okText?: ReactNode;
  okButtonProps?: { disabled?: boolean };
  onCancel?: () => void;
  onOk?: () => void;
  open?: boolean;
  title?: ReactNode;
}

export function LightweightModal({
  children,
  footer,
  okButtonProps,
  okText,
  onCancel,
  onOk,
  open,
  title,
}: LightweightModalProps) {
  if (!open) return null;
  return (
    <section aria-label={typeof title === "string" ? title : undefined} role="dialog">
      {title && <h2>{title}</h2>}
      {children}
      {footer !== null && (onCancel || onOk) && <div>
        {onCancel && <button onClick={onCancel} type="button">Hủy</button>}
        {onOk && <button disabled={okButtonProps?.disabled} onClick={onOk} type="button">{okText ?? "OK"}</button>}
      </div>}
    </section>
  );
}

function LightweightDescriptionItem({
  children,
  label,
}: {
  children?: ReactNode;
  label?: ReactNode;
}) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{children}</span>
    </div>
  );
}

export const LightweightDescriptions = Object.assign(
  function LightweightDescriptions({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  },
  { Item: LightweightDescriptionItem },
);

export const lightweightAntd = {
  Alert: LightweightAlert,
  App: LightweightApp,
  Avatar: function LightweightAvatar({ children }: LooseProps) { return <span>{children}</span>; },
  Button: LightweightButton,
  Card: LightweightCard,
  Checkbox: LightweightCheckboxNamespace,
  Col: function LightweightCol({ children }: LooseProps) { return <div>{children}</div>; },
  Descriptions: LightweightDescriptions,
  DatePicker: LightweightInput,
  Divider: function LightweightDivider({ children }: LooseProps) { return <div>{children}</div>; },
  Empty: LightweightEmpty,
  Form: LightweightFormNamespace,
  Input: LightweightInputNamespace,
  InputNumber: LightweightInput,
  Modal: LightweightModal,
  Pagination: LightweightPagination,
  Popconfirm: LightweightPopconfirm,
  Progress: LightweightProgress,
  Radio: LightweightRadioNamespace,
  Result: LightweightResult,
  Row: function LightweightRow({ children }: LooseProps) { return <div>{children}</div>; },
  Segmented: LightweightSegmented,
  Select: LightweightSelect,
  Skeleton: function LightweightSkeleton() { return <div>Đang tải</div>; },
  Spin: function LightweightSpin() { return <span>Đang tải</span>; },
  Space: LightweightSpace,
  Statistic: LightweightStatistic,
  Switch: LightweightSwitch,
  Table: LightweightTable,
  Tabs: LightweightTabs,
  Tag: function LightweightTag({ children }: LooseProps) { return <span>{children}</span>; },
  Typography: LightweightTypography,
};
