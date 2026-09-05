"use client";

import { useFeedback } from "@/components/feedback/feedback-provider";
import { useI18n } from "@/components/i18n/i18n-provider";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { Alert, Button, Spin, Tag } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  renderAssetAction?: (asset: MediaAsset) => ReactNode;
  scope: ViewerScope;
  target: MediaTarget;
  token: string;
}

type AttachmentMutation = { assetId: string; action: "up" | "down" | "remove" };

const statusLabels: Record<MediaAsset["status"], string> = {
  AVAILABLE: "Sẵn sàng",
  DELETED: "Đã xóa",
  DELETING: "Đang xóa",
  PENDING_UPLOAD: "Chờ tải lên",
  QUARANTINED: "Đang kiểm tra",
  REJECTED: "Không an toàn",
};

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
  pendingAction,
  renderAssetAction,
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
  pendingAction: AttachmentMutation | null;
  renderAssetAction?: (asset: MediaAsset) => ReactNode;
  scope: ViewerScope;
  target: MediaTarget;
  token: string;
  total: number;
}) {
  const { t, formatNumber } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  function formatBytes(value: number) {
    if (value < 1024) return `${formatNumber(value)} B`;
    if (value < 1024 * 1024)
      return `${formatNumber(Math.round(value / 1024))} KiB`;
    return `${formatNumber(Math.round((value / 1024 / 1024) * 10) / 10)} MiB`;
  }

  const downloadController = useRef<AbortController | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [metadataRetrying, setMetadataRetrying] = useState(false);
  const metadataRetryInFlight = useRef(false);
  const [downloadError, setDownloadError] = useState<{ cause: unknown } | null>(
    null,
  );
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

  const retryMetadata = async () => {
    if (!mediaEnabled || metadataRetryInFlight.current) return;
    metadataRetryInFlight.current = true;
    setMetadataRetrying(true);
    try {
      await assetQuery.refetch({ cancelRefetch: false, throwOnError: false });
    } finally {
      metadataRetryInFlight.current = false;
      setMetadataRetrying(false);
    }
  };

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
        setDownloadError({ cause: error });
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
          {asset?.originalFileName ?? t("Tệp đính kèm {p0}", { p0: index + 1 })}
        </strong>
        <span className={styles.attachmentMeta}>
          {asset ? (
            <>
              {formatBytes(asset.sizeBytes)} · {asset.contentType}
              <Tag>{t(statusLabels[asset.status])}</Tag>
            </>
          ) : assetQuery.isPending && mediaEnabled ? (
            <>
              <Spin size="small" /> {t("Đang đọc metadata an toàn")}
            </>
          ) : (
            <>
              {t("Mã tệp …")}
              {assetId.slice(-8)}
            </>
          )}
        </span>
        {(assetQuery.error || metadataRetrying) && mediaEnabled && (
          <Alert
            action={
              <Button
                loading={metadataRetrying || assetQuery.isFetching}
                onClick={() => void retryMetadata()}
                size="small"
              >
                {t("Thử lại")}
              </Button>
            }
            showIcon
            title={formatError(assetQuery.error, "Không tải được metadata tệp")}
            type="warning"
          />
        )}
        {downloadError && mediaEnabled && (
          <Alert
            showIcon
            title={formatError(
              downloadError.cause,
              "Không thể cấp liên kết tải tệp.",
            )}
            type="error"
          />
        )}
      </div>
      <div
        aria-label={t("Thao tác tệp {p0}", {
          p0: asset?.originalFileName ?? index + 1,
        })}
        className={styles.attachmentActions}
        role="group"
      >
        <Button
          disabled={!mediaEnabled || asset?.status !== "AVAILABLE" || replacing}
          loading={downloadBusy}
          onClick={() => void download()}
          size="small"
        >
          {t("Tải xuống")}
        </Button>
        {canMutate && (
          <>
            <Button
              aria-label={t("Đưa tệp {p0} lên", { p0: index + 1 })}
              disabled={index === 0 || replacing}
              loading={
                pendingAction?.assetId === assetId &&
                pendingAction.action === "up"
              }
              onClick={() => onMove(index, index - 1)}
              size="small"
            >
              {t("Lên")}
            </Button>
            <Button
              aria-label={t("Đưa tệp {p0} xuống", { p0: index + 1 })}
              disabled={index === total - 1 || replacing}
              loading={
                pendingAction?.assetId === assetId &&
                pendingAction.action === "down"
              }
              onClick={() => onMove(index, index + 1)}
              size="small"
            >
              {t("Xuống")}
            </Button>
            <Button
              danger
              disabled={replacing || removeDisabled}
              loading={
                pendingAction?.assetId === assetId &&
                pendingAction.action === "remove"
              }
              onClick={() => onRemove(index)}
              size="small"
              title={
                removeDisabled
                  ? t("Bản nháp nhận tệp phải giữ ít nhất một tệp")
                  : undefined
              }
            >
              {t("Gỡ")}
            </Button>
          </>
        )}
        {asset && renderAssetAction?.(asset)}
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
  renderAssetAction,
  scope,
  target,
  token,
}: SecureAttachmentListProps) {
  const { t } = useI18n(learningMessages);
  const { formatError } = useFeedback();
  const [replaceError, setReplaceError] = useState<{ cause: unknown } | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<AttachmentMutation | null>(
    null,
  );
  const replaceInFlight = useRef(false);
  const replace = async (next: string[], action: AttachmentMutation) => {
    if (!canMutate || !onReplace || replacing || replaceInFlight.current)
      return;
    replaceInFlight.current = true;
    setPendingAction(action);
    setReplaceError(null);
    try {
      await onReplace(next);
    } catch (error) {
      setReplaceError({ cause: error });
    } finally {
      replaceInFlight.current = false;
      setPendingAction(null);
    }
  };
  const move = (from: number, to: number) => {
    const next = [...assetIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void replace(next, {
      assetId: assetIds[from],
      action: to < from ? "up" : "down",
    });
  };
  const remove = (index: number) =>
    void replace(
      assetIds.filter((_, itemIndex) => itemIndex !== index),
      { assetId: assetIds[index], action: "remove" },
    );

  if (!assetIds.length) return <p>{t("Chưa có tệp đính kèm.")}</p>;
  return (
    <div aria-busy={replacing || pendingAction !== null}>
      {!mediaEnabled && (
        <Alert
          description={t(
            "Snapshot ID vẫn được giữ để đối soát. Metadata chi tiết và liên kết tải xuống chỉ được cấp khi module Tài liệu riêng tư hoạt động.",
          )}
          showIcon
          title={t("Tải tệp đang tạm khóa")}
          type="warning"
        />
      )}
      {replaceError && (
        <Alert
          showIcon
          title={formatError(
            replaceError.cause,
            "Không thể cập nhật danh sách tệp.",
          )}
          type="error"
        />
      )}
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
            replacing={replacing || pendingAction !== null}
            pendingAction={pendingAction}
            renderAssetAction={renderAssetAction}
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
