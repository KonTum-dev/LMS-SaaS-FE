"use client";

import {
  CalendarOutlined,
  ContactsOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Empty,
  Modal,
  Pagination,
  Spin,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { useAuth } from "@/components/providers/app-providers";
import { ApiError } from "@/lib/api";
import { getViewerScope, lmsQueryKeys } from "@/lib/query-keys";
import { canAccessWorkspaceRoute } from "@/lib/workspace-access";
import {
  tenantCrmApi,
  type CrmContact,
  type CrmContactInput,
  type CrmOptions,
} from "@/lib/tenant-crm-api";
import { crmMessages, type CrmCopy } from "./messages";
import styles from "./page.module.css";

const stageColors = {
  NEW: "blue",
  CONTACTED: "cyan",
  QUALIFIED: "gold",
  ENROLLED: "green",
  LOST: "default",
};
const blank = {
  fullName: "",
  phone: "",
  email: "",
  kind: "LEAD",
  stage: "NEW",
  orgUnitId: "",
  nextFollowUpAt: "",
};
type Fields = typeof blank;

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export default function CrmPage() {
  const auth = useAuth();
  const { locale } = useI18n();
  const m = crmMessages[locale];
  const scope = getViewerScope(auth.user, auth.organization);
  const allowed = canAccessWorkspaceRoute({ ...auth, pathname: "/crm" });
  if (auth.loading)
    return (
      <div className={styles.loading}>
        <Spin />
      </div>
    );
  if (!allowed || !scope || !auth.token)
    return <Alert type="warning" title={m.denied} />;
  // Remount private local state on any identity, membership or token change.
  return (
    <CrmWorkspace
      key={`${scope.tenantId}:${scope.viewerId}:${scope.membershipId}:${auth.token}`}
      token={auth.token}
      rootKey={[...lmsQueryKeys.viewer(scope), "crm"]}
      readOnly={auth.effectiveAccess?.readOnly ?? true}
      centerName={auth.organization?.name ?? ""}
      m={m}
      locale={locale}
    />
  );
}

function CrmWorkspace({
  token,
  rootKey,
  readOnly,
  centerName,
  m,
  locale,
}: {
  token: string;
  rootKey: readonly string[];
  readOnly: boolean;
  centerName: string;
  m: CrmCopy;
  locale: "vi" | "en";
}) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: "",
    kind: "",
    stage: "",
    source: "",
    followUp: "",
    orgUnitId: "",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [contactDirty, setContactDirty] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const options = useQuery({
    queryKey: [...rootKey, "options"],
    queryFn: ({ signal }) => tenantCrmApi.options({ token }, { signal }),
    retry: false,
  });
  const query = {
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    page,
    limit: 20,
  };
  const list = useQuery({
    queryKey: [...rootKey, "list", query],
    queryFn: ({ signal }) => tenantCrmApi.list({ token }, query, { signal }),
    retry: false,
  });
  const detail = useQuery({
    queryKey: [...rootKey, "detail", selected],
    enabled: Boolean(selected),
    queryFn: ({ signal }) => tenantCrmApi.get({ token }, selected!, { signal }),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const rows = list.isError ? [] : (list.data?.items ?? []);
  const contact = detail.isError ? undefined : detail.data;
  const canCreate =
    !readOnly && !options.isError && Boolean(options.data?.canCreate);
  const canEdit = !readOnly && Boolean(contact?.canEdit) && !options.isError;

  function filter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  function close() {
    if (operation.current) return;
    setSelected(null);
    setCreating(false);
    setError(null);
  }
  function open(id?: string) {
    setError(null);
    setSuccess(null);
    setContactDirty(false);
    setNoteDirty(false);
    setCreating(!id);
    setSelected(id ?? null);
  }
  async function mutate(
    action: (signal: AbortSignal) => Promise<CrmContact>,
    message: string,
    wasCreate = false,
  ) {
    if (operation.current || readOnly) return;
    const controller = new AbortController();
    operation.current = controller;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await action(controller.signal);
      if (controller.signal.aborted) return;
      setSuccess(message);
      setContactDirty(false);
      setNoteDirty(false);
      if (wasCreate) {
        setCreating(false);
        setSelected(updated._id);
      }
      queryClient.setQueryData([...rootKey, "detail", updated._id], updated);
      await queryClient.invalidateQueries({ queryKey: [...rootKey, "list"] });
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof ApiError && cause.status === 409
          ? m.conflict
          : m.error,
      );
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
        setCreating(false);
        setSelected(null);
        queryClient.removeQueries({ queryKey: rootKey });
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        setPending(false);
      }
    }
  }

  const person = (row: CrmContact) => (
    <div className={styles.person}>
      <span className={styles.avatar}>
        {row.fullName.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <strong>{row.fullName}</strong>
        <small>{m.kinds[row.kind]}</small>
      </div>
    </div>
  );
  const channel = (row: CrmContact) => (
    <div className={styles.contactInfo}>
      {row.phone ? (
        <a href={`tel:${row.phone}`}>{row.phone}</a>
      ) : (
        <span className={styles.muted}>{m.notShared}</span>
      )}
      {row.email && <a href={`mailto:${row.email}`}>{row.email}</a>}
    </div>
  );
  const followUp = (row: CrmContact) =>
    row.nextFollowUpAt ? (
      <div className={styles.contactInfo}>
        <span>{date(row.nextFollowUpAt)}</span>
        {new Date(row.nextFollowUpAt).getTime() <= now && (
          <span>
            <Tag color="orange">{m.overdue}</Tag>
          </span>
        )}
      </div>
    ) : (
      <span className={styles.muted}>{m.noFollowUp}</span>
    );
  const columns: ColumnsType<CrmContact> = [
    { title: m.name, key: "name", width: 210, render: (_, row) => person(row) },
    {
      title: m.phone,
      key: "phone",
      width: 200,
      render: (_, row) => channel(row),
    },
    {
      title: m.stage,
      key: "stage",
      width: 140,
      render: (_, row) => (
        <Tag color={stageColors[row.stage]}>{m.stages[row.stage]}</Tag>
      ),
    },
    {
      title: m.nextFollowUp,
      key: "followUp",
      width: 165,
      render: (_, row) => followUp(row),
    },
    {
      title: m.source,
      key: "source",
      width: 130,
      render: (_, row) => (
        <span className={styles.muted}>{m.sources[row.source]}</span>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => open(row._id)}
          aria-label={`${m.action}: ${row.fullName}`}
        >
          {m.action}
        </Button>
      ),
    },
  ];

  return (
    <div className={`page-shell ${styles.page}`}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>CRM · {centerName}</span>
          <h1>{m.title}</h1>
          <p>{m.subtitle}</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          disabled={!canCreate}
          onClick={() => open()}
        >
          {m.create}
        </Button>
      </header>
      {readOnly && <Alert type="warning" showIcon title={m.readOnly} />}
      {options.data?.scoped && <Alert type="info" showIcon title={m.scoped} />}
      {!selected && !creating && error && (
        <Alert type="error" showIcon title={error} />
      )}
      {!selected && !creating && success && (
        <Alert type="success" showIcon title={success} />
      )}
      <section className={styles.stats} aria-label={m.title}>
        {[
          {
            label: m.total,
            value: list.isError ? "—" : (list.data?.total ?? "—"),
            icon: <ContactsOutlined />,
          },
          {
            label: m.followUps,
            value: rows.filter(
              (row) =>
                row.nextFollowUpAt &&
                new Date(row.nextFollowUpAt).getTime() <= now,
            ).length,
            icon: <CalendarOutlined />,
          },
          {
            label: m.zaloCount,
            value: rows.filter((row) => row.zalo).length,
            icon: <MessageOutlined />,
          },
        ].map((item) => (
          <div className={styles.stat} key={item.label}>
            <span className={styles.statIcon}>{item.icon}</span>
            <div>
              <strong>{item.value}</strong>
              <small>{item.label}</small>
            </div>
          </div>
        ))}
      </section>
      <section className={styles.list}>
        <div className={styles.filters}>
          <input
            className={`${styles.control} ${styles.search}`}
            type="search"
            aria-label={m.search}
            placeholder={m.search}
            maxLength={100}
            value={filters.search}
            onChange={(event) => filter("search", event.target.value)}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={list.isFetching || options.isFetching}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: rootKey })
            }
          >
            {m.refresh}
          </Button>
          {(
            [
              { key: "kind", label: m.allKinds, entries: m.kinds },
              { key: "stage", label: m.allStages, entries: m.stages },
              { key: "source", label: m.allSources, entries: m.sources },
              {
                key: "followUp",
                label: m.allFollowUps,
                entries: m.followUpOptions,
              },
            ] as const
          ).map((item) => (
            <select
              className={styles.control}
              aria-label={item.label}
              key={item.key}
              value={filters[item.key]}
              onChange={(event) => filter(item.key, event.target.value)}
            >
              <option value="">{item.label}</option>
              {Object.entries(item.entries).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ))}
          <select
            className={styles.control}
            aria-label={m.allUnits}
            value={filters.orgUnitId}
            onChange={(event) => filter("orgUnitId", event.target.value)}
          >
            <option value="">{m.allUnits}</option>
            {options.data?.orgUnits.map((unit) => (
              <option key={unit._id} value={unit._id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        {list.isError || options.isError ? (
          <div className={styles.empty}>
            <Alert type="error" title={m.error} />
          </div>
        ) : list.isPending ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>
            <Empty description={m.noContacts} />
            <p>{m.emptyHint}</p>
          </div>
        ) : (
          <>
            <div className={styles.desktopTable}>
              <Table<CrmContact>
                columns={columns}
                dataSource={rows}
                rowKey="_id"
                pagination={false}
                scroll={{ x: 950 }}
              />
            </div>
            <div className={styles.mobileCards}>
              {rows.map((row) => (
                <article className={styles.mobileCard} key={row._id}>
                  {person(row)}
                  {channel(row)}
                  <div>
                    <Tag color={stageColors[row.stage]}>
                      {m.stages[row.stage]}
                    </Tag>
                    <span className={styles.muted}>
                      {m.sources[row.source]}
                    </span>
                  </div>
                  <div>
                    {followUp(row)}
                    <Button
                      onClick={() => open(row._id)}
                      aria-label={`${m.action}: ${row.fullName}`}
                    >
                      {m.action}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {!list.isError && (
          <footer className={styles.footer}>
            <Pagination
              current={page}
              total={list.data?.total ?? 0}
              pageSize={20}
              showSizeChanger={false}
              onChange={setPage}
              size="small"
            />
          </footer>
        )}
      </section>
      <Modal
        open={creating || Boolean(selected)}
        title={creating ? m.create : (contact?.fullName ?? m.details)}
        onCancel={close}
        footer={null}
        width={780}
        destroyOnHidden
        maskClosable={!pending}
        closable={!pending}
        keyboard={!pending}
      >
        <div className={styles.detail}>
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              action={
                selected && !pending ? (
                  <Button
                    size="small"
                    onClick={() => {
                      setError(null);
                      void detail.refetch();
                    }}
                  >
                    {m.reload}
                  </Button>
                ) : undefined
              }
            />
          )}
          {success && <Alert type="success" showIcon title={success} />}
          {creating && options.data ? (
            <ContactForm
              key="create"
              m={m}
              options={options.data}
              busy={pending}
              editable={canCreate}
              onDirtyChange={setContactDirty}
              onClose={close}
              onSave={(input) =>
                mutate(
                  (signal) =>
                    tenantCrmApi.create({ token }, input as CrmContactInput, {
                      signal,
                    }),
                  m.created,
                  true,
                )
              }
            />
          ) : detail.isPending ? (
            <div className={styles.loading}>
              <Spin />
            </div>
          ) : detail.isError || !contact ? (
            <Alert type="error" title={m.error} />
          ) : (
            <>
              {!canEdit && <Alert type="info" title={m.viewOnly} />}
              <ContactForm
                key={`${contact._id}:${contact.revision}`}
                contact={contact}
                m={m}
                options={
                  options.data ?? {
                    orgUnits: [],
                    canCreate: false,
                    scoped: true,
                  }
                }
                busy={pending}
                editable={canEdit && !noteDirty}
                onDirtyChange={setContactDirty}
                onClose={close}
                onSave={(input) =>
                  mutate(
                    (signal) =>
                      tenantCrmApi.update(
                        { token },
                        contact._id,
                        { ...input, revision: contact.revision },
                        { signal },
                      ),
                    m.saved,
                  )
                }
              />
              {contact.zalo && (
                <section className={styles.zalo}>
                  <h3>{m.zalo}</h3>
                  <p>{m.zaloHint}</p>
                  <dl>
                    <dt>{m.name}</dt>
                    <dd>{contact.zalo.displayName}</dd>
                    <dt>{m.phone}</dt>
                    <dd>
                      {contact.zalo.phoneShared && contact.zalo.phone
                        ? contact.zalo.phone
                        : m.phoneNotShared}
                    </dd>
                    <dt>{m.lastSynced}</dt>
                    <dd>{date(contact.zalo.syncedAt)}</dd>
                  </dl>
                </section>
              )}
              <section className={styles.history}>
                <h3>{m.history}</h3>
                <p>{m.historyHint}</p>
                {(contactDirty || noteDirty) && <p>{m.saveDraftFirst}</p>}
                {canEdit && (
                  <NoteForm
                    key={`${contact._id}:${contact.revision}`}
                    m={m}
                    busy={pending || contactDirty}
                    onDirtyChange={setNoteDirty}
                    onSubmit={(body) =>
                      mutate(
                        (signal) =>
                          tenantCrmApi.addNote(
                            { token },
                            contact._id,
                            { body, revision: contact.revision },
                            { signal },
                          ),
                        m.noteSaved,
                      )
                    }
                  />
                )}
                <ol className={styles.timeline}>
                  {[...(contact.history ?? [])].reverse().map((event) => (
                    <li key={event.id}>
                      <strong>
                        {m.events[event.type as keyof typeof m.events] ??
                          m.events.UPDATED}
                      </strong>
                      <time dateTime={event.at}>{date(event.at)}</time>
                      {event.note && <p>{event.note}</p>}
                    </li>
                  ))}
                </ol>
                {!contact.history?.length && <p>{m.noHistory}</p>}
              </section>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ContactForm({
  contact,
  options,
  m,
  busy,
  editable,
  onSave,
  onClose,
  onDirtyChange,
}: {
  contact?: CrmContact;
  options: CrmOptions;
  m: CrmCopy;
  busy: boolean;
  editable: boolean;
  onSave: (input: Partial<CrmContactInput>) => Promise<void>;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const initial: Fields = contact
    ? {
        fullName: contact.fullName,
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        kind: contact.kind,
        stage: contact.stage,
        orgUnitId: contact.orgUnitId ?? "",
        nextFollowUpAt: localDate(contact.nextFollowUpAt),
      }
    : blank;
  const [values, setValues] = useState<Fields>(initial);
  const [changed, setChanged] = useState(false);
  const [notice, setNotice] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  function update(key: keyof Fields, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    const dirty = (Object.keys(next) as (keyof Fields)[]).some(
      (field) => next[field] !== initial[field],
    );
    setChanged(dirty);
    onDirtyChange(dirty);
    setNotice(false);
    setValidation(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || busy) return;
    if (values.fullName.trim().length < 2) {
      setValidation(m.invalidName);
      return;
    }
    const normalizedPhone = values.phone.replace(/[ ()-]/g, "");
    if (normalizedPhone && !/^\+?[0-9]{7,20}$/.test(normalizedPhone)) {
      setValidation(m.invalidPhone);
      return;
    }
    if (
      values.nextFollowUpAt &&
      !Number.isFinite(Date.parse(values.nextFollowUpAt))
    ) {
      setValidation(m.invalidDate);
      return;
    }
    const input: Record<string, unknown> = {};
    for (const key of Object.keys(values) as (keyof Fields)[]) {
      if (contact && values[key] === initial[key]) continue;
      const value = key === "phone" ? normalizedPhone : values[key].trim();
      input[key] =
        key === "nextFollowUpAt"
          ? value
            ? new Date(value).toISOString()
            : null
          : ["phone", "email", "orgUnitId"].includes(key)
            ? value || null
            : value;
    }
    if (!Object.keys(input).length) {
      setNotice(true);
      return;
    }
    await onSave(input as Partial<CrmContactInput>);
  }
  const textField = (
    key: "fullName" | "phone" | "email",
    label: string,
    type: string,
    maxLength: number,
  ) => (
    <label className={styles.field}>
      <span>
        {label}
        {key === "fullName" ? " *" : ""}
      </span>
      <input
        className={styles.control}
        type={type}
        value={values[key]}
        required={key === "fullName"}
        minLength={key === "fullName" ? 2 : undefined}
        maxLength={maxLength}
        onChange={(event) => update(key, event.target.value)}
        disabled={busy || !editable}
        autoComplete="off"
      />
    </label>
  );
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <div className={styles.fields}>
        {textField("fullName", m.name, "text", 160)}
        {textField("phone", m.phone, "tel", 24)}
        {textField("email", m.email, "email", 254)}
        <label className={styles.field}>
          <span>{m.kind}</span>
          <select
            className={styles.control}
            value={values.kind}
            disabled={busy || !editable}
            onChange={(event) => update("kind", event.target.value)}
          >
            {Object.entries(m.kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{m.stage}</span>
          <select
            className={styles.control}
            value={values.stage}
            disabled={busy || !editable}
            onChange={(event) => update("stage", event.target.value)}
          >
            {Object.entries(m.stages).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{m.unit}</span>
          <select
            className={styles.control}
            value={values.orgUnitId}
            required={options.scoped}
            disabled={busy || !editable}
            onChange={(event) => update("orgUnitId", event.target.value)}
          >
            <option value="" disabled={options.scoped}>
              {options.scoped ? m.unit : m.global}
            </option>
            {options.orgUnits.map((unit) => (
              <option key={unit._id} value={unit._id} disabled={!unit.canWrite}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${styles.field} ${styles.wide}`}>
          <span>{m.nextFollowUp}</span>
          <input
            className={styles.control}
            type="datetime-local"
            value={values.nextFollowUpAt}
            onChange={(event) => update("nextFollowUpAt", event.target.value)}
            disabled={busy || !editable}
          />
        </label>
      </div>
      {notice && <Alert type="info" title={m.noChanges} />}
      {validation && <Alert type="error" title={validation} />}
      <div className={styles.actions}>
        <Button onClick={onClose} disabled={busy}>
          {m.cancel}
        </Button>
        {editable && (
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={Boolean(contact && !changed)}
          >
            {busy ? m.saving : contact ? m.save : m.create}
          </Button>
        )}
      </div>
    </form>
  );
}

function NoteForm({
  m,
  busy,
  onSubmit,
  onDirtyChange,
}: {
  m: CrmCopy;
  busy: boolean;
  onSubmit: (body: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <form
      className={styles.note}
      onSubmit={(event) => {
        event.preventDefault();
        if (note.trim() && !busy) void onSubmit(note.trim());
      }}
    >
      <label className={styles.field}>
        <span>{m.note}</span>
        <textarea
          className={styles.control}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            onDirtyChange(Boolean(event.target.value.trim()));
          }}
          placeholder={m.notePlaceholder}
          maxLength={2000}
          required
          disabled={busy}
        />
      </label>
      <Button htmlType="submit" disabled={!note.trim() || busy} loading={busy}>
        {m.addNote}
      </Button>
    </form>
  );
}
