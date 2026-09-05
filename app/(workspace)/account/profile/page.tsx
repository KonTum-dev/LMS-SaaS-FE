"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { accountPolishMessages as authMessages } from "@/lib/i18n/account-polish-messages";
import { describeFeedbackError } from "@/lib/feedback-errors";


import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Input } from "antd";
import { Form } from "@/components/form/localized-form";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileImageEditor } from "@/components/account-security/profile-image-editor";
import { useAuth } from "@/components/providers/app-providers";
import { accountProfileApi } from "@/lib/profile-api";
import styles from "./page.module.css";

interface ProfileFormValues {
  email: string;
  fullName: string;
}

export default function AccountProfilePage() {
  const { t, locale } = useI18n(authMessages);
  const { message } = useFeedback();
  const router = useRouter();
  const { token, updateUserProfile, user } = useAuth();
  const [form] = Form.useForm<ProfileFormValues>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ cause: unknown } | null>(null);

  useEffect(() => {
    if (user)
      form.setFieldsValue({ email: user.email, fullName: user.fullName });
  }, [form, user]);

  if (!user) {
    return (
      <Alert showIcon title={t("Không tìm thấy phiên tài khoản.")} type="warning" />
    );
  }

  const applyProfile = (profile: {
    avatarUrl: string | null;
    fullName: string;
    sub: string;
  }) => {
    updateUserProfile(profile);
    form.setFieldsValue({ fullName: profile.fullName });
  };

  const save = async (values: ProfileFormValues) => {
    setSaveError(null);
    setSaving(true);
    try {
      const profile = await accountProfileApi.update(
        token,
        values.fullName.trim(),
      );
      applyProfile(profile);
      message.success("Đã cập nhật hồ sơ");
    } catch (caught) {
      setSaveError({ cause: caught });
    } finally {
      setSaving(false);
    }
  };

  const initial =
    Array.from(user.fullName.trim())[0]?.toLocaleUpperCase("vi") || "DX";

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <h1>{t("Hồ sơ cá nhân")}</h1>
          <p>
            {t("Cập nhật tên và ảnh đại diện của bạn.")}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className="surface-card" title={t("Thông tin tài khoản")}>
          <ProfileImageEditor
            alt={t("Ảnh đại diện của {name}", { name: user.fullName })}
            fallback={initial}
            help={t("JPEG, PNG hoặc WebP · tối đa 5 MB.")}
            imageUrl={user.avatarUrl}
            label={t("Ảnh đại diện")}
            onRemove={async () => {
              applyProfile(await accountProfileApi.removeAvatar(token));
              message.success("Đã gỡ ảnh đại diện");
            }}
            onUpload={async (file, options) => {
              applyProfile(
                await accountProfileApi.uploadAvatar(token, file, options),
              );
              message.success("Đã cập nhật ảnh đại diện");
            }}
          />

          <Form<ProfileFormValues>
            className={styles.profileForm}
            form={form}
            layout="vertical"
            onFinish={(values) => void save(values)}
            requiredMark={false}
            style={{ marginTop: 28 }}
          >
            {saveError && (
              <Alert
                closable
                onClose={() => setSaveError(null)}
                showIcon
                style={{ marginBottom: 20 }}
                title={describeFeedbackError(saveError.cause, locale, t("Không thể cập nhật hồ sơ.")).message}
                type="error"
              />
            )}
            <Form.Item
              label={t("Tên hiển thị")}
              name="fullName"
              rules={[
                { required: true, message: t("Nhập tên hiển thị") },
                { min: 2, message: t("Tên cần ít nhất 2 ký tự") },
                { max: 160, message: t("Tên không được vượt quá 160 ký tự") },
              ]}
            >
              <Input
                autoComplete="name"
                maxLength={160}
                prefix={<UserOutlined />}
              />
            </Form.Item>
            <Form.Item
              extra={t("Không thể đổi email tại đây.")}
              label={t("Email đăng nhập")}
              name="email"
            >
              <Input autoComplete="email" disabled />
            </Form.Item>
            <Button htmlType="submit" loading={saving} type="primary">
              {t("Lưu hồ sơ")}</Button>
            <Button className={styles.securityLink} onClick={() => router.push("/account/security")} type="link">
              {t("Mở cài đặt bảo mật")}</Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
