// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";

interface Row { id: string; name: string }

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

describe("DataTable", () => {
  it("render row model của TanStack bằng giao diện Ant Design", () => {
    const columns: ColumnDef<StockFeatures, Row>[] = [
      { accessorKey: "name", header: "Học viên", cell: ({ getValue }) => <strong>{getValue<string>()}</strong> },
    ];

    render(<DataTable columns={columns} data={[{ id: "1", name: "Nguyễn Minh An" }]} rowKey="id" />);

    expect(screen.getByText("Học viên")).toBeTruthy();
    expect(screen.getByText("Nguyễn Minh An")).toBeTruthy();
  });

  it("giữ đúng record và action khi chuyển sang trang tiếp theo", async () => {
    const onSelect = vi.fn();
    const data = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      name: `Học viên ${index + 1}`,
    }));
    const columns: ColumnDef<StockFeatures, Row>[] = [
      { accessorKey: "name", header: "Học viên", cell: ({ row }) => <span>{row.original.name}</span> },
      {
        id: "action",
        header: "Thao tác",
        cell: ({ row }) => (
          <button type="button" onClick={() => onSelect(row.original.id)}>
            Chọn {row.original.name}
          </button>
        ),
      },
    ];

    render(<DataTable columns={columns} data={data} pageSize={5} rowKey="id" />);

    fireEvent.click(screen.getByTitle("2"));

    await waitFor(() => expect(screen.getByText("Học viên 6")).toBeTruthy());
    expect(screen.queryByText("Học viên 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chọn Học viên 6" }));
    expect(onSelect).toHaveBeenCalledWith("6");
  });
});
