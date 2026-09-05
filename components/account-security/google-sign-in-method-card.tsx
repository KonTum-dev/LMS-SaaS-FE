"use client";

import {
  DisconnectOutlined,
  GoogleOutlined,
  LockOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Input, Modal, Skeleton, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Form } from "@/components/form/localized-form";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import {
  googleAuthApi,
  googleAuthErrorMessage,
  type GoogleAuthChallenge,
} from "@/lib/google-auth-api";
import { authMessages } from "@/lib/i18n/auth-messages";
import { lmsQueryKeys } from "@/lib/query-keys";
import { GoogleIdentityButton } from "./google-identity-button";
import styles from "./google-sign-in-method-card.module.css";

interface PasswordConfirmationValues {
  currentPassword: string;
}

type ConfirmationAction = "LINK" | "UNLINK" | null;

interface Notice {
  message: string;
  type: "info" | "success";
}

function confirmationCopy(action: ConfirmationAction) {
  return action === "UNLINK"
    ? {
        button: "Hủy liên kết Google",
        note: "Sau khi hủy liên kết, bạn vẫn có thể đăng nhập bằng email và mật khẩu.",
        title: "Hủy liên kết Google",
      }
    : {
        button: "Xác nhận và tiếp tục",
        note: "Xác nhận mật khẩu trước khi chọn tài khoản Google cần liên kết.",
        title: "Liên kết Google để đăng nhập",
      };
}

export function GoogleSignInMethodCard() {
  const { t, formatDate } = useI18n(authMessages);
  const { logout, token, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [passwordForm] = Form.useForm<PasswordConfirmationValues>();
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [linkChallenge, setLinkChallenge] =
    useState<GoogleAuthChallenge | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const confirmationInFlight = useRef(false);
  const linkInFlight = useRef(false);
  const latestTokenRef = useRef(token);

  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  const queryKey = useMemo(
    () =>
      user
        ? lmsQueryKeys.googleIdentity(user.sub)
        : (["lms", "account", "signed-out", "google-identity"] as const),
    [user],
  );
  const supported = user?.role !== "SUPER_ADMIN";
  const statusQuery = useQuery({
    enabled: Boolean(token && user && supported),
    queryFn: ({ signal }) => googleAuthApi.getLinkStatus({ token }, signal),
    queryKey,
  });

  const forceReloginIfCredentialsChanged = useCallback(
    (caught: unknown): boolean => {
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
    },
    [logout, passwordForm, router],
  );

  const openConfirmation = (action: Exclude<ConfirmationAction, null>) => {
    if (confirmationInFlight.current || linkInFlight.current) return;
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
      if (action === "LINK") {
        const challenge = await googleAuthApi.createLinkChallenge(
          { token: requestedToken },
          currentPassword,
        );
        passwordForm.resetFields();
        if (latestTokenRef.current !== requestedToken) return;
        setLinkChallenge(challenge);
        setError("");
        setNotice({
          message: "Mật khẩu đã được xác nhận. Hãy chọn tài khoản Google.",
          type: "info",
        });
        setConfirmationAction(null);
        return;
      }

      await googleAuthApi.unlink({ token: requestedToken }, currentPassword);
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      setError("");
      setNotice({
        message:
          "Đã hủy liên kết Google. Bạn vẫn có thể đăng nhập bằng email và mật khẩu.",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey });
      setConfirmationAction(null);
    } catch (caught) {
      passwordForm.resetFields();
      if (latestTokenRef.current !== requestedToken) return;
      if (forceReloginIfCredentialsChanged(caught)) return;
      setConfirmationError(googleAuthErrorMessage(caught, "LINK"));
    } finally {
      confirmationInFlight.current = false;
      setConfirmationPending(false);
    }
  };

  const getVerifiedLinkChallenge = useCallback(async () => {
    if (
      !linkChallenge ||
      Date.parse(linkChallenge.expiresAt) - 30_000 <= Date.now()
    ) {
      setLinkChallenge(null);
      throw new ApiError(
        t("Phiên xác minh Google đã hết hạn"),
        400,
        "GOOGLE_CHALLENGE_EXPIRED",
      );
    }
    return linkChallenge;
  }, [linkChallenge, t]);

  const linkGoogle = useCallback(
    async (credential: string, challengeToken: string) => {
      if (linkInFlight.current) return;
      linkInFlight.current = true;
      const requestedToken = token;
      setLinkChallenge(null);
      setNotice(null);
      setError("");
      setLinkPending(true);
      try {
        const updated = await googleAuthApi.link(
          { token: requestedToken },
          { challengeToken, credential },
        );
        if (latestTokenRef.current !== requestedToken) return;
        queryClient.setQueryData(queryKey, updated);
        setNotice({
          message:
            "Đã liên kết Google. Bạn có thể dùng “Đăng nhập bằng Google” từ lần đăng nhập tiếp theo.",
          type: "success",
        });
      } finally {
        linkInFlight.current = false;
        setLinkPending(false);
      }
    },
    [queryClient, queryKey, token],
  );

  const handleGoogleError = useCallback(
    (caught: unknown) => {
      setLinkChallenge(null);
      setNotice(null);
      if (
        caught instanceof ApiError &&
        caught.code === "GOOGLE_ALREADY_LINKED"
      ) {
        setError("");
        setNotice({
          message:
            "Tài khoản này đã liên kết Google. Bạn có thể dùng “Đăng nhập bằng Google” ở lần đăng nhập tiếp theo.",
          type: "info",
        });
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      setError(googleAuthErrorMessage(caught, "LINK"));
    },
    [queryClient, queryKey],
  );

  const confirmation = confirmationCopy(confirmationAction);
  const status = statusQuery.data;

  return (
    <Card
      className={`surface-card ${styles.card}`}
      title={
        <span className={styles.cardTitle}>
          <GoogleOutlined /> {t("Phương thức đăng nhập")}
        </span>
      }
    >
      <div className={styles.content}>
        <p className={styles.description}>
          {t(
            "Liên kết Google để dùng nút “Đăng nhập bằng Google”. Quyền Google Drive và YouTube được quản lý riêng trong Kết nối dữ liệu.",
          )}
        </p>
        {!user ? (
          <Alert
            showIcon
            title={t("Không tìm thấy phiên tài khoản.")}
            type="warning"
          />
        ) : !supported ? (
          <Alert
            description={t(
              "Tài khoản quản trị nền tảng tiếp tục đăng nhập bằng email và mật khẩu.",
            )}
            showIcon
            title={t(
              "Tài khoản quản trị nền tảng không hỗ trợ liên kết đăng nhập Google.",
            )}
            type="info"
          />
        ) : (
          <>
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
                onClose={() => setNotice(null)}
                showIcon
                title={t(notice.message)}
                type={notice.type}
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
                    onClick={() =>
                      void statusQuery.refetch({ cancelRefetch: false })
                    }
                    size="small"
                  >
                    {t("Thử lại")}
                  </Button>
                }
                showIcon
                title={t("Không thể đọc trạng thái liên kết Google.")}
                type="error"
              />
            ) : status?.linked ? (
              <>
                <div className={styles.statusRow}>
                  <div className={styles.statusCopy}>
                    <strong>{t("Google đã liên kết")}</strong>
                    <span>{status.email ?? t("Tài khoản Google")}</span>
                  </div>
                  <Tag color="success">{t("Có thể đăng nhập")}</Tag>
                </div>
                <div className={styles.metadata}>
                  <strong>{t("Liên kết từ")}</strong>
                  <span>
                    {status.linkedAt
                      ? formatDate(status.linkedAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : t("Chưa có")}
                  </span>
                </div>
                <div className={styles.actions}>
                  <Button
                    danger
                    disabled={confirmationPending || linkPending}
                    icon={<DisconnectOutlined />}
                    onClick={() => openConfirmation("UNLINK")}
                  >
                    {t("Hủy liên kết Google")}
                  </Button>
                </div>
              </>
            ) : linkPending ? (
              <div aria-live="polite" role="status">
                <Button aria-busy="true" disabled loading>
                  {t("Đang xác minh với Google…")}
                </Button>
              </div>
            ) : linkChallenge ? (
              <div className={styles.googleButton}>
                <GoogleIdentityButton
                  accessibleLabel={t("Chọn tài khoản Google để liên kết")}
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
                    <strong>{t("Google chưa liên kết")}</strong>
                    <span>{t("Bạn đang dùng email và mật khẩu.")}</span>
                  </div>
                  <Tag>{t("Chưa liên kết")}</Tag>
                </div>
                <div className={styles.actions}>
                  <Button
                    disabled={confirmationPending || linkPending}
                    icon={<GoogleOutlined />}
                    onClick={() => openConfirmation("LINK")}
                    type="primary"
                  >
                    {t("Liên kết tài khoản Google")}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Modal
        cancelButtonProps={{ disabled: confirmationPending }}
        cancelText={t("Hủy")}
        closable={!confirmationPending}
        confirmLoading={confirmationPending}
        destroyOnHidden
        keyboard={!confirmationPending}
        mask={{ closable: !confirmationPending }}
        okButtonProps={{
          "aria-busy": confirmationPending,
          "aria-label": t(confirmation.button),
          danger: confirmationAction === "UNLINK",
          disabled: confirmationPending,
        }}
        okText={t(confirmation.button)}
        onCancel={closeConfirmation}
        onOk={() => passwordForm.submit()}
        open={confirmationAction !== null}
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
            rules={[
              { message: t("Nhập mật khẩu hiện tại"), required: true },
            ]}
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
