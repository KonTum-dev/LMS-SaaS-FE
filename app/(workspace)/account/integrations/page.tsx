"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";


import {
  CloudUploadOutlined,
  DisconnectOutlined,
  LockOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Modal, Skeleton, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { YouTubeIntegrationCard } from "@/components/integrations/youtube-integration-card";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import {
  googleDriveApi,
  googleDriveErrorMessage,
  navigateToGoogleDriveAuthorization,
  type GoogleDriveStatus,
} from "@/lib/google-drive-api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  canPublishYouTube,
  canRevokeYouTube,
} from "@/lib/workspace-access";
import styles from "./page.module.css";

type ConfirmationAction = "CONNECT_DRIVE" | "DISCONNECT_DRIVE";

interface PasswordConfirmationValues {
  currentPassword: string;
}

const DRIVE_DISCONNECT_WARNING =
  "Hủy liên kết workspace hiện tại sẽ thu hồi quyền Google Drive của DX LMS. Các workspace hoặc tài khoản LMS khác đang dùng cùng tài khoản Google có thể phải liên kết lại. Các tệp sao lưu đã tạo vẫn được giữ nguyên trên Drive.";


function confirmationCopy(action: ConfirmationAction | null) {
  switch (action) {
    case "CONNECT_DRIVE":
      return {
        button: "Xác nhận và liên kết",
        note: "Xác nhận mật khẩu trước khi cấp quyền tạo tệp sao lưu trên Google Drive.",
        title: "Liên kết Google Drive",
      };
    case "DISCONNECT_DRIVE":
      return {
        button: "Hủy liên kết",
        note: DRIVE_DISCONNECT_WARNING,
        title: "Hủy liên kết Google Drive",
      };
    default:
      return { button: "Xác nhận", note: "", title: "Xác nhận mật khẩu" };
  }
}

function AccountIntegrationsContent() {
  const { t, formatDate } = useI18n(authMessages);
  const { logout, organization, token, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const callbackResult = searchParams.get("googleDrive");
  const [passwordForm] = Form.useForm<PasswordConfirmationValues>();
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [driveError, setDriveError] = useState(() =>
    callbackResult === "error"
      ? "Google Drive chưa được liên kết. Bạn có thể thử lại khi sẵn sàng."
      : "",
  );
  const [driveNotice, setDriveNotice] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const callbackHandled = useRef(false);
  const confirmationInFlight = useRef(false);
  const syncInFlight = useRef(false);
  const latestTokenRef = useRef(token);
  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const googleDriveKey = useMemo(
    () =>
      scope
        ? lmsQueryKeys.googleDrive(scope)
        : (["lms", "signed-out", "integrations", "google-drive"] as const),
    [scope],
  );
  const dataIntegrationsSupported = user?.role !== "SUPER_ADMIN";

  const driveStatusQuery = useQuery({
    enabled: Boolean(token && scope && dataIntegrationsSupported),
    queryFn: ({ signal }) => googleDriveApi.getStatus({ token }, signal),
    queryKey: googleDriveKey,
    refetchInterval: (query) => {
      return query.state.data?.syncInProgress ? 2_000 : false;
    },
  });

  useEffect(() => {
    if (callbackResult !== "connected" && callbackResult !== "error") return;
    if (callbackHandled.current) return;
    callbackHandled.current = true;
    if (callbackResult === "error") {
      router.replace("/account/integrations", { scroll: false });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: googleDriveKey });
        if (cancelled) return;
        const verified = queryClient.getQueryData<GoogleDriveStatus>(googleDriveKey);
        if (verified?.state === "CONNECTED") {
          setDriveError("");
          setDriveNotice("Đã liên kết Google Drive để đồng bộ dữ liệu.");
        } else {
          setDriveNotice("");
          setDriveError(
            "Google Drive chưa được liên kết. Bạn có thể thử lại khi sẵn sàng.",
          );
        }
      } catch {
        if (!cancelled) {
          setDriveNotice("");
          setDriveError(
            "Chưa thể xác nhận liên kết Google Drive. Vui lòng tải lại trạng thái.",
          );
        }
      } finally {
        if (!cancelled) {
          router.replace("/account/integrations", { scroll: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [callbackResult, googleDriveKey, queryClient, router]);

  const openConfirmation = (action: ConfirmationAction) => {
    if (confirmationInFlight.current || syncInFlight.current) return;
    passwordForm.resetFields();
    setConfirmationError("");
    setConfirmationAction(action);
  };

  const closeConfirmation = () => {
    if (confirmationInFlight.current) return;
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
    if (!action || confirmationInFlight.current) return;
    confirmationInFlight.current = true;
    const requestedToken = token;
    setConfirmationPending(true);
    setConfirmationError("");
    try {
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
      await googleDriveApi.disconnect(
        { token: requestedToken },
        currentPassword,
      );
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      setDriveNotice(
        "Đã hủy liên kết Google Drive. Các tệp sao lưu hiện có vẫn được giữ nguyên.",
      );
      setDriveError("");
      await queryClient.invalidateQueries({ queryKey: googleDriveKey });
      setConfirmationAction(null);
    } catch (caught) {
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      if (forceReloginIfCredentialsChanged(caught)) return;
      setConfirmationError(googleDriveErrorMessage(caught));
    } finally {
      confirmationInFlight.current = false;
      setConfirmationPending(false);
    }
  };

  const syncDrive = async () => {
    if (syncInFlight.current || confirmationInFlight.current || driveStatusQuery.data?.syncInProgress) return;
    syncInFlight.current = true;
    const requestedToken = token;
    setSyncPending(true);
    setDriveError("");
    setDriveNotice("");
    try {
      const updated = await googleDriveApi.sync({ token: requestedToken });
      if (latestTokenRef.current !== requestedToken) return;
      queryClient.setQueryData(googleDriveKey, updated);
      setDriveNotice("Đã đồng bộ bản sao lưu lên Google Drive.");
    } catch (caught) {
      if (latestTokenRef.current !== requestedToken) return;
      setDriveError(googleDriveErrorMessage(caught));
    } finally {
      syncInFlight.current = false;
      setSyncPending(false);
    }
  };

  if (!user || !scope) {
    return (
      <Alert
        showIcon
        title={t("Không tìm thấy phạm vi tài khoản hiện tại.")}
        type="warning"
      />
    );
  }

  if (!dataIntegrationsSupported) {
    return (
      <div className="page-shell">
        <div className="page-heading">
          <div>
            <h1>{t("Kết nối dữ liệu")}</h1>
            <p>{t("Quản lý quyền dữ liệu Google Drive và YouTube cho workspace.")}</p>
          </div>
        </div>
        <Alert
          description={t("Đăng nhập bằng tài khoản của tổ chức để kết nối Google Drive hoặc YouTube.")}
          showIcon
          title={t("Kết nối dành cho tài khoản tổ chức")}
          type="info"
        />
      </div>
    );
  }

  const driveStatus = driveStatusQuery.data;
  const confirmation = confirmationCopy(confirmationAction);
  const syncActive =
    driveStatus?.syncInProgress === true;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Kết nối dữ liệu")}</h1>
          <p>
            {t("Sao lưu dữ liệu và xuất bản video bài học.")}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Card
          className={`surface-card ${styles.card}`}
          title={
            <span className={styles.cardTitle}>
              <CloudUploadOutlined /> Google Drive</span>
          }
        >
          <div className={styles.content}>
            <p className={styles.description}>
              {t("Sao lưu dữ liệu của tổ chức lên Google Drive.")}</p>
            {driveError && (
              <Alert
                closable
                onClose={() => setDriveError("")}
                showIcon
                title={t(driveError)}
                type="error"
              />
            )}
            {driveNotice && (
              <Alert
                closable
                onClose={() => setDriveNotice("")}
                showIcon
                title={t(driveNotice)}
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
                    loading={driveStatusQuery.isFetching}
                    onClick={() => void driveStatusQuery.refetch({ cancelRefetch: false })}
                    size="small"
                  >
                    {t("Thử lại")}</Button>
                }
                showIcon
                title={t(googleDriveErrorMessage(driveStatusQuery.error))}
                type="error"
              />
            ) : driveStatus?.state === "CONNECTED" ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>{driveStatus.accountEmail ?? "Google Drive"}</strong>
                  </div>
                  <Tag color="success">{t("Sẵn sàng đồng bộ")}</Tag>
                </div>
                <div className={styles.metadata}>
                  <div>
                    <strong>{t("Lần đồng bộ gần nhất")}</strong>
                    <span>
                      {syncActive
                        ? t("Đang xử lý…")
                        : formatDate(
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
                      {t("Mở {name} trên Google Drive", { name: driveStatus.lastSync.file.name })}</a>
                  ) : driveStatus.lastSync?.file ? (
                    <span>{t("Tệp sao lưu:")} {driveStatus.lastSync.file.name}</span>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <Button
                    aria-busy={syncPending || syncActive}
                    disabled={syncActive || syncPending || confirmationPending}
                    icon={<CloudUploadOutlined />}
                    loading={syncPending || syncActive}
                    onClick={() => void syncDrive()}
                    type="primary"
                  >
                    {t("Đồng bộ ngay")}</Button>
                  <Button
                    danger
                    disabled={syncActive || syncPending || confirmationPending}
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("DISCONNECT_DRIVE")}
                  >
                    {t("Hủy liên kết")}</Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>
                      {driveStatus?.state === "REAUTH_REQUIRED"
                        ? t("Cần liên kết lại")
                        : t("Chưa liên kết")}
                    </strong>
                    <span>
                      {driveStatus?.state === "REAUTH_REQUIRED"
                        ? t("Quyền Google Drive đã hết hiệu lực.")
                        : t("Chỉ liên kết khi bạn muốn tạo bản sao lưu.")}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Button
                    disabled={confirmationPending}
                    icon={<CloudUploadOutlined />}
                    onClick={() => openConfirmation("CONNECT_DRIVE")}
                    type="primary"
                  >
                    {driveStatus?.state === "REAUTH_REQUIRED"
                      ? t("Liên kết lại Google Drive")
                      : t("Liên kết Google Drive")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        <YouTubeIntegrationCard
          canPublish={canPublishYouTube(user)}
          canRevoke={canRevokeYouTube(user)}
          scope={scope}
          token={token}
        />
      </div>

      <p className={styles.description}>{t("Kết nối này không thay đổi cách đăng nhập Google.")}</p>

      <Modal
        cancelButtonProps={{ disabled: confirmationPending }}
        cancelText={t("Hủy")}
        destroyOnHidden
        closable={!confirmationPending}
        keyboard={!confirmationPending}
        mask={{ closable: !confirmationPending }}
        okButtonProps={{ "aria-label": t(confirmation.button), "aria-busy": confirmationPending, disabled: confirmationPending, danger: confirmationAction === "DISCONNECT_DRIVE" }}
        okText={t(confirmation.button)}
        onCancel={closeConfirmation}
        onOk={() => passwordForm.submit()}
        open={confirmationAction !== null}
        confirmLoading={confirmationPending}
        title={t(confirmation.title)}
      >
        <p className={styles.modalNote}>{t(confirmation.note)}</p>
        {confirmationError && (
          <Alert
            showIcon
            style={{ marginBottom: 16 }}
            title={t(confirmationError)}
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
            label={t("Mật khẩu hiện tại")}
            name="currentPassword"
            rules={[{ message: t("Nhập mật khẩu hiện tại"), required: true }]}
          >
            <Input.Password
              autoComplete="current-password"
              disabled={confirmationPending}
              prefix={<LockOutlined />}
              placeholder={t("Mật khẩu hiện tại")}
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
