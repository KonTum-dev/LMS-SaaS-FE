"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
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
import dayjs from "dayjs";
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

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sessionLabel(session: ClassSession): string {
  return `${dayjs(session.startAt).format("DD/MM/YYYY · HH:mm")}–${dayjs(
    session.endAt,
  ).format("HH:mm")} · ${
    sessionStatusPresentation[session.status].label
  }`;
}

export default function CohortAttendancePage() {
  const { message } = App.useApp();
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
        throw new Error("Workspace hiện không cho phép lưu điểm danh");
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
        throw new Error("Hãy chọn trạng thái cho ít nhất một học viên");
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
      message.error(errorMessage(error, "Không thể lưu điểm danh"));
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
      title: "Học viên",
    },
    {
      key: "status",
      render: (_, item) => (
        <Select<AttendanceStatus>
          aria-label={`Trạng thái của ${personName(item.learnerId)}`}
          disabled={!canMutate}
          onChange={(status) => updateDraft(item, { status })}
          options={attendanceStatuses.map(({ label, value }) => ({
            label,
            value,
          }))}
          placeholder="Chưa điểm danh"
          style={{ minWidth: 145 }}
          value={valueFor(item).status}
        />
      ),
      title: "Trạng thái",
      width: 180,
    },
    {
      key: "note",
      render: (_, item) => (
        <Input
          aria-label={`Ghi chú cho ${personName(item.learnerId)}`}
          disabled={!canMutate}
          maxLength={500}
          onChange={(event) => updateDraft(item, { note: event.target.value })}
          placeholder="Ghi chú (không bắt buộc)"
          value={valueFor(item).note}
        />
      ),
      title: "Ghi chú",
    },
    {
      key: "marked",
      render: (_, item) =>
        item.markedAt ? (
          <Space direction="vertical" size={0}>
            <span>{dayjs(item.markedAt).format("DD/MM/YYYY HH:mm")}</span>
            {item.status && (
              <Tag color={attendanceStatusPresentation[item.status].color}>
                {attendanceStatusPresentation[item.status].label}
              </Tag>
            )}
          </Space>
        ) : (
          "Chưa lưu"
        ),
      responsive: ["md"],
      title: "Lần ghi nhận gần nhất",
      width: 195,
    },
  ];

  if (!roleAllowed) {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị viên và giảng viên được điểm danh lớp học."
        type="warning"
      />
    );
  }
  if (!scope) {
    return (
      <Alert
        showIcon
        title="Phiên làm việc thiếu phạm vi thành viên hợp lệ."
        type="error"
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-heading page-toolbar">
        <div className="page-heading-copy">
          <Typography.Text>
            <Link href="/cohorts">← Quay lại danh sách lớp</Link>
          </Typography.Text>
          <h1>Điểm danh lớp học</h1>
          <p>Chọn đúng buổi học, cập nhật hàng loạt rồi lưu một lần.</p>
        </div>
        <Space wrap>
          <Button
            disabled={!canMutate || items.length === 0}
            onClick={markAllPresent}
          >
            Tất cả có mặt
          </Button>
          <Button
            disabled={!canMutate || markedCount === 0}
            loading={saveMutation.isPending}
            onClick={() => void saveAttendance()}
            type="primary"
          >
            Lưu điểm danh
          </Button>
        </Space>
      </div>

      {readOnly && (
        <Alert
          description="Bạn vẫn xem được sổ điểm danh nhưng không thể thay đổi dữ liệu."
          showIcon
          title="Workspace chỉ đọc"
          type="info"
        />
      )}

      <Card className="surface-card" title="Buổi học">
        {sessionsQuery.isPending ? (
          <Spin />
        ) : sessionsQuery.error ? (
          <Alert
            action={
              <Button onClick={() => void sessionsQuery.refetch()} size="small">
                Thử lại
              </Button>
            }
            showIcon
            title={errorMessage(sessionsQuery.error, "Không tải được lịch học")}
            type="error"
          />
        ) : sessions.length === 0 ? (
          <Empty description="Lớp chưa có buổi học để điểm danh">
            <Link href="/cohorts">Quay lại để thêm lịch học</Link>
          </Empty>
        ) : (
          <Space align="center" wrap>
            <Select
              aria-label="Chọn buổi học"
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
                {sessionStatusPresentation[selectedSession.status].label}
              </Tag>
            )}
          </Space>
        )}
      </Card>

      {selectedSession?.status === "CANCELLED" && (
        <Alert
          description={
            selectedSession.cancellationReason ||
            "Buổi học này đã hủy nên sổ điểm danh chỉ được xem."
          }
          showIcon
          title="Không thể điểm danh buổi đã hủy"
          type="warning"
        />
      )}

      {activeSessionId && (
        <>
          <div className="metric-grid">
            <Card className="metric-card">
              <Statistic title="Sĩ số" value={items.length} />
            </Card>
            <Card className="metric-card">
              <Statistic title="Đã chọn trạng thái" value={markedCount} />
            </Card>
            <Card className="metric-card">
              <Statistic title="Có mặt" value={presentCount} />
            </Card>
            <Card className="metric-card">
              <Statistic title="Vắng" value={absentCount} />
            </Card>
          </div>

          <Card className="surface-card" title="Sổ điểm danh">
            {attendanceQuery.error && !attendanceQuery.data ? (
              <Alert
                action={
                  <Button
                    onClick={() => void attendanceQuery.refetch()}
                    size="small"
                  >
                    Thử lại
                  </Button>
                }
                showIcon
                title={errorMessage(
                  attendanceQuery.error,
                  "Không tải được sổ điểm danh",
                )}
                type="error"
              />
            ) : (
              <Table<AttendanceRosterItem>
                columns={columns}
                dataSource={items}
                loading={attendanceQuery.isPending}
                locale={{ emptyText: "Lớp chưa có học viên" }}
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
