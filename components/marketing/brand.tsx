import styles from "@/app/marketing.module.css";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={styles.brand}>
      <span className={`${styles.brandMark} ${inverse ? styles.brandMarkInverse : ""}`} aria-hidden="true">
        DX
      </span>
      <span className={styles.brandName}>DX LMS</span>
    </span>
  );
}
