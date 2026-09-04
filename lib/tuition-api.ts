import { apiFetch } from "@/lib/api";

export type TuitionInvoiceLifecycle = "DRAFT" | "ISSUED" | "VOID";
export type TuitionInvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";
export type TuitionPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "OTHER";

export interface TuitionPaymentEntry {
  _id: string;
  amountVnd: number;
  idempotencyKey: string;
  method: TuitionPaymentMethod;
  note?: string;
  paidAt: string;
  providerReference?: string;
  recordedBy: string;
}

export interface TuitionInvoice {
  _id: string;
  amountVnd: number;
  balanceVnd: number;
  cohortId?: string;
  orgUnitId?: string;
  createdAt?: string;
  createdBy: string;
  currency: "VND";
  description: string;
  dueAt: string;
  invoiceNumber: string;
  issuedAt?: string;
  learnerId: string;
  learner?: { _id: string; email: string; fullName: string };
  lifecycle: TuitionInvoiceLifecycle;
  paidAmountVnd: number;
  payments: TuitionPaymentEntry[];
  status: TuitionInvoiceStatus;
  tenantId: string;
  title: string;
  updatedAt?: string;
  voidedAt?: string;
}

export interface TuitionInvoiceList {
  items: TuitionInvoice[];
  limit: number;
  page: number;
  total: number;
}

export interface TuitionInvoiceQuery {
  cohortId?: string;
  orgUnitId?: string;
  learnerId?: string;
  limit?: number;
  page?: number;
  status?: TuitionInvoiceStatus;
}

export interface CreateTuitionInvoiceInput {
  amountVnd: number;
  cohortId?: string;
  orgUnitId?: string;
  description?: string;
  dueAt: string;
  learnerId: string;
  title: string;
}

export interface UpdateTuitionInvoiceInput {
  amountVnd?: number;
  cohortId?: string | null;
  orgUnitId?: string | null;
  description?: string;
  dueAt?: string;
  title?: string;
}

export interface RecordTuitionPaymentInput {
  amountVnd: number;
  idempotencyKey: string;
  method: TuitionPaymentMethod;
  note?: string;
  paidAt?: string;
  providerReference?: string;
}

export interface TuitionLearnerDirectoryEntry {
  accountStatus: "ACTIVE" | "INACTIVE";
  email: string;
  fullName: string;
  membershipId: string;
  orgUnitId?: string;
  role: "TENANT_ADMIN" | "INSTRUCTOR" | "LEARNER" | "GUARDIAN";
  status: "ACTIVE" | "INACTIVE";
  userId: string;
}

export interface TuitionInvoiceOptionCohort {
  _id: string;
  code: string;
  name: string;
  orgUnitId?: string;
}

export interface TuitionInvoiceOptionLearner {
  cohortIds: string[];
  email: string;
  fullName: string;
  membershipId: string;
  orgUnitId?: string;
  userId: string;
}

export interface TuitionInvoiceOptionOrgUnit {
  _id: string;
  code: string;
  name: string;
  type: "ROOT" | "BRANCH" | "DEPARTMENT";
}

export interface TuitionInvoiceOptions {
  cohorts: TuitionInvoiceOptionCohort[];
  learners: TuitionInvoiceOptionLearner[];
  orgUnits: TuitionInvoiceOptionOrgUnit[];
  scoped: boolean;
}

export interface TuitionApiContext {
  token: string;
}

export function buildTuitionQuery(values: TuitionInvoiceQuery = {}): string {
  const params = new URLSearchParams();
  const record = values as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(record).sort()) {
    const raw = record[key];
    if (typeof raw === "string") {
      const value = raw.trim();
      if (value) params.set(key, value);
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      params.set(key, String(raw));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function createTuitionPaymentIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `tuition-payment:${globalThis.crypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `tuition-payment:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const invoicePath = (invoiceId: string) =>
  `/tuition/invoices/${encodeURIComponent(invoiceId)}`;

export const tuitionApi = {
  getInvoiceOptions: (
    { token }: TuitionApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<TuitionInvoiceOptions>("/tuition/invoice-options", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  listInvoices: (
    { token }: TuitionApiContext,
    query: TuitionInvoiceQuery = {},
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<TuitionInvoiceList>(
      `/tuition/invoices${buildTuitionQuery(query)}`,
      {
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        token,
      },
    ),
  getInvoice: (
    { token }: TuitionApiContext,
    invoiceId: string,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<TuitionInvoice>(invoicePath(invoiceId), {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  listLearners: (
    { token }: TuitionApiContext,
    options: { signal?: AbortSignal } = {},
  ) =>
    apiFetch<TuitionLearnerDirectoryEntry[]>("/users", {
      cache: "no-store",
      ...(options.signal ? { signal: options.signal } : {}),
      token,
    }),
  createInvoice: (
    { token }: TuitionApiContext,
    input: CreateTuitionInvoiceInput,
  ) =>
    apiFetch<TuitionInvoice>("/tuition/invoices", {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
  updateDraft: (
    { token }: TuitionApiContext,
    invoiceId: string,
    input: UpdateTuitionInvoiceInput,
  ) =>
    apiFetch<TuitionInvoice>(invoicePath(invoiceId), {
      body: JSON.stringify(input),
      method: "PATCH",
      token,
    }),
  issueInvoice: ({ token }: TuitionApiContext, invoiceId: string) =>
    apiFetch<TuitionInvoice>(`${invoicePath(invoiceId)}/issue`, {
      method: "POST",
      token,
    }),
  voidInvoice: ({ token }: TuitionApiContext, invoiceId: string) =>
    apiFetch<TuitionInvoice>(`${invoicePath(invoiceId)}/void`, {
      method: "POST",
      token,
    }),
  recordPayment: (
    { token }: TuitionApiContext,
    invoiceId: string,
    input: RecordTuitionPaymentInput,
  ) =>
    apiFetch<TuitionInvoice>(`${invoicePath(invoiceId)}/payments`, {
      body: JSON.stringify(input),
      method: "POST",
      token,
    }),
};
