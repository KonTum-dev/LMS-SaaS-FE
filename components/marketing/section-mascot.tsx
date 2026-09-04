import Image from "next/image";
import styles from "@/app/marketing.module.css";

const mascots = {
  about: {
    className: styles.sectionMascotAbout,
    src: "/graphics/dx-lms-dolphin-about.png",
    width: 750,
    height: 900,
  },
  motivation: {
    className: styles.sectionMascotMotivation,
    src: "/graphics/dx-lms-dolphin-motivation.png",
    width: 843,
    height: 900,
  },
  services: {
    className: styles.sectionMascotServices,
    src: "/graphics/dx-lms-dolphin-services.png",
    width: 768,
    height: 900,
  },
  pricing: {
    className: styles.sectionMascotPricing,
    src: "/graphics/dx-lms-dolphin-pricing.png",
    width: 822,
    height: 900,
  },
  cta: {
    className: styles.sectionMascotCta,
    src: "/graphics/dx-lms-dolphin-cta.png",
    width: 857,
    height: 900,
  },
  contact: {
    className: styles.sectionMascotContact,
    src: "/graphics/dx-lms-dolphin-contact.png",
    width: 750,
    height: 900,
  },
} as const;

type SectionMascotVariant = keyof typeof mascots;

export function SectionMascot({ variant }: { variant: SectionMascotVariant }) {
  const mascot = mascots[variant];

  return (
    <figure
      className={`${styles.sectionMascot} ${mascot.className}`}
      aria-hidden="true"
      data-reveal
      data-section-mascot={variant}
    >
      <Image
        src={mascot.src}
        alt=""
        width={mascot.width}
        height={mascot.height}
        sizes="(max-width: 620px) 68vw, (max-width: 768px) 58vw, 300px"
      />
    </figure>
  );
}
