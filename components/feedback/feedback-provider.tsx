"use client";

import { App } from "antd";
import type { ArgsProps, MessageInstance, MessageType, NoticeType, TypeOpen } from "antd/es/message/interface";
import type { NotificationInstance } from "antd/es/notification/interface";
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { isKnownFeedbackText, translateFeedbackText } from "@/lib/feedback-catalog";
import { describeFeedbackError } from "@/lib/feedback-errors";
import { type FeedbackLocale, useFeedbackLocale } from "./feedback-locale";

type AppApi = ReturnType<typeof App.useApp>;
type ErrorOpen = (error: unknown, fallback?: string) => MessageType;
type FeedbackApi = AppApi & {
  reportError: ErrorOpen;
  formatError: (error: unknown, fallback?: string) => string;
  text: (text: string, kind?: NoticeType) => string;
};
const FeedbackContext = createContext<FeedbackApi | null>(null);
let nextFeedbackKey = 0;
const words = {
  vi: { success: "Thành công", error: "Cần kiểm tra", warning: "Lưu ý", info: "Thông tin", loading: "Đang xử lý", close: "Đóng thông báo", generic: "Thao tác đã hoàn tất.", infoFallback: "Có thông tin mới. Vui lòng kiểm tra nội dung trên trang." },
  en: { success: "Success", error: "Please check", warning: "Please note", info: "Information", loading: "Working", close: "Dismiss notification", generic: "The action is complete.", infoFallback: "There is an update. Please check the details on this page." },
};

export function readableFeedbackText(content: unknown, locale: FeedbackLocale, kind: NoticeType): string {
  if (typeof content === "string" && isKnownFeedbackText(content)) return translateFeedbackText(content, locale, kind);
  if (kind === "error" || kind === "warning") return describeFeedbackError(content, locale).message;
  if (kind === "loading") return locale === "vi" ? "Đang xử lý yêu cầu. Vui lòng chờ…" : "Processing your request. Please wait…";
  // Never render arbitrary response objects, validation internals or untranslated
  // backend text. Dynamic user data is supported only by catalogued templates.
  return kind === "success" ? words[locale].generic : words[locale].infoFallback;
}

export function FeedbackProvider({ children, authorityEpoch = null }: { children: React.ReactNode; authorityEpoch?: string | null }) {
  const app = App.useApp();
  const { locale } = useFeedbackLocale();
  const currentAuthority = useRef(authorityEpoch);
  useLayoutEffect(() => { currentAuthority.current = authorityEpoch; }, [authorityEpoch]);
  const value = useMemo<FeedbackApi>(() => {
    const isStale = () => authorityEpoch !== null && currentAuthority.current !== authorityEpoch;
    const text = (source: string, kind: NoticeType = "info") => readableFeedbackText(source, locale, kind);
    const formatError = (error: unknown, fallback?: string) => {
      if (typeof error === "string" && isKnownFeedbackText(error)) return text(error, "error");
      return describeFeedbackError(error, locale,
        fallback && isKnownFeedbackText(fallback) ? translateFeedbackText(fallback, locale, "error") : undefined).message;
    };
    const open = (args: ArgsProps, preparedBody?: string): MessageType => {
      if (isStale()) {
        // A response from a previous workspace/account must not reopen feedback
        // after its authority boundary has already cleared the overlays.
        const settled = Promise.resolve(true);
        return Object.assign(() => {}, { then: settled.then.bind(settled) });
      }
      const kind = args.type ?? "info";
      const body = preparedBody ?? readableFeedbackText(args.content, locale, kind);
      // Each default notice owns its close callback/thenable. Only callers
      // supplying an explicit key opt into AntD's replacement semantics.
      const key = args.key ?? `feedback:${++nextFeedbackKey}`;
      const duration = args.duration ?? (kind === "error" || kind === "warning" || kind === "loading" ? 0 : Math.min(12, Math.max(6, Math.ceil(body.length / 24))));
      return app.message.open({
        ...args, key, type: kind, duration, pauseOnHover: true,
        className: ["feedback-toast", args.className].filter(Boolean).join(" "),
        content: <div className="feedback-toast-content" lang={locale} role={kind === "error" || kind === "warning" ? "alert" : "status"} aria-atomic="true">
          <div className="feedback-toast-copy"><strong>{words[locale][kind]}</strong><div>{body}</div></div>
          <button type="button" className="feedback-toast-dismiss" aria-label={words[locale].close} title={words[locale].close} onClick={() => app.message.destroy(key)}>×</button>
        </div>,
      });
    };
    const typed = (kind: NoticeType): TypeOpen => (content, duration, onClose) => {
      const args = content && typeof content === "object" && "content" in content
        ? content as ArgsProps : { content };
      // This returned AntD handler executes on an action, never while constructing the provider value.
      // eslint-disable-next-line react-hooks/refs
      return open({
        ...(typeof duration === "number" ? { duration } : {}),
        onClose: typeof duration === "function" ? duration : onClose,
        ...args, type: kind,
      });
    };
    const message: MessageInstance = {
      ...app.message,
      success: typed("success"), error: typed("error"), warning: typed("warning"),
      info: typed("info"), loading: typed("loading"), open,
      destroy: (key) => { if (!isStale()) app.message.destroy(key); },
    };
    const notification = { ...app.notification } as NotificationInstance;
    for (const kind of ["success", "error", "warning", "info", "open"] as const) {
      notification[kind] = (args) => { if (isStale()) return; app.notification[kind]({
        ...args,
        title: typeof args.title === "string" ? text(args.title, kind === "open" ? "info" : kind) : args.title,
        description: typeof args.description === "string" ? text(args.description, kind === "open" ? "info" : kind) : args.description,
        className: ["feedback-notification", args.className].filter(Boolean).join(" "),
      }); };
    }
    return { ...app, message, notification, text, formatError,
      reportError: (error, fallback) => open({ type: "error", content: "" }, formatError(error, fallback)),
    };
  }, [app, locale, authorityEpoch]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackApi {
  const app = App.useApp();
  const context = useContext(FeedbackContext);
  // Isolated consumers/tests without the root provider retain AntD semantics.
  // The production app always mounts FeedbackProvider above its routed children.
  return context ?? {
    ...app,
    reportError: (error, fallback) => app.message.error(error instanceof Error ? error.message : fallback ?? "Không thể hoàn tất yêu cầu"),
    formatError: (error, fallback) => error instanceof Error ? error.message : fallback ?? "Không thể hoàn tất yêu cầu",
    text: (value) => value,
  };
}
