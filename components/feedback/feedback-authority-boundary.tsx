"use client";

import { App, Modal } from "antd";
import { useLayoutEffect, useRef } from "react";

/**
 * AntD's holders intentionally outlive route/query remounts so sign-in feedback
 * stays visible. Confirmation callbacks and notices from a previous signed-in
 * authority, however, must never follow the user into a different session.
 */
export function FeedbackAuthorityBoundary({
  authorityEpoch,
  children,
}: {
  authorityEpoch: string | null;
  children: React.ReactNode;
}) {
  const { message, notification } = App.useApp();
  const previousEpoch = useRef(authorityEpoch);

  useLayoutEffect(() => {
    if (
      previousEpoch.current !== null &&
      previousEpoch.current !== authorityEpoch
    ) {
      message.destroy();
      notification.destroy();
      // Includes modal.confirm instances created by App.useApp().modal; AntD
      // registers their holder cleanup in the same destroyAll registry.
      Modal.destroyAll();
    }
    previousEpoch.current = authorityEpoch;
  }, [authorityEpoch, message, notification]);

  return children;
}
