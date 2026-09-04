"use client";

import {
  CloudUploadOutlined,
  DisconnectOutlined,
  GoogleOutlined,
  LockOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Skeleton,
  Tag,
} from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GoogleIdentityButton } from "@/components/account-security/google-identity-button";
import { YouTubeIntegrationCard } from "@/components/integrations/youtube-integration-card";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import {
  googleAuthApi,
  googleAuthErrorMessage,
  type GoogleAuthChallenge,
} from "@/lib/google-auth-api";
import {
  googleDriveApi,
  googleDriveErrorMessage,
  navigateToGoogleDriveAuthorization,
} from "@/lib/google-drive-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  canPublishYouTube,
  canRevokeYouTube,
} from "@/lib/workspace-access";
import styles from "./page.module.css";

type ConfirmationAction = "CONNECT_DRIVE" | "DISCONNECT_DRIVE" | "LINK_GOOGLE" | "UNLINK_GOOGLE";

interface PasswordConfirmationValues {
  currentPassword: string;
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const DRIVE_DISCONNECT_WARNING =
  "Ngắt kết nối workspace hiện tại sẽ thu hồi quyền Google Drive của DX LMS. Các workspace hoặc tài khoản LMS khác đang dùng cùng tài khoản Google có thể phải kết nối lại. Các tệp sao lưu đã tạo vẫn được giữ nguyên trên Drive.";

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Chưa có";
}

function confirmationCopy(action: ConfirmationAction | null) {
  switch (action) {
    case "LINK_GOOGLE":
      return {
        button: "Xác nhận và tiếp tục",
        note: "Xác nhận mật khẩu trước khi chọn tài khoản Google cần liên kết.",
        title: "Liên kết đăng nhập Google",
      };
    case "UNLINK_GOOGLE":
      return {
        button: "Hủy liên kết",
        note: "Sau khi hủy liên kết, bạn vẫn có thể đăng nhập bằng email và mật khẩu.",
        title: "Hủy liên kết Google",
      };
    case "CONNECT_DRIVE":
      return {
        button: "Xác nhận và kết nối",
        note: "Xác nhận mật khẩu trước khi cấp quyền tạo tệp sao lưu trên Google Drive.",
        title: "Kết nối Google Drive",
      };
    case "DISCONNECT_DRIVE":
      return {
        button: "Ngắt kết nối",
        note: DRIVE_DISCONNECT_WARNING,
        title: "Ngắt kết nối Google Drive",
      };
    default:
      return { button: "Xác nhận", note: "", title: "Xác nhận mật khẩu" };
  }
}

function AccountIntegrationsContent() {
  const { logout, organization, token, user, workspaces } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const callbackResult = searchParams.get("googleDrive");
  const [passwordForm] = Form.useForm<PasswordConfirmationValues>();
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [driveError, setDriveError] = useState(() =>
    callbackResult === "error"
      ? "Google Drive chưa được kết nối. Bạn có thể thử lại khi sẵn sàng."
      : "",
  );
  const [driveNotice, setDriveNotice] = useState(() =>
    callbackResult === "connected" ? "Đã kết nối Google Drive." : "",
  );
  const [linkChallenge, setLinkChallenge] =
    useState<GoogleAuthChallenge | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const latestTokenRef = useRef(token);
  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const googleIdentityKey = useMemo(
    () =>
      user
        ? lmsQueryKeys.googleIdentity(user.sub)
        : (["lms", "account", "signed-out", "google-identity"] as const),
    [user],
  );
  const googleDriveKey = useMemo(
    () =>
      scope
        ? lmsQueryKeys.googleDrive(scope)
        : (["lms", "signed-out", "integrations", "google-drive"] as const),
    [scope],
  );
  const googleIntegrationsSupported = user?.role !== "SUPER_ADMIN";

  const linkStatusQuery = useQuery({
    enabled: Boolean(token && user && googleIntegrationsSupported),
    queryFn: ({ signal }) => googleAuthApi.getLinkStatus({ token }, signal),
    queryKey: googleIdentityKey,
  });
  const driveStatusQuery = useQuery({
    enabled: Boolean(token && scope && googleIntegrationsSupported),
    queryFn: ({ signal }) => googleDriveApi.getStatus({ token }, signal),
    queryKey: googleDriveKey,
    refetchInterval: (query) => {
      return query.state.data?.syncInProgress ? 2_000 : false;
    },
  });

  useEffect(() => {
    if (callbackResult !== "connected" && callbackResult !== "error") return;
    if (callbackResult === "connected") {
      void queryClient.invalidateQueries({ queryKey: googleDriveKey });
    }
    router.replace("/account/integrations", { scroll: false });
  }, [callbackResult, googleDriveKey, queryClient, router]);

  const workspaceName = useMemo(() => {
    if (organization?.name) return organization.name;
    const selected = workspaces.find(
      (workspace) => workspace.tenantId === user?.tenantId,
    );
    if (selected?.name) return selected.name;
    return user?.role === "SUPER_ADMIN"
      ? "Không gian quản trị nền tảng"
      : "Workspace hiện tại";
  }, [organization?.name, user?.role, user?.tenantId, workspaces]);

  const openConfirmation = (action: ConfirmationAction) => {
    passwordForm.resetFields();
    setConfirmationError("");
    setConfirmationAction(action);
  };

  const closeConfirmation = () => {
    if (confirmationPending) return;
    passwordForm.resetFields();
    setConfirmationError("");
    setConfirmationAction(null);
  };

  const forceReloginIfCredentialsChanged = (caught: unknown): boolean => {
    if (
      caught instanceof ApiError &&
      caught.status === 409 &&
      caught.code === "CREDENTIAL_CHANGED_RELOGIN"
    ) {
      passwordForm.resetFields();
      logout();
      router.replace("/login");
      return true;
    }
    return false;
  };

  const confirmPasswordAction = async ({
    currentPassword,
  }: PasswordConfirmationValues) => {
    const action = confirmationAction;
    if (!action) return;
    const requestedToken = token;
    setConfirmationPending(true);
    setConfirmationError("");
    try {
      if (action === "LINK_GOOGLE") {
        const challenge = await googleAuthApi.createLinkChallenge(
          { token: requestedToken },
          currentPassword,
        );
        passwordForm.resetFields();
        if (latestTokenRef.current !== requestedToken) return;
        setLinkChallenge(challenge);
        setGoogleError("");
        setGoogleNotice("Mật khẩu đã được xác nhận. Hãy chọn tài khoản Google.");
        setConfirmationAction(null);
        return;
      }
      if (action === "CONNECT_DRIVE") {
        const authorizationUrl = await googleDriveApi.connect(
          { token: requestedToken },
          currentPassword,
        );
        passwordForm.resetFields();
        if (latestTokenRef.current !== requestedToken) return;
        setConfirmationAction(null);
        navigateToGoogleDriveAuthorization(authorizationUrl);
        return;
      }
      if (action === "UNLINK_GOOGLE") {
        await googleAuthApi.unlink({ token: requestedToken }, currentPassword);
        passwordForm.resetFields();
        if (latestTokenRef.current !== requestedToken) return;
        setConfirmationAction(null);
        setGoogleNotice("Đã hủy liên kết đăng nhập Google.");
        setGoogleError("");
        await queryClient.invalidateQueries({ queryKey: googleIdentityKey });
        return;
      }

      await googleDriveApi.disconnect(
        { token: requestedToken },
        currentPassword,
      );
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      setConfirmationAction(null);
      setDriveNotice(
        "Đã ngắt kết nối. Các tệp sao lưu hiện có trên Drive vẫn được giữ nguyên.",
      );
      setDriveError("");
      await queryClient.invalidateQueries({ queryKey: googleDriveKey });
    } catch (caught) {
      passwordForm.resetFields();
      if (forceReloginIfCredentialsChanged(caught)) return;
      setConfirmationError(
        action === "LINK_GOOGLE" || action === "UNLINK_GOOGLE"
          ? googleAuthErrorMessage(caught, "LINK")
          : googleDriveErrorMessage(caught),
      );
    } finally {
      setConfirmationPending(false);
    }
  };

  const getVerifiedLinkChallenge = useCallback(
    async () => {
      if (
        !linkChallenge ||
        Date.parse(linkChallenge.expiresAt) - 30_000 <= Date.now()
      ) {
        setLinkChallenge(null);
        throw new ApiError(
          "Phiên xác minh Google đã hết hạn",
          400,
          "GOOGLE_CHALLENGE_EXPIRED",
        );
      }
      return linkChallenge;
    },
    [linkChallenge],
  );

  const linkGoogle = useCallback(
    async (credential: string, challengeToken: string) => {
      const requestedToken = token;
      setLinkChallenge(null);
      setGoogleNotice("");
      setGoogleError("");
      setLinkPending(true);
      try {
        const updated = await googleAuthApi.link(
          { token: requestedToken },
          { challengeToken, credential },
        );
        if (latestTokenRef.current !== requestedToken) return;
        queryClient.setQueryData(googleIdentityKey, updated);
        setGoogleNotice("Đã liên kết tài khoản Google để đăng nhập.");
      } finally {
        setLinkPending(false);
      }
    },
    [googleIdentityKey, queryClient, token],
  );

  const handleGoogleError = useCallback((caught: unknown) => {
    setLinkChallenge(null);
    setGoogleNotice("");
    setGoogleError(googleAuthErrorMessage(caught, "LINK"));
  }, []);

  const syncDrive = async () => {
    const requestedToken = token;
    setSyncPending(true);
    setDriveError("");
    setDriveNotice("");
    try {
      const updated = await googleDriveApi.sync({ token: requestedToken });
      if (latestTokenRef.current !== requestedToken) return;
      queryClient.setQueryData(googleDriveKey, updated);
      setDriveNotice("Đã hoàn tất sao lưu lên Google Drive.");
    } catch (caught) {
      setDriveError(googleDriveErrorMessage(caught));
    } finally {
      setSyncPending(false);
    }
  };

  if (!user || !scope) {
    return (
      <Alert
        showIcon
        title="Không tìm thấy phạm vi tài khoản hiện tại."
        type="warning"
      />
    );
  }

  if (!googleIntegrationsSupported) {
    return (
      <div className="page-shell">
        <div className="page-heading">
          <div>
            <h1>Ứng dụng kết nối</h1>
            <p>Quản lý các kết nối ngoài dành cho tài khoản DX LMS.</p>
          </div>
        </div>
        <Alert
          description="Để bảo vệ quyền quản trị toàn nền tảng, tài khoản SUPER_ADMIN không thể liên kết đăng nhập Google hoặc sao lưu dữ liệu tenant lên Google Drive. Hãy chuyển sang một tài khoản thuộc workspace để sử dụng các tính năng này."
          showIcon
          title="Tích hợp Google không áp dụng cho quản trị nền tảng"
          type="info"
        />
      </div>
    );
  }

  const linkStatus = linkStatusQuery.data;
  const driveStatus = driveStatusQuery.data;
  const confirmation = confirmationCopy(confirmationAction);
  const syncActive =
    driveStatus?.syncInProgress === true;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>Ứng dụng kết nối</h1>
          <p>
            Quản lý phương thức đăng nhập Google và bản sao lưu Google Drive của
            riêng bạn.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <Card
          className={`surface-card ${styles.card}`}
          title={
            <span className={styles.cardTitle}>
              <GoogleOutlined /> Đăng nhập bằng Google
            </span>
          }
        >
          <div className={styles.content}>
            <p className={styles.description}>
              Liên kết một tài khoản Google để đăng nhập DX LMS nhanh hơn. Tính
              năng này không yêu cầu quyền truy cập Google Drive.
            </p>
            {googleError && (
              <Alert
                closable
                onClose={() => setGoogleError("")}
                showIcon
                title={googleError}
                type="error"
              />
            )}
            {googleNotice && (
              <Alert
                closable
                onClose={() => setGoogleNotice("")}
                showIcon
                title={googleNotice}
                type="success"
              />
            )}
            {linkStatusQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            ) : linkStatusQuery.isError ? (
              <Alert
                action={
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void linkStatusQuery.refetch()}
                    size="small"
                  >
                    Thử lại
                  </Button>
                }
                showIcon
                title="Không thể đọc trạng thái liên kết Google."
                type="error"
              />
            ) : linkStatus?.linked ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>Đã liên kết</strong>
                    <span>{linkStatus.email ?? "Tài khoản Google"}</span>
                  </div>
                  <Tag color="success">Đang hoạt động</Tag>
                </div>
                <div className={styles.metadata}>
                  <div>
                    <strong>Liên kết từ</strong>
                    <span>{formatDateTime(linkStatus.linkedAt)}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Button
                    danger
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("UNLINK_GOOGLE")}
                  >
                    Hủy liên kết
                  </Button>
                </div>
              </>
            ) : linkChallenge ? (
              <div className={styles.googleButton}>
                <GoogleIdentityButton
                  accessibleLabel="Chọn tài khoản Google để liên kết"
                  disabled={linkPending}
                  getChallenge={getVerifiedLinkChallenge}
                  intent="LINK"
                  onCredential={linkGoogle}
                  onError={handleGoogleError}
                />
              </div>
            ) : (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>Chưa liên kết</strong>
                    <span>Bạn đang dùng email và mật khẩu.</span>
                  </div>
                  <Tag>Chưa kết nối</Tag>
                </div>
                <div className={styles.actions}>
                  <Button
                    icon={<GoogleOutlined />}
                    onClick={() => openConfirmation("LINK_GOOGLE")}
                    type="primary"
                  >
                    Liên kết Google
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card
          className={`surface-card ${styles.card}`}
          title={
            <span className={styles.cardTitle}>
              <CloudUploadOutlined /> Sao lưu Google Drive
            </span>
          }
        >
          <div className={styles.content}>
            <p className={styles.description}>
              Tạo bản sao lưu một chiều cho dữ liệu thuộc workspace hiện tại.
              DX LMS không đọc hay ghi đè các tệp Drive khác của bạn.
            </p>
            <Alert
              showIcon
              title={`Workspace hiện tại: ${workspaceName}`}
              type="info"
            />
            {driveError && (
              <Alert
                closable
                onClose={() => setDriveError("")}
                showIcon
                title={driveError}
                type="error"
              />
            )}
            {driveNotice && (
              <Alert
                closable
                onClose={() => setDriveNotice("")}
                showIcon
                title={driveNotice}
                type="success"
              />
            )}
            {driveStatusQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 3 }} title={false} />
            ) : driveStatusQuery.isError ? (
              <Alert
                action={
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void driveStatusQuery.refetch()}
                    size="small"
                  >
                    Thử lại
                  </Button>
                }
                showIcon
                title={googleDriveErrorMessage(driveStatusQuery.error)}
                type="error"
              />
            ) : driveStatus?.state === "CONNECTED" ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>Đã kết nối</strong>
                    <span>{driveStatus.accountEmail ?? "Google Drive"}</span>
                  </div>
                  <Tag color="success">Sẵn sàng sao lưu</Tag>
                </div>
                <div className={styles.metadata}>
                  <div>
                    <strong>Lần sao lưu gần nhất</strong>
                    <span>
                      {syncActive
                        ? "Đang xử lý…"
                        : formatDateTime(
                            driveStatus.lastSync?.completedAt ?? null,
                          )}
                    </span>
                  </div>
                  {driveStatus.lastSync?.file?.url ? (
                    <a
                      className={styles.fileLink}
                      href={driveStatus.lastSync.file.url}
                      referrerPolicy="no-referrer"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Mở {driveStatus.lastSync.file.name} trên Google Drive
                    </a>
                  ) : driveStatus.lastSync?.file ? (
                    <span>Tệp sao lưu: {driveStatus.lastSync.file.name}</span>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <Button
                    disabled={syncActive || syncPending}
                    icon={<CloudUploadOutlined />}
                    loading={syncPending || syncActive}
                    onClick={() => void syncDrive()}
                    type="primary"
                  >
                    Sao lưu ngay
                  </Button>
                  <Button
                    danger
                    disabled={syncActive || syncPending}
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("DISCONNECT_DRIVE")}
                  >
                    Ngắt kết nối
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>
                      {driveStatus?.state === "REAUTH_REQUIRED"
                        ? "Cần kết nối lại"
                        : "Chưa kết nối"}
                    </strong>
                    <span>
                      {driveStatus?.state === "REAUTH_REQUIRED"
                        ? "Quyền Google Drive đã hết hiệu lực."
                        : "Chỉ kết nối khi bạn muốn tạo bản sao lưu."}
                    </span>
                  </div>
                  <Tag
                    color={
                      driveStatus?.state === "REAUTH_REQUIRED"
                        ? "warning"
                        : undefined
                    }
                  >
                    {driveStatus?.state === "REAUTH_REQUIRED"
                      ? "Cần xác thực lại"
                      : "Chưa kết nối"}
                  </Tag>
                </div>
                <div className={styles.actions}>
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={() => openConfirmation("CONNECT_DRIVE")}
                    type="primary"
                  >
                    {driveStatus?.state === "REAUTH_REQUIRED"
                      ? "Kết nối lại Drive"
                      : "Kết nối Google Drive"}
                  </Button>
                </div>
              </>
            )}
            <span className={styles.description}>
              {DRIVE_DISCONNECT_WARNING}
            </span>
          </div>
        </Card>

        <YouTubeIntegrationCard
          canPublish={canPublishYouTube(user)}
          canRevoke={canRevokeYouTube(user)}
          scope={scope}
          token={token}
        />
      </div>

      <Modal
        cancelButtonProps={{ disabled: confirmationPending }}
        cancelText="Hủy"
        destroyOnHidden
        mask={{ closable: !confirmationPending }}
        okButtonProps={{ danger: confirmationAction === "UNLINK_GOOGLE" || confirmationAction === "DISCONNECT_DRIVE" }}
        okText={confirmation.button}
        onCancel={closeConfirmation}
        onOk={() => passwordForm.submit()}
        open={confirmationAction !== null}
        confirmLoading={confirmationPending}
        title={confirmation.title}
      >
        <p className={styles.modalNote}>{confirmation.note}</p>
        {confirmationError && (
          <Alert
            showIcon
            style={{ marginBottom: 16 }}
            title={confirmationError}
            type="error"
          />
        )}
        <Form<PasswordConfirmationValues>
          form={passwordForm}
          layout="vertical"
          onFinish={(values) => void confirmPasswordAction(values)}
          requiredMark={false}
        >
          <Form.Item
            label="Mật khẩu hiện tại"
            name="currentPassword"
            rules={[{ message: "Nhập mật khẩu hiện tại", required: true }]}
          >
            <Input.Password
              autoComplete="current-password"
              disabled={confirmationPending}
              prefix={<LockOutlined />}
              placeholder="Mật khẩu hiện tại"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function AccountIntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="page-shell">
          <Skeleton active />
        </div>
      }
    >
      <AccountIntegrationsContent />
    </Suspense>
  );
}
