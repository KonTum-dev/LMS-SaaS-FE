"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningMessages } from "@/lib/i18n/learning-messages";

import { useFeedback } from "@/components/feedback/feedback-provider";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from "antd";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/app-providers";
import {
  cohortApi,
  cohortQueryKeys,
  type AttendanceRosterItem,
  type AttendanceStatus,
  type ClassSession,
} from "@/lib/cohort-api";
import { getViewerScope } from "@/lib/query-keys";
import attendanceStyles from "./attendance.module.css";

interface AttendanceDraft {
  note?: string;
  status?: AttendanceStatus;
}

const attendanceStatuses: Array<{
  color: string;
  label: string;
  value: AttendanceStatus;
}> = [
    { color: "green", label: "Có mặt", value: "PRESENT" },
    { color: "red", label: "Vắng", value: "ABSENT" },
    { color: "orange", label: "Đi muộn", value: "LATE" },
    { color: "blue", label: "Có phép", value: "EXCUSED" },
  ];

const attendanceStatusPresentation = Object.fromEntries(
  attendanceStatuses.map(({ color, label, value }) => [
    value,
    { color, label },
  ]),
) as Record<AttendanceStatus, { color: string; label: string }>;

const sessionStatusPresentation: Record<
  ClassSession["status"],
  { color: string; label: string }
> = {
  CANCELLED: { color: "red", label: "Đã hủy" },
  COMPLETED: { color: "purple", label: "Đã hoàn thành" },
  IN_PROGRESS: { color: "green", label: "Đang diễn ra" },
  SCHEDULED: { color: "blue", label: "Đã xếp lịch" },
};

function personName(value: AttendanceRosterItem["learnerId"]): string {
  return typeof value === "string" ? value : value.fullName;
}

function learnerId(value: AttendanceRosterItem["learnerId"]): string {
  return typeof value === "string" ? value : value._id;
}

export default function CohortAttendancePage() {
  const { t, locale } = useI18n(learningMessages);
  function sessionLabel(session: ClassSession): string {
    return `${formatUiDate(session.startAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}–${formatUiDate(session.endAt, locale, { hour: "2-digit", minute: "2-digit" })} · ${t(sessionStatusPresentation[session.status].label)}`;
  }

  const { message, reportError, formatError } = useFeedback();
  const { id: rawCohortId } = useParams<{ id: string }>();
  const cohortId = Array.isArray(rawCohortId)
    ? rawCohortId[0] ?? ""
    : rawCohortId;
  const { effectiveAccess, organization, token, user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const roleAllowed =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const readOnly = effectiveAccess?.readOnly ?? false;

  const sessionsKey = scope
    ? cohortQueryKeys.sessions(scope, cohortId)
    : (["lms", "signed-out", "cohorts", cohortId, "sessions"] as const);
  const sessionsQuery = useQuery({
    enabled: Boolean(token && scope && roleAllowed && cohortId),
    queryFn: ({ signal }) =>
      cohortApi.listSessions({ token }, cohortId, {}, { signal }),
    queryKey: sessionsKey,
  });
  const sessions = sessionsQuery.data ?? [];
  const selectedSession =
    sessions.find((session) => session._id === selectedSessionId) ??
    sessions.find((session) => session.status !== "CANCELLED") ??
    sessions[0];
  const activeSessionId = selectedSession?._id ?? "";
  const attendanceKey =
    scope && activeSessionId
      ? cohortQueryKeys.attendance(scope, cohortId, activeSessionId)
      : ([
        "lms",
        "signed-out",
        "cohorts",
        cohortId,
        "attendance",
      ] as const);
  const attendanceQuery = useQuery({
    enabled: Boolean(
      token && scope && roleAllowed && cohortId && activeSessionId,
    ),
    queryFn: ({ signal }) =>
      cohortApi.getAttendance(
        { token },
        cohortId,
        activeSessionId,
        { signal },
      ),
    queryKey: attendanceKey,
  });
  const items = attendanceQuery.data?.items ?? [];
  const canMutate = Boolean(
    roleAllowed &&
    scope &&
    !readOnly &&
    selectedSession &&
    selectedSession.status !== "CANCELLED",
  );

  const valueFor = (item: AttendanceRosterItem): AttendanceDraft => {
    const id = learnerId(item.learnerId);
    return {
      note: drafts[id]?.note ?? item.note ?? "",
      status: drafts[id]?.status ?? item.status ?? undefined,
    };
  };

  const markedCount = items.filter((item) => valueFor(item).status).length;
  const presentCount = items.filter(
    (item) => valueFor(item).status === "PRESENT",
  ).length;
  const absentCount = items.filter(
    (item) => valueFor(item).status === "ABSENT",
  ).length;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!canMutate || !activeSessionId) {
        throw new Error(t("Workspace hiện không cho phép lưu điểm danh"));
      }
      const records = items.flatMap((item) => {
        const value = valueFor(item);
        if (!value.status) return [];
        return [
          {
            learnerId: learnerId(item.learnerId),
            note: value.note?.trim() || null,
            status: value.status,
          },
        ];
      });
      if (records.length === 0) {
        throw new Error(t("Hãy chọn trạng thái cho ít nhất một học viên"));
      }
      return cohortApi.bulkMarkAttendance(
        { token },
        cohortId,
        activeSessionId,
        records,
      );
    },
    onSuccess: (snapshot) => {
      attendanceQuery.refetch().catch(() => undefined);
      setDrafts({});
      message.success(`Đã lưu điểm danh ${snapshot.markedCount} học viên`);
    },
  });

  const updateDraft = (
    item: AttendanceRosterItem,
    patch: AttendanceDraft,
  ) => {
    const id = learnerId(item.learnerId);
    setDrafts((current) => ({
      ...current,
      [id]: { ...valueFor(item), ...current[id], ...patch },
    }));
  };

  const markAllPresent = () => {
    setDrafts(
      Object.fromEntries(
        items.map((item) => {
          const id = learnerId(item.learnerId);
          return [id, { ...valueFor(item), status: "PRESENT" as const }];
        }),
      ),
    );
  };

  const saveAttendance = async () => {
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      reportError(error, "Không thể lưu điểm danh");
    }
  };

  const columns: TableColumnsType<AttendanceRosterItem> = [
    {
      key: "learner",
      render: (_, item) => (
        <div className="table-primary-cell">
          <strong>{personName(item.learnerId)}</strong>
          {typeof item.learnerId !== "string" && (
            <Typography.Text className="table-muted">
              {item.learnerId.email}
            </Typography.Text>
          )}
        </div>
      ),
      title: t("Học viên"),
    },
    {
      key: "status",
      render: (_, item) => (
        <Select<AttendanceStatus>
          aria-label={t("Trạng thái của {p0}", { p0: personName(item.learnerId) })}
          disabled={!canMutate}
          onChange={(status) => updateDraft(item, { status })}
          options={attendanceStatuses.map(({ label, value }) => ({
            label: t(label),
            value,
          }))}
          placeholder={t("Chưa điểm danh")}
          style={{ minWidth: 145 }}
          value={valueFor(item).status}
        />
      ),
      title: t("Trạng thái"),
      width: 180,
    },
    {
      key: "note",
      render: (_, item) => (
        <Input
          aria-label={t("Ghi chú cho {p0}", { p0: personName(item.learnerId) })}
          disabled={!canMutate}
          maxLength={500}
          onChange={(event) => updateDraft(item, { note: event.target.value })}
          placeholder={t("Ghi chú (không bắt buộc)")}
          value={valueFor(item).note}
        />
      ),
      title: t("Ghi chú"),
    },
    {
      key: "marked",
      render: (_, item) =>
        item.markedAt ? (
          <Space orientation="vertical" size={0}>
            <span>{formatUiDate(item.markedAt, locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            {item.status && (
              <Tag color={attendanceStatusPresentation[item.status].color}>
                {t(attendanceStatusPresentation[item.status].label)}
              </Tag>
            )}
          </Space>
        ) : (
          t("Chưa lưu")
        ),
      responsive: ["md"],
      title: t("Lần ghi nhận gần nhất"),
      width: 195,
    },
  ];

  if (!roleAllowed) {
    return (
      <Alert
        showIcon
        title={t("Chỉ quản trị viên và giảng viên được điểm danh lớp học.")}
        type="warning"
      />
    );
  }
  if (!scope) {
    return (
      <Alert
        showIcon
        title={t("Phiên làm việc thiếu phạm vi thành viên hợp lệ.")}
        type="error"
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <Typography.Text>
            <Link href="/cohorts">{t("← Quay lại danh sách lớp")}</Link>
          </Typography.Text>
          <h1>{t("Điểm danh lớp học")}</h1>
          <p>{t("Chọn đúng buổi học, cập nhật hàng loạt rồi lưu một lần.")}</p>
        </div>
        <Space wrap>
          <Button
            disabled={!canMutate || items.length === 0}
            onClick={markAllPresent}
          >{t("Tất cả có mặt")}</Button>
          <Button
            disabled={!canMutate || markedCount === 0}
            loading={saveMutation.isPending}
            onClick={() => void saveAttendance()}
            type="primary"
          >{t("Lưu điểm danh")}</Button>
        </Space>
      </div>

      {readOnly && (
        <Alert
          description={t("Bạn vẫn xem được sổ điểm danh nhưng không thể thay đổi dữ liệu.")}
          showIcon
          title={t("Workspace chỉ đọc")}
          type="info"
        />
      )}

      <Card className="surface-card" title={t("Buổi học")}>
        {sessionsQuery.isPending ? (
          <Spin />
        ) : sessionsQuery.error ? (
          <Alert
            action={
              <Button disabled={sessionsQuery.isFetching} loading={sessionsQuery.isFetching} onClick={() => { if (!sessionsQuery.isFetching) void sessionsQuery.refetch(); }} size="small">{t("Thử lại")}</Button>
            }
            showIcon
            title={formatError(sessionsQuery.error, t("Không tải được lịch học"))}
            type="error"
          />
        ) : sessions.length === 0 ? (
          <Empty description={t("Lớp chưa có buổi học để điểm danh")}>
            <Link href="/cohorts">{t("Quay lại để thêm lịch học")}</Link>
          </Empty>
        ) : (
          <Space align="center" wrap>
            <Select
              aria-label={t("Chọn buổi học")}
              onChange={(sessionId) => {
                setSelectedSessionId(sessionId);
                setDrafts({});
              }}
              options={sessions.map((session) => ({
                label: sessionLabel(session),
                value: session._id,
              }))}
              style={{ minWidth: 330 }}
              value={activeSessionId}
            />
            {selectedSession && (
              <Tag
                color={
                  sessionStatusPresentation[selectedSession.status].color
                }
              >
                {t(sessionStatusPresentation[selectedSession.status].label)}
              </Tag>
            )}
          </Space>
        )}
      </Card>

      {selectedSession?.status === "CANCELLED" && (
        <Alert
          description={
            selectedSession.cancellationReason ||
            t("Buổi học này đã hủy nên sổ điểm danh chỉ được xem.")
          }
          showIcon
          title={t("Không thể điểm danh buổi đã hủy")}
          type="warning"
        />
      )}

      {activeSessionId && (
        <>
          <div className={attendanceStyles.summaryGrid}>
            <Card className="metric-card">
              <Statistic title={t("Sĩ số")} value={items.length} />
            </Card>
            <Card className="metric-card">
              <Statistic title={t("Đã chọn trạng thái")} value={markedCount} />
            </Card>
            <Card className="metric-card">
              <Statistic title={t("Có mặt")} value={presentCount} />
            </Card>
            <Card className="metric-card">
              <Statistic title={t("Vắng")} value={absentCount} />
            </Card>
          </div>

          <Card className="surface-card" title={t("Sổ điểm danh")}>
            {attendanceQuery.error && !attendanceQuery.data ? (
              <Alert
                action={
                  <Button
                    disabled={attendanceQuery.isFetching}
                    loading={attendanceQuery.isFetching}
                    onClick={() => { if (!attendanceQuery.isFetching) void attendanceQuery.refetch(); }}
                    size="small"
                  >{t("Thử lại")}</Button>
                }
                showIcon
                title={formatError(
                  attendanceQuery.error,
                  t("Không tải được sổ điểm danh"),
                )}
                type="error"
              />
            ) : (
              <Table<AttendanceRosterItem>
                columns={columns}
                dataSource={items}
                loading={attendanceQuery.isPending}
                locale={{ emptyText: t("Lớp chưa có học viên") }}
                pagination={false}
                rowKey={(item) => learnerId(item.learnerId)}
                scroll={{ x: 850 }}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
