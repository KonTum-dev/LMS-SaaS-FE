"use client";

import { Alert, Button, Spin, Tag } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  mediaApi,
  openMediaDownload,
  type MediaAsset,
  type MediaTarget,
} from "@/lib/media-api";
import { lmsQueryKeys, type ViewerScope } from "@/lib/query-keys";
import styles from "./secure-attachments.module.css";

interface SecureAttachmentListProps {
  assetIds: readonly string[];
  canMutate?: boolean;
  mediaEnabled: boolean;
  minCount?: number;
  onReplace?: (assetIds: string[]) => Promise<void>;
  replacing?: boolean;
  scope: ViewerScope;
  target: MediaTarget;
  token: string;
}

const statusLabels: Record<MediaAsset["status"], string> = {
  AVAILABLE: "Sẵn sàng",
  DELETED: "Đã xóa",
  DELETING: "Đang xóa",
  PENDING_UPLOAD: "Chờ tải lên",
  QUARANTINED: "Đang kiểm tra",
  REJECTED: "Không an toàn",
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KiB`;
  return `${Math.round((value / 1024 / 1024) * 10) / 10} MiB`;
}

function mediaAssetKey(
  scope: ViewerScope,
  target: MediaTarget,
  assetId: string,
) {
  switch (target.kind) {
    case "LESSON":
      return lmsQueryKeys.lessonAsset(
        scope,
        target.courseId,
        target.lessonId,
        assetId,
      );
    case "LEARNER_SUBMISSION":
      return lmsQueryKeys.mySubmissionAsset(
        scope,
        target.assignmentId,
        assetId,
      );
    case "GRADING":
      return lmsQueryKeys.gradingAsset(scope, target.submissionId, assetId);
  }
}

function AttachmentRow({
  assetId,
  canMutate,
  index,
  mediaEnabled,
  onMove,
  onRemove,
  removeDisabled,
  replacing,
  scope,
  target,
  token,
  total,
}: {
  assetId: string;
  canMutate: boolean;
  index: number;
  mediaEnabled: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  removeDisabled: boolean;
  replacing: boolean;
  scope: ViewerScope;
  target: MediaTarget;
  token: string;
  total: number;
}) {
  const downloadController = useRef<AbortController | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const targetKey =
    target.kind === "LESSON"
      ? `LESSON:${target.courseId}:${target.lessonId}`
      : target.kind === "LEARNER_SUBMISSION"
        ? `LEARNER_SUBMISSION:${target.assignmentId}`
        : `GRADING:${target.submissionId}`;
  const authorityKey = `${scope.tenantId}:${scope.viewerId}:${scope.membershipId}:${scope.role}:${targetKey}:${mediaEnabled ? "MEDIA" : "NO_MEDIA"}`;
  const liveAuthorityKey = useRef(authorityKey);
  useLayoutEffect(() => {
    liveAuthorityKey.current = authorityKey;
  }, [authorityKey]);
  const assetQueryKey = useMemo(
    () => mediaAssetKey(scope, target, assetId),
    [assetId, scope, target],
  );
  const assetQuery = useQuery({
    enabled: mediaEnabled,
    queryFn: ({ signal }) =>
      mediaApi.getAsset({ token }, target, assetId, signal),
    queryKey: assetQueryKey,
  });
  const asset = mediaEnabled ? assetQuery.data : undefined;

  useEffect(() => {
    if (!mediaEnabled) {
      queryClient.removeQueries({ exact: true, queryKey: assetQueryKey });
    }
  }, [assetQueryKey, mediaEnabled, queryClient]);

  useEffect(() => {
    return () => downloadController.current?.abort();
  }, [assetId, authorityKey, token]);

  const download = async () => {
    if (
      !mediaEnabled ||
      asset?.status !== "AVAILABLE" ||
      downloadBusy ||
      downloadController.current
    )
      return;
    const requestedAuthorityKey = authorityKey;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      const ticket = await mediaApi.requestDownload(
        { token },
        target,
        assetId,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        liveAuthorityKey.current !== requestedAuthorityKey
      )
        return;
      openMediaDownload(ticket);
    } catch (error) {
      if (!controller.signal.aborted) {
        setDownloadError(
          error instanceof Error
            ? error.message
            : "Không thể cấp liên kết tải tệp.",
        );
      }
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
        setDownloadBusy(false);
      }
    }
  };

  return (
    <li className={styles.attachmentRow}>
      <div>
        <strong className={styles.attachmentName}>
          {asset?.originalFileName ?? `Tệp đính kèm ${index + 1}`}
        </strong>
        <span className={styles.attachmentMeta}>
          {asset ? (
            <>
              {formatBytes(asset.sizeBytes)} · {asset.contentType}
              <Tag>{statusLabels[asset.status]}</Tag>
            </>
          ) : assetQuery.isPending && mediaEnabled ? (
            <>
              <Spin size="small" /> Đang đọc metadata an toàn
            </>
          ) : (
            <>Mã tệp …{assetId.slice(-8)}</>
          )}
        </span>
        {assetQuery.error && mediaEnabled && (
          <Alert
            action={
              <Button onClick={() => void assetQuery.refetch()} size="small">
                Thử lại
              </Button>
            }
            showIcon
            title={
              assetQuery.error instanceof Error
                ? assetQuery.error.message
                : "Không tải được metadata tệp"
            }
            type="warning"
          />
        )}
        {downloadError && mediaEnabled && (
          <Alert showIcon title={downloadError} type="error" />
        )}
      </div>
      <div
        aria-label={`Thao tác tệp ${asset?.originalFileName ?? index + 1}`}
        className={styles.attachmentActions}
        role="group"
      >
        <Button
          disabled={!mediaEnabled || asset?.status !== "AVAILABLE" || replacing}
          loading={downloadBusy}
          onClick={() => void download()}
          size="small"
        >
          Tải xuống
        </Button>
        {canMutate && (
          <>
            <Button
              aria-label={`Đưa tệp ${index + 1} lên`}
              disabled={index === 0 || replacing}
              onClick={() => onMove(index, index - 1)}
              size="small"
            >
              Lên
            </Button>
            <Button
              aria-label={`Đưa tệp ${index + 1} xuống`}
              disabled={index === total - 1 || replacing}
              onClick={() => onMove(index, index + 1)}
              size="small"
            >
              Xuống
            </Button>
            <Button
              danger
              disabled={replacing || removeDisabled}
              onClick={() => onRemove(index)}
              size="small"
              title={
                removeDisabled
                  ? "Bản nháp nhận tệp phải giữ ít nhất một tệp"
                  : undefined
              }
            >
              Gỡ
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function SecureAttachmentList({
  assetIds,
  canMutate = false,
  mediaEnabled,
  minCount = 0,
  onReplace,
  replacing = false,
  scope,
  target,
  token,
}: SecureAttachmentListProps) {
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const replace = async (next: string[]) => {
    if (!canMutate || !onReplace || replacing) return;
    setReplaceError(null);
    try {
      await onReplace(next);
    } catch (error) {
      setReplaceError(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật danh sách tệp.",
      );
    }
  };
  const move = (from: number, to: number) => {
    const next = [...assetIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void replace(next);
  };
  const remove = (index: number) =>
    void replace(assetIds.filter((_, itemIndex) => itemIndex !== index));

  if (!assetIds.length) return <p>Chưa có tệp đính kèm.</p>;
  return (
    <div>
      {!mediaEnabled && (
        <Alert
          description="Snapshot ID vẫn được giữ để đối soát. Metadata chi tiết và liên kết tải xuống chỉ được cấp khi module Tài liệu riêng tư hoạt động."
          showIcon
          title="Tải tệp đang tạm khóa"
          type="warning"
        />
      )}
      {replaceError && <Alert showIcon title={replaceError} type="error" />}
      <ol className={styles.attachmentList}>
        {assetIds.map((assetId, index) => (
          <AttachmentRow
            assetId={assetId}
            canMutate={canMutate && Boolean(onReplace)}
            index={index}
            key={assetId}
            mediaEnabled={mediaEnabled}
            onMove={move}
            onRemove={remove}
            removeDisabled={assetIds.length <= minCount}
            replacing={replacing}
            scope={scope}
            target={target}
            token={token}
            total={assetIds.length}
          />
        ))}
      </ol>
    </div>
  );
}
