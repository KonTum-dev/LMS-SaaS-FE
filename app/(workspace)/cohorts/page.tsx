"use client";

import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAntdTanStackForm } from "@/components/form/use-antd-tanstack-form";
import { isFormValidationError } from "@/components/form/validation-error";
import { useAuth } from "@/components/providers/app-providers";
import { DataTable } from "@/components/table/data-table";
import {
  cohortApi,
  cohortQueryKeys,
  type ClassSession,
  type Cohort,
  type CohortCourseSummary,
  type CohortEnrollment,
  type CohortPersonSummary,
  type EditableClassSessionStatus,
  type EditableCohortStatus,
} from "@/lib/cohort-api";
import { effectiveModuleEnabled } from "@/lib/entitlements";
import {
  orgUnitQueryKeys,
  orgUnitsApi,
  type OrgUnitTreeNode,
} from "@/lib/org-units-api";
import { getViewerScope } from "@/lib/query-keys";

interface CohortFormValues {
  capacity: number;
  code: string;
  courseId: string;
  endDate?: Dayjs;
  instructorIds: string[];
  name: string;
  orgUnitId?: string;
  startDate?: Dayjs;
  status: EditableCohortStatus;
  timezone: string;
}

interface SessionFormValues {
  endAt: Dayjs;
  location?: string;
  meetingUrl?: string;
  startAt: Dayjs;
  status: EditableClassSessionStatus;
}

const cohortStatuses: Array<{
  color: string;
  label: string;
  value: EditableCohortStatus;
}> = [
  { color: "default", label: "Bản nháp", value: "DRAFT" },
  { color: "blue", label: "Sắp khai giảng", value: "SCHEDULED" },
  { color: "green", label: "Đang học", value: "ACTIVE" },
  { color: "purple", label: "Đã hoàn thành", value: "COMPLETED" },
];

const cohortStatusPresentation = {
  ...Object.fromEntries(
    cohortStatuses.map(({ color, label, value }) => [value, { color, label }]),
  ),
  ARCHIVED: { color: "default", label: "Đã lưu trữ" },
} as Record<Cohort["status"], { color: string; label: string }>;

const sessionStatuses: Array<{
  color: string;
  label: string;
  value: EditableClassSessionStatus;
}> = [
  { color: "blue", label: "Đã xếp lịch", value: "SCHEDULED" },
  { color: "green", label: "Đang diễn ra", value: "IN_PROGRESS" },
  { color: "purple", label: "Đã hoàn thành", value: "COMPLETED" },
];

const sessionStatusPresentation: Record<
  ClassSession["status"],
  { color: string; label: string }
> = {
  CANCELLED: { color: "red", label: "Đã hủy" },
  COMPLETED: { color: "purple", label: "Đã hoàn thành" },
  IN_PROGRESS: { color: "green", label: "Đang diễn ra" },
  SCHEDULED: { color: "blue", label: "Đã xếp lịch" },
};

const timezoneOptions = [
  { label: "Việt Nam · Asia/Ho_Chi_Minh", value: "Asia/Ho_Chi_Minh" },
  { label: "Bangkok · Asia/Bangkok", value: "Asia/Bangkok" },
  { label: "Singapore · Asia/Singapore", value: "Asia/Singapore" },
  { label: "UTC", value: "UTC" },
];

const cohortDefaults: Pick<
  CohortFormValues,
  "capacity" | "instructorIds" | "status" | "timezone"
> = {
  capacity: 30,
  instructorIds: [],
  status: "DRAFT",
  timezone: "Asia/Ho_Chi_Minh",
};

const sessionDefaults: Pick<SessionFormValues, "status"> = {
  status: "SCHEDULED",
};

function idOf(value: string | { _id: string }): string {
  return typeof value === "string" ? value : value._id;
}

function courseTitle(value: Cohort["courseId"]): string {
  return typeof value === "string" ? "Khóa học" : value.title;
}

function personLabel(value: string | CohortPersonSummary): string {
  return typeof value === "string" ? value : value.fullName;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function flattenOrgUnits(
  nodes: readonly OrgUnitTreeNode[],
): OrgUnitTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenOrgUnits(node.children)]);
}

export default function CohortsPage() {
  const { message } = App.useApp();
  const { effectiveAccess, organization, token, user } = useAuth();
  const queryClient = useQueryClient();
  const [cohortForm] = Form.useForm<CohortFormValues>();
  const [sessionForm] = Form.useForm<SessionFormValues>();
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(
    null,
  );
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [cohortOrgUnitId, setCohortOrgUnitId] = useState<
    string | undefined
  >();
  const [orgUnitId, setOrgUnitId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Cohort["status"] | undefined>();
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const roleAllowed =
    user?.role === "TENANT_ADMIN" || user?.role === "INSTRUCTOR";
  const readOnly = effectiveAccess?.readOnly ?? false;
  const canMutate = Boolean(roleAllowed && scope && !readOnly);
  const organizationStructureEnabled = effectiveModuleEnabled(
    effectiveAccess,
    "ORGANIZATION_STRUCTURE",
  );
  const isScopedAdmin =
    user?.role === "TENANT_ADMIN" && user.orgUnitScopeMode === "SCOPED";
  const canMutateRoster = Boolean(
    user?.role === "TENANT_ADMIN" &&
      scope &&
      !readOnly &&
      selectedCohort &&
      selectedCohort?.status !== "ARCHIVED",
  );
  const filters = useMemo(
    () => ({
      ...(orgUnitId ? { orgUnitId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
    }),
    [orgUnitId, search, status],
  );
  const cohortsKey = scope
    ? cohortQueryKeys.list(scope, filters)
    : (["lms", "signed-out", "cohorts", filters] as const);
  const coursesKey = scope
    ? ([...cohortQueryKeys.root(scope), "course-directory"] as const)
    : (["lms", "signed-out", "cohorts", "course-directory"] as const);
  const instructorsKey = scope
    ? ([
        ...cohortQueryKeys.root(scope),
        "instructor-directory",
        cohortOrgUnitId ?? "GLOBAL",
      ] as const)
    : ([
        "lms",
        "signed-out",
        "cohorts",
        "instructor-directory",
        cohortOrgUnitId ?? "GLOBAL",
      ] as const);
  const orgUnitsKey = scope
    ? orgUnitQueryKeys.tree(scope, false)
    : (["lms", "signed-out", "org-units", "tree"] as const);
  const sessionsKey =
    scope && selectedCohort
      ? cohortQueryKeys.sessions(scope, selectedCohort._id)
      : (["lms", "signed-out", "cohorts", "sessions"] as const);
  const selectedCourseId = selectedCohort
    ? idOf(selectedCohort.courseId)
    : "";
  const rosterKey =
    scope && selectedCohort
      ? cohortQueryKeys.learners(scope, selectedCohort._id)
      : (["lms", "signed-out", "cohorts", "learners"] as const);
  const learnerDirectory = useMemo(
    () => ({
      limit: 100,
      page: 1,
      ...(learnerSearch.trim() ? { search: learnerSearch.trim() } : {}),
    }),
    [learnerSearch],
  );
  const courseLearnersKey =
    scope && selectedCohort && selectedCourseId
      ? cohortQueryKeys.courseLearners(
          scope,
          selectedCohort._id,
          selectedCourseId,
          learnerDirectory,
        )
      : (["lms", "signed-out", "cohorts", "course-roster"] as const);

  const cohortsQuery = useQuery({
    enabled: Boolean(token && scope && roleAllowed),
    queryFn: ({ signal }) =>
      cohortApi.listCohorts({ token }, filters, { signal }),
    queryKey: cohortsKey,
  });
  const coursesQuery = useQuery({
    enabled: Boolean(token && scope && roleAllowed),
    queryFn: ({ signal }) => cohortApi.listCourses({ token }, { signal }),
    queryKey: coursesKey,
  });
  const instructorsQuery = useQuery({
    enabled: Boolean(
      token &&
        scope &&
        cohortOpen &&
        user?.role === "TENANT_ADMIN" &&
        (!isScopedAdmin || cohortOrgUnitId),
    ),
    queryFn: ({ signal }) =>
      cohortApi.listEligibleInstructors(
        { token },
        cohortOrgUnitId ? { orgUnitId: cohortOrgUnitId } : {},
        { signal },
      ),
    queryKey: instructorsKey,
  });
  const orgUnitsQuery = useQuery({
    enabled: Boolean(
      token && scope && roleAllowed && organizationStructureEnabled,
    ),
    queryFn: ({ signal }) =>
      orgUnitsApi.tree({ token }, false, { signal }),
    queryKey: orgUnitsKey,
  });
  const sessionsQuery = useQuery({
    enabled: Boolean(token && scope && selectedCohort && scheduleOpen),
    queryFn: ({ signal }) =>
      cohortApi.listSessions(
        { token },
        selectedCohort?._id ?? "",
        {},
        { signal },
      ),
    queryKey: sessionsKey,
  });
  const rosterQuery = useQuery({
    enabled: Boolean(token && scope && selectedCohort && rosterOpen),
    queryFn: ({ signal }) =>
      cohortApi.listLearners(
        { token },
        selectedCohort?._id ?? "",
        { signal },
      ),
    queryKey: rosterKey,
  });
  const courseLearnersQuery = useQuery({
    enabled: Boolean(
      token &&
        scope &&
        rosterOpen &&
        selectedCohort &&
        selectedCourseId &&
        canMutateRoster,
    ),
    queryFn: ({ signal }) =>
      cohortApi.listCourseLearners(
        { token },
        selectedCourseId,
        learnerDirectory,
        { signal },
      ),
    queryKey: courseLearnersKey,
  });

  const cohorts = cohortsQuery.data ?? [];
  const courses = (coursesQuery.data ?? []).filter(
    (course) => course.status !== "ARCHIVED",
  );
  const instructors = instructorsQuery.data?.items ?? [];
  const orgUnits = flattenOrgUnits(orgUnitsQuery.data?.items ?? []);
  const sessions = sessionsQuery.data ?? [];
  const roster = rosterQuery.data ?? [];
  const rosterLearnerIds = new Set(
    roster.map((item) => idOf(item.learnerId)),
  );
  const learnerCandidates = (courseLearnersQuery.data?.items ?? []).filter(
    (item) => !rosterLearnerIds.has(item.userId._id),
  );
  const remainingCapacity = selectedCohort
    ? Math.max(selectedCohort.capacity - roster.length, 0)
    : 0;

  const saveCohortMutation = useMutation({
    mutationFn: async (values: CohortFormValues) => {
      if (!canMutate) {
        throw new Error("Workspace hiện không cho phép thay đổi lớp học");
      }
      const common = {
        capacity: values.capacity,
        code: values.code.trim().toUpperCase(),
        endDate: values.endDate?.endOf("day").toISOString(),
        ...(user?.role === "TENANT_ADMIN"
          ? { instructorIds: values.instructorIds ?? [] }
          : {}),
        name: values.name.trim(),
        orgUnitId: values.orgUnitId || undefined,
        startDate: values.startDate?.startOf("day").toISOString(),
        status: values.status,
        timezone: values.timezone,
      };
      return editingCohort
        ? cohortApi.updateCohort({ token }, editingCohort._id, {
            ...common,
            endDate: common.endDate ?? null,
            orgUnitId: common.orgUnitId ?? null,
            startDate: common.startDate ?? null,
          })
        : cohortApi.createCohort({ token }, {
            ...common,
            courseId: values.courseId,
          });
    },
    onSuccess: async () => {
      message.success(
        editingCohort ? "Đã cập nhật lớp học" : "Đã tạo lớp học",
      );
      setCohortOpen(false);
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: cohortQueryKeys.lists(scope),
        });
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (cohort: Cohort) => {
      if (!canMutate) {
        throw new Error("Workspace hiện không cho phép lưu trữ lớp học");
      }
      return cohortApi.archiveCohort({ token }, cohort._id);
    },
    onSuccess: async () => {
      message.success("Đã lưu trữ lớp học");
      if (scope) {
        await queryClient.invalidateQueries({
          queryKey: cohortQueryKeys.lists(scope),
        });
      }
    },
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (values: SessionFormValues) => {
      if (!canMutate || !selectedCohort) {
        throw new Error("Workspace hiện không cho phép thay đổi lịch học");
      }
      const common = {
        endAt: values.endAt.toISOString(),
        location: values.location?.trim() || undefined,
        meetingUrl: values.meetingUrl?.trim() || undefined,
        startAt: values.startAt.toISOString(),
        status: values.status,
      };
      return editingSession
        ? cohortApi.updateSession(
            { token },
            selectedCohort._id,
            editingSession._id,
            {
              ...common,
              location: common.location ?? null,
              meetingUrl: common.meetingUrl ?? null,
            },
          )
        : cohortApi.createSession(
            { token },
            selectedCohort._id,
            common,
          );
    },
    onSuccess: async () => {
      message.success(
        editingSession ? "Đã cập nhật buổi học" : "Đã thêm buổi học",
      );
      setSessionOpen(false);
      if (scope && selectedCohort) {
        await queryClient.invalidateQueries({
          queryKey: cohortQueryKeys.sessionsRoot(scope, selectedCohort._id),
        });
      }
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (session: ClassSession) => {
      if (!canMutate || !selectedCohort) {
        throw new Error("Workspace hiện không cho phép hủy buổi học");
      }
      return cohortApi.cancelSession(
        { token },
        selectedCohort._id,
        session._id,
      );
    },
    onSuccess: async () => {
      message.success("Đã hủy buổi học");
      if (scope && selectedCohort) {
        await queryClient.invalidateQueries({
          queryKey: cohortQueryKeys.sessionsRoot(scope, selectedCohort._id),
        });
      }
    },
  });

  const addLearnersMutation = useMutation({
    mutationFn: (learnerIds: string[]) => {
      if (!canMutateRoster || !selectedCohort) {
        throw new Error("Chỉ quản trị viên có thể thêm học viên vào lớp");
      }
      return cohortApi.addLearners(
        { token },
        selectedCohort._id,
        learnerIds,
      );
    },
    onSuccess: async (nextRoster) => {
      message.success(`Đã thêm ${selectedLearnerIds.length} học viên vào lớp`);
      setSelectedLearnerIds([]);
      queryClient.setQueryData(rosterKey, nextRoster);
      if (scope && selectedCohort) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: cohortQueryKeys.learnersRoot(
              scope,
              selectedCohort._id,
            ),
          }),
          queryClient.invalidateQueries({
            queryKey: cohortQueryKeys.attendanceRoot(
              scope,
              selectedCohort._id,
            ),
          }),
        ]);
      }
    },
  });

  const removeLearnerMutation = useMutation({
    mutationFn: (learnerId: string) => {
      if (!canMutateRoster || !selectedCohort) {
        throw new Error("Chỉ quản trị viên có thể rút học viên khỏi lớp");
      }
      return cohortApi.removeLearner(
        { token },
        selectedCohort._id,
        learnerId,
      );
    },
    onSuccess: async () => {
      message.success("Đã rút học viên khỏi lớp");
      if (scope && selectedCohort) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: cohortQueryKeys.learnersRoot(
              scope,
              selectedCohort._id,
            ),
          }),
          queryClient.invalidateQueries({
            queryKey: cohortQueryKeys.attendanceRoot(
              scope,
              selectedCohort._id,
            ),
          }),
        ]);
      }
    },
  });

  const tanstackCohortForm = useAntdTanStackForm<CohortFormValues>(
    {
      ...cohortDefaults,
      code: "",
      courseId: "",
      name: "",
    },
    (values) => saveCohortMutation.mutateAsync(values).then(() => undefined),
  );
  const tanstackSessionForm = useAntdTanStackForm<SessionFormValues>(
    {
      ...sessionDefaults,
      endAt: dayjs(),
      startAt: dayjs(),
    },
    (values) => saveSessionMutation.mutateAsync(values).then(() => undefined),
  );

  const showCreateCohort = () => {
    setEditingCohort(null);
    setCohortOrgUnitId(undefined);
    cohortForm.resetFields();
    cohortForm.setFieldsValue(cohortDefaults);
    setCohortOpen(true);
  };

  const showEditCohort = (cohort: Cohort) => {
    setEditingCohort(cohort);
    setCohortOrgUnitId(cohort.orgUnitId);
    cohortForm.resetFields();
    cohortForm.setFieldsValue({
      capacity: cohort.capacity,
      code: cohort.code,
      courseId: idOf(cohort.courseId),
      endDate: cohort.endDate ? dayjs(cohort.endDate) : undefined,
      instructorIds: cohort.instructorIds.map(idOf),
      name: cohort.name,
      orgUnitId: cohort.orgUnitId,
      startDate: cohort.startDate ? dayjs(cohort.startDate) : undefined,
      status:
        cohort.status === "ARCHIVED" ? "COMPLETED" : cohort.status,
      timezone: cohort.timezone,
    });
    setCohortOpen(true);
  };

  const showSchedule = (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setScheduleOpen(true);
  };

  const showRoster = (cohort: Cohort) => {
    setSelectedCohort(cohort);
    setLearnerSearch("");
    setSelectedLearnerIds([]);
    setRosterOpen(true);
  };

  const showCreateSession = () => {
    const startAt = dayjs().add(1, "hour").startOf("hour");
    setEditingSession(null);
    sessionForm.resetFields();
    sessionForm.setFieldsValue({
      ...sessionDefaults,
      endAt: startAt.add(90, "minute"),
      startAt,
    });
    setSessionOpen(true);
  };

  const showEditSession = (session: ClassSession) => {
    setEditingSession(session);
    sessionForm.resetFields();
    sessionForm.setFieldsValue({
      endAt: dayjs(session.endAt),
      location: session.location,
      meetingUrl: session.meetingUrl,
      startAt: dayjs(session.startAt),
      status:
        session.status === "CANCELLED" ? "COMPLETED" : session.status,
    });
    setSessionOpen(true);
  };

  const saveCohort = async () => {
    try {
      await tanstackCohortForm.submit(await cohortForm.validateFields());
    } catch (error) {
      if (!isFormValidationError(error)) {
        message.error(errorMessage(error, "Không thể lưu lớp học"));
      }
    }
  };

  const saveSession = async () => {
    try {
      await tanstackSessionForm.submit(await sessionForm.validateFields());
    } catch (error) {
      if (!isFormValidationError(error)) {
        message.error(errorMessage(error, "Không thể lưu buổi học"));
      }
    }
  };

  const archiveCohort = async (cohort: Cohort) => {
    try {
      await archiveMutation.mutateAsync(cohort);
    } catch (error) {
      message.error(errorMessage(error, "Không thể lưu trữ lớp học"));
    }
  };

  const cancelSession = async (session: ClassSession) => {
    try {
      await cancelSessionMutation.mutateAsync(session);
    } catch (error) {
      message.error(errorMessage(error, "Không thể hủy buổi học"));
    }
  };

  const addLearners = async () => {
    if (selectedLearnerIds.length === 0) return;
    try {
      await addLearnersMutation.mutateAsync(selectedLearnerIds);
    } catch (error) {
      message.error(errorMessage(error, "Không thể thêm học viên vào lớp"));
    }
  };

  const removeLearner = async (enrollment: CohortEnrollment) => {
    try {
      await removeLearnerMutation.mutateAsync(idOf(enrollment.learnerId));
    } catch (error) {
      message.error(errorMessage(error, "Không thể rút học viên khỏi lớp"));
    }
  };

  const cohortColumns: ColumnDef<StockFeatures, Cohort>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{row.original.name}</strong>
          <Typography.Text className="table-muted" copyable>
            {row.original.code}
          </Typography.Text>
        </div>
      ),
      header: "Lớp học",
    },
    {
      accessorKey: "courseId",
      cell: ({ row }) => courseTitle(row.original.courseId),
      header: "Khóa học",
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "instructorIds",
      cell: ({ row }) =>
        row.original.instructorIds.length > 0
          ? row.original.instructorIds.map(personLabel).join(", ")
          : "Chưa phân công",
      header: "Giảng viên",
      meta: { responsive: ["lg"] },
    },
    ...(organizationStructureEnabled
      ? [
          {
            accessorKey: "orgUnitId",
            cell: ({ row }) =>
              row.original.orgUnitId
                ? (orgUnits.find(
                    (unit) => unit._id === row.original.orgUnitId,
                  )?.name ?? "Đơn vị đã chọn")
                : "Toàn trung tâm",
            header: "Chi nhánh",
            meta: { responsive: ["lg"] },
          } satisfies ColumnDef<StockFeatures, Cohort>,
        ]
      : []),
    {
      accessorKey: "startDate",
      cell: ({ row }) =>
        row.original.startDate
          ? `${dayjs(row.original.startDate).format("DD/MM/YYYY")} – ${
              row.original.endDate
                ? dayjs(row.original.endDate).format("DD/MM/YYYY")
                : "chưa chốt"
            }`
          : "Chưa chốt lịch",
      header: "Thời gian",
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<Cohort["status"]>();
        const presentation = cohortStatusPresentation[value];
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
      header: "Trạng thái",
      meta: { width: 145 },
    },
    {
      cell: ({ row }) => (
        <div
          aria-label={`Thao tác với lớp ${row.original.name}`}
          className="table-row-actions"
          role="group"
        >
          <Button
            aria-label={`Học viên lớp ${row.original.name}`}
            icon={<TeamOutlined />}
            onClick={() => showRoster(row.original)}
            size="small"
            title="Học viên"
            type="text"
          />
          <Button
            aria-label={`Lịch học ${row.original.name}`}
            icon={<CalendarOutlined />}
            onClick={() => showSchedule(row.original)}
            size="small"
            title="Lịch học"
            type="text"
          />
          <Link href={`/cohorts/${row.original._id}/attendance`}>
            <Button
              aria-label={`Điểm danh lớp ${row.original.name}`}
              icon={<UsergroupAddOutlined />}
              size="small"
              title="Điểm danh"
              type="text"
            />
          </Link>
          {canMutate && (
            <>
              <Button
                aria-label={`Chỉnh sửa lớp ${row.original.name}`}
                icon={<EditOutlined />}
                onClick={() => showEditCohort(row.original)}
                size="small"
                title="Chỉnh sửa lớp"
                type="text"
              />
              <Popconfirm
                cancelText="Không"
                okText="Lưu trữ"
                onConfirm={() => void archiveCohort(row.original)}
                title="Lưu trữ lớp học này?"
              >
                <Button
                  aria-label={`Lưu trữ lớp ${row.original.name}`}
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  title="Lưu trữ lớp"
                  type="text"
                />
              </Popconfirm>
            </>
          )}
        </div>
      ),
      header: "",
      id: "actions",
      meta: { width: 220 },
    },
  ];

  const sessionColumns: ColumnDef<StockFeatures, ClassSession>[] = [
    {
      accessorKey: "startAt",
      cell: ({ row }) => (
        <div className="table-primary-cell">
          <strong>{dayjs(row.original.startAt).format("DD/MM/YYYY")}</strong>
          <span className="table-muted">
            {dayjs(row.original.startAt).format("HH:mm")} – {" "}
            {dayjs(row.original.endAt).format("HH:mm")}
          </span>
        </div>
      ),
      header: "Buổi học",
    },
    {
      accessorKey: "location",
      cell: ({ row }) =>
        row.original.location || row.original.meetingUrl || "Chưa có địa điểm",
      header: "Địa điểm / liên kết",
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<ClassSession["status"]>();
        const presentation = sessionStatusPresentation[value];
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
      header: "Trạng thái",
      meta: { width: 140 },
    },
    ...(canMutate
      ? [
          {
            cell: ({ row }) =>
              row.original.status === "CANCELLED" ? null : (
                <Space size="small">
                  <Button
                    aria-label="Chỉnh sửa buổi học"
                    icon={<EditOutlined />}
                    onClick={() => showEditSession(row.original)}
                    size="small"
                    type="text"
                  />
                  <Popconfirm
                    cancelText="Không"
                    okText="Hủy buổi"
                    onConfirm={() => void cancelSession(row.original)}
                    title="Hủy buổi học này?"
                  >
                    <Button danger size="small" type="text">
                      Hủy buổi
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            header: "",
            id: "actions",
            meta: { width: 150 },
          } satisfies ColumnDef<StockFeatures, ClassSession>,
        ]
      : []),
  ];

  if (!roleAllowed) {
    return (
      <Alert
        showIcon
        title="Chỉ quản trị viên và giảng viên được quản lý lớp học."
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
          <h1>Lớp học</h1>
          <p>
            Vận hành từng lớp đang chạy, lịch các buổi học và điểm danh học
            viên.
          </p>
        </div>
        <Button
          disabled={!canMutate}
          icon={<PlusOutlined />}
          onClick={showCreateCohort}
          type="primary"
        >
          Tạo lớp học
        </Button>
      </div>

      {readOnly && (
        <Alert
          description="Bạn vẫn xem được lớp và lịch; thao tác tạo, sửa, hủy và lưu trữ đang tạm khóa."
          showIcon
          title="Workspace chỉ đọc"
          type="info"
        />
      )}

      {organizationStructureEnabled && orgUnitsQuery.error && (
        <Alert
          description="Bạn vẫn có thể quản lý lớp không gắn chi nhánh."
          showIcon
          title={errorMessage(
            orgUnitsQuery.error,
            "Không tải được danh sách chi nhánh",
          )}
          type="warning"
        />
      )}

      <Card className="surface-card">
        <Space wrap style={{ marginBottom: 18 }}>
          <Input.Search
            allowClear
            aria-label="Tìm lớp học"
            onSearch={setSearch}
            placeholder="Tìm theo tên hoặc mã lớp"
            style={{ width: 280 }}
          />
          {organizationStructureEnabled && (
            <Select
              allowClear
              aria-label="Lọc theo chi nhánh"
              loading={orgUnitsQuery.isFetching}
              onChange={setOrgUnitId}
              options={orgUnits.map((unit) => ({
                label: `${"— ".repeat(unit.depth)}${unit.name}`,
                value: unit._id,
              }))}
              placeholder="Tất cả chi nhánh"
              style={{ width: 210 }}
              value={orgUnitId}
            />
          )}
          <Select
            allowClear
            aria-label="Lọc trạng thái lớp"
            onChange={setStatus}
            options={[
              ...cohortStatuses,
              { label: "Đã lưu trữ", value: "ARCHIVED" as const },
            ]}
            placeholder="Tất cả trạng thái"
            style={{ width: 190 }}
            value={status}
          />
        </Space>
        {cohortsQuery.error && !cohortsQuery.data ? (
          <Alert
            action={
              <Button onClick={() => void cohortsQuery.refetch()} size="small">
                Thử lại
              </Button>
            }
            showIcon
            title={errorMessage(cohortsQuery.error, "Không tải được lớp học")}
            type="error"
          />
        ) : (
          <DataTable
            ariaLabel="Danh sách lớp học"
            columns={cohortColumns}
            data={cohorts}
            emptyText={
              <Empty description="Chưa có lớp học">
                <Button
                  disabled={!canMutate}
                  onClick={showCreateCohort}
                  type="primary"
                >
                  Tạo lớp đầu tiên
                </Button>
              </Empty>
            }
            loading={cohortsQuery.isPending}
            rowKey="_id"
            scrollX={920}
          />
        )}
      </Card>

      <Modal
        cancelText="Hủy"
        confirmLoading={saveCohortMutation.isPending}
        onCancel={() => setCohortOpen(false)}
        onOk={() => void saveCohort()}
        okButtonProps={{ disabled: !canMutate }}
        okText={editingCohort ? "Lưu thay đổi" : "Tạo lớp học"}
        open={cohortOpen}
        title={editingCohort ? "Chỉnh sửa lớp học" : "Tạo lớp học"}
        width={720}
      >
        <Form
          form={cohortForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Khóa học"
            name="courseId"
            rules={[{ message: "Chọn khóa học", required: true }]}
          >
            <Select
              disabled={Boolean(editingCohort)}
              loading={coursesQuery.isFetching}
              options={courses.map((course: CohortCourseSummary) => ({
                label: course.title,
                value: course._id,
              }))}
              placeholder="Chọn khóa học nền"
              showSearch
            />
          </Form.Item>
          <Space align="start" size="middle" style={{ width: "100%" }}>
            <Form.Item
              label="Mã lớp"
              name="code"
              rules={[
                { message: "Nhập mã lớp", min: 2, required: true },
                {
                  message: "Chỉ dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới",
                  pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
                },
              ]}
            >
              <Input placeholder="IELTS-2026-09" />
            </Form.Item>
            <Form.Item
              label="Sức chứa"
              name="capacity"
              rules={[{ message: "Từ 1 đến 10.000", required: true }]}
            >
              <InputNumber max={10_000} min={1} />
            </Form.Item>
          </Space>
          <Form.Item
            label="Tên lớp"
            name="name"
            rules={[{ message: "Nhập tên lớp", min: 2, required: true }]}
          >
            <Input placeholder="IELTS buổi tối K09" />
          </Form.Item>
          {organizationStructureEnabled && (
            <Form.Item
              extra={
                isScopedAdmin
                  ? "Chọn một đơn vị trong phạm vi bạn quản lý."
                  : "Để trống nếu lớp dùng chung cho toàn trung tâm."
              }
              label="Chi nhánh / đơn vị vận hành"
              name="orgUnitId"
              rules={
                isScopedAdmin
                  ? [
                      {
                        message: "Chọn chi nhánh hoặc đơn vị vận hành lớp",
                        required: true,
                      },
                    ]
                  : undefined
              }
            >
              <Select
                allowClear
                aria-label="Chọn chi nhánh cho lớp"
                loading={orgUnitsQuery.isFetching}
                onChange={(value: unknown) => {
                  const nextOrgUnitId =
                    typeof value === "string"
                      ? value || undefined
                      : value &&
                          typeof value === "object" &&
                          "currentTarget" in value
                        ? String(
                            (value as { currentTarget: { value?: string } })
                              .currentTarget.value ?? "",
                          ) || undefined
                        : undefined;
                  setCohortOrgUnitId(nextOrgUnitId);
                  cohortForm.setFieldsValue({ instructorIds: [] });
                }}
                options={orgUnits.map((unit) => ({
                  label: `${"— ".repeat(unit.depth)}${unit.name}`,
                  value: unit._id,
                }))}
                placeholder="Toàn trung tâm"
                showSearch
              />
            </Form.Item>
          )}
          <Space align="start" size="middle" style={{ width: "100%" }}>
            <Form.Item label="Ngày bắt đầu" name="startDate">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item label="Ngày kết thúc" name="endDate">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item label="Múi giờ" name="timezone">
            <Select options={timezoneOptions} showSearch />
          </Form.Item>
          <Form.Item label="Trạng thái" name="status">
            <Select options={cohortStatuses} />
          </Form.Item>
          {user?.role === "TENANT_ADMIN" && (
            <Form.Item label="Giảng viên phụ trách" name="instructorIds">
              <Select
                aria-label="Chọn giảng viên phụ trách"
                disabled={isScopedAdmin && !cohortOrgUnitId}
                loading={instructorsQuery.isFetching}
                mode="multiple"
                notFoundContent={
                  isScopedAdmin && !cohortOrgUnitId
                    ? "Chọn chi nhánh trước"
                    : undefined
                }
                options={instructors.map((instructor) => ({
                  label: `${instructor.fullName} · ${instructor.email}`,
                  value: instructor.userId,
                }))}
                placeholder="Có thể phân công nhiều giảng viên"
                showSearch
              />
            </Form.Item>
          )}
          {user?.role === "TENANT_ADMIN" && instructorsQuery.error && (
            <Alert
              showIcon
              title={errorMessage(
                instructorsQuery.error,
                "Không tải được giảng viên phù hợp với chi nhánh",
              )}
              type="warning"
            />
          )}
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setRosterOpen(false)}
        open={rosterOpen}
        title={`Học viên · ${selectedCohort?.name ?? ""}`}
        width={720}
      >
        <div style={{ marginTop: 20 }}>
          {user?.role === "INSTRUCTOR" && (
            <Alert
              description="Giảng viên có thể xem danh sách lớp; việc thêm hoặc rút học viên do quản trị viên thực hiện."
              showIcon
              title="Danh sách chỉ đọc"
              type="info"
            />
          )}
          {readOnly && user?.role === "TENANT_ADMIN" && (
            <Alert
              description="Bạn vẫn xem được danh sách nhưng không thể thêm hoặc rút học viên."
              showIcon
              title="Workspace chỉ đọc"
              type="info"
            />
          )}
          {selectedCohort?.status === "ARCHIVED" && (
            <Alert
              description="Lớp đã lưu trữ nên danh sách học viên chỉ được xem."
              showIcon
              title="Lớp đã lưu trữ"
              type="info"
            />
          )}

          {canMutateRoster && (
            <div style={{ marginTop: 18 }}>
              <Typography.Paragraph type="secondary">
                Nguồn chọn là học viên đang được ghi danh hợp lệ trong khóa học
                nền của lớp.
              </Typography.Paragraph>
              {courseLearnersQuery.error && (
                <Alert
                  action={
                    <Button
                      onClick={() => void courseLearnersQuery.refetch()}
                      size="small"
                    >
                      Thử lại
                    </Button>
                  }
                  showIcon
                  title={errorMessage(
                    courseLearnersQuery.error,
                    "Không tải được học viên khả dụng",
                  )}
                  type="warning"
                />
              )}
              <Space.Compact block>
                <Select<string[]>
                  aria-label="Chọn học viên thêm vào lớp"
                  disabled={
                    addLearnersMutation.isPending || remainingCapacity === 0
                  }
                  filterOption={false}
                  loading={courseLearnersQuery.isFetching}
                  mode="multiple"
                  onChange={setSelectedLearnerIds}
                  onSearch={setLearnerSearch}
                  options={learnerCandidates.map((item) => ({
                    label: `${item.userId.fullName} · ${item.userId.email}`,
                    value: item.userId._id,
                  }))}
                  placeholder={
                    remainingCapacity === 0
                      ? "Lớp đã đủ sức chứa"
                      : "Tìm và chọn nhiều học viên"
                  }
                  showSearch
                  style={{ width: "100%" }}
                  value={selectedLearnerIds}
                />
                <Button
                  disabled={
                    selectedLearnerIds.length === 0 ||
                    selectedLearnerIds.length > remainingCapacity
                  }
                  loading={addLearnersMutation.isPending}
                  onClick={() => void addLearners()}
                  type="primary"
                >
                  Thêm vào lớp
                </Button>
              </Space.Compact>
              {selectedLearnerIds.length > remainingCapacity && (
                <Typography.Text type="danger">
                  Chỉ còn {remainingCapacity} chỗ trong lớp.
                </Typography.Text>
              )}
              {(courseLearnersQuery.data?.total ?? 0) > 100 && (
                <Typography.Text type="secondary">
                  Hiển thị tối đa 100 kết quả; nhập tên hoặc email để tìm chính
                  xác hơn.
                </Typography.Text>
              )}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <strong>
              Danh sách lớp ({roster.length}/{selectedCohort?.capacity ?? 0})
            </strong>
            {rosterQuery.error && !rosterQuery.data ? (
              <Alert
                action={
                  <Button onClick={() => void rosterQuery.refetch()} size="small">
                    Thử lại
                  </Button>
                }
                showIcon
                title={errorMessage(
                  rosterQuery.error,
                  "Không tải được danh sách học viên",
                )}
                type="error"
              />
            ) : rosterQuery.isPending ? (
              <div
                style={{ display: "grid", minHeight: 160, placeItems: "center" }}
              >
                <Spin />
              </div>
            ) : roster.length > 0 ? (
              roster.map((enrollment) => (
                <div
                  key={enrollment._id}
                  style={{
                    alignItems: "center",
                    borderBottom: "1px solid #eee",
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                  }}
                >
                  <span>
                    {personLabel(enrollment.learnerId)}
                    {typeof enrollment.learnerId !== "string" && (
                      <small
                        className="table-muted"
                        style={{ display: "block" }}
                      >
                        {enrollment.learnerId.email}
                      </small>
                    )}
                  </span>
                  {canMutateRoster ? (
                    <Popconfirm
                      cancelText="Không"
                      okText="Rút"
                      onConfirm={() => void removeLearner(enrollment)}
                      title="Rút học viên khỏi lớp này?"
                    >
                      <Button
                        danger
                        disabled={removeLearnerMutation.isPending}
                        size="small"
                        type="text"
                      >
                        Rút
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Tag color="green">Đang học</Tag>
                  )}
                </div>
              ))
            ) : (
              <Empty
                description="Lớp chưa có học viên"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </div>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setScheduleOpen(false)}
        open={scheduleOpen}
        title={`Lịch học · ${selectedCohort?.name ?? ""}`}
        width={920}
      >
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 16,
            }}
          >
            <Button
              disabled={!canMutate}
              icon={<PlusOutlined />}
              onClick={showCreateSession}
              type="primary"
            >
              Thêm buổi học
            </Button>
          </div>
          {sessionsQuery.error && !sessionsQuery.data ? (
            <Alert
              action={
                <Button onClick={() => void sessionsQuery.refetch()}>
                  Thử lại
                </Button>
              }
              showIcon
              title={errorMessage(
                sessionsQuery.error,
                "Không tải được lịch học",
              )}
              type="error"
            />
          ) : sessionsQuery.isPending ? (
            <div style={{ display: "grid", minHeight: 180, placeItems: "center" }}>
              <Spin />
            </div>
          ) : (
            <DataTable
              ariaLabel="Lịch các buổi học"
              columns={sessionColumns}
              data={sessions}
              emptyText="Chưa có buổi học"
              rowKey="_id"
              scrollX={680}
            />
          )}
        </div>
      </Modal>

      <Modal
        cancelText="Hủy"
        confirmLoading={saveSessionMutation.isPending}
        onCancel={() => setSessionOpen(false)}
        onOk={() => void saveSession()}
        okButtonProps={{ disabled: !canMutate }}
        okText={editingSession ? "Lưu thay đổi" : "Thêm buổi học"}
        open={sessionOpen}
        title={editingSession ? "Chỉnh sửa buổi học" : "Thêm buổi học"}
      >
        <Form
          form={sessionForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label="Bắt đầu"
            name="startAt"
            rules={[{ message: "Chọn thời điểm bắt đầu", required: true }]}
          >
            <DatePicker format="DD/MM/YYYY HH:mm" showTime />
          </Form.Item>
          <Form.Item
            dependencies={["startAt"]}
            label="Kết thúc"
            name="endAt"
            rules={[
              { message: "Chọn thời điểm kết thúc", required: true },
              ({ getFieldValue }) => ({
                validator: (_, value: Dayjs | undefined) =>
                  !value || value.isAfter(getFieldValue("startAt") as Dayjs)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error("Kết thúc phải sau thời điểm bắt đầu"),
                      ),
              }),
            ]}
          >
            <DatePicker format="DD/MM/YYYY HH:mm" showTime />
          </Form.Item>
          <Form.Item label="Trạng thái" name="status">
            <Select options={sessionStatuses} />
          </Form.Item>
          <Form.Item label="Địa điểm" name="location">
            <Input maxLength={300} placeholder="Phòng 201" />
          </Form.Item>
          <Form.Item
            label="Liên kết học trực tuyến"
            name="meetingUrl"
            rules={[{ message: "Nhập URL http(s) hợp lệ", type: "url" }]}
          >
            <Input maxLength={2_048} placeholder="https://meet.example.com/..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
