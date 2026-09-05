"use client";

import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { Form } from "@/components/form/localized-form";
import { useI18n } from "@/components/i18n/i18n-provider";
import { contactMessages } from "@/lib/i18n/contact-messages";
import styles from "./contact-draft.module.css";

interface ContactDraftValues { message: string; organization?: string; email?: string; }

export function ContactDraft() {
  const { t } = useI18n(contactMessages);
  const { notification } = useFeedback();
  const [form] = Form.useForm<ContactDraftValues>();
  const [pending, setPending] = useState<"copy" | "download" | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const noteId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function prepare(action: "copy" | "download") {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(action);
    let objectUrl: string | undefined;
    try {
      let values: ContactDraftValues;
      try { values = await form.validateFields(); } catch { return; }
      if (!mounted.current) return;
      const organization = values.organization?.trim();
      const email = values.email?.trim();
      const draft = [
        t("DX LMS — Bản nháp trao đổi"),
        t("Bản nháp chưa được gửi đến DX LMS."),
        "",
        ...(organization ? [`${t("Tổ chức")}: ${organization}`] : []),
        ...(email ? [`Email: ${email}`] : []),
        "",
        `${t("Nội dung")}:`,
        values.message.trim(),
      ].join("\n");

      if (action === "copy") {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(draft);
      } else {
        objectUrl = URL.createObjectURL(new Blob(["\uFEFF", draft], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "dx-lms-request-draft.txt";
        document.body.append(link);
        try { link.click(); } finally { link.remove(); }
      }
      if (mounted.current) notification.success({
        title: <span>{t(action === "copy" ? "Đã sao chép bản nháp" : "Đã chuẩn bị tệp bản nháp")}</span>,
        description: <span>{t("Bản nháp chưa được gửi đến DX LMS.")}</span>,
      });
    } catch {
      if (mounted.current) notification.error({
        title: <span>{t(action === "copy" ? "Không thể sao chép" : "Không thể tạo tệp bản nháp")}</span>,
        description: <span>{t(action === "copy"
          ? "Trình duyệt chưa cho phép sao chép. Bạn có thể tải bản nháp hoặc chọn và sao chép nội dung thủ công."
          : "Hãy thử lại hoặc dùng nút Sao chép bản nháp.")}</span>,
      });
    } finally {
      // Give the browser time to start the download before releasing its local URL.
      if (objectUrl) {
        const downloadUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
      inFlight.current = false;
      if (mounted.current) setPending(null);
    }
  }

  return (
    <details className={styles.helper}>
      <summary>{t("Chuẩn bị nội dung trao đổi")}<span>{t("Tùy chọn")}</span></summary>
      <div className={styles.content}>
        <p className={styles.note} id={noteId}>{t("Bản nháp chỉ ở trang này. Sao chép hoặc tải về khi cần; nội dung không được gửi đến DX LMS.")}</p>
        <Form<ContactDraftValues> aria-describedby={noteId} aria-label={t("Chuẩn bị nội dung trao đổi")} className={styles.form} disabled={pending !== null} form={form} layout="vertical" requiredMark={false}>
          <Form.Item label={t("Nội dung cần trao đổi")} name="message" rules={[
            { required: true, whitespace: true, message: t("Nhập nội dung trước khi sao chép hoặc tải về.") },
            { max: 2000, message: t("Nội dung tối đa 2.000 ký tự.") },
          ]}>
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 10 }} maxLength={2000} showCount placeholder={t("Bạn muốn cải thiện điều gì? Có những lớp học hoặc quy trình nào cần hỗ trợ?")} />
          </Form.Item>
          <div className={styles.optionalFields}>
            <Form.Item label={t("Tổ chức (không bắt buộc)")} name="organization" rules={[{ max: 120, message: t("Tên tổ chức tối đa 120 ký tự.") }]}>
              <Input autoComplete="organization" maxLength={120} placeholder={t("Tên tổ chức của bạn")} />
            </Form.Item>
            <Form.Item label={t("Email (không bắt buộc)")} name="email" rules={[
              { type: "email", transform: (value: string | undefined) => value?.trim(), message: t("Email chưa đúng định dạng.") },
              { max: 254, message: t("Email tối đa 254 ký tự.") },
            ]}>
              <Input autoComplete="email" maxLength={254} type="email" placeholder="you@example.com" />
            </Form.Item>
          </div>
          <p className={styles.privacy}>{t("Không nhập mật khẩu, thông tin thanh toán hoặc dữ liệu riêng của học viên.")}</p>
          <div className={styles.actions}>
            <Button htmlType="button" icon={<CopyOutlined aria-hidden="true" />} loading={pending === "copy"} onClick={() => void prepare("copy")} type="primary">{t("Sao chép bản nháp")}</Button>
            <Button htmlType="button" icon={<DownloadOutlined aria-hidden="true" />} loading={pending === "download"} onClick={() => void prepare("download")}>{t("Tải bản nháp (.txt)")}</Button>
          </div>
        </Form>
      </div>
    </details>
  );
}
