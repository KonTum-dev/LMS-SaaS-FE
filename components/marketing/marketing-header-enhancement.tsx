"use client";

import { useEffect } from "react";

export function MarketingHeaderEnhancement() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const destination = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!destination) return;

      const mobileMenu = link.closest("details");
      if (mobileMenu) mobileMenu.open = false;

      const alreadyFocusable = destination.hasAttribute("tabindex");
      if (!alreadyFocusable) destination.setAttribute("tabindex", "-1");
      destination.focus({ preventScroll: true });
      if (!alreadyFocusable) {
        destination.addEventListener("blur", () => destination.removeAttribute("tabindex"), { once: true });
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
