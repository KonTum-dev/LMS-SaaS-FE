"use client";

import {
  DisconnectOutlined,
  LockOutlined,
  ReloadOutlined,
  YoutubeOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Input, Modal, Skeleton, Tag } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import {
  navigateToYouTubeAuthorization,
  youtubeApi,
  youtubeErrorMessage,
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
  "Ngắt kết nối sẽ thu hồi quyền YouTube của DX LMS. Các workspace hoặc tài khoản DX LMS khác đang dùng cùng tài khoản Google này có thể phải kết nối lại. Những video đã xuất bản vẫn được giữ nguyên trên kênh.";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Chưa có";
}

export function YouTubeIntegrationCard({
  canPublish,
  canRevoke,
  scope,
  token,
}: YouTubeIntegrationCardProps) {
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
  const [confirmationError, setConfirmationError] = useState("");
  const [error, setError] = useState(() =>
    callbackResult === "error"
      ? "Kênh YouTube chưa được kết nối. Bạn có thể thử lại khi sẵn sàng."
      : "",
  );
  const [notice, setNotice] = useState(() =>
    callbackResult === "connected" ? "Đã kết nối kênh YouTube." : "",
  );
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
    if (callbackResult === "connected" && canRevoke) {
      void queryClient.invalidateQueries({ queryKey });
    }
    router.replace("/account/integrations", { scroll: false });
  }, [callbackResult, canRevoke, queryClient, queryKey, router]);

  const openConfirmation = (action: Exclude<ConfirmationAction, null>) => {
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

  const confirm = async ({ currentPassword }: PasswordValues) => {
    const action = confirmationAction;
    if (
      !action ||
      (action === "CONNECT" && !canPublish) ||
      (action === "DISCONNECT" && !canRevoke)
    ) {
      return;
    }
    const requestedToken = token;
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
      setConfirmationAction(null);
      setNotice(
        "Đã ngắt kết nối YouTube. Các video đã xuất bản vẫn được giữ trên kênh.",
      );
      setError("");
      await queryClient.invalidateQueries({ queryKey });
    } catch (caught) {
      passwordForm.resetFields();
      if (
        caught instanceof ApiError &&
        caught.status === 409 &&
        caught.code === "CREDENTIAL_CHANGED_RELOGIN"
      ) {
        logout();
        router.replace("/login");
        return;
      }
      if (latestTokenRef.current !== requestedToken) return;
      setConfirmationError(youtubeErrorMessage(caught));
    } finally {
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
          <YoutubeOutlined /> Kênh YouTube
        </span>
      }
    >
      <div className={styles.content}>
        <p className={styles.description}>
          Kết nối kênh để giáo viên hoặc quản trị viên toàn workspace có thể chủ
          động xuất bản từng video bài học. DX LMS không tự động đưa video lên
          YouTube.
        </p>
        <Alert
          description="DX LMS chỉ đưa video lên đúng kênh sau mỗi lần bạn xác nhận. Kết nối Google Drive ở mục trên không được dùng để tự động xuất bản video."
          showIcon
          title="Bạn kiểm soát từng lần xuất bản"
          type="info"
        />
        {!canRevoke ? (
          <Alert
            description="Tích hợp này chỉ áp dụng cho tài khoản đang làm việc trong một workspace."
            showIcon
            title="Không có kết nối YouTube trong tài khoản này"
            type="info"
          />
        ) : (
          <>
            {!canPublish && (
              <Alert
                description="Bạn vẫn có thể xem trạng thái và ngắt kết nối kênh của chính mình. Chỉ giáo viên hoặc quản trị viên toàn workspace mới có thể kết nối kênh và xuất bản video."
                showIcon
                title="Quyền xuất bản không khả dụng với vai trò hiện tại"
                type="info"
              />
            )}
            {error && (
              <Alert
                closable
                onClose={() => setError("")}
                showIcon
                title={error}
                type="error"
              />
            )}
            {notice && (
              <Alert
                closable
                onClose={() => setNotice("")}
                showIcon
                title={notice}
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
                    onClick={() => void statusQuery.refetch()}
                    size="small"
                  >
                    Thử lại
                  </Button>
                }
                showIcon
                title={youtubeErrorMessage(statusQuery.error)}
                type="error"
              />
            ) : status?.state === "CONNECTED" ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>Đã kết nối</strong>
                    <span>{status.channel?.title ?? "Kênh YouTube"}</span>
                  </div>
                  <Tag
                    color={
                      !canPublish || status.uploadEnabled
                        ? "success"
                        : "warning"
                    }
                  >
                    {!canPublish
                      ? "Đã kết nối"
                      : status.uploadEnabled
                        ? "Sẵn sàng xuất bản"
                        : "Tạm khóa xuất bản"}
                  </Tag>
                </div>
                <div className={styles.metadata}>
                  <strong>Kết nối từ</strong>
                  <span>{formatDateTime(status.connectedAt)}</span>
                  {status.channel?.id && <span>ID kênh: {status.channel.id}</span>}
                </div>
                {canPublish && !status.uploadEnabled && (
                  <Alert
                    description="Quyền kênh đã được lưu nhưng backend hoặc kho media hiện chưa cho phép upload. Không có video nào được gửi đi."
                    showIcon
                    title="Xuất bản YouTube chưa khả dụng"
                    type="warning"
                  />
                )}
                <div className={styles.actions}>
                  <Button
                    danger
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("DISCONNECT")}
                  >
                    Ngắt kết nối YouTube
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>{reconnect ? "Cần kết nối lại" : "Chưa kết nối"}</strong>
                    <span>
                      {reconnect
                        ? "Quyền YouTube đã hết hiệu lực."
                        : "Chưa có video nào được tự động xuất bản."}
                    </span>
                  </div>
                  <Tag color={reconnect ? "warning" : undefined}>
                    {reconnect ? "Cần xác thực lại" : "Chưa kết nối"}
                  </Tag>
                </div>
                {(canPublish || reconnect) && (
                  <div className={styles.actions}>
                    {canPublish && (
                      <Button
                        icon={<YoutubeOutlined />}
                        onClick={() => openConfirmation("CONNECT")}
                        type="primary"
                      >
                        {reconnect ? "Kết nối lại YouTube" : "Kết nối YouTube"}
                      </Button>
                    )}
                    {reconnect && (
                      <Button
                        danger
                        icon={<DisconnectOutlined />}
                        onClick={() => openConfirmation("DISCONNECT")}
                      >
                        Ngắt kết nối YouTube
                      </Button>
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
        cancelText="Hủy"
        confirmLoading={confirmationPending}
        destroyOnHidden
        mask={{ closable: !confirmationPending }}
        okButtonProps={{ danger: confirmationAction === "DISCONNECT" }}
        okText={
          confirmationAction === "DISCONNECT"
            ? "Ngắt kết nối YouTube"
            : "Xác nhận và kết nối"
        }
        onCancel={closeConfirmation}
        onOk={() => passwordForm.submit()}
        open={confirmationAction !== null}
        title={
          confirmationAction === "DISCONNECT"
            ? "Ngắt kết nối YouTube"
            : "Kết nối kênh YouTube"
        }
      >
        <p className={styles.modalNote}>
          {confirmationAction === "DISCONNECT"
            ? YOUTUBE_DISCONNECT_WARNING
            : "Xác nhận mật khẩu trước khi chọn kênh YouTube cần kết nối."}
        </p>
        {confirmationError && (
          <Alert
            showIcon
            style={{ marginBottom: 16 }}
            title={confirmationError}
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
    </Card>
  );
}
