// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const mocks = vi.hoisted(() => ({
  removeCurrent: vi.fn(),
  updateOrganization: vi.fn(),
  uploadCurrent: vi.fn(),
}));

const organization = {
  _id: "64b000000000000000000043",
  enabledModules: ["USERS" as const, "COURSES" as const],
  logoUrl: "https://legacy.example.test/logo.png",
  name: "Bright Academy",
  primaryColor: "#176BFF",
  slug: "bright-academy",
  status: "ACTIVE" as const,
};

vi.mock("@/components/providers/app-providers", () => ({
  useAuth: () => ({
    effectiveAccess: {
      graceEndsAt: null,
      limits: {
        maxActiveLearners: null,
        maxBranches: null,
        maxCourses: 10,
        maxUsers: 100,
      },
      modules: ["USERS", "COURSES"],
      readOnly: false,
      state: "ACTIVE",
    },
    organization,
    token: "tenant-token",
    updateOrganization: mocks.updateOrganization,
    user: {
      email: "owner@example.test",
      fullName: "Owner",
      membershipId: "membership-1",
      orgUnitScopeMode: "GLOBAL",
      role: "TENANT_ADMIN",
      sub: "64b000000000000000000011",
      tenantId: organization._id,
    },
  }),
}));
vi.mock("@/lib/profile-api", () => ({
  organizationLogoApi: {
    removeCurrent: mocks.removeCurrent,
    uploadCurrent: mocks.uploadCurrent,
  },
}));
vi.mock("@/components/account-security/profile-image-editor", () => ({
  ProfileImageEditor: ({
    imageUrl,
    onRemove,
    onUpload,
  }: {
    imageUrl?: string | null;
    onRemove: () => Promise<void>;
    onUpload: (
      file: File,
      options: { onProgress: () => void; signal: AbortSignal },
    ) => Promise<void>;
  }) => (
    <div>
      <span>logo:{imageUrl}</span>
      <button
        onClick={() =>
          void onUpload(new File(["logo"], "logo.png", { type: "image/png" }), {
            onProgress() {},
            signal: new AbortController().signal,
          })
        }
        type="button"
      >
        Tải logo local
      </button>
      <button onClick={() => void onRemove()} type="button">
        Gỡ logo local
      </button>
    </div>
  ),
}));

const localLogo =
  "http://localhost:4000/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

beforeEach(() => {
  mocks.removeCurrent.mockReset();
  mocks.removeCurrent.mockResolvedValue({ ...organization, logoUrl: null });
  mocks.updateOrganization.mockReset();
  mocks.uploadCurrent.mockReset();
  mocks.uploadCurrent.mockResolvedValue({
    ...organization,
    logoUrl: localLogo,
  });
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
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App>
        <SettingsPage />
      </App>
    </QueryClientProvider>,
  );
}

describe("SettingsPage local logo", () => {
  it("không còn nhận URL ngoài và upload/remove logo qua backend", async () => {
    renderPage();
    expect(screen.queryByLabelText("Đường dẫn ảnh logo")).toBeNull();
    expect(screen.getByText(`logo:${organization.logoUrl}`)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Tải logo local" }));
    await waitFor(() =>
      expect(mocks.uploadCurrent).toHaveBeenCalledWith(
        "tenant-token",
        expect.objectContaining({ name: "logo.png", type: "image/png" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      ...organization,
      logoUrl: localLogo,
    });

    fireEvent.click(screen.getByRole("button", { name: "Gỡ logo local" }));
    await waitFor(() =>
      expect(mocks.removeCurrent).toHaveBeenCalledWith("tenant-token"),
    );
    expect(mocks.updateOrganization).toHaveBeenLastCalledWith({
      ...organization,
      logoUrl: null,
    });
  });
});
