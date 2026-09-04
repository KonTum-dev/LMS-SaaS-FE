"use client";

import { Alert, App, Button, Card, Empty, Input, Space, Spin, Tag } from "antd";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  auditActions,
  auditApi,
  auditTargetTypes,
  type AuditAction,
  type AuditActionDetails,
  type AuditEventFilters,
  type AuditIntegrityIssueCode,
  type AuditIntegrityResponse,
  type AuditLedgerScope,
  type AuditOutcome,
  type AuditTargetType,
} from "@/lib/audit-api";
import { lmsQueryKeys, normalizeQueryFilters, type ViewerScope } from "@/lib/query-keys";
import styles from "./audit-ledger-view.module.css";

const actionLabels: Record<AuditAction, string> = {
  INVITATION_CREATED: "Tạo lời mời",
  INVITATION_RESENT: "Gửi lại lời mời",
  INVITATION_REVOKED: "Thu hồi lời mời",
  MEMBERSHIP_CREATED: "Tạo thành viên",
  MEMBERSHIP_ROLE_CHANGED: "Đổi vai trò thành viên",
  MEMBERSHIP_STATUS_CHANGED: "Đổi trạng thái thành viên",
  TENANT_MODULES_UPDATED: "Cập nhật module tenant",
  TENANT_SETTINGS_UPDATED: "Cập nhật workspace",
  TENANT_UPDATED_BY_SUPER_ADMIN: "Quản trị nền tảng cập nhật tenant",
};

const targetLabels: Record<AuditTargetType, string> = {
  INVITATION: "Lời mời",
  MEMBERSHIP: "Thành viên",
  TENANT: "Tenant",
};

const issueLabels: Record<AuditIntegrityIssueCode, string> = {
  EVENT_HASH_MISMATCH: "Hash nội dung sự kiện không khớp",
  HEAD_MISMATCH: "Đầu chuỗi không khớp sự kiện cuối",
  PREVIOUS_HASH_MISMATCH: "Liên kết hash giữa hai sự kiện bị đứt",
  ROLLBACK_OR_DIVERGENCE: "Checkpoint ngoài hệ thống phát hiện rollback hoặc phân nhánh",
  SEQUENCE_GAP: "Chuỗi bị thiếu số thứ tự",
  UNKNOWN_KEY: "Thiếu khóa lịch sử để xác minh",
};

const detailLabels: Record<keyof AuditActionDetails, string> = {
  afterModules: "Module sau thay đổi",
  afterRole: "Vai trò mới",
  afterStatus: "Trạng thái mới",
  beforeModules: "Module trước thay đổi",
  beforeRole: "Vai trò cũ",
  beforeStatus: "Trạng thái cũ",
  membershipId: "Mã thành viên",
  revision: "Phiên bản",
  tenantId: "Mã tenant",
};

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "medium",
});

interface AuditFilterDraft {
  action: AuditAction | "";
  actorId: string;
  from: string;
  outcome: AuditOutcome | "";
  targetId: string;
  targetType: AuditTargetType | "";
  to: string;
}

type VerificationMode = "ANCHORED" | "GENESIS";

const emptyFilters: AuditFilterDraft = {
  action: "",
  actorId: "",
  from: "",
  outcome: "",
  targetId: "",
  targetType: "",
  to: "",
};

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function committedFilters(draft: AuditFilterDraft): AuditEventFilters {
  return {
    action: draft.action || undefined,
    actorId: draft.actorId.trim() || undefined,
    from: toIso(draft.from),
    outcome: draft.outcome || undefined,
    targetId: draft.targetId.trim() || undefined,
    targetType: draft.targetType || undefined,
    to: toIso(draft.to),
  };
}

function scopeKey(scope: AuditLedgerScope): string {
  return scope.kind === "CURRENT_TENANT" ? "current" : `tenant:${scope.tenantId}`;
}

function compactId(value: string | undefined): string {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function detailValue(value: AuditActionDetails[keyof AuditActionDetails]): string {
  return Array.isArray(value) ? value.join(", ") || "Không có" : String(value ?? "—");
}

function actorLabel(actor: { kind: string; role?: string; source?: string; userId?: string }) {
  if (actor.kind === "SYSTEM") return actor.source ? `Hệ thống · ${actor.source}` : "Hệ thống";
  if (actor.kind === "PROVIDER") return actor.source ? `Nhà cung cấp · ${actor.source}` : "Nhà cung cấp";
  return `${actor.role ?? "Người dùng"} · ${compactId(actor.userId)}`;
}

export interface AuditLedgerViewProps {
  scope: AuditLedgerScope;
  token: string;
  viewerScope: ViewerScope;
}

export function AuditLedgerView({ scope, token, viewerScope }: AuditLedgerViewProps) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<AuditFilterDraft>(emptyFilters);
  const [filters, setFilters] = useState<AuditEventFilters>({});
  const [checkpointState, setCheckpointState] = useState<{ authority: string; value: string } | null>(null);
  const [verificationState, setVerificationState] = useState<{
    authority: string;
    mode: VerificationMode;
    result: AuditIntegrityResponse;
  } | null>(null);
  const authority = `${viewerScope.tenantId}:${viewerScope.membershipId}:${viewerScope.viewerId}:${viewerScope.role}:${scopeKey(scope)}`;
  const authorityRef = useRef(authority);
  useEffect(() => {
    authorityRef.current = authority;
  }, [authority]);
  const checkpointInput = checkpointState?.authority === authority ? checkpointState.value : "";
  const verification = verificationState?.authority === authority ? verificationState.result : null;
  const verificationMode = verificationState?.authority === authority ? verificationState.mode : null;

  const eventsQuery = useInfiniteQuery({
    initialPageParam: null as string | null,
    queryKey: [
      ...lmsQueryKeys.viewer(viewerScope),
      "audit-ledger",
      scopeKey(scope),
      normalizeQueryFilters({
        action: filters.action,
        actorId: filters.actorId,
        from: filters.from,
        outcome: filters.outcome,
        targetId: filters.targetId,
        targetType: filters.targetType,
        to: filters.to,
      }),
    ],
    queryFn: ({ pageParam }) => auditApi.listEvents(
      { token },
      scope,
      pageParam ? { cursor: pageParam, limit: 50 } : { ...filters, limit: 50 },
    ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const verifyMutation = useMutation({
    mutationFn: (input: {
      authority: string;
      checkpoint?: string;
      continuation?: string;
      mode: VerificationMode;
    }) => auditApi.verifyIntegrity(
      { token },
      scope,
      {
        ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
        ...(input.continuation ? { continuation: input.continuation } : {}),
        maxEvents: 5000,
      },
    ),
    onError: (error, input) => {
      if (input.authority !== authorityRef.current) return;
      message.error(error instanceof Error ? error.message : "Không thể kiểm tra chuỗi audit");
    },
    onSuccess: (result, input) => {
      if (input.authority !== authorityRef.current) return;
      setVerificationState({ authority: input.authority, mode: input.mode, result });
      if (result.complete && result.valid) {
        message.success(input.mode === "GENESIS"
          ? "Đã hoàn tất quét chuỗi audit từ genesis"
          : "Phạm vi audit incremental từ checkpoint hợp lệ");
      }
    },
  });

  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [eventsQuery.data?.pages],
  );
  const snapshot = eventsQuery.data?.pages[0]?.snapshot ?? null;
  const verifiedCheckpoint = verification?.valid && verification.complete
    ? verification.checkpoint
    : null;
  const displayedCheckpoint = verifiedCheckpoint ?? (verification ? null : snapshot?.checkpoint ?? null);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilters(committedFilters(draft));
  };

  const resetFilters = () => {
    setDraft(emptyFilters);
    setFilters({});
  };

  const startVerification = () => {
    const checkpoint = checkpointInput.trim();
    setVerificationState(null);
    verifyMutation.mutate({
      authority,
      checkpoint: checkpoint || undefined,
      mode: checkpoint ? "ANCHORED" : "GENESIS",
    });
  };

  const continueVerification = () => {
    if (!verification?.continuation || !verificationMode) return;
    verifyMutation.mutate({
      authority,
      continuation: verification.continuation,
      mode: verificationMode,
    });
  };

  const copyCheckpoint = async (checkpoint: string) => {
    try {
      await navigator.clipboard.writeText(checkpoint);
      message.success("Đã sao chép checkpoint");
    } catch {
      message.error("Trình duyệt không cho phép sao chép; hãy chọn checkpoint thủ công");
    }
  };

  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <Card className="surface-card" title="Bộ lọc sự kiện">
        <form className={styles.filters} onSubmit={applyFilters}>
          <label className={styles.filterField}>
            <span>Hành động</span>
            <select
              aria-label="Hành động audit"
              onChange={(event) => setDraft((value) => ({ ...value, action: event.target.value as AuditFilterDraft["action"] }))}
              value={draft.action}
            >
              <option value="">Tất cả</option>
              {auditActions.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Kết quả</span>
            <select
              aria-label="Kết quả audit"
              onChange={(event) => setDraft((value) => ({ ...value, outcome: event.target.value as AuditFilterDraft["outcome"] }))}
              value={draft.outcome}
            >
              <option value="">Tất cả</option>
              <option value="SUCCEEDED">Đã thay đổi</option>
              <option value="NO_CHANGE">Không đổi</option>
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Loại đối tượng</span>
            <select
              aria-label="Loại đối tượng audit"
              onChange={(event) => setDraft((value) => ({ ...value, targetType: event.target.value as AuditFilterDraft["targetType"] }))}
              value={draft.targetType}
            >
              <option value="">Tất cả</option>
              {auditTargetTypes.map((target) => <option key={target} value={target}>{targetLabels[target]}</option>)}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Mã người thực hiện</span>
            <input aria-label="Mã người thực hiện" onChange={(event) => setDraft((value) => ({ ...value, actorId: event.target.value }))} value={draft.actorId} />
          </label>
          <label className={styles.filterField}>
            <span>Mã đối tượng</span>
            <input aria-label="Mã đối tượng" onChange={(event) => setDraft((value) => ({ ...value, targetId: event.target.value }))} value={draft.targetId} />
          </label>
          <div className={styles.filterActions}>
            <Button htmlType="submit" type="primary">Áp dụng</Button>
            <Button onClick={resetFilters}>Xóa lọc</Button>
          </div>
          <label className={styles.filterField}>
            <span>Từ thời điểm</span>
            <input aria-label="Từ thời điểm" onChange={(event) => setDraft((value) => ({ ...value, from: event.target.value }))} type="datetime-local" value={draft.from} />
          </label>
          <label className={styles.filterField}>
            <span>Đến thời điểm</span>
            <input aria-label="Đến thời điểm" onChange={(event) => setDraft((value) => ({ ...value, to: event.target.value }))} type="datetime-local" value={draft.to} />
          </label>
        </form>
      </Card>

      {eventsQuery.error ? (
        <Alert showIcon title={eventsQuery.error instanceof Error ? eventsQuery.error.message : "Không tải được nhật ký audit"} type="error" />
      ) : eventsQuery.isPending ? (
        <Card className="surface-card"><Spin /> Đang tải nhật ký...</Card>
      ) : (
        <Card className="surface-card table-surface" title="Sự kiện bất biến">
          {snapshot && (
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}><span>Chuỗi</span><code>{compactId(snapshot.chainId)}</code></div>
              <div className={styles.summaryItem}><span>Snapshot đến sequence</span><strong>{snapshot.throughSequence.toLocaleString("vi-VN")}</strong></div>
              <div className={styles.summaryItem}><span>Hash snapshot</span><code>{compactId(snapshot.throughHash)}</code></div>
            </div>
          )}
          {events.length === 0 ? <Empty description="Chưa có sự kiện phù hợp" /> : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>Nhật ký audit bất biến của tenant</caption>
                <thead><tr><th>Sequence</th><th>Thời điểm</th><th>Hành động</th><th>Người thực hiện</th><th>Đối tượng</th><th>Kết quả</th></tr></thead>
                <tbody>
                  {events.map((event) => {
                    const details = Object.entries(event.details).filter((entry) => entry[1] !== undefined);
                    return (
                      <Fragment key={event.id}>
                        <tr>
                          <td><strong>#{event.sequence}</strong></td>
                          <td>{dateTime.format(new Date(event.recordedAt))}</td>
                          <td><div className={styles.primaryCell}><strong>{actionLabels[event.action] ?? event.action}</strong><span className={styles.secondary}>{event.changedFields.join(", ") || "Không đổi field"}</span></div></td>
                          <td>{actorLabel(event.actor)}</td>
                          <td><div className={styles.primaryCell}><strong>{targetLabels[event.target.type] ?? event.target.type}</strong><code>{compactId(event.target.id)}</code></div></td>
                          <td><Tag color={event.outcome === "SUCCEEDED" ? "green" : "default"}>{event.outcome === "SUCCEEDED" ? "Đã thay đổi" : "Không đổi"}</Tag></td>
                        </tr>
                        <tr className={styles.detailsRow}>
                          <td colSpan={6}>
                            <details>
                              <summary>Chi tiết đã redact và bằng chứng hash</summary>
                              <div className={styles.detailsGrid}>
                                {details.map(([key, value]) => (
                                  <div className={styles.detailItem} key={key}><span>{detailLabels[key as keyof AuditActionDetails] ?? key}</span><strong>{detailValue(value)}</strong></div>
                                ))}
                                <div className={styles.detailItem}><span>Event ID</span><code className={styles.hash}>{event.id}</code></div>
                                <div className={styles.detailItem}><span>Key ID</span><code>{event.keyId}</code></div>
                                <div className={styles.detailItem}><span>Previous hash</span><code className={styles.hash}>{event.previousHash}</code></div>
                                <div className={styles.detailItem}><span>Event hash</span><code className={styles.hash}>{event.eventHash}</code></div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {eventsQuery.hasNextPage && <div className={styles.loadMore}><Button loading={eventsQuery.isFetchingNextPage} onClick={() => void eventsQuery.fetchNextPage()}>Tải thêm sự kiện</Button></div>}
        </Card>
      )}

      <Card className="surface-card" title="Kiểm tra tính toàn vẹn">
        <div className={styles.verification}>
          <Alert
            description="Không nhập checkpoint để quét từ genesis; nhập checkpoint VERIFIED chỉ kiểm tra phần chuỗi mới sau anchor đã tin cậy. Quá trình phân trang không phải một Mongo snapshot nguyên tử. Hãy lưu checkpoint ngoài Mongo và vẫn chạy quét từ genesis định kỳ."
            showIcon
            title="Giới hạn bảo đảm"
            type="info"
          />
          <label className={styles.checkpoint}>
            <span>Checkpoint đã lưu bên ngoài (không bắt buộc)</span>
            <Input.TextArea onChange={(event) => setCheckpointState({ authority, value: event.target.value })} placeholder="Dán checkpoint từ lần kiểm tra trước" value={checkpointInput} />
          </label>
          <div className={styles.verificationActions}>
            <Button loading={verifyMutation.isPending} onClick={startVerification} type="primary">Kiểm tra chuỗi</Button>
            {verification?.continuation && <Button disabled={verifyMutation.isPending} onClick={continueVerification}>Tiếp tục kiểm tra</Button>}
          </div>
          {verification && (
            <Alert
              description={`Đã kiểm tra sequence ${verification.verifiedFromSequence.toLocaleString("vi-VN")}–${verification.verifiedThroughSequence.toLocaleString("vi-VN")} / head ${verification.headSequence.toLocaleString("vi-VN")}.`}
              title={verification.valid
                ? (verification.complete
                    ? (verificationMode === "GENESIS"
                        ? "Đã hoàn tất quét từ genesis"
                        : "Phạm vi incremental từ checkpoint hợp lệ")
                    : "Phần đã kiểm tra hợp lệ; cần tiếp tục")
                : `${verification.issue ? issueLabels[verification.issue.code] : "Chuỗi audit không hợp lệ"}${verification.issue?.sequence ? ` tại sequence ${verification.issue.sequence}` : ""}`}
              showIcon
              type={verification.valid ? (verification.complete ? "success" : "warning") : "error"}
            />
          )}
          {displayedCheckpoint && (
            <label className={styles.checkpoint}>
              <span>
                {verifiedCheckpoint
                  ? (verificationMode === "GENESIS"
                      ? "Checkpoint sau lần quét từ genesis — lưu ngoài Mongo"
                      : "Checkpoint incremental đã xác minh — lưu ngoài Mongo")
                  : "Checkpoint snapshot chưa xác minh — hãy kiểm tra chuỗi trước khi lưu"}
              </span>
              <textarea onFocus={(event) => event.currentTarget.select()} readOnly value={displayedCheckpoint} />
              <Button onClick={() => void copyCheckpoint(displayedCheckpoint)}>Sao chép checkpoint</Button>
            </label>
          )}
        </div>
      </Card>
    </Space>
  );
}
