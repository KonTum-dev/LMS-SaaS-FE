import Link from "next/link";
import styles from "@/app/marketing.module.css";
import { Brand } from "./brand";
import { MarketingHeaderEnhancement } from "./marketing-header-enhancement";
import { MarketingIcon } from "./marketing-icon";

const navigation = [
  { href: "#san-pham", label: "Sản phẩm" },
  { href: "#vai-tro", label: "Vai trò" },
  { href: "#bao-mat", label: "Bảo mật" },
  { href: "#bang-gia", label: "Gói triển khai" },
  { href: "#faq", label: "Hỏi đáp" },
];

export function MarketingHeader() {
  return (
    <header className={styles.header} data-marketing-header>
      <MarketingHeaderEnhancement />
      <a className={styles.skipLink} href="#noi-dung-chinh">Bỏ qua điều hướng</a>
      <div className={styles.headerInner}>
        <a className={styles.brandLink} href="#top" aria-label="DX LMS, về đầu trang">
          <Brand />
        </a>

        <nav className={styles.desktopNav} aria-label="Điều hướng chính">
          {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.textLink} href="/login">Đăng nhập</Link>
          <Link className={styles.compactButton} href="/login">
            Mở workspace <MarketingIcon name="right" />
          </Link>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Menu điều hướng">
            <MarketingIcon name="menu" />
            <span>Menu</span>
          </summary>
          <nav aria-label="Điều hướng trên thiết bị di động">
            {navigation.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
            <Link href="/login">Đăng nhập vào workspace</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
