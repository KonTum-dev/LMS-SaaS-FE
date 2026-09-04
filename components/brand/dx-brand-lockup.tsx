import Image from "next/image";
import styles from "./dx-brand-lockup.module.css";

export interface DxBrandLockupProps {
  className?: string;
  subtitle?: string;
  variant?: "regular" | "inverse";
}

export function DxBrandMark({ className }: { className?: string }) {
  return (
    <Image
      alt="DX LMS"
      className={[styles.mark, className].filter(Boolean).join(" ")}
      height={192}
      src="/marketing/brand/dolphinx-dolphin-mark-192.webp"
      width={192}
    />
  );
}

export function DxBrandLockup({
  className,
  subtitle,
  variant = "regular",
}: DxBrandLockupProps) {
  const classes = [
    styles.lockup,
    variant === "inverse" ? styles.inverse : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-label={`DX LMS${subtitle ? ` — ${subtitle}` : ""}`}
      className={classes}
      role="img"
    >
      <Image
        alt=""
        aria-hidden="true"
        className={styles.mark}
        height={192}
        src="/marketing/brand/dolphinx-dolphin-mark-192.webp"
        width={192}
      />
      <span className={styles.copy}>
        <span className={styles.name}>DX LMS</span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </span>
    </span>
  );
}
