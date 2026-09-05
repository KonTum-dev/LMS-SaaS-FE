"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import { useMemo as useI18nMemo } from "react";

import { Alert, Button, Card, Empty, Input, Space, Spin, Tag } from "antd";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import {
  lmsQueryKeys,
  normalizeQueryFilters,
  type ViewerScope,
} from "@/lib/query-keys";
import styles from "./audit-ledger-view.module.css";

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
const auditMessages = { ...operationsMessages, ...workspacePolishMessages };

export interface AuditLedgerViewProps {
  scope: AuditLedgerScope;
  token: string;
  viewerScope: ViewerScope;
}

export function AuditLedgerView({
  scope,
  token,
  viewerScope,
}: AuditLedgerViewProps) {
  const {
    t,
    locale,
    actionLabels,
    targetLabels,
    issueLabels,
    detailLabels,
    dateTime,
    committedFilters,
    scopeKey,
    compactId,
    detailValue,
    actorLabel,
  } = useOperationsCopy();
  const { message, reportError } = useFeedback();
  const [draft, setDraft] = useState<AuditFilterDraft>(emptyFilters);
  const [filters, setFilters] = useState<AuditEventFilters>({});
  const advancedFilterCount = [draft.actorId, draft.targetId, draft.targetType, draft.from, draft.to].filter(Boolean).length;
  const [checkpointState, setCheckpointState] = useState<{
    authority: string;
    value: string;
  } | null>(null);
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
  const checkpointInput =
    checkpointState?.authority === authority ? checkpointState.value : "";
  const verification =
    verificationState?.authority === authority
      ? verificationState.result
      : null;
  const verificationMode =
    verificationState?.authority === authority ? verificationState.mode : null;

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
    queryFn: ({ pageParam }) =>
      auditApi.listEvents(
        { token },
        scope,
        pageParam
          ? { cursor: pageParam, limit: 50 }
          : { ...filters, limit: 50 },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const verifyMutation = useMutation({
    mutationFn: (input: {
      authority: string;
      checkpoint?: string;
      continuation?: string;
      mode: VerificationMode;
    }) =>
      auditApi.verifyIntegrity({ token }, scope, {
        ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
        ...(input.continuation ? { continuation: input.continuation } : {}),
        maxEvents: 5000,
      }),
    onError: (error, input) => {
      if (input.authority !== authorityRef.current) return;
      reportError(error, "Không thể kiểm tra chuỗi audit");
    },
    onSuccess: (result, input) => {
      if (input.authority !== authorityRef.current) return;
      setVerificationState({
        authority: input.authority,
        mode: input.mode,
        result,
      });
      if (result.complete && result.valid) {
        message.success(
          input.mode === "GENESIS"
            ? "Đã hoàn tất quét chuỗi audit từ genesis"
            : "Phạm vi audit incremental từ checkpoint hợp lệ",
        );
      }
    },
  });

  const events = useMemo(
    () => eventsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [eventsQuery.data?.pages],
  );
  const snapshot = eventsQuery.data?.pages[0]?.snapshot ?? null;
  const verifiedCheckpoint =
    verification?.valid && verification.complete
      ? verification.checkpoint
      : null;
  const displayedCheckpoint =
    verifiedCheckpoint ??
    (verification ? null : (snapshot?.checkpoint ?? null));

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
      message.error(
        "Trình duyệt không cho phép sao chép; hãy chọn checkpoint thủ công",
      );
    }
  };

  return (
    <Space orientation="vertical" size={18} style={{ width: "100%" }}>
      <Card className="surface-card" title={t("Bộ lọc sự kiện")}>
        <form className={styles.filters} onSubmit={applyFilters}>
          <label className={styles.filterField}>
            <span>{t("Hành động")}</span>
            <select
              aria-label={t("Hành động audit")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  action: event.target.value as AuditFilterDraft["action"],
                }))
              }
              value={draft.action}
            >
              <option value="">{t("Tất cả")}</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>{t("Kết quả")}</span>
            <select
              aria-label={t("Kết quả audit")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  outcome: event.target.value as AuditFilterDraft["outcome"],
                }))
              }
              value={draft.outcome}
            >
              <option value="">{t("Tất cả")}</option>
              <option value="SUCCEEDED">{t("Đã thay đổi")}</option>
              <option value="NO_CHANGE">{t("Không đổi")}</option>
            </select>
          </label>
          <div className={styles.filterActions}>
            <Button htmlType="submit" loading={eventsQuery.isFetching && !eventsQuery.isFetchingNextPage} type="primary">{t("Áp dụng")}</Button>
            <Button onClick={resetFilters}>{t("Xóa lọc")}</Button>
          </div>
          <details className={styles.advancedFilters}>
            <summary>{t("Bộ lọc chi tiết")}{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}</summary>
            <div className={styles.filters}>
          <label className={styles.filterField}>
            <span>{t("Loại đối tượng")}</span>
            <select
              aria-label={t("Loại đối tượng audit")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  targetType: event.target
                    .value as AuditFilterDraft["targetType"],
                }))
              }
              value={draft.targetType}
            >
              <option value="">{t("Tất cả")}</option>
              {auditTargetTypes.map((target) => (
                <option key={target} value={target}>
                  {targetLabels[target]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span>{t("Mã người thực hiện")}</span>
            <input
              aria-label={t("Mã người thực hiện")}
              onChange={(event) =>
                setDraft((value) => ({ ...value, actorId: event.target.value }))
              }
              value={draft.actorId}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t("Mã đối tượng")}</span>
            <input
              aria-label={t("Mã đối tượng")}
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  targetId: event.target.value,
                }))
              }
              value={draft.targetId}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t("Từ thời điểm")}</span>
            <input
              aria-label={t("Từ thời điểm")}
              onChange={(event) =>
                setDraft((value) => ({ ...value, from: event.target.value }))
              }
              type="datetime-local"
              value={draft.from}
            />
          </label>
          <label className={styles.filterField}>
            <span>{t("Đến thời điểm")}</span>
            <input
              aria-label={t("Đến thời điểm")}
              onChange={(event) =>
                setDraft((value) => ({ ...value, to: event.target.value }))
              }
              type="datetime-local"
              value={draft.to}
            />
          </label>
            </div>
          </details>
        </form>
      </Card>

      {eventsQuery.error ? (
        <Alert
          action={<Button loading={eventsQuery.isFetching} onClick={() => void eventsQuery.refetch({ cancelRefetch: false })}>{t("Thử lại")}</Button>}
          showIcon
          title={
            eventsQuery.error instanceof Error
              ? describeOperationsError(
                  eventsQuery.error,
                  locale,
                  t("Không tải được nhật ký audit"),
                )
              : t("Không tải được nhật ký audit")
          }
          type="error"
        />
      ) : eventsQuery.isPending ? (
        <Card className="surface-card">
          <Spin /> {t("Đang tải nhật ký...")}{" "}
        </Card>
      ) : (
        <Card
          className="surface-card table-surface"
          title={t("Nhật ký thay đổi")}
        >
          {snapshot && (
            <details className={styles.snapshot}>
              <summary>{t("Thông tin xác minh")}</summary>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span>{t("Chuỗi")}</span>
                <code>{compactId(snapshot.chainId)}</code>
              </div>
              <div className={styles.summaryItem}>
                <span>{t("Snapshot đến sequence")}</span>
                <strong>
                  {snapshot.throughSequence.toLocaleString(
                    locale === "en" ? "en-US" : "vi-VN",
                  )}
                </strong>
              </div>
              <div className={styles.summaryItem}>
                <span>{t("Hash snapshot")}</span>
                <code>{compactId(snapshot.throughHash)}</code>
              </div>
            </div>
            </details>
          )}
          {events.length === 0 ? (
            <Empty description={t("Chưa có sự kiện phù hợp")} />
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>{t("Nhật ký audit bất biến của tenant")}</caption>
                <thead>
                  <tr>
                    <th>{t("Số thứ tự")}</th>
                    <th>{t("Thời điểm")}</th>
                    <th>{t("Hành động")}</th>
                    <th>{t("Người thực hiện")}</th>
                    <th>{t("Đối tượng")}</th>
                    <th>{t("Kết quả")}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const details = Object.entries(event.details).filter(
                      (entry) => entry[1] !== undefined,
                    );
                    return (
                      <Fragment key={event.id}>
                        <tr>
                          <td>
                            <strong>#{event.sequence}</strong>
                          </td>
                          <td>{dateTime.format(new Date(event.recordedAt))}</td>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>
                                {actionLabels[event.action] ?? event.action}
                              </strong>
                            </div>
                          </td>
                          <td>{actorLabel(event.actor)}</td>
                          <td>
                            <div className={styles.primaryCell}>
                              <strong>
                                {targetLabels[event.target.type] ??
                                  event.target.type}
                              </strong>
                              <code>{compactId(event.target.id)}</code>
                            </div>
                          </td>
                          <td>
                            <Tag
                              color={
                                event.outcome === "SUCCEEDED"
                                  ? "green"
                                  : "default"
                              }
                            >
                              {event.outcome === "SUCCEEDED"
                                ? t("Đã thay đổi")
                                : t("Không đổi")}
                            </Tag>
                          </td>
                        </tr>
                        <tr className={styles.detailsRow}>
                          <td colSpan={6}>
                            <details>
                              <summary>
                                {t(
                                  "Chi tiết đã redact và bằng chứng hash",
                                )}{" "}
                              </summary>
                              <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                  <span>{t("Trường đã thay đổi")}</span>
                                  <code>{event.changedFields.join(", ") || t("Không đổi field")}</code>
                                </div>
                                {details.map(([key, value]) => (
                                  <div className={styles.detailItem} key={key}>
                                    <span>
                                      {detailLabels[
                                        key as keyof AuditActionDetails
                                      ] ?? key}
                                    </span>
                                    <strong>{detailValue(value)}</strong>
                                  </div>
                                ))}
                                <div className={styles.detailItem}>
                                  <span>{t("Mã sự kiện")}</span>
                                  <code className={styles.hash}>
                                    {event.id}
                                  </code>
                                </div>
                                <div className={styles.detailItem}>
                                  <span>{t("Mã khóa")}</span>
                                  <code>{event.keyId}</code>
                                </div>
                                <div className={styles.detailItem}>
                                  <span>{t("Hash trước đó")}</span>
                                  <code className={styles.hash}>
                                    {event.previousHash}
                                  </code>
                                </div>
                                <div className={styles.detailItem}>
                                  <span>{t("Hash sự kiện")}</span>
                                  <code className={styles.hash}>
                                    {event.eventHash}
                                  </code>
                                </div>
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
          {eventsQuery.hasNextPage && (
            <div className={styles.loadMore}>
              <Button
                loading={eventsQuery.isFetchingNextPage}
                onClick={() => void eventsQuery.fetchNextPage()}
              >
                {t("Tải thêm sự kiện")}{" "}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="surface-card" title={t("Kiểm tra tính toàn vẹn")}>
        <div className={styles.verification}>
          <details className={styles.guarantees}>
            <summary>{t("Xem phạm vi bảo đảm")}</summary>
          <Alert
            description={t(
              "Không nhập checkpoint để quét từ genesis; nhập checkpoint VERIFIED chỉ kiểm tra phần chuỗi mới sau anchor đã tin cậy. Quá trình phân trang không phải một Mongo snapshot nguyên tử. Hãy lưu checkpoint ngoài Mongo và vẫn chạy quét từ genesis định kỳ.",
            )}
            showIcon
            title={t("Giới hạn bảo đảm")}
            type="info"
          />
          </details>
          <label className={styles.checkpoint}>
            <span>{t("Checkpoint đã lưu bên ngoài (không bắt buộc)")}</span>
            <Input.TextArea
              onChange={(event) =>
                setCheckpointState({ authority, value: event.target.value })
              }
              placeholder={t("Dán checkpoint từ lần kiểm tra trước")}
              value={checkpointInput}
            />
          </label>
          <div className={styles.verificationActions}>
            <Button
              loading={verifyMutation.isPending}
              onClick={startVerification}
              type="primary"
            >
              {t("Kiểm tra chuỗi")}{" "}
            </Button>
            {verification?.continuation && (
              <Button
                disabled={verifyMutation.isPending}
                onClick={continueVerification}
              >
                {t("Tiếp tục kiểm tra")}{" "}
              </Button>
            )}
          </div>
          {verification && (
            <Alert
              description={t(
                "Đã kiểm tra sequence {value0}–{value1} / head {value2}.",
                {
                  value0: verification.verifiedFromSequence.toLocaleString(
                    locale === "en" ? "en-US" : "vi-VN",
                  ),
                  value1: verification.verifiedThroughSequence.toLocaleString(
                    locale === "en" ? "en-US" : "vi-VN",
                  ),
                  value2: verification.headSequence.toLocaleString(
                    locale === "en" ? "en-US" : "vi-VN",
                  ),
                },
              )}
              title={
                verification.valid
                  ? verification.complete
                    ? verificationMode === "GENESIS"
                      ? t("Đã hoàn tất quét từ genesis")
                      : t("Phạm vi incremental từ checkpoint hợp lệ")
                    : t("Phần đã kiểm tra hợp lệ; cần tiếp tục")
                  : t("{value0}{value1}", {
                      value0: verification.issue
                        ? issueLabels[verification.issue.code]
                        : t("Chuỗi audit không hợp lệ"),
                      value1: verification.issue?.sequence
                        ? t(" tại sequence {value0}", {
                            value0: verification.issue.sequence,
                          })
                        : "",
                    })
              }
              showIcon
              type={
                verification.valid
                  ? verification.complete
                    ? "success"
                    : "warning"
                  : "error"
              }
            />
          )}
          {displayedCheckpoint && (
            <label className={styles.checkpoint}>
              <span>
                {verifiedCheckpoint
                  ? verificationMode === "GENESIS"
                    ? t("Checkpoint sau lần quét từ genesis — lưu ngoài Mongo")
                    : t("Checkpoint incremental đã xác minh — lưu ngoài Mongo")
                  : t(
                      "Checkpoint snapshot chưa xác minh — hãy kiểm tra chuỗi trước khi lưu",
                    )}
              </span>
              <textarea
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={displayedCheckpoint}
              />
              <Button onClick={() => void copyCheckpoint(displayedCheckpoint)}>
                {t("Sao chép checkpoint")}{" "}
              </Button>
            </label>
          )}
        </div>
      </Card>
    </Space>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(auditMessages);
  return useI18nMemo(() => {
    const { t, locale } = i18n;
    const actionLabels: Record<AuditAction, string> = {
      INVITATION_CREATED: t("Tạo lời mời"),
      INVITATION_RESENT: t("Gửi lại lời mời"),
      INVITATION_REVOKED: t("Thu hồi lời mời"),
      MEMBERSHIP_CREATED: t("Tạo thành viên"),
      MEMBERSHIP_ROLE_CHANGED: t("Đổi vai trò thành viên"),
      MEMBERSHIP_STATUS_CHANGED: t("Đổi trạng thái thành viên"),
      TENANT_MODULES_UPDATED: t("Cập nhật module tenant"),
      TENANT_SETTINGS_UPDATED: t("Cập nhật workspace"),
      TENANT_UPDATED_BY_SUPER_ADMIN: t("Quản trị nền tảng cập nhật tenant"),
    };

    const targetLabels: Record<AuditTargetType, string> = {
      INVITATION: t("Lời mời"),
      MEMBERSHIP: t("Thành viên"),
      TENANT: "Tenant",
    };

    const issueLabels: Record<AuditIntegrityIssueCode, string> = {
      EVENT_HASH_MISMATCH: t("Hash nội dung sự kiện không khớp"),
      HEAD_MISMATCH: t("Đầu chuỗi không khớp sự kiện cuối"),
      PREVIOUS_HASH_MISMATCH: t("Liên kết hash giữa hai sự kiện bị đứt"),
      ROLLBACK_OR_DIVERGENCE: t(
        "Checkpoint ngoài hệ thống phát hiện rollback hoặc phân nhánh",
      ),
      SEQUENCE_GAP: t("Chuỗi bị thiếu số thứ tự"),
      UNKNOWN_KEY: t("Thiếu khóa lịch sử để xác minh"),
    };

    const detailLabels: Record<keyof AuditActionDetails, string> = {
      afterModules: t("Module sau thay đổi"),
      afterRole: t("Vai trò mới"),
      afterStatus: t("Trạng thái mới"),
      beforeModules: t("Module trước thay đổi"),
      beforeRole: t("Vai trò cũ"),
      beforeStatus: t("Trạng thái cũ"),
      membershipId: t("Mã thành viên"),
      revision: t("Phiên bản"),
      tenantId: t("Mã tenant"),
    };

    const dateTime = new Intl.DateTimeFormat(
      locale === "en" ? "en-US" : "vi-VN",
      {
        dateStyle: "medium",
        timeStyle: "medium",
      },
    );

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
      return scope.kind === "CURRENT_TENANT"
        ? "current"
        : `tenant:${scope.tenantId}`;
    }

    function compactId(value: string | undefined): string {
      if (!value) return "—";
      return value.length > 16
        ? `${value.slice(0, 8)}…${value.slice(-6)}`
        : value;
    }

    function detailValue(
      value: AuditActionDetails[keyof AuditActionDetails],
    ): string {
      return Array.isArray(value)
        ? value.join(", ") || t("Không có")
        : String(value ?? "—");
    }

    function actorLabel(actor: {
      kind: string;
      role?: string;
      source?: string;
      userId?: string;
    }) {
      if (actor.kind === "SYSTEM")
        return actor.source
          ? t("Hệ thống · {value0}", { value0: actor.source })
          : t("Hệ thống");
      if (actor.kind === "PROVIDER")
        return actor.source
          ? t("Nhà cung cấp · {value0}", { value0: actor.source })
          : t("Nhà cung cấp");
      return t("{value0} · {value1}", {
        value0: actor.role ?? t("Người dùng"),
        value1: compactId(actor.userId),
      });
    }
    return {
      ...i18n,
      actionLabels,
      targetLabels,
      issueLabels,
      detailLabels,
      dateTime,
      toIso,
      committedFilters,
      scopeKey,
      compactId,
      detailValue,
      actorLabel,
    };
  }, [i18n]);
}
