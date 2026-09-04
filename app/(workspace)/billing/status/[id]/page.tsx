"use client";

import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Result, Skeleton, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/app-providers";
import { billingApi } from "@/lib/api";
import { formatEntitlementLimit } from "@/lib/entitlements";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { billingRefetchInterval, getBillingStatusPresentation } from "../../billing-state";

export default function BillingStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization, refreshSession, token, user } = useAuth();
  const scope = useMemo(() => getViewerScope(user, organization), [organization, user]);
  const processedTerminalState = useRef<string | null>(null);
  const order = useQuery({
    enabled: Boolean(token && scope && id && user?.role === "TENANT_ADMIN"),
    queryFn: () => billingApi.getOrder({ token }, id),
    queryKey: scope ? lmsQueryKeys.billingOrder(scope, id) : ["lms", "signed-out", "billing", "orders", id],
    refetchInterval: (query) => billingRefetchInterval(query.state.data?.status, Boolean(query.state.error)),
  });
  const terminalStatus = order.data?.status;

  useEffect(() => {
    if (!scope || !terminalStatus || !getBillingStatusPresentation(terminalStatus).terminal) return;
    const terminalKey = `${id}:${terminalStatus}`;
    if (processedTerminalState.current === terminalKey) return;
    processedTerminalState.current = terminalKey;
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: lmsQueryKeys.billingSubscription(scope) }),
      queryClient.invalidateQueries({ exact: true, queryKey: lmsQueryKeys.billingOrders(scope) }),
      ...(terminalStatus === "PAID" ? [refreshSession()] : []),
    ]);
  }, [id, queryClient, refreshSession, scope, terminalStatus]);

  if (user?.role !== "TENANT_ADMIN") return <Alert showIcon title="Bạn không có quyền xem đơn thanh toán này." type="warning" />;
  if (order.isLoading) return <Card className="surface-card"><Skeleton active paragraph={{ rows: 5 }} /></Card>;
  if (order.error && !order.data) return <Alert action={<Button onClick={() => router.push("/billing")}>Về trang thuê bao</Button>} showIcon title={order.error instanceof Error ? order.error.message : "Không tìm thấy đơn thanh toán"} type="error" />;
  if (!order.data) return <Alert showIcon title="Không tìm thấy đơn thanh toán" type="error" />;

  const state = getBillingStatusPresentation(order.data.status);
  const icon = order.data.status === "PAID"
    ? <CheckCircleOutlined />
    : order.data.status === "PENDING"
      ? <ClockCircleOutlined />
      : order.data.status === "REVIEW_REQUIRED" || order.data.status === "REFUND_REQUIRED"
        ? <ExclamationCircleOutlined />
        : <CloseCircleOutlined />;
  const resultStatus = order.data.status === "PAID"
    ? "success"
    : order.data.status === "PENDING"
      ? "info"
      : order.data.status === "REVIEW_REQUIRED" || order.data.status === "REFUND_REQUIRED"
        ? "warning"
        : "error";
  return <div className="page-shell"><Card className="surface-card billing-status-card">
    {order.error && <Alert showIcon style={{ marginBottom: 18 }} title="Kết nối tạm thời gián đoạn; hệ thống sẽ tự động kiểm tra lại trạng thái thanh toán." type="warning" />}
    <Result
      extra={<Button onClick={() => router.push("/billing")} type="primary">Về trang thuê bao</Button>}
      icon={icon}
      status={resultStatus}
      subTitle={state.description}
      title={state.label}
    />
    {order.data.reviewReason && <Alert showIcon style={{ marginBottom: 18 }} title={order.data.reviewReason} type="warning" />}
    <div className="billing-order-summary"><div><span>Hóa đơn</span><Typography.Text copyable>{order.data.invoiceNumber}</Typography.Text></div><div><span>Gói</span><strong>{order.data.planSnapshot.name}</strong><small>{formatEntitlementLimit(order.data.planSnapshot.entitlements.maxUsers, "users")} · {formatEntitlementLimit(order.data.planSnapshot.entitlements.maxCourses, "courses")}</small></div><div><span>Trạng thái thanh toán</span><Tag color={state.color}>{state.label}</Tag></div></div>
  </Card></div>;
}
