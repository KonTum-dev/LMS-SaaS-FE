"use client";

import { useEffect } from "react";

export function MarketingHeaderEnhancement() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-marketing-header]");
    if (!header) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || !header.contains(link)) return;

      const mobileMenu = link.closest("details");
      if (mobileMenu) mobileMenu.open = false;

      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const destination = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!destination) return;

      const alreadyFocusable = destination.hasAttribute("tabindex");
      if (!alreadyFocusable) destination.setAttribute("tabindex", "-1");
      destination.focus({ preventScroll: true });
      if (!alreadyFocusable) {
        destination.addEventListener("blur", () => destination.removeAttribute("tabindex"), { once: true });
      }
    };

    header.addEventListener("click", handleClick);
    return () => header.removeEventListener("click", handleClick);
  }, []);

  return null;
}
