"use client";

import {
  flexRender,
  stockFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type StockFeatures,
} from "@tanstack/react-table";
import { Empty, Table } from "antd";

interface DataTableBaseProps<TData extends RowData> {
  ariaLabel?: string;
  columns: ColumnDef<StockFeatures, TData>[];
  data: TData[];
  emptyText?: React.ReactNode;
  loading?: boolean;
  rowKey: keyof TData | ((record: TData) => React.Key);
  scrollX?: number;
}

interface ClientPaginationProps {
  onPageChange?: never;
  page?: never;
  pageSize?: number;
  total?: never;
}

interface ServerPaginationProps {
  onPageChange: (page: number, pageSize: number) => void;
  page: number;
  pageSize: number;
  total: number;
}

export type DataTableProps<TData extends RowData> = DataTableBaseProps<TData>
  & (ClientPaginationProps | ServerPaginationProps);

export function DataTable<TData extends RowData>({
  ariaLabel = "Bảng dữ liệu",
  columns,
  data,
  emptyText = "Chưa có dữ liệu",
  loading,
  onPageChange,
  page,
  pageSize = 10,
  rowKey,
  scrollX,
  total,
}: DataTableProps<TData>) {
  const table = useTable({ data, columns, features: stockFeatures });
  const headers = table.getHeaderGroups()[0]?.headers ?? [];
  const rowsByRecord = new Map(table.getRowModel().rows.map((row) => [row.original, row]));

  const antdColumns = headers.map((header) => {
    const meta = header.column.columnDef.meta as {
      responsive?: Array<"xs" | "sm" | "md" | "lg" | "xl" | "xxl">;
      width?: number;
    } | undefined;

    return {
      key: header.id,
      responsive: meta?.responsive,
      title: flexRender(header.column.columnDef.header, header.getContext()),
      width: meta?.width,
      render: (_: unknown, record: TData) => {
        const row = rowsByRecord.get(record);
        const cell = row?.getVisibleCells().find((item) => item.column.id === header.column.id);
        return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
      },
    };
  });

  const emptyState = typeof emptyText === "string"
    ? <Empty className="data-table__empty" description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    : emptyText;
  const serverControlled = typeof page === "number"
    && typeof total === "number"
    && typeof onPageChange === "function";
  const pagination = {
    ...(serverControlled ? { current: page, onChange: onPageChange, total } : {}),
    hideOnSinglePage: true,
    pageSize,
    showLessItems: true,
    showSizeChanger: false,
    showTotal: (itemTotal: number, range: [number, number]) => `${range[0]}–${range[1]} trên ${itemTotal} mục`,
  };

  return (
    <div aria-label={ariaLabel} className="data-table" role="region">
      {scrollX && <div aria-hidden="true" className="data-table__mobile-hint">Vuốt ngang để xem thêm</div>}
      <Table<TData>
        className="data-table__table"
        columns={antdColumns}
        dataSource={table.getRowModel().rows.map((row) => row.original)}
        loading={loading}
        locale={{ emptyText: emptyState }}
        pagination={pagination}
        rowKey={rowKey as never}
        scroll={scrollX ? { x: scrollX } : undefined}
      />
    </div>
  );
}
