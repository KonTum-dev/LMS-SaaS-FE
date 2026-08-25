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

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<StockFeatures, TData>[];
  data: TData[];
  emptyText?: React.ReactNode;
  loading?: boolean;
  pageSize?: number;
  rowKey: keyof TData | ((record: TData) => React.Key);
  scrollX?: number;
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyText = "Chưa có dữ liệu",
  loading,
  pageSize = 10,
  rowKey,
  scrollX,
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

  return (
    <Table<TData>
      columns={antdColumns}
      dataSource={table.getRowModel().rows.map((row) => row.original)}
      loading={loading}
      locale={{ emptyText: typeof emptyText === "string" ? <Empty description={emptyText} /> : emptyText }}
      pagination={{ pageSize }}
      rowKey={rowKey as never}
      scroll={scrollX ? { x: scrollX } : undefined}
    />
  );
}
