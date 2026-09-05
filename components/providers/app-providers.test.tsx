// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { AppProviders, useAuth } from "./app-providers";
import { useFeedback } from "@/components/feedback/feedback-provider";

const user = {
  sub: "teacher-1",
  email: "teacher@nova.test",
  fullName: "Cô Mai",
  membershipId: "membership-1",
  role: "INSTRUCTOR" as const,
  tenantId: "tenant-1",
};
const organization = {
  _id: "tenant-1",
  name: "Nova Academy",
  slug: "nova",
  status: "ACTIVE" as const,
  primaryColor: "#5B5BD6",
  logoUrl: null,
  enabledModules: ["COURSES" as const],
};
const effectiveAccess = {
  graceEndsAt: null,
  limits: {
    maxActiveLearners: null,
    maxBranches: null,
    maxCourses: 25,
    maxUsers: 250,
  },
  modules: ["COURSES" as const],
  readOnly: false,
  state: "ACTIVE" as const,
};
const workspaces = [
  {
    membershipId: "membership-1",
    tenantId: "tenant-1",
    name: "Nova Academy",
    slug: "nova",
    role: "INSTRUCTOR" as const,
    logoUrl: null,
    primaryColor: "#5B5BD6",
  },
  {
    membershipId: "membership-2",
    tenantId: "tenant-2",
    name: "Lumen School",
    slug: "lumen",
    role: "TENANT_ADMIN" as const,
    logoUrl: null,
    primaryColor: "#176BFF",
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const lateSessionPayload = {
  accessToken: "late-token",
  effectiveAccess,
  organization,
  user,
  workspaces,
};

let exposedQueryClient: QueryClient | null = null;
let broadcastChannels: MockBroadcastChannel[] = [];
let latePrivateMutation = deferred<{ secret: string }>();
let lateAuthResponse = deferred<typeof lateSessionPayload>();
let lateAuthOutcome = vi.fn();
const oldAuthorityAction = vi.fn();

class MockBroadcastChannel {
  readonly postMessage = vi.fn();
  private readonly listeners = new Set<
    (event: MessageEvent<unknown>) => void
  >();

  constructor(readonly name: string) {
    broadcastChannels.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void,
  ) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void,
  ) {
    if (type === "message") this.listeners.delete(listener);
  }

  close() {
    this.listeners.clear();
  }

  receive(data: unknown) {
    const event = new MessageEvent("message", { data });
    this.listeners.forEach((listener) => listener(event));
  }
}

function Probe() {
  const auth = useAuth();
  const { modal } = useFeedback();
  const queryClient = useQueryClient();
  const [cacheSize, setCacheSize] = useState(
    () => queryClient.getQueryCache().getAll().length,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    exposedQueryClient = queryClient;
    return () => {
      if (exposedQueryClient === queryClient) exposedQueryClient = null;
    };
  }, [queryClient]);
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe(() => {
        setCacheSize(queryClient.getQueryCache().getAll().length);
      }),
    [queryClient],
  );
  const lateMutation = useMutation({
    mutationFn: () => latePrivateMutation.promise,
    onSuccess: (data) => {
      queryClient.setQueryData(["late-private"], data);
      auth.updateOrganization({ ...organization, name: "Late private tenant" });
    },
  });

  return (
    <>
      <span>{auth.user?.email ?? "signed-out"}</span>
      <span>access:{auth.effectiveAccess?.state ?? "none"}</span>
      <span>organization:{auth.organization?._id ?? "none"}</span>
      <span>role:{auth.user?.role ?? "none"}</span>
      <span>avatar:{auth.user?.avatarUrl ?? "none"}</span>
      <span>token:{auth.token || "none"}</span>
      <span>workspaces:{auth.workspaces.length}</span>
      <span>workspace-one:{auth.workspaces[0]?.name ?? "none"}</span>
      <span>cache:{cacheSize}</span>
      <span>error:{error || "none"}</span>
      <button
        onClick={() =>
          modal.confirm({
            title: "Confirm an action for the previous authority",
            okText: "Execute the old action",
            onOk: oldAuthorityAction,
          })
        }
        type="button"
      >
        Open authority confirmation
      </button>
      <button
        onClick={() =>
          queryClient.setQueryData(["private", "tenant-1"], { secret: true })
        }
        type="button"
      >
        Seed cache
      </button>
      <button onClick={() => lateMutation.mutate()} type="button">
        Start late mutation
      </button>
      <button
        onClick={() => {
          const expectedGeneration = auth.captureAuthGeneration();
          void lateAuthResponse.promise
            .then((payload) =>
              auth.consumeAuthResponse(payload, expectedGeneration),
            )
            .then(() => lateAuthOutcome("accepted"))
            .catch(() => lateAuthOutcome("rejected"));
        }}
        type="button"
      >
        Start late auth response
      </button>
      <button
        onClick={() =>
          void auth
            .switchWorkspace("tenant-2")
            .catch((caught) =>
              setError(caught instanceof Error ? caught.message : "failed"),
            )
        }
        type="button"
      >
        Chuyển workspace
      </button>
      <button
        onClick={() =>
          void auth
            .switchWorkspace("tenant-3")
            .catch((caught) =>
              setError(caught instanceof Error ? caught.message : "failed"),
            )
        }
        type="button"
      >
        Chuyển workspace 3
      </button>
      <button onClick={() => void auth.refreshSession()} type="button">
        Làm mới phiên
      </button>
      <button
        onClick={() =>
          void auth
            .login("new@nova.test", "ValidPassword123")
            .catch((caught) =>
              setError(caught instanceof Error ? caught.message : "failed"),
            )
        }
        type="button"
      >
        Đăng nhập mới
      </button>
      <button
        onClick={() => {
          auth.updateOrganization({
            ...organization,
            name: "Tên tenant cũ đến muộn",
          });
          auth.updateEffectiveAccess(
            { ...effectiveAccess, readOnly: true, state: "READ_ONLY" },
            "tenant-1",
          );
        }}
        type="button"
      >
        Áp dụng phản hồi cũ
      </button>
      <button
        onClick={() =>
          auth.updateUserProfile({
            avatarUrl:
              "https://lms-be.example.test/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            fullName: "Cô Mai mới",
            sub: "teacher-1",
          })
        }
        type="button"
      >
        Cập nhật hồ sơ
      </button>
      <button onClick={auth.logout} type="button">
        Đăng xuất
      </button>
    </>
  );
}

function renderRestoredSession(fetchImplementation?: typeof fetch) {
  localStorage.setItem(
    "novalms-session",
    JSON.stringify({
      effectiveAccess: {
        ...effectiveAccess,
        readOnly: true,
        state: "READ_ONLY",
      },
      organization,
      token: "token-1",
      user,
    }),
  );
  vi.stubGlobal(
    "fetch",
    fetchImplementation ??
      (vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ effectiveAccess, user, organization, workspaces }),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          ),
        ) as typeof fetch),
  );
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  );
}

beforeEach(() => {
  exposedQueryClient = null;
  broadcastChannels = [];
  latePrivateMutation = deferred<{ secret: string }>();
  lateAuthResponse = deferred<typeof lateSessionPayload>();
  lateAuthOutcome = vi.fn();
  oldAuthorityAction.mockClear();
  const store = new Map<string, string>();
  const storage: Storage = {
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppProviders auth lifecycle", () => {
  it.each(["logout", "workspace switch"])(
    "removes a previous authority's actual confirmation on %s",
    async (transition) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              effectiveAccess,
              user,
              organization,
              workspaces,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              accessToken: "token-2",
              effectiveAccess,
              organization: { ...organization, _id: "tenant-2" },
              user: {
                ...user,
                tenantId: "tenant-2",
                membershipId: "membership-2",
              },
              workspaces,
            }),
            { status: 200 },
          ),
        );
      renderRestoredSession(fetchMock as typeof fetch);
      await screen.findByText("organization:tenant-1");
      fireEvent.click(
        screen.getByRole("button", { name: "Open authority confirmation" }),
      );
      const oldButton = await screen.findByRole("button", {
        name: "Execute the old action",
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: transition === "logout" ? "Đăng xuất" : "Chuyển workspace",
        }),
      );
      await screen.findByText(
        transition === "logout" ? "signed-out" : "organization:tenant-2",
      );
      await waitFor(() =>
        expect(
          screen.queryByText("Confirm an action for the previous authority"),
        ).toBeNull(),
      );
      expect(oldButton.isConnected).toBe(false);
      fireEvent.click(oldButton);
      expect(oldAuthorityAction).not.toHaveBeenCalled();
    },
  );

  it("thay access state cũ trong localStorage bằng dữ liệu mới từ auth/me", async () => {
    renderRestoredSession();

    await screen.findByText("access:ACTIVE");
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      effectiveAccess: { readOnly: false, state: "ACTIVE" },
    });
  });

  it("khôi phục avatar mới nhất từ auth/me sau khi reload", async () => {
    const staleAvatar =
      "https://lms-be.example.test/api/v1/public-assets/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const freshAvatar =
      "https://lms-be.example.test/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    localStorage.setItem(
      "novalms-session",
      JSON.stringify({
        effectiveAccess,
        organization,
        token: "token-1",
        user: { ...user, avatarUrl: staleAvatar },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            effectiveAccess,
            organization,
            user: { ...user, avatarUrl: freshAvatar },
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    await screen.findByText(`avatar:${freshAvatar}`);
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}").user,
    ).toMatchObject({ avatarUrl: freshAvatar });
  });

  it("khôi phục được localStorage legacy không có workspaces", async () => {
    renderRestoredSession(
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ effectiveAccess, user, organization }),
            { headers: { "Content-Type": "application/json" }, status: 200 },
          ),
        ) as typeof fetch,
    );

    await screen.findByText("teacher@nova.test");
    expect(screen.getByText("workspaces:0")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      token: "token-1",
      workspaces: [],
    });
  });

  it("cập nhật profile hiện tại vào UI và session storage", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật hồ sơ" }));

    expect(
      screen.getByText(
        "avatar:https://lms-be.example.test/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}").user,
    ).toMatchObject({
      avatarUrl:
        "https://lms-be.example.test/api/v1/public-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fullName: "Cô Mai mới",
      sub: "teacher-1",
    });
  });

  it("không để 401 auth/me cũ hủy response login mới hợp lệ", async () => {
    const staleRestore = deferred<Response>();
    const freshLogin = deferred<Response>();
    const switchedUser = {
      ...user,
      email: "new@nova.test",
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(staleRestore.promise)
      .mockReturnValueOnce(freshLogin.promise);
    renderRestoredSession(fetchMock as typeof fetch);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập mới" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    staleRestore.resolve(
      new Response(
        JSON.stringify({ code: "UNAUTHORIZED", message: "Token cũ hết hạn" }),
        { headers: { "Content-Type": "application/json" }, status: 401 },
      ),
    );
    freshLogin.resolve(
      new Response(
        JSON.stringify({
          accessToken: "new-login-token",
          effectiveAccess,
          organization: switchedOrganization,
          user: switchedUser,
          workspaces,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    await screen.findByText("token:new-login-token");
    expect(screen.getByText("organization:tenant-2")).toBeTruthy();
    expect(screen.getByText("new@nova.test")).toBeTruthy();
    expect(screen.getByText("error:none")).toBeTruthy();
  });

  it.each([
    ["auth:expired", () => window.dispatchEvent(new Event("auth:expired"))],
    [
      "logout",
      () => fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" })),
    ],
  ])(
    "%s clear session storage và toàn bộ query cache",
    async (_name, expire) => {
      renderRestoredSession();
      await screen.findByText("teacher@nova.test");
      fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
      await waitFor(() => expect(screen.getByText("cache:1")).toBeTruthy());

      expire();

      await screen.findByText("signed-out");
      await waitFor(() => expect(screen.getByText("cache:0")).toBeTruthy());
      expect(localStorage.getItem("novalms-session")).toBeNull();
    },
  );

  it("xoay QueryClient để mutation cũ đến muộn không thể bơm lại private cache sau logout", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    const retiredClient = exposedQueryClient;
    expect(retiredClient).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Start late mutation" }),
    );
    await waitFor(() =>
      expect(retiredClient!.getMutationCache().getAll()[0]?.state.status).toBe(
        "pending",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await screen.findByText("signed-out");
    await waitFor(() => expect(exposedQueryClient).not.toBe(retiredClient));
    act(() => latePrivateMutation.resolve({ secret: "late-tenant-data" }));
    await waitFor(() =>
      expect(retiredClient!.getQueryData(["late-private"])).toEqual({
        secret: "late-tenant-data",
      }),
    );
    expect(exposedQueryClient!.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem("novalms-session")).toBeNull();
  });

  it("từ chối AuthResponse đến muộn sau logout thay vì tái tạo phiên", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    fireEvent.click(
      screen.getByRole("button", { name: "Start late auth response" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    await screen.findByText("signed-out");

    act(() => lateAuthResponse.resolve(lateSessionPayload));
    await waitFor(() =>
      expect(lateAuthOutcome).toHaveBeenCalledWith("rejected"),
    );
    expect(screen.getByText("token:none")).toBeTruthy();
    expect(localStorage.getItem("novalms-session")).toBeNull();
  });

  it("phát logout không kèm dữ liệu phiên sau khi xóa cache cục bộ", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await screen.findByText("signed-out");
    expect(screen.getByText("cache:0")).toBeTruthy();
    expect(broadcastChannels).toHaveLength(1);
    expect(broadcastChannels[0].name).toBe("novalms-auth");
    expect(broadcastChannels[0].postMessage).toHaveBeenCalledWith({
      type: "LOGOUT",
    });
  });

  it("nhận logout từ tab khác sẽ xóa session và toàn bộ cache mà không phát vòng lặp", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    act(() => broadcastChannels[0].receive({ type: "LOGOUT" }));

    await screen.findByText("signed-out");
    expect(screen.getByText("cache:0")).toBeTruthy();
    expect(localStorage.getItem("novalms-session")).toBeNull();
    expect(broadcastChannels[0].postMessage).not.toHaveBeenCalled();
  });

  it("storage fallback xóa phiên nếu tab khác gỡ session", async () => {
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "novalms-session",
          newValue: null,
        }),
      ),
    );

    await screen.findByText("signed-out");
    expect(screen.getByText("cache:0")).toBeTruthy();
  });

  it("vẫn vận hành và logout cục bộ nếu trình duyệt từ chối BroadcastChannel", async () => {
    vi.stubGlobal(
      "BroadcastChannel",
      class UnavailableBroadcastChannel {
        constructor() {
          throw new DOMException("BroadcastChannel blocked", "SecurityError");
        }
      },
    );
    renderRestoredSession();
    await screen.findByText("teacher@nova.test");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await screen.findByText("signed-out");
    expect(screen.getByText("cache:0")).toBeTruthy();
    expect(localStorage.getItem("novalms-session")).toBeNull();
  });

  it("đổi workspace thay toàn bộ phiên và xóa cache tenant cũ trước khi hiển thị phiên mới", async () => {
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const switchedUser = {
      ...user,
      membershipId: "membership-2",
      role: "TENANT_ADMIN" as const,
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-2",
            effectiveAccess,
            organization: switchedOrganization,
            user: switchedUser,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Chuyển workspace" }));

    await screen.findByText("organization:tenant-2");
    expect(screen.getByText("token:token-2")).toBeTruthy();
    expect(screen.getByText("cache:0")).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining("/auth/switch-workspace"),
      expect.objectContaining({
        body: JSON.stringify({ tenantId: "tenant-2" }),
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
        method: "POST",
      }),
    );
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      organization: { _id: "tenant-2" },
      token: "token-2",
      user: { membershipId: "membership-2", tenantId: "tenant-2" },
      workspaces,
    });
  });

  it("auth/me đổi vai trò sẽ xóa cache thuộc quyền cũ trước khi cập nhật phiên", async () => {
    const learnerUser = { ...user, role: "LEARNER" as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            effectiveAccess,
            user: learnerUser,
            organization,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("role:INSTRUCTOR");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Làm mới phiên" }));

    await screen.findByText("role:LEARNER");
    expect(screen.getByText("cache:0")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      user: { role: "LEARNER" },
    });
  });

  it("auth/me đổi membership trong cùng tenant sẽ xoay cache authority", async () => {
    const reissuedMembership = { ...user, membershipId: "membership-reissued" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            effectiveAccess,
            user: reissuedMembership,
            organization,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("teacher@nova.test");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Làm mới phiên" }));

    await screen.findByText("cache:0");
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      user: { membershipId: "membership-reissued", tenantId: "tenant-1" },
    });
  });

  it("giữ nguyên token, tổ chức và cache khi đổi workspace thất bại", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ message: "Không có quyền vào workspace" }),
          { headers: { "Content-Type": "application/json" }, status: 403 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");
    fireEvent.click(screen.getByRole("button", { name: "Seed cache" }));
    await screen.findByText("cache:1");

    fireEvent.click(screen.getByRole("button", { name: "Chuyển workspace" }));

    await screen.findByText("error:Không có quyền vào workspace");
    expect(screen.getByText("organization:tenant-1")).toBeTruthy();
    expect(screen.getByText("token:token-1")).toBeTruthy();
    expect(screen.getByText("cache:1")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("novalms-session") ?? "{}"),
    ).toMatchObject({
      organization: { _id: "tenant-1" },
      token: "token-1",
    });
  });

  it("bỏ qua 401 đến muộn từ token cũ nhưng logout khi chính token hiện tại hết hạn", async () => {
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const switchedUser = {
      ...user,
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-2",
            effectiveAccess,
            organization: switchedOrganization,
            user: switchedUser,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");
    fireEvent.click(screen.getByRole("button", { name: "Chuyển workspace" }));
    await screen.findByText("token:token-2");

    window.dispatchEvent(
      new CustomEvent("auth:expired", { detail: { token: "token-1" } }),
    );
    expect(screen.getByText("token:token-2")).toBeTruthy();

    window.dispatchEvent(
      new CustomEvent("auth:expired", { detail: { token: "token-2" } }),
    );
    await screen.findByText("signed-out");
    expect(localStorage.getItem("novalms-session")).toBeNull();
  });

  it("không logout bởi 401 token cũ trong lúc đang hủy query trước khi commit token mới", async () => {
    const cancellation = deferred<void>();
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const switchedUser = {
      ...user,
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-2",
            effectiveAccess,
            organization: switchedOrganization,
            user: switchedUser,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");
    expect(exposedQueryClient).not.toBeNull();
    vi.spyOn(exposedQueryClient!, "cancelQueries").mockReturnValue(
      cancellation.promise,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Chuyển workspace$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    window.dispatchEvent(
      new CustomEvent("auth:expired", { detail: { token: "token-1" } }),
    );

    expect(screen.getByText("teacher@nova.test")).toBeTruthy();
    cancellation.resolve();
    await screen.findByText("token:token-2");
    expect(screen.getByText("organization:tenant-2")).toBeTruthy();
  });

  it("không để auth/me dùng token cũ ghi đè workspace vừa chuyển", async () => {
    const staleRefresh = deferred<Response>();
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const switchedUser = {
      ...user,
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockReturnValueOnce(staleRefresh.promise)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-2",
            effectiveAccess,
            organization: switchedOrganization,
            user: switchedUser,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");

    fireEvent.click(screen.getByRole("button", { name: "Làm mới phiên" }));
    fireEvent.click(screen.getByRole("button", { name: /^Chuyển workspace$/ }));
    await screen.findByText("token:token-2");
    staleRefresh.resolve(
      new Response(
        JSON.stringify({
          effectiveAccess: {
            ...effectiveAccess,
            readOnly: true,
            state: "READ_ONLY",
          },
          user,
          organization,
          workspaces,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText("organization:tenant-2")).toBeTruthy();
    expect(screen.getByText("token:token-2")).toBeTruthy();
    expect(screen.getByText("access:ACTIVE")).toBeTruthy();
  });

  it("hai yêu cầu chuyển đồng thời dùng quy tắc yêu cầu mới nhất thắng", async () => {
    const firstSwitch = deferred<Response>();
    const organizationThree = {
      ...organization,
      _id: "tenant-3",
      name: "Orion Center",
      slug: "orion",
    };
    const userThree = {
      ...user,
      membershipId: "membership-3",
      tenantId: "tenant-3",
    };
    const organizationTwo = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const userTwo = {
      ...user,
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockReturnValueOnce(firstSwitch.promise)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-3",
            effectiveAccess,
            organization: organizationThree,
            user: userThree,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");

    fireEvent.click(screen.getByRole("button", { name: /^Chuyển workspace$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chuyển workspace 3" }));
    await screen.findByText("token:token-3");
    firstSwitch.resolve(
      new Response(
        JSON.stringify({
          accessToken: "token-2",
          effectiveAccess,
          organization: organizationTwo,
          user: userTwo,
          workspaces,
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByText("organization:tenant-3")).toBeTruthy();
    expect(screen.getByText("token:token-3")).toBeTruthy();
  });

  it("bỏ qua organization và entitlement cũ sau khi đã đổi tenant", async () => {
    const switchedOrganization = {
      ...organization,
      _id: "tenant-2",
      name: "Lumen School",
      slug: "lumen",
    };
    const switchedUser = {
      ...user,
      membershipId: "membership-2",
      tenantId: "tenant-2",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ effectiveAccess, user, organization, workspaces }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "token-2",
            effectiveAccess,
            organization: switchedOrganization,
            user: switchedUser,
            workspaces,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      );
    renderRestoredSession(fetchMock as typeof fetch);
    await screen.findByText("organization:tenant-1");
    fireEvent.click(screen.getByRole("button", { name: /^Chuyển workspace$/ }));
    await screen.findByText("organization:tenant-2");

    fireEvent.click(
      screen.getByRole("button", { name: "Áp dụng phản hồi cũ" }),
    );

    expect(screen.getByText("organization:tenant-2")).toBeTruthy();
    expect(screen.getByText("access:ACTIVE")).toBeTruthy();
    expect(
      screen.getByText("workspace-one:Tên tenant cũ đến muộn"),
    ).toBeTruthy();
  });
});
