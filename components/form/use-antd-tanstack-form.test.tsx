// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAntdTanStackForm } from "./use-antd-tanstack-form";

function Harness({ onSubmit }: { onSubmit: (value: { title: string }) => void }) {
  const bridge = useAntdTanStackForm({ title: "" }, onSubmit);
  return <button onClick={() => void bridge.submit({ title: "Bài tập tuần 1" })}>Lưu</button>;
}

describe("cầu nối TanStack Form và Ant Design", () => {
  it("chuyển đúng giá trị đã được Ant Design validate vào vòng đời submit", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: "Bài tập tuần 1" }));
  });
});
