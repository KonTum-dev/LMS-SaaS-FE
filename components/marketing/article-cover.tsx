"use client";

import Image from "next/image";
import { useI18n } from "@/components/i18n/i18n-provider";
import { marketingMessages } from "@/lib/i18n/marketing-messages";
import type { MarketingBlogPost } from "@/lib/marketing-content";
import styles from "./article-cover.module.css";

const cardSizes =
  "(max-width: 560px) calc(100vw - 28px), (max-width: 809px) calc(50vw - 35px), (max-width: 1248px) calc(33.333vw - 31px), 386px";
const largeSizes =
  "(max-width: 560px) calc(100vw - 40px), (max-width: 1088px) calc(100vw - 68px), 1020px";

export function ArticleCover({
  post,
  large = false,
}: {
  post: MarketingBlogPost;
  large?: boolean;
}) {
  const { t } = useI18n(marketingMessages);

  return (
    <div
      className={styles.articleVisual}
      data-article-cover={post.slug}
      data-size={large ? "large" : "card"}
    >
      <Image
        alt={large ? t(post.title) : ""}
        className={styles.image}
        fill
        loading="lazy"
        sizes={large ? largeSizes : cardSizes}
        src={post.hero}
      />
    </div>
  );
}
