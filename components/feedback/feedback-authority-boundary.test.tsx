// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App, ConfigProvider, Modal } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackAuthorityBoundary } from "./feedback-authority-boundary";

const performOldAction = vi.fn();
function Probe() {
  const { modal, message, notification } = App.useApp();
  return (
    <button
      onClick={() => {
        modal.confirm({
          title: "Previous authority confirmation",
          okText: "Execute previous action",
          onOk: performOldAction,
        });
        void message.error("Previous authority error", 0);
        notification.warning({
          title: "Previous authority notification",
          duration: 0,
        });
      }}
    >
      Open previous authority UI
    </button>
  );
}

function tree(authorityEpoch: string | null) {
  return (
    <ConfigProvider theme={{ token: { motion: false } }}>
      <App>
        <FeedbackAuthorityBoundary authorityEpoch={authorityEpoch}>
          <Probe />
        </FeedbackAuthorityBoundary>
      </App>
    </ConfigProvider>
  );
}

beforeEach(() => {
  performOldAction.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
afterEach(() => {
  Modal.destroyAll();
  cleanup();
});

describe("feedback authority boundary", () => {
  it.each([
    ["logout", null],
    ["workspace switch", '[2,"user-1","tenant-2","member-2","TENANT_ADMIN"]'],
    [
      "same-scope query generation rotation",
      '[2,"user-1","tenant-1","member-1","TENANT_ADMIN"]',
    ],
    ["authority demotion", '[1,"user-1","tenant-1","member-1","INSTRUCTOR"]'],
    ["identity change", '[2,"user-2","tenant-1","member-2","TENANT_ADMIN"]'],
  ])(
    "removes old modal callbacks and notices on %s",
    async (_label, nextEpoch) => {
      const view = render(
        tree('[1,"user-1","tenant-1","member-1","TENANT_ADMIN"]'),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Open previous authority UI" }),
      );
      const oldAction = await screen.findByRole("button", {
        name: "Execute previous action",
      });
      await screen.findByText("Previous authority error");
      await screen.findByText("Previous authority notification");

      view.rerender(tree(nextEpoch));

      await waitFor(() => {
        expect(
          screen.queryByText("Previous authority confirmation"),
        ).toBeNull();
        expect(screen.queryByText("Previous authority error")).toBeNull();
        expect(
          screen.queryByText("Previous authority notification"),
        ).toBeNull();
      });
      expect(oldAction.isConnected).toBe(false);
      fireEvent.click(oldAction);
      expect(performOldAction).not.toHaveBeenCalled();
    },
  );

  it("keeps anonymous-to-login feedback and unchanged-authority interactions", async () => {
    const view = render(tree(null));
    fireEvent.click(
      screen.getByRole("button", { name: "Open previous authority UI" }),
    );
    await screen.findByText("Previous authority error");
    view.rerender(tree('[1,"user-1","tenant-1","member-1","TENANT_ADMIN"]'));
    expect(screen.getByText("Previous authority error")).toBeTruthy();
    view.rerender(tree('[1,"user-1","tenant-1","member-1","TENANT_ADMIN"]'));
    fireEvent.click(
      screen.getByRole("button", { name: "Execute previous action" }),
    );
    expect(performOldAction).toHaveBeenCalledOnce();
  });
});
