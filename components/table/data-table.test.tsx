// @vitest-environment jsdom

import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";

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
  showSizeChanger?: boolean;
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
  beforeEach(() => { mocks.props = null; });
  afterEach(cleanup);

  it("giữ client pagination hiện hữu khi chỉ truyền pageSize", () => {
    render(<DataTable columns={columns} data={rows} pageSize={5} rowKey="_id" />);

    expect(mocks.props?.dataSource).toEqual(rows);
    expect(mocks.props?.rowKey).toBe("_id");
    expect(mocks.props?.pagination).toMatchObject({
      hideOnSinglePage: true,
      pageSize: 5,
      showLessItems: true,
      showSizeChanger: false,
    });
    expect(mocks.props?.pagination).not.toHaveProperty("current");
    expect(mocks.props?.pagination).not.toHaveProperty("total");
    expect(mocks.props?.pagination).not.toHaveProperty("onChange");
    expect(mocks.props?.pagination?.showTotal?.(12, [1, 5])).toBe("1–5 trên 12 mục");
  });

  it("giữ default pageSize=10 và các props table không liên quan", () => {
    render(<DataTable columns={columns} data={rows} loading rowKey={(row) => row._id} scrollX={720} />);

    expect(mocks.props?.pagination?.pageSize).toBe(10);
    expect(mocks.props?.loading).toBe(true);
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
      hideOnSinglePage: true,
      pageSize: 20,
      showLessItems: true,
      showSizeChanger: false,
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
});
