"use client";

import {
  DeleteOutlined,
  PictureOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Alert, Avatar, Button, Progress } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import { validateProfileImage } from "@/lib/profile-api";
import styles from "./profile-image-editor.module.css";

interface ProfileImageEditorProps {
  alt: string;
  disabled?: boolean;
  fallback: string;
  help: string;
  imageUrl?: string | null;
  label: string;
  onRemove: () => Promise<void>;
  onUpload: (
    file: File,
    options: {
      onProgress: (percent: number) => void;
      signal: AbortSignal;
    },
  ) => Promise<void>;
  shape?: "circle" | "square";
}

export function ProfileImageEditor({
  alt,
  disabled = false,
  fallback,
  help,
  imageUrl,
  label,
  onRemove,
  onUpload,
  shape = "circle",
}: ProfileImageEditorProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);

  const releasePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  };

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const upload = async (file: File) => {
    const validation = validateProfileImage(file);
    if (validation) {
      setError(validation);
      return;
    }
    releasePreview();
    const nextPreview = URL.createObjectURL(file);
    previewRef.current = nextPreview;
    setPreviewUrl(nextPreview);
    setError(null);
    setProgress(0);
    setPending("upload");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await onUpload(file, {
        onProgress: setProgress,
        signal: controller.signal,
      });
      releasePreview();
      setProgress(100);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(
          caught instanceof Error ? caught.message : "Không thể tải ảnh lên.",
        );
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setPending(null);
    }
  };

  const remove = async () => {
    if (!imageUrl || pending) return;
    setError(null);
    setPending("remove");
    try {
      await onRemove();
      releasePreview();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể gỡ ảnh hiện tại.",
      );
    } finally {
      setPending(null);
    }
  };

  const busy = pending !== null;
  return (
    <div className={styles.editor}>
      <Avatar
        alt={alt}
        className={styles.avatar}
        icon={!fallback ? <PictureOutlined /> : undefined}
        shape={shape}
        size={88}
        src={previewUrl ?? imageUrl ?? undefined}
      >
        {fallback}
      </Avatar>
      <div className={styles.copy}>
        <strong>{label}</strong>
        <small id={`${inputId}-help`}>{help}</small>
        <div className={styles.actions}>
          <label
            className={styles.uploadButton}
            data-disabled={disabled || busy ? "true" : "false"}
            htmlFor={inputId}
          >
            <UploadOutlined aria-hidden="true" />
            {imageUrl ? "Thay ảnh" : "Chọn ảnh"}
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={`${inputId}-help`}
              className={styles.fileInput}
              disabled={disabled || busy}
              id={inputId}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
              ref={inputRef}
              type="file"
            />
          </label>
          {imageUrl && (
            <Button
              danger
              disabled={disabled || pending === "upload"}
              icon={<DeleteOutlined />}
              loading={pending === "remove"}
              onClick={() => void remove()}
              size="small"
            >
              Gỡ ảnh
            </Button>
          )}
          {pending === "upload" && (
            <Button
              onClick={() => {
                controllerRef.current?.abort();
                releasePreview();
              }}
              size="small"
            >
              Hủy tải
            </Button>
          )}
          {error && previewUrl && !pending && (
            <Button
              onClick={() => {
                releasePreview();
                setError(null);
              }}
              size="small"
            >
              Bỏ ảnh đã chọn
            </Button>
          )}
        </div>
      </div>
      {pending === "upload" && (
        <div aria-live="polite" className={styles.progress}>
          <div className={styles.progressLabel}>
            <span>Đang tải trực tiếp lên máy chủ riêng</span>
            <span>{progress > 0 ? `${progress}%` : "Đang kết nối"}</span>
          </div>
          <Progress
            percent={progress}
            showInfo={false}
            status="active"
            strokeColor="var(--brand-blue)"
          />
        </div>
      )}
      {error && (
        <Alert
          className={styles.error}
          closable
          onClose={() => setError(null)}
          showIcon
          title={error}
          type="error"
        />
      )}
    </div>
  );
}
