"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { Alert, Button, Progress } from "antd";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createMediaMutationId,
  mediaFileFingerprint,
  runMediaUpload,
  validateMediaFiles,
  type MediaAsset,
  type MediaUploadStage,
  type UploadableMediaTarget,
} from "@/lib/media-api";
import styles from "./secure-attachments.module.css";

type UploadJobStatus =
  "QUEUED" | "RUNNING" | "ATTACHING" | "DONE" | "ERROR" | "CANCELLED";

interface UploadJob {
  asset?: MediaAsset;
  clientMutationId: string;
  error?: { source: string; cause?: unknown };
  fileName: string;
  fingerprint: string;
  id: string;
  stage: MediaUploadStage | "ATTACHING";
  status: UploadJobStatus;
}

interface SecureMediaUploaderProps {
  allowedContentTypes: readonly string[];
  currentAssetIds: readonly string[];
  disabled?: boolean;
  label: string;
  maxBytes: number;
  maxCount: number;
  onAvailable: (asset: MediaAsset) => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  target: UploadableMediaTarget;
  token: string;
}

const stageLabels: Record<UploadJob["stage"], string> = {
  ATTACHING: "Đang lưu vào bản nháp",
  AVAILABLE: "Đã kiểm tra an toàn",
  FINALIZING: "Đang xác minh upload",
  HASHING: "Đang tính SHA-256 trong trình duyệt",
  INITIATING: "Đang xin quyền tải lên ngắn hạn",
  SCANNING: "Đang quét an toàn",
  UPLOADING: "Đang tải trực tiếp lên kho riêng tư",
};

const stagePercent: Record<UploadJob["stage"], number> = {
  ATTACHING: 95,
  AVAILABLE: 100,
  FINALIZING: 65,
  HASHING: 10,
  INITIATING: 25,
  SCANNING: 80,
  UPLOADING: 45,
};

export function SecureMediaUploader({
  target,
  token,
  ...props
}: SecureMediaUploaderProps) {
  const targetKey =
    target.kind === "LESSON"
      ? `LESSON:${target.courseId}:${target.lessonId}`
      : `LEARNER_SUBMISSION:${target.assignmentId}`;

  return (
    <SecureMediaUploaderSession
      {...props}
      key={targetKey}
      target={target}
      token={token}
    />
  );
}

function SecureMediaUploaderSession({
  allowedContentTypes,
  currentAssetIds,
  disabled = false,
  label,
  maxBytes,
  maxCount,
  onAvailable,
  onBusyChange,
  target,
  token,
}: SecureMediaUploaderProps) {
  const { t } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const helpId = useId();
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const selectionMessage = (source: string) => {
    const count = /^Chỉ được đính kèm tối đa (\d+) tệp\.$/.exec(source);
    if (count) return t("Chỉ được đính kèm tối đa {p0} tệp.", { p0: count[1] });
    const size =
      /^Mỗi tệp phải lớn hơn 0 byte và không vượt quá (\d+) MiB\.$/.exec(
        source,
      );
    if (size)
      return t("Mỗi tệp phải lớn hơn 0 byte và không vượt quá {max} MiB.", {
        max: size[1],
      });
    return t(source);
  };
  const activeJobIds = useRef(new Set<string>());
  const selectionInFlight = useRef(false);
  const controllers = useRef(new Map<string, AbortController>());
  const files = useRef(new Map<string, File>());
  const mounted = useRef(true);
  const busy = jobs.some(
    (job) =>
      job.status === "QUEUED" ||
      job.status === "RUNNING" ||
      job.status === "ATTACHING",
  );
  const unsettledCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status !== "CANCELLED" &&
          (!job.asset || !currentAssetIds.includes(job.asset._id)),
      ).length,
    [currentAssetIds, jobs],
  );
  const fingerprints = useMemo(
    () =>
      new Set(
        jobs
          .filter((job) => job.status !== "CANCELLED")
          .map((job) => job.fingerprint),
      ),
    [jobs],
  );

  useEffect(() => {
    const activeJobs = activeJobIds.current;
    const activeControllers = controllers.current;
    const activeFiles = files.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const controller of activeControllers.values()) controller.abort();
      activeJobs.clear();
      activeControllers.clear();
      activeFiles.clear();
    };
  }, []);

  useEffect(() => {
    const activeControllers = controllers.current;
    return () => {
      for (const controller of activeControllers.values()) controller.abort();
    };
  }, [token]);

  useEffect(() => {
    if (!disabled) return;
    for (const controller of controllers.current.values()) controller.abort();
  }, [disabled]);

  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const patchJob = (jobId: string, patch: Partial<UploadJob>) => {
    if (!mounted.current || !activeJobIds.current.has(jobId)) return;
    setJobs((current) =>
      current.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    );
  };

  const execute = async (job: UploadJob) => {
    if (
      disabled ||
      controllers.current.has(job.id) ||
      !activeJobIds.current.has(job.id)
    )
      return;
    const file = files.current.get(job.id);
    if (!job.asset && !file) return;
    onBusyChange?.(true);
    const controller = new AbortController();
    controllers.current.set(job.id, controller);
    patchJob(job.id, { error: undefined, status: "RUNNING" });
    try {
      const asset =
        job.asset ??
        (await runMediaUpload({
          clientMutationId: job.clientMutationId,
          context: { token },
          file: file!,
          onProgress: ({ stage }) => patchJob(job.id, { stage }),
          signal: controller.signal,
          target,
        }));
      if (
        !mounted.current ||
        !activeJobIds.current.has(job.id) ||
        controller.signal.aborted
      ) {
        throw new DOMException("Upload aborted", "AbortError");
      }
      files.current.delete(job.id);
      patchJob(job.id, { asset, stage: "ATTACHING", status: "ATTACHING" });
      await onAvailable(asset);
      if (
        !mounted.current ||
        !activeJobIds.current.has(job.id) ||
        controller.signal.aborted
      )
        return;
      patchJob(job.id, { asset, stage: "AVAILABLE", status: "DONE" });
    } catch (error) {
      const cancelled =
        controller.signal.aborted ||
        (error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: string }).code === "MEDIA_UPLOAD_CANCELLED");
      if (!activeJobIds.current.has(job.id)) return;
      patchJob(job.id, {
        error: cancelled
          ? { source: "Đã hủy tải tệp." }
          : { source: "Không thể hoàn tất tải tệp.", cause: error },
        status: cancelled ? "CANCELLED" : "ERROR",
      });
      if (cancelled) files.current.delete(job.id);
    } finally {
      if (controllers.current.get(job.id) === controller) {
        controllers.current.delete(job.id);
      }
    }
  };

  const selectFiles = async (selected: File[]) => {
    if (
      disabled ||
      selectionInFlight.current ||
      controllers.current.size > 0 ||
      busy
    )
      return;
    const validation = validateMediaFiles({
      allowedContentTypes,
      currentCount: currentAssetIds.length + unsettledCount,
      existingFingerprints: fingerprints,
      files: selected,
      maxBytes,
      maxCount,
    });
    if (validation) {
      setSelectionError(validation);
      return;
    }
    setSelectionError(null);
    const nextJobs = selected.map((file): UploadJob => {
      const id = createMediaMutationId();
      activeJobIds.current.add(id);
      files.current.set(id, file);
      return {
        clientMutationId: createMediaMutationId(),
        fileName: file.name,
        fingerprint: mediaFileFingerprint(file),
        id,
        stage: "HASHING",
        status: "QUEUED",
      };
    });
    setJobs((current) => [...current, ...nextJobs]);
    selectionInFlight.current = true;
    try {
      for (const job of nextJobs) await execute(job);
    } finally {
      selectionInFlight.current = false;
    }
  };

  const cancel = (job: UploadJob) => {
    const controller = controllers.current.get(job.id);
    if (controller) {
      controller.abort();
      return;
    }
    files.current.delete(job.id);
    patchJob(job.id, {
      error: { source: "Đã hủy tải tệp." },
      status: "CANCELLED",
    });
  };

  const removeJob = (jobId: string) => {
    activeJobIds.current.delete(jobId);
    const controller = controllers.current.get(jobId);
    controller?.abort();
    controllers.current.delete(jobId);
    files.current.delete(jobId);
    setJobs((current) => current.filter((job) => job.id !== jobId));
  };

  return (
    <div aria-busy={busy} className={styles.uploadPanel}>
      <label>
        <strong>{label}</strong>
        <input
          accept={allowedContentTypes.join(",")}
          aria-describedby={helpId}
          aria-label={label}
          className={styles.fileInput}
          disabled={
            disabled ||
            busy ||
            currentAssetIds.length + unsettledCount >= maxCount
          }
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = "";
            void selectFiles(selected);
          }}
          type="file"
        />
      </label>
      <small id={helpId}>
        {t("Tối đa")} {maxCount} {t("tệp,")}{" "}
        {Math.round(maxBytes / 1024 / 1024)}{" "}
        {t(
          "MiB mỗi tệp. SHA-256 được tính trong trình duyệt; nội dung tải thẳng lên kho riêng tư.",
        )}
      </small>
      {selectionError && (
        <Alert
          showIcon
          title={selectionMessage(selectionError)}
          type="warning"
        />
      )}
      {jobs.length > 0 && (
        <ul aria-live="polite" className={styles.uploadJobs}>
          {jobs.map((job) => (
            <li className={styles.uploadJob} key={job.id}>
              <div>
                <strong className={styles.attachmentName}>
                  {job.fileName}
                </strong>
                <span className={styles.jobStatus}>
                  {(job.error
                    ? job.error.cause === undefined
                      ? t(job.error.source)
                      : formatError(job.error.cause, job.error.source)
                    : null) ??
                    (job.status === "QUEUED"
                      ? t("Đang chờ tải lên")
                      : t(stageLabels[job.stage]))}
                </span>
                {job.status === "ERROR" && (
                  <span className={styles.jobHint}>
                    {t(
                      "“Bỏ tệp” chỉ dọn dữ liệu trong trình duyệt. Asset dở dang đã khởi tạo (nếu có) tiếp tục do lifecycle cleanup phía máy chủ quản lý; thao tác này không xác nhận xóa asset trên máy chủ.",
                    )}
                  </span>
                )}
                <Progress
                  percent={
                    job.status === "QUEUED"
                      ? 0
                      : job.status === "DONE"
                        ? 100
                        : stagePercent[job.stage]
                  }
                  showInfo={false}
                  status={
                    job.status === "ERROR"
                      ? "exception"
                      : job.status === "DONE"
                        ? "success"
                        : job.status === "CANCELLED"
                          ? "normal"
                          : "active"
                  }
                />
              </div>
              <div className={styles.uploadActions}>
                {job.status === "ERROR" && (
                  <>
                    <Button
                      disabled={disabled || busy}
                      onClick={() => void execute(job)}
                      size="small"
                    >
                      {t("Thử lại")}
                    </Button>
                    <Button
                      danger
                      onClick={() => removeJob(job.id)}
                      size="small"
                    >
                      {t("Bỏ tệp")}
                    </Button>
                  </>
                )}
                {job.status === "QUEUED" && (
                  <Button danger onClick={() => removeJob(job.id)} size="small">
                    {t("Bỏ tệp")}
                  </Button>
                )}
                {job.status === "RUNNING" && (
                  <Button danger onClick={() => cancel(job)} size="small">
                    {t("Hủy")}
                  </Button>
                )}
                {(job.status === "DONE" || job.status === "CANCELLED") && (
                  <Button onClick={() => removeJob(job.id)} size="small">
                    {t("Ẩn")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
