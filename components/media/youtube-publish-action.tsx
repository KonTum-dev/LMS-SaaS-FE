"use client";

import { YoutubeOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Select,
  Tag,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type { MediaAsset } from "@/lib/media-api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import {
  createYouTubeMutationId,
  youtubeApi,
  youtubeErrorMessage,
  type YouTubePrivacyStatus,
  type YouTubeUploadJob,
} from "@/lib/youtube-api";
import {
  clearPendingYouTubeUploadMutation,
  fingerprintYouTubeUploadRequest,
  persistPendingYouTubeUploadMutation,
  readPendingYouTubeUploadMutation,
  youtubeUploadMutationStorageKey,
  type PendingYouTubeUploadMutation,
  type YouTubeUploadRequest,
} from "@/lib/youtube-upload-idempotency";
import styles from "./youtube-publish-action.module.css";

interface YouTubePublishActionProps {
  asset: MediaAsset;
  courseId: string;
  description?: string;
  disabled?: boolean;
  lessonId: string;
  mediaEnabled: boolean;
  scope: ViewerScope;
  title: string;
  token: string;
}

interface PublishValues {
  consentAccepted: boolean;
  description?: string;
  madeForKids?: "NO" | "YES";
  privacyStatus: YouTubePrivacyStatus;
  title: string;
}

const activeUploadStates = new Set<YouTubeUploadJob["status"]>([
  "QUEUED",
  "RETRY_WAIT",
  "UPLOADING",
]);

const statusLabels: Record<YouTubeUploadJob["status"], string> = {
  FAILED: "Không thành công",
  QUEUED: "Đang chờ",
  RETRY_WAIT: "Sẽ thử lại",
  SUCCEEDED: "Đã xuất bản",
  UPLOADING: "Đang tải lên",
};

function safeFailureMessage(job: YouTubeUploadJob): string {
  switch (job.failureCode) {
    case "MEDIA_STORAGE_UNAVAILABLE":
      return "Kho media đang tạm khóa. Không có video nào được gửi lên YouTube.";
    case "MEDIA_ASSET_NOT_AVAILABLE":
    case "MEDIA_VIDEO_SOURCE_INVALID":
      return "Video không còn ở trạng thái sẵn sàng để xuất bản.";
    case "YOUTUBE_REAUTH_REQUIRED":
      return "Quyền YouTube đã hết hiệu lực. Hãy kết nối lại trong Ứng dụng kết nối.";
    case "YOUTUBE_QUOTA_EXCEEDED":
      return "Hạn mức YouTube hiện đã hết. Vui lòng thử lại sau.";
    case "YOUTUBE_COMPLETION_UNKNOWN":
      return "YouTube có thể đã nhận video này nhưng DX LMS chưa xác nhận được kết quả. Không xuất bản lại; hãy liên hệ quản trị viên hoặc bộ phận hỗ trợ để đối soát.";
    default:
      return "YouTube chưa thể xử lý video này. Vui lòng kiểm tra kết nối và thử lại.";
  }
}

export function YouTubePublishAction({
  asset,
  courseId,
  description = "",
  disabled = false,
  lessonId,
  mediaEnabled,
  scope,
  title,
  token,
}: YouTubePublishActionProps) {
  const eligible =
    mediaEnabled &&
    asset.status === "AVAILABLE" &&
    asset.contentType.toLowerCase() === "video/mp4";
  const queryClient = useQueryClient();
  const connectionKey = useMemo(() => lmsQueryKeys.youtube(scope), [scope]);
  const uploadSource = useMemo(
    () => ({ assetId: asset._id, courseId, lessonId }),
    [asset._id, courseId, lessonId],
  );
  const uploadsKey = useMemo(
    () => lmsQueryKeys.youtubeUploads(scope, uploadSource),
    [scope, uploadSource],
  );
  const mutationStorageKey = useMemo(
    () => youtubeUploadMutationStorageKey(scope, courseId, lessonId, asset._id),
    [asset._id, courseId, lessonId, scope],
  );
  const [form] = Form.useForm<PublishValues>();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const pendingMutationRef = useRef<PendingYouTubeUploadMutation | null>(null);
  const latestTokenRef = useRef(token);

  useEffect(() => {
    latestTokenRef.current = token;
  }, [token]);

  const connectionQuery = useQuery({
    enabled: eligible,
    queryFn: ({ signal }) => youtubeApi.getStatus({ token }, signal),
    queryKey: connectionKey,
  });
  const uploadsQuery = useQuery({
    enabled: eligible,
    queryFn: ({ signal }) =>
      youtubeApi.listUploads({ token }, signal, uploadSource),
    queryKey: uploadsKey,
  });
  const persistedJob = uploadsQuery.data?.[0];
  const trackedJobId = jobId ?? persistedJob?.jobId ?? null;
  const jobKey = useMemo(
    () => lmsQueryKeys.youtubeUpload(scope, trackedJobId ?? "pending"),
    [scope, trackedJobId],
  );
  const jobQuery = useQuery({
    enabled: eligible && Boolean(trackedJobId),
    queryFn: ({ signal }) =>
      youtubeApi.getUpload({ token }, trackedJobId!, signal),
    queryKey: jobKey,
    refetchInterval: (query) =>
      query.state.data && activeUploadStates.has(query.state.data.status)
        ? 2_000
        : false,
  });

  if (!eligible) return null;

  const connection = connectionQuery.data;
  const ready =
    connection?.state === "CONNECTED" &&
    Boolean(connection.channel) &&
    connection.uploadEnabled === true &&
    uploadsQuery.isSuccess;
  const job = jobQuery.data ?? persistedJob;
  const completionUnknown =
    job?.status === "FAILED" &&
    job.failureCode === "YOUTUBE_COMPLETION_UNKNOWN";
  const percentage = job?.totalBytes
    ? Math.min(100, Math.round((job.uploadedBytes / job.totalBytes) * 100))
    : 0;
  const unavailableReason = uploadsQuery.isError
    ? youtubeErrorMessage(uploadsQuery.error)
    : connectionQuery.isError
      ? youtubeErrorMessage(connectionQuery.error)
      : connection?.state === "REAUTH_REQUIRED"
        ? "Kênh YouTube cần được kết nối lại."
        : connection?.state === "DISCONNECTED"
          ? "Hãy kết nối kênh trong Ứng dụng kết nối."
          : connection?.state === "CONNECTED" && !connection.channel
            ? "Không thể xác định kênh YouTube đích. Hãy kết nối lại."
            : connection && !connection.uploadEnabled
              ? "Backend hoặc kho media hiện đang khóa upload YouTube."
              : "Đang kiểm tra quyền xuất bản YouTube.";

  const openDialog = () => {
    setSubmitError("");
    form.setFieldsValue({
      consentAccepted: false,
      description: description.slice(0, 5_000),
      madeForKids: undefined,
      privacyStatus: "PRIVATE",
      title: title.trim().slice(0, 100),
    });
    setOpen(true);
  };

  const closeDialog = () => {
    if (submitting) return;
    form.resetFields();
    setSubmitError("");
    setOpen(false);
  };

  const publish = async (values: PublishValues) => {
    if (!ready || disabled || !values.madeForKids) return;
    const requestedToken = token;
    setSubmitting(true);
    setSubmitError("");
    const request: YouTubeUploadRequest = {
      assetId: asset._id,
      consentAccepted: true,
      courseId,
      ...(values.description?.trim()
        ? { description: values.description.trim() }
        : {}),
      lessonId,
      madeForKids: values.madeForKids === "YES",
      privacyStatus: values.privacyStatus,
      title: values.title.trim(),
    };
    let mutation: PendingYouTubeUploadMutation | null = null;
    const acceptCreatedJob = (
      created: YouTubeUploadJob,
      acceptedMutation: PendingYouTubeUploadMutation,
    ) => {
      const nextKey = lmsQueryKeys.youtubeUpload(scope, created.jobId);
      queryClient.setQueryData(nextKey, created);
      queryClient.setQueryData<YouTubeUploadJob[]>(uploadsKey, (current) => [
        created,
        ...(current ?? []).filter(
          (candidate) => candidate.jobId !== created.jobId,
        ),
      ]);
      setJobId(created.jobId);
      clearPendingYouTubeUploadMutation(
        mutationStorageKey,
        acceptedMutation.id,
      );
      pendingMutationRef.current = null;
      form.resetFields();
      setOpen(false);
    };
    try {
      const fingerprint = await fingerprintYouTubeUploadRequest(request);
      const stored = readPendingYouTubeUploadMutation(mutationStorageKey);
      const reusable =
        pendingMutationRef.current?.fingerprint === fingerprint
          ? pendingMutationRef.current
          : stored?.fingerprint === fingerprint
            ? stored
            : null;
      mutation = {
        fingerprint,
        id: reusable?.id ?? createYouTubeMutationId(),
      };
      pendingMutationRef.current = mutation;
      persistPendingYouTubeUploadMutation(mutationStorageKey, mutation);
      const input = { ...request, clientMutationId: mutation.id };
      let created: YouTubeUploadJob;
      try {
        created = await youtubeApi.createUpload(
          { token: requestedToken },
          input,
        );
      } catch (firstError) {
        if (!(firstError instanceof ApiError) || firstError.status !== 0) {
          throw firstError;
        }
        created = await youtubeApi.createUpload(
          { token: requestedToken },
          input,
        );
      }
      if (latestTokenRef.current !== requestedToken) return;
      acceptCreatedJob(created, mutation);
    } catch (caught) {
      if (latestTokenRef.current !== requestedToken) return;
      if (caught instanceof ApiError && caught.status === 0) {
        await uploadsQuery.refetch();
        if (latestTokenRef.current !== requestedToken) return;
      }
      setSubmitError(
        caught instanceof ApiError && caught.status === 0
          ? `${youtubeErrorMessage(caught)} Nếu yêu cầu đã tới máy chủ, lần thử lại sẽ dùng cùng mã an toàn để không tạo bản sao.`
          : youtubeErrorMessage(caught),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <Button
        disabled={
          disabled ||
          !ready ||
          submitting ||
          completionUnknown ||
          Boolean(job && activeUploadStates.has(job.status))
        }
        icon={<YoutubeOutlined />}
        loading={
          submitting || connectionQuery.isLoading || uploadsQuery.isLoading
        }
        onClick={openDialog}
        size="small"
        title={
          completionUnknown
            ? "Cần đối soát kết quả với YouTube trước khi xuất bản lại"
            : job && activeUploadStates.has(job.status)
            ? "Video này đang được xuất bản"
            : ready
              ? undefined
              : unavailableReason
        }
      >
        Xuất bản lên YouTube
      </Button>
      {!ready && !connectionQuery.isLoading && (
        <span className={styles.hint}>{unavailableReason}</span>
      )}
      {job && (
        <div aria-live="polite" className={styles.jobStatus}>
          <div className={styles.jobRow}>
            <Tag
              color={
                job.status === "SUCCEEDED"
                  ? "success"
                  : job.status === "FAILED"
                    ? "error"
                    : "processing"
              }
            >
              {statusLabels[job.status]}
            </Tag>
            <span className={styles.hint}>Lần thử: {job.attempts}</span>
          </div>
          {activeUploadStates.has(job.status) && (
            <Progress percent={percentage} size="small" />
          )}
          {job.status === "FAILED" && (
            <span className={styles.failure} role="alert">
              {safeFailureMessage(job)}
            </span>
          )}
          {job.status === "SUCCEEDED" && job.watchUrl && (
            <a
              className={styles.watchLink}
              href={job.watchUrl}
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
              target="_blank"
            >
              Mở video trên YouTube
            </a>
          )}
        </div>
      )}

      <Modal
        cancelButtonProps={{ disabled: submitting }}
        cancelText="Hủy"
        confirmLoading={submitting}
        destroyOnHidden
        mask={{ closable: !submitting }}
        okText="Xác nhận xuất bản"
        onCancel={closeDialog}
        onOk={() => form.submit()}
        open={open}
        title="Xuất bản video lên YouTube"
      >
        <p className={styles.modalNote}>
          Video chỉ được gửi sau khi bạn xác nhận từng lần. V1 không tự gắn
          video vào nội dung bài học và không tự động công khai video.
        </p>
        {submitError && <Alert showIcon title={submitError} type="error" />}
        <Form<PublishValues>
          form={form}
          layout="vertical"
          onFinish={(values) => void publish(values)}
          requiredMark={false}
        >
          <Form.Item
            label="Tiêu đề YouTube"
            name="title"
            rules={[{ message: "Nhập tiêu đề video", required: true }]}
          >
            <Input disabled={submitting} maxLength={100} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea disabled={submitting} maxLength={5_000} rows={4} />
          </Form.Item>
          <Form.Item
            label="Quyền riêng tư"
            name="privacyStatus"
            rules={[{ message: "Chọn quyền riêng tư", required: true }]}
          >
            <Select
              disabled={submitting}
              options={[
                { label: "Riêng tư (mặc định)", value: "PRIVATE" },
                { label: "Không công khai", value: "UNLISTED" },
                { label: "Công khai", value: "PUBLIC" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Video này có dành cho trẻ em không?"
            name="madeForKids"
            rules={[{ message: "Chọn Có hoặc Không", required: true }]}
          >
            <Radio.Group disabled={submitting}>
              <Radio value="YES">Có</Radio>
              <Radio value="NO">Không</Radio>
            </Radio.Group>
          </Form.Item>
          {connection?.channel && (
            <div className={styles.destination} role="status">
              Kênh đích: <strong>{connection.channel.title}</strong>
              <span>ID: {connection.channel.id}</span>
            </div>
          )}
          <Form.Item
            name="consentAccepted"
            rules={[
              {
                validator: (_, value) =>
                  value === true
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          "Bạn cần xác nhận quyền và chính sách trước khi xuất bản",
                        ),
                      ),
              },
            ]}
            valuePropName="checked"
          >
            <Checkbox className={styles.consent} disabled={submitting}>
              Tôi xác nhận có quyền xuất bản video này, đã chọn đúng quyền riêng
              tư và trạng thái dành cho trẻ em.
            </Checkbox>
          </Form.Item>
          <p className={styles.policyLinks}>
            Khi tiếp tục, bạn đồng ý tuân thủ{" "}
            <a
              href="https://www.youtube.com/static?template=terms"
              rel="noopener noreferrer"
              target="_blank"
            >
              Điều khoản dịch vụ YouTube
            </a>
            ,{" "}
            <a
              href="https://www.youtube.com/howyoutubeworks/our-policies/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Nguyên tắc cộng đồng
            </a>{" "}
            và{" "}
            <a
              href="https://policies.google.com/privacy"
              rel="noopener noreferrer"
              target="_blank"
            >
              Chính sách quyền riêng tư của Google
            </a>
            .
          </p>
        </Form>
      </Modal>
    </div>
  );
}
