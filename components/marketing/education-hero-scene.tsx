import Image from "next/image";
import styles from "./education-hero-scene.module.css";

type EducationHeroSceneProps = {
  alt: string;
};

export function EducationHeroScene({ alt }: EducationHeroSceneProps) {
  return (
    <div className={styles.scene} data-hero-visual>
      <div className={styles.parallax}>
        <Image
          className={styles.learningScene}
          src="/marketing/illustrations/learning-together-v2.png"
          alt={alt}
          width={1448}
          height={1086}
          sizes="(max-width: 620px) 100vw, (max-width: 999px) 620px, (max-width: 1462px) 52vw, 760px"
          preload
        />
        <span className={`${styles.stationery} ${styles.pencil}`} aria-hidden="true">
          <Image
            src="/marketing/illustrations/pencil-v1.png"
            alt=""
            width={1254}
            height={1254}
            sizes="90px"
            loading="eager"
            draggable={false}
          />
        </span>
        <span className={`${styles.stationery} ${styles.ruler}`} aria-hidden="true">
          <Image
            src="/marketing/illustrations/ruler-v1.png"
            alt=""
            width={1254}
            height={1254}
            sizes="100px"
            loading="eager"
            draggable={false}
          />
        </span>
        <span className={`${styles.stationery} ${styles.eraser}`} aria-hidden="true">
          <Image
            src="/marketing/illustrations/eraser-v1.png"
            alt=""
            width={1254}
            height={1254}
            sizes="60px"
            loading="eager"
            draggable={false}
          />
        </span>
      </div>
    </div>
  );
}
