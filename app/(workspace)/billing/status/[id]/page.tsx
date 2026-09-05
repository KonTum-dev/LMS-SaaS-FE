"use client";
import { describeOperationsError } from "@/lib/i18n/operations-errors";
import { useI18n } from "@/components/i18n/i18n-provider";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { useMemo as useI18nMemo } from "react";

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Result, Skeleton, Space, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { billingApi } from "@/lib/api";
import { formatEntitlementLimit } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import {
  billingRefetchInterval,
  getBillingStatusPresentation,
} from "../../billing-state";

export default function BillingStatusPage() {
  const { t, getBillingStatusPresentation, formatEntitlementLimit, locale } =
    useOperationsCopy();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization, refreshSession, token, user } = useAuth();
  const scope = useMemo(
    () => getViewerScope(user, organization),
    [organization, user],
  );
  const processedTerminalState = useRef<string | null>(null);
  const order = useQuery({
    enabled: Boolean(token && scope && id && user?.role === "TENANT_ADMIN"),
    queryFn: () => billingApi.getOrder({ token }, id),
    queryKey: scope
      ? lmsQueryKeys.billingOrder(scope, id)
      : ["lms", "signed-out", "billing", "orders", id],
    refetchInterval: (query) =>
      billingRefetchInterval(
        query.state.data?.status,
        Boolean(query.state.error),
      ),
  });
  const terminalStatus = order.data?.status;

  useEffect(() => {
    if (
      !scope ||
      !terminalStatus ||
      !getBillingStatusPresentation(terminalStatus).terminal
    )
      return;
    const terminalKey = `${id}:${terminalStatus}`;
    if (processedTerminalState.current === terminalKey) return;
    processedTerminalState.current = terminalKey;
    void Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: lmsQueryKeys.billingSubscription(scope),
      }),
      queryClient.invalidateQueries({
        exact: true,
        queryKey: lmsQueryKeys.billingOrders(scope),
      }),
      ...(terminalStatus === "PAID" ? [refreshSession()] : []),
    ]);
  }, [
    getBillingStatusPresentation,
    id,
    queryClient,
    refreshSession,
    scope,
    terminalStatus,
  ]);

  if (user?.role !== "TENANT_ADMIN")
    return (
      <Alert
        showIcon
        title={t("Bạn không có quyền xem đơn thanh toán này.")}
        type="warning"
      />
    );
  if (order.isLoading)
    return (
      <Card className="surface-card">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  if (order.error && !order.data)
    return (
      <Alert
        action={
          <Space wrap>
          <Button onClick={() => router.push("/billing")}>
            {t("Về trang thuê bao")}
          </Button>
          <Button disabled={order.isFetching} loading={order.isFetching} onClick={() => { if (!order.isFetching) void order.refetch(); }} type="primary">
            {t("Thử lại")}
          </Button>
          </Space>
        }
        showIcon
        title={
          order.error instanceof Error
            ? describeOperationsError(
                order.error,
                locale,
                t("Không tìm thấy đơn thanh toán"),
              )
            : t("Không tìm thấy đơn thanh toán")
        }
        type="error"
      />
    );
  if (!order.data)
    return (
      <Alert showIcon title={t("Không tìm thấy đơn thanh toán")} type="error" />
    );

  const state = getBillingStatusPresentation(order.data.status);
  const icon =
    order.data.status === "PAID" ? (
      <CheckCircleOutlined />
    ) : order.data.status === "PENDING" ? (
      <ClockCircleOutlined />
    ) : order.data.status === "REVIEW_REQUIRED" ||
      order.data.status === "REFUND_REQUIRED" ? (
      <ExclamationCircleOutlined />
    ) : (
      <CloseCircleOutlined />
    );
  const resultStatus =
    order.data.status === "PAID"
      ? "success"
      : order.data.status === "PENDING"
        ? "info"
        : order.data.status === "REVIEW_REQUIRED" ||
            order.data.status === "REFUND_REQUIRED"
          ? "warning"
          : "error";
  return (
    <div className="page-shell">
      <Card className="surface-card billing-status-card">
        {order.error && (
          <Alert
            showIcon
            style={{ marginBottom: 18 }}
            title={t(
              "Kết nối tạm thời gián đoạn; hệ thống sẽ tự động kiểm tra lại trạng thái thanh toán.",
            )}
            type="warning"
          />
        )}
        <Result
          extra={
            <Button onClick={() => router.push("/billing")} type="primary">
              {t("Về trang thuê bao")}
            </Button>
          }
          icon={icon}
          status={resultStatus}
          subTitle={state.description}
          title={state.label}
        />
        {order.data.reviewReason && (
          <Alert
            showIcon
            style={{ marginBottom: 18 }}
            title={order.data.reviewReason}
            type="warning"
          />
        )}
        <div className="billing-order-summary">
          <div>
            <span>{t("Hóa đơn")}</span>
            <Typography.Text copyable>
              {order.data.invoiceNumber}
            </Typography.Text>
          </div>
          <div>
            <span>{t("Gói")}</span>
            <strong>{order.data.planSnapshot.name}</strong>
            <small>
              {formatEntitlementLimit(
                order.data.planSnapshot.entitlements.maxUsers,
                "users",
              )}{" "}
              ·{" "}
              {formatEntitlementLimit(
                order.data.planSnapshot.entitlements.maxCourses,
                "courses",
              )}
            </small>
          </div>
          <div>
            <span>{t("Trạng thái thanh toán")}</span>
            <Tag color={state.color}>{state.label}</Tag>
          </div>
        </div>
      </Card>
    </div>
  );
}

function useOperationsCopy() {
  const i18n = useI18n(operationsMessages);
  return useI18nMemo(() => {
    const { t } = i18n;

    const translatedGetBillingStatusPresentation = (
      state: Parameters<typeof getBillingStatusPresentation>[0],
    ) => {
      const presentation = getBillingStatusPresentation(state);
      return {
        ...presentation,
        label: t(presentation.label),
        description: t(presentation.description),
      };
    };
    const translatedFormatEntitlementLimit = (
      value: number | null,
      resource: Parameters<typeof formatEntitlementLimit>[1],
    ) => {
      const label = t(
        {
          activeLearners: "học viên hoạt động",
          branches: "chi nhánh hoạt động",
          courses: "khóa học",
          users: "người dùng",
        }[resource],
      );
      return value === null
        ? t("Không giới hạn {resource}", { resource: label })
        : t("Tối đa {count} {resource}", {
            count: i18n.formatNumber(value),
            resource: label,
          });
    };
    return {
      ...i18n,
      getBillingStatusPresentation: translatedGetBillingStatusPresentation,
      formatEntitlementLimit: translatedFormatEntitlementLimit,
    };
  }, [i18n]);
}
