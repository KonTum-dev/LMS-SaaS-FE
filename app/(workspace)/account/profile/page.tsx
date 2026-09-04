"use client";

import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input } from "antd";
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
  const { message } = App.useApp();
  const router = useRouter();
  const { token, updateUserProfile, user } = useAuth();
  const [form] = Form.useForm<ProfileFormValues>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user)
      form.setFieldsValue({ email: user.email, fullName: user.fullName });
  }, [form, user]);

  if (!user) {
    return (
      <Alert showIcon title="Không tìm thấy phiên tài khoản." type="warning" />
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
      setSaveError(
        caught instanceof Error ? caught.message : "Không thể cập nhật hồ sơ.",
      );
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
          <h1>Hồ sơ cá nhân</h1>
          <p>
            Cập nhật tên hiển thị và ảnh đại diện dùng xuyên suốt không gian học
            tập.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <Card className="surface-card" title="Thông tin tài khoản">
          <ProfileImageEditor
            alt={`Ảnh đại diện của ${user.fullName}`}
            fallback={initial}
            help="JPEG, PNG hoặc WebP, tối đa 5 MiB. Ảnh được xử lý thành WebP và lưu trên máy chủ riêng."
            imageUrl={user.avatarUrl}
            label="Ảnh đại diện"
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
                title={saveError}
                type="error"
              />
            )}
            <Form.Item
              label="Tên hiển thị"
              name="fullName"
              rules={[
                { required: true, message: "Nhập tên hiển thị" },
                { min: 2, message: "Tên cần ít nhất 2 ký tự" },
                { max: 160, message: "Tên không được vượt quá 160 ký tự" },
              ]}
            >
              <Input
                autoComplete="name"
                maxLength={160}
                prefix={<UserOutlined />}
              />
            </Form.Item>
            <Form.Item
              extra="Email là định danh đăng nhập và không thể thay đổi tại đây."
              label="Email đăng nhập"
              name="email"
            >
              <Input autoComplete="email" disabled />
            </Form.Item>
            <Button htmlType="submit" loading={saving} type="primary">
              Lưu hồ sơ
            </Button>
          </Form>
        </Card>

        <Card
          className={`surface-card ${styles.sideCard}`}
          title="Tài khoản an toàn"
        >
          <div className={styles.detail}>
            <span className={styles.detailIcon}>
              <SafetyCertificateOutlined />
            </span>
            <span>
              <strong>Ảnh nằm trên hạ tầng riêng</strong>
              <span>
                Trình duyệt không tải ảnh lên Firebase hay dịch vụ lưu trữ bên
                thứ ba.
              </span>
            </span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailIcon}>
              <LockOutlined />
            </span>
            <span>
              <strong>Mật khẩu được quản lý riêng</strong>
              <span>
                Việc đổi ảnh hoặc tên hiển thị không làm thay đổi thông tin đăng
                nhập.
              </span>
            </span>
          </div>
          <Button onClick={() => router.push("/account/security")}>
            Mở cài đặt bảo mật
          </Button>
        </Card>
      </div>
    </div>
  );
}
