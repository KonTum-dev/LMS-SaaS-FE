// @vitest-environment jsdom

import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";
import { FeedbackLocaleProvider } from "@/components/feedback/feedback-locale";

interface TestRow {
  _id: string;
  name: string;
}

interface CapturedPagination {
  current?: number;
  hideOnSinglePage?: boolean;
  onChange?: (page: number, pageSize: number) => void;
  pageSize?: number;
  showLessItems?: boolean;
  showSizeChanger?: boolean | { "aria-label": string; showSearch: boolean };
  pageSizeOptions?: number[];
  disabled?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
  total?: number;
}

interface CapturedTableProps {
  dataSource?: TestRow[];
  loading?: boolean;
  pagination?: CapturedPagination;
  rowKey?: keyof TestRow | ((row: TestRow) => React.Key);
  scroll?: { x: number };
}

const mocks = vi.hoisted(() => ({
  props: null as CapturedTableProps | null,
}));

vi.mock("antd", () => {
  function Table(props: CapturedTableProps) {
    mocks.props = props;
    return <div data-testid="antd-table" />;
  }
  const Empty = Object.assign(
    ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    { PRESENTED_IMAGE_SIMPLE: null },
  );
  return { Empty, Table };
});

const columns: ColumnDef<StockFeatures, TestRow>[] = [
  { accessorKey: "name", cell: ({ getValue }) => getValue<string>(), header: "Tên" },
];
const rows: TestRow[] = [
  { _id: "row-1", name: "Một" },
  { _id: "row-2", name: "Hai" },
];

describe("DataTable pagination contract", () => {
  it("localizes table navigation but preserves caller-owned labels and row data", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    render(<FeedbackLocaleProvider initialLocale="en"><DataTable columns={columns} data={rows} rowKey="_id" scrollX={720} /></FeedbackLocaleProvider>);
    expect(screen.getByRole("region", { name: "Data table" })).toBeTruthy();
    expect(screen.getByText("Swipe horizontally to see more")).toBeTruthy();
    expect(mocks.props?.pagination?.showTotal?.(1200, [1, 10])).toBe("1–10 of 1200 items");
    expect(mocks.props?.dataSource).toEqual(rows);
  });
  beforeEach(() => { mocks.props = null; });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("giữ client pagination hiện hữu khi chỉ truyền pageSize", () => {
    render(<DataTable columns={columns} data={rows} pageSize={5} rowKey="_id" />);

    expect(mocks.props?.dataSource).toEqual(rows);
    expect(mocks.props?.rowKey).toBe("_id");
    expect(mocks.props?.pagination).toMatchObject({
      current: 1,
      total: 2,
      hideOnSinglePage: true,
      pageSize: 5,
      showLessItems: true,
      showSizeChanger: { "aria-label": "Số dòng mỗi trang", showSearch: false },
    });
    expect(mocks.props?.pagination?.pageSizeOptions).toEqual([5, 10, 20, 50, 100]);
    expect(typeof mocks.props?.pagination?.onChange).toBe("function");
    expect(mocks.props?.pagination?.showTotal?.(12, [1, 5])).toBe("1–5 trên 12 mục");
  });

  it("giữ default pageSize=10 và các props table không liên quan", () => {
    render(<DataTable columns={columns} data={rows} loading rowKey={(row) => row._id} scrollX={720} />);

    expect(mocks.props?.pagination?.pageSize).toBe(10);
    expect(mocks.props?.loading).toBe(true);
    expect(mocks.props?.pagination?.disabled).toBe(true);
    expect(screen.getByRole("region").getAttribute("aria-busy")).toBe("true");
    expect(mocks.props?.scroll).toEqual({ x: 720 });
    expect(typeof mocks.props?.rowKey).toBe("function");
  });

  it("forward đầy đủ server-controlled page/pageSize/total và callback", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<DataTable
      columns={columns}
      data={rows}
      onPageChange={onPageChange}
      page={3}
      pageSize={20}
      rowKey="_id"
      total={63}
    />);

    expect(mocks.props?.dataSource).toEqual(rows);
    expect(mocks.props?.pagination).toMatchObject({
      current: 3,
      hideOnSinglePage: false,
      pageSize: 20,
      showLessItems: true,
      showSizeChanger: { "aria-label": "Số dòng mỗi trang", showSearch: false },
      total: 63,
    });
    mocks.props?.pagination?.onChange?.(4, 20);
    expect(onPageChange).toHaveBeenCalledOnce();
    expect(onPageChange).toHaveBeenCalledWith(4, 20);

    rerender(<DataTable
      columns={columns}
      data={rows}
      onPageChange={onPageChange}
      page={4}
      pageSize={20}
      rowKey="_id"
      total={63}
    />);
    expect(mocks.props?.pagination?.current).toBe(4);
  });

  it("resets client page when size or filters change while preserving the chosen size", () => {
    const manyRows = Array.from({ length: 65 }, (_, i) => ({ _id: String(i), name: String(i) }));
    const { rerender } = render(<DataTable columns={columns} data={manyRows} paginationResetKey="all" rowKey="_id" />);
    act(() => mocks.props?.pagination?.onChange?.(3, 10));
    expect(mocks.props?.pagination?.current).toBe(3);
    act(() => mocks.props?.pagination?.onChange?.(2, 20));
    expect(mocks.props?.pagination).toMatchObject({ current: 1, pageSize: 20 });
    act(() => mocks.props?.pagination?.onChange?.(3, 20));
    rerender(<DataTable columns={columns} data={manyRows} paginationResetKey="filtered" rowKey="_id" />);
    expect(mocks.props?.pagination).toMatchObject({ current: 1, pageSize: 20, total: 65 });
  });

  it("clamps a client page after removals and keeps totals visible on an empty list", () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({ _id: String(i), name: String(i) }));
    const { rerender } = render(<DataTable columns={columns} data={manyRows} rowKey="_id" />);
    act(() => mocks.props?.pagination?.onChange?.(3, 10));
    rerender(<DataTable columns={columns} data={rows} rowKey="_id" />);
    expect(mocks.props?.pagination?.current).toBe(1);
    rerender(<DataTable columns={columns} data={[]} rowKey="_id" />);
    expect(mocks.props?.pagination).toMatchObject({ current: 1, total: 0, hideOnSinglePage: true });
    expect(screen.getByText("0 mục")).toBeTruthy();
    expect(mocks.props?.pagination?.showTotal?.(0, [0, 0])).toBe("0–0 trên 0 mục");
  });

  it("server size changes start at page one; stale loading totals never trigger a clamp", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<DataTable columns={columns} data={rows} loading onPageChange={onPageChange} page={4} pageSize={20} rowKey="_id" total={2} />);
    expect(onPageChange).not.toHaveBeenCalled();
    rerender(<DataTable columns={columns} data={rows} onPageChange={onPageChange} page={4} pageSize={20} rowKey="_id" total={2} />);
    expect(onPageChange).toHaveBeenCalledWith(1, 20);
    onPageChange.mockClear();
    mocks.props?.pagination?.onChange?.(2, 50);
    expect(onPageChange).toHaveBeenCalledWith(1, 50);
  });

  it("keeps page-size navigation when a smaller page can still be chosen", () => {
    const fifteenRows = Array.from({ length: 15 }, (_, i) => ({ _id: String(i), name: String(i) }));
    render(<DataTable columns={columns} data={fifteenRows} pageSize={20} rowKey="_id" />);
    expect(mocks.props?.pagination?.hideOnSinglePage).toBe(false);
    act(() => mocks.props?.pagination?.onChange?.(1, 10));
    expect(mocks.props?.pagination).toMatchObject({ pageSize: 10, total: 15, current: 1 });
  });
});
