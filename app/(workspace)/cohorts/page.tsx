"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { formatDate as formatUiDate } from "@/lib/i18n/translate";
import { learningPolishMessages as learningMessages } from "@/lib/i18n/learning-polish-messages";
import polish from "@/components/layout/learning-polish.module.css";

import { useFeedback } from "@/components/feedback/feedback-provider";

import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, StockFeatures } from "@tanstack/react-table";
import { Alert, Button, Card, DatePicker, Empty, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import { Form } from "@/components/form/localized-form";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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

interface DirectoryOption { label: string; value: string }

function mergeDirectoryOptions(selected: DirectoryOption[], current: DirectoryOption[]) {
  return [...new Map([...selected, ...current].map(option => [option.value, option])).values()];
}

function flattenOrgUnits(
  nodes: readonly OrgUnitTreeNode[],
): OrgUnitTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenOrgUnits(node.children)]);
}

export default function CohortsPage() {
  const { t, locale } = useI18n(learningMessages);
  const { message, reportError, formatError } = useFeedback();
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
  const [instructorSearch, setInstructorSearch] = useState("");
  const [selectedInstructorOptions, setSelectedInstructorOptions] = useState<DirectoryOption[]>([]);
  const [selectedLearnerOptions, setSelectedLearnerOptions] = useState<DirectoryOption[]>([]);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [cohortOrgUnitId, setCohortOrgUnitId] = useState<
    string | undefined
  >();
  const [orgUnitId, setOrgUnitId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<Cohort["status"] | undefined>();
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const actionRequests = useRef(new Map<string, Promise<void>>());
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(new Set());
  const actionKey = (action: string, id = "") => JSON.stringify([scope, action, id]);
  const runAction = (key: string, action: () => Promise<void>) => {
    const existing = actionRequests.current.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(action).finally(() => {
      actionRequests.current.delete(key);
      setPendingActions(current => { const next = new Set(current); next.delete(key); return next; });
    });
    actionRequests.current.set(key, request);
    setPendingActions(current => new Set(current).add(key));
    return request;
  };
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
      "paged",
      instructorSearch.trim(),
    ] as const)
    : ([
      "lms",
      "signed-out",
      "cohorts",
      "instructor-directory",
      cohortOrgUnitId ?? "GLOBAL",
      "paged",
      instructorSearch.trim(),
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
      limit: 20,
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
  const instructorsQuery = useInfiniteQuery({
    initialPageParam: 1,
    enabled: Boolean(
      token &&
      scope &&
      cohortOpen &&
      user?.role === "TENANT_ADMIN" &&
      (!isScopedAdmin || cohortOrgUnitId),
    ),
    queryFn: ({ signal, pageParam }) =>
      cohortApi.listEligibleInstructors(
        { token },
        { limit: 20, page: pageParam, ...(cohortOrgUnitId ? { orgUnitId: cohortOrgUnitId } : {}), ...(instructorSearch.trim() ? { search: instructorSearch.trim() } : {}) },
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
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
  const courseLearnersQuery = useInfiniteQuery({
    initialPageParam: 1,
    enabled: Boolean(
      token &&
      scope &&
      rosterOpen &&
      selectedCohort &&
      selectedCourseId &&
      canMutateRoster,
    ),
    queryFn: ({ signal, pageParam }) =>
      cohortApi.listCourseLearners(
        { token },
        selectedCourseId,
        { ...learnerDirectory, page: pageParam },
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    queryKey: [...courseLearnersKey, "paged"],
  });

  const cohorts = cohortsQuery.data ?? [];
  const courses = (coursesQuery.data ?? []).filter(
    (course) => course.status !== "ARCHIVED",
  );
  const instructors = instructorsQuery.data?.pages.flatMap(page => page.items) ?? [];
  const instructorOptions = mergeDirectoryOptions(selectedInstructorOptions, instructors.map(instructor => ({
    label: `${instructor.fullName} · ${instructor.email}`, value: instructor.userId,
  })));
  const orgUnits = flattenOrgUnits(orgUnitsQuery.data?.items ?? []);
  const sessions = sessionsQuery.data ?? [];
  const roster = rosterQuery.data ?? [];
  const rosterLearnerIds = new Set(
    roster.map((item) => idOf(item.learnerId)),
  );
  const loadedLearners = courseLearnersQuery.data?.pages.flatMap(page => page.items) ?? [];
  const learnerCandidates = loadedLearners.filter(
    (item) => !rosterLearnerIds.has(item.userId._id),
  );
  const learnerOptions = mergeDirectoryOptions(selectedLearnerOptions.filter(option => !rosterLearnerIds.has(option.value)), learnerCandidates.map(item => ({
    label: `${item.userId.fullName} · ${item.userId.email}`, value: item.userId._id,
  })));
  const remainingCapacity = selectedCohort
    ? Math.max(selectedCohort.capacity - roster.length, 0)
    : 0;

  const saveCohortMutation = useMutation({
    mutationFn: async (values: CohortFormValues) => {
      if (!canMutate) {
        throw new Error(t("Workspace hiện không cho phép thay đổi lớp học"));
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
        throw new Error(t("Workspace hiện không cho phép lưu trữ lớp học"));
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
        throw new Error(t("Workspace hiện không cho phép thay đổi lịch học"));
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
        throw new Error(t("Workspace hiện không cho phép hủy buổi học"));
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
        throw new Error(t("Chỉ quản trị viên có thể thêm học viên vào lớp"));
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
      setSelectedLearnerOptions([]);
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
        throw new Error(t("Chỉ quản trị viên có thể rút học viên khỏi lớp"));
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
    setInstructorSearch("");
    setSelectedInstructorOptions([]);
    setEditingCohort(null);
    setCohortOrgUnitId(undefined);
    cohortForm.resetFields();
    cohortForm.setFieldsValue(cohortDefaults);
    setCohortOpen(true);
  };

  const showEditCohort = (cohort: Cohort) => {
    setInstructorSearch("");
    setSelectedInstructorOptions(cohort.instructorIds.map(instructor => ({
      label: typeof instructor === "string" ? instructor : `${instructor.fullName} · ${instructor.email}`,
      value: idOf(instructor),
    })));
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
    setSelectedLearnerOptions([]);
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

  const saveCohort = () => runAction(actionKey("save-cohort"), async () => {
    try {
      await tanstackCohortForm.submit(await cohortForm.validateFields());
    } catch (error) {
      if (!isFormValidationError(error)) {
        reportError(error, "Không thể lưu lớp học");
      }
    }
  });

  const saveSession = () => runAction(actionKey("save-session"), async () => {
    try {
      await tanstackSessionForm.submit(await sessionForm.validateFields());
    } catch (error) {
      if (!isFormValidationError(error)) {
        reportError(error, "Không thể lưu buổi học");
      }
    }
  });

  const archiveCohort = (cohort: Cohort) => runAction(actionKey("archive", cohort._id), async () => {
    try {
      await archiveMutation.mutateAsync(cohort);
    } catch (error) {
      reportError(error, "Không thể lưu trữ lớp học");
    }
  });

  const cancelSession = (session: ClassSession) => runAction(actionKey("cancel", session._id), async () => {
    try {
      await cancelSessionMutation.mutateAsync(session);
    } catch (error) {
      reportError(error, "Không thể hủy buổi học");
    }
  });

  const addLearners = () => runAction(actionKey("add-learners", selectedCohort?._id), async () => {
    if (selectedLearnerIds.length === 0) return;
    try {
      await addLearnersMutation.mutateAsync(selectedLearnerIds);
    } catch (error) {
      reportError(error, "Không thể thêm học viên vào lớp");
    }
  });

  const removeLearner = (enrollment: CohortEnrollment) => runAction(actionKey("remove", enrollment._id), async () => {
    try {
      await removeLearnerMutation.mutateAsync(idOf(enrollment.learnerId));
    } catch (error) {
      reportError(error, "Không thể rút học viên khỏi lớp");
    }
  });

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
      header: t("Lớp học"),
    },
    {
      accessorKey: "courseId",
      cell: ({ row }) => courseTitle(row.original.courseId),
      header: t("Khóa học"),
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "instructorIds",
      cell: ({ row }) =>
        row.original.instructorIds.length > 0
          ? row.original.instructorIds.map(personLabel).join(", ")
          : t("Chưa phân công"),
      header: t("Giảng viên"),
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
              )?.name ?? t("Đơn vị đã chọn"))
              : t("Toàn trung tâm"),
          header: t("Chi nhánh"),
          meta: { responsive: ["lg"] },
        } satisfies ColumnDef<StockFeatures, Cohort>,
      ]
      : []),
    {
      accessorKey: "startDate",
      cell: ({ row }) =>
        row.original.startDate
          ? `${formatUiDate(row.original.startDate, locale, { day: "2-digit", month: "2-digit", year: "numeric" })} – ${row.original.endDate
            ? formatUiDate(row.original.endDate, locale, { day: "2-digit", month: "2-digit", year: "numeric" })
            : t("chưa chốt")
          }`
          : t("Chưa chốt lịch"),
      header: t("Thời gian"),
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<Cohort["status"]>();
        const presentation = cohortStatusPresentation[value];
        return <Tag color={presentation.color}>{t(presentation.label)}</Tag>;
      },
      header: t("Trạng thái"),
      meta: { width: 145 },
    },
    {
      cell: ({ row }) => (
        <div
          aria-label={t("Thao tác với lớp {p0}", { p0: row.original.name })}
          className="table-row-actions"
          role="group"
        >
          <Button
            aria-label={t("Học viên lớp {p0}", { p0: row.original.name })}
            icon={<TeamOutlined />}
            onClick={() => showRoster(row.original)}
            size="small"
            title={t("Học viên")}
            type="text"
          />
          <Button
            aria-label={t("Lịch học {p0}", { p0: row.original.name })}
            icon={<CalendarOutlined />}
            onClick={() => showSchedule(row.original)}
            size="small"
            title={t("Lịch học")}
            type="text"
          />
          <Link href={`/cohorts/${row.original._id}/attendance`}>
            <Button
              aria-label={t("Điểm danh lớp {p0}", { p0: row.original.name })}
              icon={<UsergroupAddOutlined />}
              size="small"
              title={t("Điểm danh")}
              type="text"
            />
          </Link>
          {canMutate && (
            <>
              <Button
                aria-label={t("Chỉnh sửa lớp {p0}", { p0: row.original.name })}
                icon={<EditOutlined />}
                onClick={() => showEditCohort(row.original)}
                size="small"
                title={t("Chỉnh sửa lớp")}
                type="text"
              />
              <Popconfirm
                cancelText={t("Không")}
                okText={t("Lưu trữ")}
                onConfirm={() => archiveCohort(row.original)}
                okButtonProps={{ loading: pendingActions.has(actionKey("archive", row.original._id)) }}
                title={t("Lưu trữ lớp học này?")}
              >
                <Button
                  aria-label={t("Lưu trữ lớp {p0}", { p0: row.original.name })}
                  danger
                  loading={pendingActions.has(actionKey("archive", row.original._id))}
                  icon={<DeleteOutlined />}
                  size="small"
                  title={t("Lưu trữ lớp")}
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
          <strong>{formatUiDate(row.original.startAt, locale, { day: "2-digit", month: "2-digit", year: "numeric" })}</strong>
          <span className="table-muted">
            {formatUiDate(row.original.startAt, locale, { hour: "2-digit", minute: "2-digit" })} – {" "}
            {formatUiDate(row.original.endAt, locale, { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ),
      header: t("Buổi học"),
    },
    {
      accessorKey: "location",
      cell: ({ row }) =>
        row.original.location || row.original.meetingUrl || t("Chưa có địa điểm"),
      header: t("Địa điểm / liên kết"),
      meta: { responsive: ["md"] },
    },
    {
      accessorKey: "status",
      cell: ({ getValue }) => {
        const value = getValue<ClassSession["status"]>();
        const presentation = sessionStatusPresentation[value];
        return <Tag color={presentation.color}>{t(presentation.label)}</Tag>;
      },
      header: t("Trạng thái"),
      meta: { width: 140 },
    },
    ...(canMutate
      ? [
        {
          cell: ({ row }) =>
            row.original.status === "CANCELLED" ? null : (
              <Space size="small">
                <Button
                  aria-label={t("Chỉnh sửa buổi học")}
                  icon={<EditOutlined />}
                  onClick={() => showEditSession(row.original)}
                  size="small"
                  type="text"
                />
                <Popconfirm
                  cancelText={t("Không")}
                  okText={t("Hủy buổi")}
                  onConfirm={() => cancelSession(row.original)}
                  okButtonProps={{ loading: pendingActions.has(actionKey("cancel", row.original._id)) }}
                  title={t("Hủy buổi học này?")}
                >
                  <Button danger loading={pendingActions.has(actionKey("cancel", row.original._id))} size="small" type="text">{t("Hủy buổi")}</Button>
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
        title={t("Chỉ quản trị viên và giảng viên được quản lý lớp học.")}
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
          <h1>{t("Lớp học")}</h1>
          <p>{t("Vận hành từng lớp đang chạy, lịch các buổi học và điểm danh học viên.")}</p>
        </div>
        <Button
          disabled={!canMutate}
          icon={<PlusOutlined />}
          onClick={showCreateCohort}
          type="primary"
        >{t("Tạo lớp học")}</Button>
      </div>

      {readOnly && (
        <Alert
          description={t("Bạn vẫn xem được lớp và lịch; thao tác tạo, sửa, hủy và lưu trữ đang tạm khóa.")}
          showIcon
          title={t("Workspace chỉ đọc")}
          type="info"
        />
      )}

      {organizationStructureEnabled && orgUnitsQuery.error && (
        <Alert
          description={t("Bạn vẫn có thể quản lý lớp không gắn chi nhánh.")}
          showIcon
          title={formatError(
            orgUnitsQuery.error,
            t("Không tải được danh sách chi nhánh"),
          )}
          type="warning"
        />
      )}

      <Card className="surface-card">
        <div className="list-filter-bar" role="search" aria-label={t("Bộ lọc lớp học")}>
          <Input.Search
            allowClear
            aria-label={t("Tìm lớp học")}
            maxLength={100}
            enterButton={t("Tìm kiếm")}
            onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) setSearch(""); }}
            onSearch={(value) => { const next = value.trim(); setSearchInput(next); setSearch(next); }}
            placeholder={t("Tìm theo tên hoặc mã lớp")}
            style={{ width: 280 }}
            value={searchInput}
          />
          {organizationStructureEnabled && (
            <Select
              allowClear
              aria-label={t("Lọc theo chi nhánh")}
              loading={orgUnitsQuery.isFetching}
              onChange={setOrgUnitId}
              options={orgUnits.map((unit) => ({
                label: `${"— ".repeat(unit.depth)}${unit.name}`,
                value: unit._id,
              }))}
              placeholder={t("Tất cả chi nhánh")}
              style={{ width: 210 }}
              value={orgUnitId}
            />
          )}
          <Select
            allowClear
            aria-label={t("Lọc trạng thái lớp")}
            onChange={(value: Cohort["status"] | "") => setStatus(value || undefined)}
            options={[
              { label: t("Chưa lưu trữ"), value: "" },
              ...cohortStatuses.map(option => ({ ...option, label: t(option.label) })),
              { label: t("Đã lưu trữ"), value: "ARCHIVED" as const },
            ]}
            placeholder={t("Chưa lưu trữ")}
            style={{ width: 190 }}
            value={status ?? ""}
          />
          <Button disabled={!searchInput && !search && !orgUnitId && !status} onClick={() => { setSearchInput(""); setSearch(""); setOrgUnitId(undefined); setStatus(undefined); }}>
            {t("Xóa bộ lọc")}
          </Button>
        </div>
        {(cohortsQuery.error && !cohortsQuery.data) || pendingActions.has(actionKey("retry-cohorts")) ? (
          <Alert
            action={
              <Button loading={cohortsQuery.isFetching || pendingActions.has(actionKey("retry-cohorts"))} onClick={() => void runAction(actionKey("retry-cohorts"), async () => { await cohortsQuery.refetch({ cancelRefetch: false }); })} size="small">{t("Thử lại")}</Button>
            }
            showIcon
            title={formatError(cohortsQuery.error, t("Không tải được lớp học"))}
            type="error"
          />
        ) : (
          <DataTable
            ariaLabel={t("Danh sách lớp học")}
            columns={cohortColumns}
            data={cohorts}
            emptyText={
              search || orgUnitId || status ? t("Không có lớp học phù hợp") : <Empty description={t("Chưa có lớp học")}>
                <Button
                  disabled={!canMutate}
                  onClick={showCreateCohort}
                  type="primary"
                >{t("Tạo lớp đầu tiên")}</Button>
              </Empty>
            }
            loading={cohortsQuery.isPending}
            rowKey="_id"
            paginationResetKey={JSON.stringify(filters)}
            scrollX={920}
          />
        )}
      </Card>

      <Modal
        cancelText={t("Hủy")}
        confirmLoading={pendingActions.has(actionKey("save-cohort")) || saveCohortMutation.isPending}
        onCancel={() => setCohortOpen(false)}
        onOk={() => void saveCohort()}
        okButtonProps={{ disabled: !canMutate }}
        okText={editingCohort ? t("Lưu thay đổi") : t("Tạo lớp học")}
        open={cohortOpen}
        title={editingCohort ? t("Chỉnh sửa lớp học") : t("Tạo lớp học")}
        width={720}
      >
        <Form
          form={cohortForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label={t("Khóa học")}
            name="courseId"
            rules={[{ message: t("Chọn khóa học"), required: true }]}
          >
            <Select
              disabled={Boolean(editingCohort)}
              loading={coursesQuery.isFetching}
              options={courses.map((course: CohortCourseSummary) => ({
                label: course.title,
                value: course._id,
              }))}
              placeholder={t("Chọn khóa học nền")}
              showSearch
            />
          </Form.Item>
          <div className={polish.formGrid}>
            <Form.Item
              label={t("Mã lớp")}
              name="code"
              rules={[
                { message: t("Nhập mã lớp"), min: 2, required: true },
                {
                  message: t("Chỉ dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới"),
                  pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
                },
              ]}
            >
              <Input placeholder="IELTS-2026-09" />
            </Form.Item>
            <Form.Item
              label={t("Sức chứa")}
              name="capacity"
              rules={[{ message: t("Từ 1 đến 10.000"), required: true }]}
            >
              <InputNumber max={10_000} min={1} />
            </Form.Item>
          </div>
          <Form.Item
            label={t("Tên lớp")}
            name="name"
            rules={[{ message: t("Nhập tên lớp"), min: 2, required: true }]}
          >
            <Input placeholder={t("IELTS buổi tối K09")} />
          </Form.Item>
          {organizationStructureEnabled && (
            <Form.Item
              extra={
                isScopedAdmin
                  ? t("Chọn một đơn vị trong phạm vi bạn quản lý.")
                  : t("Để trống nếu lớp dùng chung cho toàn trung tâm.")
              }
              label={t("Chi nhánh / đơn vị vận hành")}
              name="orgUnitId"
              rules={
                isScopedAdmin
                  ? [
                    {
                      message: t("Chọn chi nhánh hoặc đơn vị vận hành lớp"),
                      required: true,
                    },
                  ]
                  : undefined
              }
            >
              <Select
                allowClear
                aria-label={t("Chọn chi nhánh cho lớp")}
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
                  setInstructorSearch("");
                  setSelectedInstructorOptions([]);
                  cohortForm.setFieldsValue({ instructorIds: [] });
                }}
                options={orgUnits.map((unit) => ({
                  label: `${"— ".repeat(unit.depth)}${unit.name}`,
                  value: unit._id,
                }))}
                placeholder={t("Toàn trung tâm")}
                showSearch
              />
            </Form.Item>
          )}
          <section className={polish.formSection}>
          <h3>{t("Lịch học và giảng viên")}</h3>
          <div className={polish.formGrid}>
            <Form.Item label={t("Ngày bắt đầu")} name="startDate">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item label={t("Ngày kết thúc")} name="endDate">
              <DatePicker format="DD/MM/YYYY" />
            </Form.Item>
          </div>
          <Form.Item label={t("Múi giờ")} name="timezone">
            <Select options={timezoneOptions.map(option => ({ ...option, label: t(option.label) }))} showSearch />
          </Form.Item>
          <Form.Item label={t("Trạng thái")} name="status">
            <Select options={cohortStatuses.map(option => ({ ...option, label: t(option.label) }))} />
          </Form.Item>
          {user?.role === "TENANT_ADMIN" && (
            <Form.Item label={t("Giảng viên phụ trách")} name="instructorIds">
              <Select
                aria-label={t("Chọn giảng viên phụ trách")}
                disabled={isScopedAdmin && !cohortOrgUnitId}
                loading={instructorsQuery.isFetching}
                mode="multiple"
                filterOption={false}
                onSearch={setInstructorSearch}
                onChange={(values: string[]) => setSelectedInstructorOptions(instructorOptions.filter(option => values.includes(option.value)))}
                notFoundContent={
                  isScopedAdmin && !cohortOrgUnitId
                    ? t("Chọn chi nhánh trước")
                    : undefined
                }
                options={instructorOptions}
                popupRender={(menu) => <>{menu}<div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography.Text type="secondary">{t("Đã tải {count} trên {total} kết quả", { count: instructors.length, total: instructorsQuery.data?.pages.at(-1)?.total ?? 0 })}</Typography.Text>
                  {instructorsQuery.hasNextPage && <Button size="small" loading={instructorsQuery.isFetchingNextPage} onMouseDown={(event) => event.preventDefault()} onClick={() => void instructorsQuery.fetchNextPage()}>{t("Tải thêm kết quả")}</Button>}
                </div></>}
                placeholder={t("Có thể phân công nhiều giảng viên")}
                showSearch
              />
            </Form.Item>
          )}
          {user?.role === "TENANT_ADMIN" && instructorsQuery.error && (
            <Alert
              showIcon
              title={formatError(
                instructorsQuery.error,
                t("Không tải được giảng viên phù hợp với chi nhánh"),
              )}
              type="warning"
            />
          )}
          </section>
        </Form>
      </Modal>

      <Modal
        footer={null}
        onCancel={() => setRosterOpen(false)}
        open={rosterOpen}
        title={t("Học viên · {p0}", { p0: selectedCohort?.name ?? "" })}
        width={720}
      >
        <div style={{ marginTop: 20 }}>
          {user?.role === "INSTRUCTOR" && (
            <Alert
              description={t("Giảng viên có thể xem danh sách lớp; việc thêm hoặc rút học viên do quản trị viên thực hiện.")}
              showIcon
              title={t("Danh sách chỉ đọc")}
              type="info"
            />
          )}
          {readOnly && user?.role === "TENANT_ADMIN" && (
            <Alert
              description={t("Bạn vẫn xem được danh sách nhưng không thể thêm hoặc rút học viên.")}
              showIcon
              title={t("Workspace chỉ đọc")}
              type="info"
            />
          )}
          {selectedCohort?.status === "ARCHIVED" && (
            <Alert
              description={t("Lớp đã lưu trữ nên danh sách học viên chỉ được xem.")}
              showIcon
              title={t("Lớp đã lưu trữ")}
              type="info"
            />
          )}

          {canMutateRoster && (
            <div style={{ marginTop: 18 }}>
              <Typography.Paragraph type="secondary">{t("Nguồn chọn là học viên đang được ghi danh hợp lệ trong khóa học nền của lớp.")}</Typography.Paragraph>
              {(courseLearnersQuery.error || pendingActions.has(actionKey("retry-directory", selectedCourseId))) && (
                <Alert
                  action={
                    <Button
                      loading={courseLearnersQuery.isFetching || pendingActions.has(actionKey("retry-directory", selectedCourseId))}
                      onClick={() => void runAction(actionKey("retry-directory", selectedCourseId), async () => { await courseLearnersQuery.refetch({ cancelRefetch: false }); })}
                      size="small"
                    >{t("Thử lại")}</Button>
                  }
                  showIcon
                  title={formatError(
                    courseLearnersQuery.error,
                    t("Không tải được học viên khả dụng"),
                  )}
                  type="warning"
                />
              )}
              <Space.Compact block>
                <Select<string[]>
                  aria-label={t("Chọn học viên thêm vào lớp")}
                  disabled={
                    addLearnersMutation.isPending || remainingCapacity === 0
                  }
                  filterOption={false}
                  loading={courseLearnersQuery.isFetching}
                  mode="multiple"
                  onChange={(values: string[]) => { setSelectedLearnerIds(values); setSelectedLearnerOptions(learnerOptions.filter(option => values.includes(option.value))); }}
                  onSearch={setLearnerSearch}
                  options={learnerOptions}
                  popupRender={(menu) => <>{menu}<div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography.Text type="secondary">{t("Đã tải {count} trên {total} kết quả", { count: loadedLearners.length, total: courseLearnersQuery.data?.pages.at(-1)?.total ?? 0 })}</Typography.Text>
                    {courseLearnersQuery.hasNextPage && <Button size="small" loading={courseLearnersQuery.isFetchingNextPage} onMouseDown={(event) => event.preventDefault()} onClick={() => void courseLearnersQuery.fetchNextPage()}>{t("Tải thêm kết quả")}</Button>}
                  </div></>}
                  placeholder={
                    remainingCapacity === 0
                      ? t("Lớp đã đủ sức chứa")
                      : t("Tìm và chọn nhiều học viên")
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
                  loading={pendingActions.has(actionKey("add-learners", selectedCohort?._id)) || addLearnersMutation.isPending}
                  onClick={() => void addLearners()}
                  type="primary"
                >{t("Thêm vào lớp")}</Button>
              </Space.Compact>
              {selectedLearnerIds.length > remainingCapacity && (
                <Typography.Text type="danger">{t("Chỉ còn")} {remainingCapacity} {t("chỗ trong lớp.")}</Typography.Text>
              )}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <strong>{t("Danh sách lớp (")}{roster.length}/{selectedCohort?.capacity ?? 0})
            </strong>
            {(rosterQuery.error && !rosterQuery.data) || pendingActions.has(actionKey("retry-roster", selectedCohort?._id)) ? (
              <Alert
                action={
                  <Button loading={rosterQuery.isFetching || pendingActions.has(actionKey("retry-roster", selectedCohort?._id))} onClick={() => void runAction(actionKey("retry-roster", selectedCohort?._id), async () => { await rosterQuery.refetch({ cancelRefetch: false }); })} size="small">{t("Thử lại")}</Button>
                }
                showIcon
                title={formatError(
                  rosterQuery.error,
                  t("Không tải được danh sách học viên"),
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
                      cancelText={t("Không")}
                      okText={t("Rút")}
                      onConfirm={() => removeLearner(enrollment)}
                      okButtonProps={{ loading: pendingActions.has(actionKey("remove", enrollment._id)) }}
                      title={t("Rút học viên khỏi lớp này?")}
                    >
                      <Button
                        danger
                        loading={pendingActions.has(actionKey("remove", enrollment._id))}
                        size="small"
                        type="text"
                      >{t("Rút")}</Button>
                    </Popconfirm>
                  ) : (
                    <Tag color="green">{t("Đang học")}</Tag>
                  )}
                </div>
              ))
            ) : (
              <Empty
                description={t("Lớp chưa có học viên")}
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
        title={t("Lịch học · {p0}", { p0: selectedCohort?.name ?? "" })}
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
            >{t("Thêm buổi học")}</Button>
          </div>
          {(sessionsQuery.error && !sessionsQuery.data) || pendingActions.has(actionKey("retry-sessions", selectedCohort?._id)) ? (
            <Alert
              action={
                <Button loading={sessionsQuery.isFetching || pendingActions.has(actionKey("retry-sessions", selectedCohort?._id))} onClick={() => void runAction(actionKey("retry-sessions", selectedCohort?._id), async () => { await sessionsQuery.refetch({ cancelRefetch: false }); })}>{t("Thử lại")}</Button>
              }
              showIcon
              title={formatError(
                sessionsQuery.error,
                t("Không tải được lịch học"),
              )}
              type="error"
            />
          ) : sessionsQuery.isPending ? (
            <div style={{ display: "grid", minHeight: 180, placeItems: "center" }}>
              <Spin />
            </div>
          ) : (
            <DataTable
              ariaLabel={t("Lịch các buổi học")}
              columns={sessionColumns}
              data={sessions}
              emptyText={t("Chưa có buổi học")}
              rowKey="_id"
              scrollX={680}
            />
          )}
        </div>
      </Modal>

      <Modal
        cancelText={t("Hủy")}
        confirmLoading={pendingActions.has(actionKey("save-session")) || saveSessionMutation.isPending}
        onCancel={() => setSessionOpen(false)}
        onOk={() => void saveSession()}
        okButtonProps={{ disabled: !canMutate }}
        okText={editingSession ? t("Lưu thay đổi") : t("Thêm buổi học")}
        open={sessionOpen}
        title={editingSession ? t("Chỉnh sửa buổi học") : t("Thêm buổi học")}
      >
        <Form
          form={sessionForm}
          layout="vertical"
          requiredMark={false}
          style={{ marginTop: 22 }}
        >
          <Form.Item
            label={t("Bắt đầu")}
            name="startAt"
            rules={[{ message: t("Chọn thời điểm bắt đầu"), required: true }]}
          >
            <DatePicker format="DD/MM/YYYY HH:mm" showTime />
          </Form.Item>
          <Form.Item
            dependencies={["startAt"]}
            label={t("Kết thúc")}
            name="endAt"
            rules={[
              { message: t("Chọn thời điểm kết thúc"), required: true },
              ({ getFieldValue }) => ({
                validator: (_, value: Dayjs | undefined) =>
                  !value || value.isAfter(getFieldValue("startAt") as Dayjs)
                    ? Promise.resolve()
                    : Promise.reject(
                      new Error(t("Kết thúc phải sau thời điểm bắt đầu")),
                    ),
              }),
            ]}
          >
            <DatePicker format="DD/MM/YYYY HH:mm" showTime />
          </Form.Item>
          <Form.Item label={t("Trạng thái")} name="status">
            <Select options={sessionStatuses.map(option => ({ ...option, label: t(option.label) }))} />
          </Form.Item>
          <Form.Item label={t("Địa điểm")} name="location">
            <Input maxLength={300} placeholder={t("Phòng 201")} />
          </Form.Item>
          <Form.Item
            label={t("Liên kết học trực tuyến")}
            name="meetingUrl"
            rules={[{ message: t("Nhập URL http(s) hợp lệ"), type: "url" }]}
          >
            <Input maxLength={2_048} placeholder="https://meet.example.com/..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
