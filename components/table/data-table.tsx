"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { listPageCount, listPageSizes } from "@/lib/list-controls";
import { useEffect, useState } from "react";

import {
  flexRender,
  stockFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type StockFeatures,
} from "@tanstack/react-table";
import { Empty, Table } from "antd";
const tableMessages = { ...learningMessages, ...workspacePolishMessages };

interface DataTableBaseProps<TData extends RowData> {
  ariaLabel?: string;
  columns: ColumnDef<StockFeatures, TData>[];
  data: TData[];
  emptyText?: React.ReactNode;
  loading?: boolean;
  /** Change with client-side search/filter criteria, not with each data refresh. */
  paginationResetKey?: string | number;
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
  ariaLabel,
  columns,
  data,
  emptyText,
  loading,
  onPageChange,
  page,
  pageSize = 10,
  paginationResetKey,
  rowKey,
  scrollX,
  total,
}: DataTableProps<TData>) {
  const { t } = useI18n(tableMessages);
  const serverControlled = typeof page === "number"
    && typeof total === "number"
    && typeof onPageChange === "function";
  const [clientPagination, setClientPagination] = useState({
    page: 1, pageSize, initialSize: pageSize, resetKey: paginationResetKey,
  });
  // Reset criteria during render so no frame shows page N of a newly filtered list.
  if (!serverControlled && (clientPagination.resetKey !== paginationResetKey || clientPagination.initialSize !== pageSize)) {
    setClientPagination({
      page: 1,
      pageSize: clientPagination.initialSize !== pageSize ? pageSize : clientPagination.pageSize,
      initialSize: pageSize,
      resetKey: paginationResetKey,
    });
  }
  const resolvedSize = serverControlled ? pageSize : clientPagination.pageSize;
  const resolvedTotal = serverControlled ? total : data.length;
  const lastPage = listPageCount(resolvedTotal, resolvedSize);
  if (!serverControlled && !loading && clientPagination.page > lastPage
    && clientPagination.resetKey === paginationResetKey && clientPagination.initialSize === pageSize) {
    setClientPagination({ ...clientPagination, page: lastPage });
  }
  const currentPage = serverControlled ? page : Math.min(clientPagination.page, lastPage);
  useEffect(() => {
    if (serverControlled && !loading && page > lastPage) onPageChange(lastPage, pageSize);
  }, [lastPage, loading, onPageChange, page, pageSize, serverControlled]);
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

  const resolvedEmptyText = emptyText ?? t("Chưa có dữ liệu");
  const emptyState = typeof resolvedEmptyText === "string"
    ? <Empty className="data-table__empty" description={resolvedEmptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
    : resolvedEmptyText;
  const pageSizes = listPageSizes(resolvedSize);
  const compactPagination = resolvedTotal <= pageSizes[0];
  const pagination = {
    current: currentPage,
    total: resolvedTotal,
    disabled: loading,
    onChange: (nextPage: number, nextSize: number) => {
      const targetPage = nextSize !== resolvedSize ? 1 : nextPage;
      if (serverControlled) onPageChange(targetPage, nextSize);
      else setClientPagination({ page: targetPage, pageSize: nextSize, initialSize: pageSize, resetKey: paginationResetKey });
    },
    hideOnSinglePage: compactPagination,
    pageSize: resolvedSize,
    pageSizeOptions: pageSizes,
    responsive: true,
    showLessItems: true,
    showSizeChanger: { "aria-label": t("Số dòng mỗi trang"), showSearch: false },
    showTotal: (itemTotal: number, range: [number, number]) => t("{p0}–{p1} trên {p2} mục", { p0: range[0], p1: range[1], p2: itemTotal }),
  };

  return (
    <div aria-busy={Boolean(loading)} aria-label={ariaLabel ?? t("Bảng dữ liệu")} className="data-table" role="region">
      {scrollX && <div aria-hidden="true" className="data-table__mobile-hint">{t("Vuốt ngang để xem thêm")}</div>}
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
      {compactPagination && <div className="data-table__summary">{t("{total} mục", { total: resolvedTotal })}</div>}
    </div>
  );
}
