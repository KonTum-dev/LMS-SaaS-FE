"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Pagination, Progress, Select, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/app-providers";
import { useI18n } from "@/components/i18n/i18n-provider";
import {
  getViewerScope,
  lmsQueryKeys,
  type ViewerScope,
} from "@/lib/query-keys";
import {
  guardianPortalApi,
  guardianPortalAccessLost,
  type GuardianLearning,
  type GuardianLearningPages,
} from "@/lib/guardian-portal-api";
import { familyMessages } from "./messages";
import styles from "./page.module.css";

interface Navigation {
  childrenPage: number;
  selectedId?: string;
  pages: GuardianLearningPages;
}
const initialPages: GuardianLearningPages = {
  coursesPage: 1,
  resultsPage: 1,
  assessmentsPage: 1,
};
const initialNavigation: Navigation = { childrenPage: 1, pages: initialPages };

export default function FamilyPage() {
  const { user, token, organization, effectiveAccess } = useAuth();
  const { t } = useI18n(familyMessages);
  const scope = getViewerScope(user, organization);
  if (user?.role !== "GUARDIAN" || !scope || !token) {
    return (
      <Alert
        showIcon
        type="warning"
        title={t(
          "Trang này chỉ dành cho phụ huynh đã đăng nhập trong tổ chức.",
        )}
      />
    );
  }
  if (!effectiveAccess?.modules.includes("GUARDIANS")) {
    return (
      <Alert
        showIcon
        type="warning"
        title={t("Tổ chức chưa bật tính năng phụ huynh.")}
      />
    );
  }
  const canLearn =
    effectiveAccess.modules.includes("COURSES") &&
    effectiveAccess.modules.includes("ENROLLMENTS");
  // Authority changes remount navigation and private queries. Never expose tokens in DOM.
  return (
    <FamilySession
      key={JSON.stringify([scope, token, canLearn])}
      token={token}
      scope={scope}
      canLearn={canLearn}
    />
  );
}

interface SessionProps {
  token: string;
  scope: ViewerScope;
  canLearn: boolean;
}
function FamilySession(props: SessionProps) {
  const querySession = useId();
  const { t } = useI18n(familyMessages);
  const [accessLost, setAccessLost] = useState(false);
  const [visible, setVisible] = useState(true);
  const [revision, setRevision] = useState(0);
  const [navigation, setNavigation] = useState(initialNavigation);
  const [pending, setPending] = useState(true);
  const inFlight = useRef(true);
  const updatePending = useCallback((value: boolean) => {
    inFlight.current = value;
    setPending(value);
  }, []);
  const refresh = useCallback(() => {
    if (
      document.visibilityState !== "visible" ||
      accessLost ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setPending(true);
    setRevision((value) => value + 1);
  }, [accessLost]);
  const loseAccess = useCallback(() => {
    setAccessLost(true);
    setNavigation(initialNavigation);
    updatePending(false);
  }, [updatePending]);

  useEffect(() => {
    const visibilityChanged = () => {
      if (document.visibilityState !== "visible") {
        setVisible(false); // Abort consumers and release private gcTime:0 query data.
        updatePending(false);
      } else {
        inFlight.current = true;
        setPending(true);
        setRevision((value) => value + 1);
        setVisible(true);
      }
    };
    if (document.visibilityState !== "visible") visibilityChanged();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibilityChanged);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.clearInterval(interval);
    };
  }, [refresh, updatePending]);

  return (
    <div className={["page-shell", styles.family].join(" ")}>
      {accessLost ? (
        <>
          <FamilyHero />
          <Alert
            showIcon
            type="warning"
            title={t(
              "Quyền xem đã thay đổi. Vui lòng tải lại hoặc liên hệ trung tâm để kiểm tra liên kết phụ huynh.",
            )}
            action={
              <Button
                onClick={() => {
                  updatePending(true);
                  setRevision((value) => value + 1);
                  setAccessLost(false);
                }}
              >
                {t("Tải lại")}
              </Button>
            }
          />
        </>
      ) : !visible ? (
        <>
          <FamilyHero />
          <Loading
            label={t("Thông tin sẽ được kiểm tra lại khi bạn quay lại trang.")}
          />
        </>
      ) : (
        <FamilyContents
          {...props}
          querySession={querySession}
          revision={revision}
          navigation={navigation}
          onNavigate={setNavigation}
          pending={pending}
          onPending={updatePending}
          onRefresh={refresh}
          onAccessLost={loseAccess}
        />
      )}
      <p className={styles.privacy}>
        {t(
          "Chỉ hiển thị thông tin học tập đã được trung tâm cho phép chia sẻ.",
        )}
      </p>
    </div>
  );
}

function FamilyHero({ children }: { children?: ReactNode }) {
  const { t } = useI18n(familyMessages);
  return (
    <div className={styles.hero}>
      <div className={styles.intro}>
        <h1>{t("Học viên của tôi")}</h1>
        <p>
          {t("Theo dõi tiến độ và kết quả học tập đã được chia sẻ với bạn.")}
        </p>
      </div>
      <Image
        className={styles.illustration}
        src="/family/learning-together.png"
        width={1536}
        height={1024}
        loading="eager"
        sizes="(max-width: 600px) 128px, (max-width: 1000px) 230px, 360px"
        alt=""
        aria-hidden="true"
      />
      {children ? <div className={styles.controls}>{children}</div> : null}
    </div>
  );
}

function FamilyContents({
  token,
  scope,
  canLearn,
  revision,
  navigation,
  onNavigate,
  pending,
  onPending,
  onRefresh,
  onAccessLost,
  querySession,
}: SessionProps & {
  querySession: string;
  revision: number;
  navigation: Navigation;
  onNavigate: (next: Navigation) => void;
  pending: boolean;
  onPending: (value: boolean) => void;
  onRefresh: () => void;
  onAccessLost: () => void;
}) {
  const { t } = useI18n(familyMessages);
  const { childrenPage, selectedId, pages } = navigation;
  const children = useQuery({
    queryKey: [
      ...lmsQueryKeys.viewer(scope),
      "guardian-portal",
      querySession,
      "children",
      childrenPage,
      revision,
    ],
    queryFn: async ({ signal }) => {
      try {
        return await guardianPortalApi.children(token, childrenPage, signal);
      } catch (error) {
        if (!signal.aborted && guardianPortalAccessLost(error)) onAccessLost();
        throw error;
      }
    },
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const validSelection =
    !children.isFetching &&
    !children.error &&
    children.data?.items.some((child) => child.learnerId === selectedId)
      ? selectedId
      : undefined;
  const learningEnabled = Boolean(validSelection && canLearn);
  const learning = useQuery({
    queryKey: [
      ...lmsQueryKeys.viewer(scope),
      "guardian-portal",
      querySession,
      "learning",
      validSelection,
      pages,
      revision,
    ],
    queryFn: async ({ signal }) => {
      try {
        return await guardianPortalApi.learning(
          token,
          validSelection!,
          pages,
          signal,
        );
      } catch (error) {
        if (!signal.aborted && guardianPortalAccessLost(error)) onAccessLost();
        throw error;
      }
    },
    enabled: learningEnabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const fetching =
    children.isPending ||
    children.isFetching ||
    (learningEnabled && (learning.isPending || learning.isFetching));
  useEffect(() => {
    onPending(fetching);
  }, [fetching, onPending]);
  const childItems =
    children.isFetching || children.error ? [] : (children.data?.items ?? []);
  return (
    <>
      <FamilyHero>
        <label htmlFor="family-learner">{t("Chọn học viên")}</label>
        <div className={styles.controlRow}>
          <Select
            id="family-learner"
            aria-label={t("Chọn học viên")}
            placeholder={t("Chọn học viên")}
            className={styles.learnerSelect}
            value={validSelection}
            disabled={pending || !childItems.length}
            onChange={(value) =>
              onNavigate({
                ...navigation,
                selectedId: value,
                pages: initialPages,
              })
            }
            options={childItems.map((child) => ({
              label: child.fullName,
              value: child.learnerId,
            }))}
          />
          <Button
            className={styles.refresh}
            icon={<ReloadOutlined aria-hidden="true" />}
            loading={pending}
            disabled={pending}
            aria-busy={pending}
            aria-label={t("Làm mới")}
            onClick={onRefresh}
          >
            {t("Làm mới")}
          </Button>
        </div>
        {!children.isFetching && !children.error && (
          <Pager
            page={childrenPage}
            limit={children.data?.limit ?? 20}
            total={children.data?.total ?? 0}
            onChange={(page) =>
              onNavigate({ childrenPage: page, pages: initialPages })
            }
          />
        )}
      </FamilyHero>
      {children.isFetching || children.isPending ? (
        <Loading label={t("Đang tải học viên…")} />
      ) : children.error ? (
        <Alert
          showIcon
          type="error"
          title={t("Không tải được học viên. Vui lòng thử lại.")}
          action={
            <Button disabled={pending} onClick={onRefresh}>
              {t("Thử lại")}
            </Button>
          }
        />
      ) : !childItems.length ? (
        <div className={styles.empty}>
          <Empty description={t("Chưa có học viên được chia sẻ")} />
          <p>
            {t(
              "Nhờ trung tâm liên kết tài khoản phụ huynh với học viên và bật chia sẻ thông tin học tập.",
            )}
          </p>
        </div>
      ) : !canLearn ? (
        <Alert
          showIcon
          type="info"
          title={t("Tổ chức chưa bật khóa học hoặc ghi danh để xem tiến độ.")}
        />
      ) : !validSelection ? (
        <div className={styles.empty}>
          <Empty
            description={t("Chọn học viên để xem tiến độ và kết quả học tập.")}
          />
        </div>
      ) : learning.isFetching || learning.isPending ? (
        <Loading label={t("Đang tải kết quả học tập…")} />
      ) : learning.error ? (
        <Alert
          showIcon
          type="error"
          title={t("Không tải được kết quả học tập. Vui lòng thử lại.")}
          action={
            <Button disabled={pending} onClick={onRefresh}>
              {t("Thử lại")}
            </Button>
          }
        />
      ) : learning.data ? (
        <Learning
          data={learning.data}
          onPage={(key, page) =>
            onNavigate({ ...navigation, pages: { ...pages, [key]: page } })
          }
        />
      ) : null}
    </>
  );
}

function Learning({
  data,
  onPage,
}: {
  data: GuardianLearning;
  onPage: (key: keyof GuardianLearningPages, page: number) => void;
}) {
  const { t, formatDate } = useI18n(familyMessages);
  const hasResults =
    data.capabilities.assignmentResults || data.capabilities.assessmentResults;
  return (
    <div className={styles.learning}>
      <h2 className={styles.learnerName}>{data.child.fullName}</h2>
      <div
        className={[
          styles.learningGrid,
          !hasResults ? styles.coursesOnly : "",
        ].join(" ")}
      >
        <section
          className={[styles.panel, styles.courses].join(" ")}
          aria-labelledby="family-course-title"
        >
          <h2 id="family-course-title" className={styles.panelTitle}>
            {t("Tiến độ khóa học")}
          </h2>
          <div className={styles.panelBody}>
            {!data.courses.items.length && (
              <Empty description={t("Chưa có khóa học đang học.")} />
            )}
            {data.courses.items.map((course) => (
              <article key={course.courseId} className={styles.course}>
                <h3>{course.title}</h3>
                <Progress
                  percent={course.progress.percent}
                  strokeColor="#176bff"
                />
                <p className={styles.muted}>
                  {t("{done}/{total} bài học bắt buộc", {
                    done: course.progress.completedRequiredLessons,
                    total: course.progress.requiredLessons,
                  })}
                </p>
              </article>
            ))}
            <Pager
              {...data.courses}
              onChange={(page) => onPage("coursesPage", page)}
            />
          </div>
        </section>
        {hasResults && (
          <div className={styles.results}>
            {data.capabilities.assignmentResults && (
              <section
                className={styles.panel}
                aria-labelledby="family-assignment-title"
              >
                <h2 id="family-assignment-title" className={styles.panelTitle}>
                  {t("Kết quả bài tập")}
                </h2>
                <div className={styles.panelBody}>
                  {!data.results.items.length && (
                    <Empty
                      description={t("Chưa có bài tập được trả kết quả.")}
                    />
                  )}
                  {data.results.items.map((result) => (
                    <article
                      key={result.submissionId}
                      className={styles.result}
                    >
                      <h3>{result.assignmentTitle}</h3>
                      <p className={styles.muted}>
                        {result.courseTitle} · {formatDate(result.releasedAt)}
                      </p>
                      <div className={styles.resultMeta}>
                        <span
                          className={[
                            styles.badge,
                            result.state === "GRADED"
                              ? styles.good
                              : styles.attention,
                          ].join(" ")}
                        >
                          {t(
                            result.state === "GRADED"
                              ? "Đã chấm điểm"
                              : "Cần bổ sung",
                          )}
                        </span>
                        {result.grade && (
                          <strong>
                            {result.grade.score}/{result.grade.maxPoints}
                          </strong>
                        )}
                      </div>
                      <p className={styles.feedbackLabel}>
                        {t("Nhận xét của giáo viên")}
                      </p>
                      <p className={styles.feedback}>
                        {result.feedback || t("Không có nhận xét.")}
                      </p>
                    </article>
                  ))}
                  <Pager
                    {...data.results}
                    onChange={(page) => onPage("resultsPage", page)}
                  />
                </div>
              </section>
            )}
            {data.capabilities.assessmentResults && (
              <section
                className={styles.panel}
                aria-labelledby="family-assessment-title"
              >
                <h2 id="family-assessment-title" className={styles.panelTitle}>
                  {t("Kết quả bài kiểm tra")}
                </h2>
                <div className={styles.panelBody}>
                  {!data.assessments.items.length && (
                    <Empty
                      description={t(
                        "Chưa có kết quả bài kiểm tra được công bố.",
                      )}
                    />
                  )}
                  {data.assessments.items.map((result) => (
                    <article key={result.attemptId} className={styles.result}>
                      <h3>{result.assessmentTitle}</h3>
                      <p className={styles.muted}>
                        {result.courseTitle} ·{" "}
                        {t("Lần làm {attempt}", {
                          attempt: result.attemptNumber,
                        })}{" "}
                        · {formatDate(result.grade.scoredAt)}
                      </p>
                      <div className={styles.resultMeta}>
                        <strong>
                          {result.grade.score}/{result.grade.maxScore}
                        </strong>
                        <span
                          className={[
                            styles.badge,
                            result.grade.passed
                              ? styles.good
                              : styles.attention,
                          ].join(" ")}
                        >
                          {t(result.grade.passed ? "Đạt" : "Chưa đạt")}
                        </span>
                      </div>
                    </article>
                  ))}
                  <Pager
                    {...data.assessments}
                    onChange={(page) => onPage("assessmentsPage", page)}
                  />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div role="status" className={styles.loading}>
      <Spin size="small" />
      {label}
    </div>
  );
}
function Pager({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n(familyMessages);
  if (page > 1 && total <= limit)
    return (
      <Button className={styles.pager} onClick={() => onChange(1)}>
        {t("Về trang đầu")}
      </Button>
    );
  return total > limit ? (
    <Pagination
      className={styles.pager}
      simple
      current={page}
      pageSize={limit}
      total={Math.min(total, limit * 100)}
      onChange={onChange}
      showSizeChanger={false}
    />
  ) : null;
}
