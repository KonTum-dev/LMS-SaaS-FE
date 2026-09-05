"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";

import {
  DisconnectOutlined,
  LockOutlined,
  ReloadOutlined,
  YoutubeOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Modal, Skeleton, Tag } from "antd";
import { Form } from "@/components/form/localized-form";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import {
  navigateToYouTubeAuthorization,
  youtubeApi,
  youtubeErrorMessage,
  type YouTubeIntegrationStatus,
} from "@/lib/youtube-api";
import styles from "./youtube-integration-card.module.css";

interface YouTubeIntegrationCardProps {
  canPublish: boolean;
  canRevoke: boolean;
  scope: ViewerScope;
  token: string;
}

interface PasswordValues {
  currentPassword: string;
}

type ConfirmationAction = "CONNECT" | "DISCONNECT" | null;

const YOUTUBE_DISCONNECT_WARNING =
  "Hủy liên kết sẽ thu hồi quyền YouTube của DX LMS. Các workspace hoặc tài khoản DX LMS khác đang dùng cùng tài khoản Google này có thể phải liên kết lại. Những video đã xuất bản vẫn được giữ nguyên trên kênh.";

export function YouTubeIntegrationCard({
  canPublish,
  canRevoke,
  scope,
  token,
}: YouTubeIntegrationCardProps) {
  const { t, locale } = useI18n(learningMessages);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }), [locale]);
  function formatDateTime(value: string | null): string {
    return value ? dateTimeFormatter.format(new Date(value)) : t("Chưa có");
  }

  const { logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const callbackResult = searchParams.get("youtube");
  const queryKey = useMemo(() => lmsQueryKeys.youtube(scope), [scope]);
  const [passwordForm] = Form.useForm<PasswordValues>();
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const confirmationInFlight = useRef(false);
  const callbackHandled = useRef(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [error, setError] = useState(() =>
    callbackResult === "error"
      ? "Kênh YouTube chưa được liên kết. Bạn có thể thử lại khi sẵn sàng."
      : "",
  );
  const [notice, setNotice] = useState("");
  const latestTokenRef = useRef(token);

  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  const statusQuery = useQuery({
    enabled: Boolean(token && canRevoke),
    queryFn: ({ signal }) => youtubeApi.getStatus({ token }, signal),
    queryKey,
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
        await queryClient.invalidateQueries({ queryKey });
        if (cancelled) return;
        const verified = queryClient.getQueryData<YouTubeIntegrationStatus>(queryKey);
        if (verified?.state === "CONNECTED") {
          setError("");
          setNotice("Đã liên kết kênh YouTube.");
        } else {
          setNotice("");
          setError(
            "Kênh YouTube chưa được liên kết. Bạn có thể thử lại khi sẵn sàng.",
          );
        }
      } catch {
        if (!cancelled) {
          setNotice("");
          setError(
            "Chưa thể xác nhận liên kết YouTube. Vui lòng tải lại trạng thái.",
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
  }, [callbackResult, canRevoke, queryClient, queryKey, router]);

  const openConfirmation = (action: Exclude<ConfirmationAction, null>) => {
    if (confirmationInFlight.current) return;
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

  const confirm = async ({ currentPassword }: PasswordValues) => {
    const action = confirmationAction;
    if (
      !action ||
      confirmationInFlight.current ||
      (action === "CONNECT" && !canPublish) ||
      (action === "DISCONNECT" && !canRevoke)
    ) {
      return;
    }
    const requestedToken = token;
    confirmationInFlight.current = true;
    setConfirmationPending(true);
    setConfirmationError("");
    try {
      if (action === "CONNECT") {
        const authorizationUrl = await youtubeApi.connect(
          { token: requestedToken },
          currentPassword,
        );
        passwordForm.resetFields();
        if (latestTokenRef.current !== requestedToken) return;
        setConfirmationAction(null);
        navigateToYouTubeAuthorization(authorizationUrl);
        return;
      }
      await youtubeApi.disconnect(
        { token: requestedToken },
        currentPassword,
      );
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      setNotice(
        "Đã hủy liên kết YouTube. Các video đã xuất bản vẫn được giữ trên kênh.",
      );
      setError("");
      await queryClient.invalidateQueries({ queryKey });
      setConfirmationAction(null);
    } catch (caught) {
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      if (
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.code === "CREDENTIAL_CHANGED_RELOGIN"
      ) {
        logout();
        router.replace("/login");
        return;
      }
      setConfirmationError(youtubeErrorMessage(caught));
    } finally {
      confirmationInFlight.current = false;
      setConfirmationPending(false);
    }
  };

  const status = statusQuery.data;
  const reconnect = status?.state === "REAUTH_REQUIRED";

  return (
    <Card
      className={`surface-card ${styles.card}`}
      title={
        <span className={styles.cardTitle}>
          <YoutubeOutlined /> YouTube</span>
      }
    >
      <div className={styles.content}>
        <p className={styles.description}>{t("Liên kết kênh để xuất bản video bài học khi bạn sẵn sàng.")}</p>
        {!canRevoke ? (
          <Alert
            description={t("Tích hợp này chỉ áp dụng cho tài khoản đang làm việc trong một workspace.")}
            showIcon
            title={t("Không có kết nối YouTube trong tài khoản này")}
            type="info"
          />
        ) : (
          <>
            {!canPublish && (
              <Alert
                description={t("Bạn vẫn có thể xem trạng thái và hủy liên kết kênh của chính mình. Chỉ giáo viên hoặc quản trị viên toàn workspace mới có thể liên kết kênh và xuất bản video.")}
                showIcon
                title={t("Quyền xuất bản không khả dụng với vai trò hiện tại")}
                type="info"
              />
            )}
            {error && (
              <Alert
                closable
                onClose={() => setError("")}
                showIcon
                title={t(error)}
                type="error"
              />
            )}
            {notice && (
              <Alert
                closable
                onClose={() => setNotice("")}
                showIcon
                title={t(notice)}
                type="success"
              />
            )}
            {statusQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 2 }} title={false} />
            ) : statusQuery.isError ? (
              <Alert
                action={
                  <Button
                    icon={<ReloadOutlined />}
                    loading={statusQuery.isFetching}
                    onClick={() => void statusQuery.refetch({ cancelRefetch: false })}
                    size="small"
                  >{t("Thử lại")}</Button>
                }
                showIcon
                title={t(youtubeErrorMessage(statusQuery.error))}
                type="error"
              />
            ) : status?.state === "CONNECTED" ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>{status.channel?.title ?? t("Kênh YouTube")}</strong>
                  </div>
                  <Tag
                    color={
                      !canPublish || status.uploadEnabled
                        ? "success"
                        : "warning"
                    }
                  >
                    {!canPublish
                      ? t("Đã liên kết")
                      : status.uploadEnabled
                        ? t("Sẵn sàng xuất bản")
                        : t("Tạm khóa xuất bản")}
                  </Tag>
                </div>
                <div className={styles.metadata}>
                  <strong>{t("Liên kết từ")}</strong>
                  <span>{formatDateTime(status.connectedAt)}</span>
                  {status.linkedEmail && <span>{t("Tài khoản Google:")} {status.linkedEmail}</span>}
                </div>
                {canPublish && !status.uploadEnabled && (
                  <Alert
                    description={t("Kênh đã kết nối. Tính năng xuất bản hiện chưa sẵn sàng.")}
                    showIcon
                    title={t("Xuất bản YouTube chưa khả dụng")}
                    type="warning"
                  />
                )}
                <div className={styles.actions}>
                  <Button
                    danger
                    disabled={confirmationPending}
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("DISCONNECT")}
                  >{t("Hủy liên kết YouTube")}</Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>{reconnect ? t("Cần liên kết lại") : t("Chưa liên kết")}</strong>
                    <span>
                      {reconnect
                        ? t("Quyền YouTube đã hết hiệu lực.")
                        : t("Video chỉ được xuất bản khi bạn yêu cầu.")}
                    </span>
                  </div>
                </div>
                {(canPublish || reconnect) && (
                  <div className={styles.actions}>
                    {canPublish && (
                      <Button
                        disabled={confirmationPending}
                        icon={<YoutubeOutlined />}
                        onClick={() => openConfirmation("CONNECT")}
                        type="primary"
                      >
                        {reconnect ? t("Liên kết lại YouTube") : t("Liên kết YouTube")}
                      </Button>
                    )}
                    {reconnect && (
                      <Button
                        danger
                        disabled={confirmationPending}
                        icon={<DisconnectOutlined />}
                        onClick={() => openConfirmation("DISCONNECT")}
                      >{t("Hủy liên kết YouTube")}</Button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Modal
        cancelButtonProps={{ disabled: confirmationPending }}
        cancelText={t("Hủy")}
        confirmLoading={confirmationPending}
        destroyOnHidden
        closable={!confirmationPending}
        keyboard={!confirmationPending}
        mask={{ closable: !confirmationPending }}
        okButtonProps={{ "aria-label": confirmationAction === "DISCONNECT" ? t("Hủy liên kết YouTube") : t("Xác nhận và liên kết"), "aria-busy": confirmationPending, disabled: confirmationPending, danger: confirmationAction === "DISCONNECT" }}
        okText={
          confirmationAction === "DISCONNECT"
            ? t("Hủy liên kết YouTube")
            : t("Xác nhận và liên kết")
        }
        onCancel={closeConfirmation}
        onOk={() => passwordForm.submit()}
        open={confirmationAction !== null}
        title={
          confirmationAction === "DISCONNECT"
            ? t("Hủy liên kết YouTube")
            : t("Liên kết kênh YouTube")
        }
      >
        <p className={styles.modalNote}>
          {confirmationAction === "DISCONNECT"
            ? t(YOUTUBE_DISCONNECT_WARNING)
            : t("Xác nhận mật khẩu trước khi chọn kênh YouTube cần liên kết.")}
        </p>
        {confirmationError && (
          <Alert
            showIcon
            style={{ marginBottom: 16 }}
            title={t(confirmationError)}
            type="error"
          />
        )}
        <Form<PasswordValues>
          form={passwordForm}
          layout="vertical"
          onFinish={(values) => void confirm(values)}
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
    </Card>
  );
}
