"use client";

import { Button } from "antd";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import type { GoogleAuthChallenge } from "@/lib/google-auth-api";
import styles from "./google-identity-button.module.css";

const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const CHALLENGE_REFRESH_LEEWAY_MS = 30_000;

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityConfiguration {
  callback: (response: GoogleCredentialResponse) => void;
  client_id: string;
  nonce: string;
}

interface GoogleIdentityButtonConfiguration {
  logo_alignment: "left";
  shape: "rectangular";
  size: "large";
  text: "continue_with" | "signin_with";
  theme: "outline";
  type: "standard";
  width: number;
}

interface GoogleIdentityApi {
  initialize: (configuration: GoogleIdentityConfiguration) => void;
  renderButton: (
    parent: HTMLElement,
    configuration: GoogleIdentityButtonConfiguration,
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

export interface GoogleIdentityButtonProps {
  accessibleLabel: string;
  disabled?: boolean;
  getChallenge: (signal: AbortSignal) => Promise<GoogleAuthChallenge>;
  intent: "LINK" | "LOGIN";
  onCredential: (credential: string, challengeToken: string) => Promise<void>;
  onError?: (error: unknown) => void;
}

function setupErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError &&
    [
      "GOOGLE_AUTH_NOT_CONFIGURED",
      "GOOGLE_INTEGRATION_DISABLED",
      "GOOGLE_LOGIN_DISABLED",
    ].includes(error.code ?? "")
  ) {
    return "Google chưa được cấu hình cho môi trường này.";
  }
  return "Không thể tải nút Google lúc này.";
}

export function GoogleIdentityButton({
  accessibleLabel,
  disabled = false,
  getChallenge,
  intent,
  onCredential,
  onError,
}: GoogleIdentityButtonProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const challengeRef = useRef<GoogleAuthChallenge | null>(null);
  const requestVersionRef = useRef(0);
  const processingRef = useRef(false);
  const mountedRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  const reportSetupError = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    challengeRef.current = null;
    setPreparing(false);
    setSetupError(setupErrorMessage(error));
    onErrorRef.current?.(error);
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.replaceChildren();
    challengeRef.current = null;

    if (!scriptReady || disabled) return;

    const googleIdentity = window.google?.accounts?.id;
    if (!googleIdentity) {
      reportSetupError(new Error("Google Identity Services unavailable"));
      return;
    }

    const controller = new AbortController();
    const requestVersion = ++requestVersionRef.current;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    void getChallenge(controller.signal)
      .then((challenge) => {
        if (
          controller.signal.aborted ||
          requestVersion !== requestVersionRef.current ||
          !mountedRef.current
        ) {
          return;
        }
        const activeSurface = surfaceRef.current;
        const activeGoogleIdentity = window.google?.accounts?.id;
        if (!activeSurface || !activeGoogleIdentity) {
          throw new Error("Google Identity Services unavailable");
        }

        challengeRef.current = challenge;
        activeGoogleIdentity.initialize({
          callback: (response) => {
            if (processingRef.current) return;
            const activeChallenge = challengeRef.current;
            const credential = response.credential;
            if (!activeChallenge || !credential) {
              reportSetupError(new Error("Google credential unavailable"));
              return;
            }

            challengeRef.current = null;
            processingRef.current = true;
            setProcessing(true);
            activeSurface.replaceChildren();
            void onCredentialRef
              .current(credential, activeChallenge.challengeToken)
              .catch((error: unknown) => onErrorRef.current?.(error))
              .finally(() => {
                processingRef.current = false;
                if (!mountedRef.current) return;
                setProcessing(false);
                setPreparing(true);
                setReloadKey((current) => current + 1);
              });
          },
          client_id: challenge.clientId,
          nonce: challenge.nonce,
        });
        activeSurface.replaceChildren();
        const measuredWidth = Math.floor(
          activeSurface.getBoundingClientRect().width,
        );
        activeGoogleIdentity.renderButton(activeSurface, {
          logo_alignment: "left",
          shape: "rectangular",
          size: "large",
          text: intent === "LOGIN" ? "signin_with" : "continue_with",
          theme: "outline",
          type: "standard",
          width: Math.max(200, Math.min(400, measuredWidth || 320)),
        });
        setPreparing(false);

        const refreshIn = Math.max(
          1_000,
          Date.parse(challenge.expiresAt) -
            Date.now() -
            CHALLENGE_REFRESH_LEEWAY_MS,
        );
        refreshTimer = setTimeout(
          () => {
            setPreparing(true);
            setReloadKey((current) => current + 1);
          },
          Math.min(refreshIn, 15 * 60_000),
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) reportSetupError(error);
      });

    return () => {
      controller.abort();
      requestVersionRef.current += 1;
      if (refreshTimer) clearTimeout(refreshTimer);
      challengeRef.current = null;
      surface.replaceChildren();
    };
  }, [disabled, getChallenge, intent, reloadKey, reportSetupError, scriptReady]);

  return (
    <div className={styles.root}>
      <Script
        id="google-identity-services"
        onError={() =>
          reportSetupError(new Error("Google Identity Services script failed"))
        }
        onReady={() => {
          setSetupError("");
          setPreparing(true);
          setScriptReady(true);
        }}
        src={GOOGLE_IDENTITY_SCRIPT}
        strategy="afterInteractive"
      />
      <div
        aria-busy={preparing || processing}
        aria-label={accessibleLabel}
        className={styles.surface}
        ref={surfaceRef}
      />
      {!disabled && (preparing || processing) && (
        <p aria-live="polite" className={styles.status} role="status">
          {processing ? "Đang xác minh với Google…" : "Đang tải Google…"}
        </p>
      )}
      {setupError && !processing && (
        <div className={styles.error} role="alert">
          <span>{setupError}</span>
          <Button
            disabled={disabled}
            onClick={() => {
              setSetupError("");
              setPreparing(true);
              setReloadKey((current) => current + 1);
            }}
            size="small"
            type="link"
          >
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}
