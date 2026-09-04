"use client";

import { useEffect } from "react";

export function MarketingMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>("[data-marketing-page]");
    if (!page) return;

    const reducedMotion = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = [...page.querySelectorAll<HTMLElement>("[data-reveal]")];
    const header = page.querySelector<HTMLElement>("[data-marketing-header]");
    const heroVisual = page.querySelector<HTMLElement>("[data-hero-visual]");
    const documentRoot = document.documentElement;
    const previousScrollBehavior = documentRoot.style.scrollBehavior;

    if (!reducedMotion) documentRoot.style.scrollBehavior = "smooth";

    revealItems.forEach((item) => {
      if (reducedMotion || !("IntersectionObserver" in window) || item.getBoundingClientRect().top < window.innerHeight * 0.98) {
        item.dataset.revealInitial = "true";
        item.dataset.revealed = "true";
      }
    });
    page.dataset.motionReady = "true";

    let observer: IntersectionObserver | null = null;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => { item.dataset.revealed = "true"; });
    } else {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer?.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8%", threshold: 0.12 });
      revealItems.filter((item) => item.dataset.revealed !== "true").forEach((item) => observer?.observe(item));
    }

    let headerScrolled: boolean | null = null;
    const syncHeader = () => {
      const nextScrolled = window.scrollY > 18;
      if (!header || nextScrolled === headerScrolled) return;
      headerScrolled = nextScrolled;
      header.dataset.scrolled = nextScrolled ? "true" : "false";
    };
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });

    let heroBounds: DOMRect | null = null;
    let heroFrame = 0;
    let nextHeroX = 0;
    let nextHeroY = 0;

    const measureHero = () => {
      heroBounds = heroVisual?.getBoundingClientRect() ?? null;
    };
    const renderHero = () => {
      heroFrame = 0;
      heroVisual?.style.setProperty("--hero-x", `${nextHeroX.toFixed(2)}px`);
      heroVisual?.style.setProperty("--hero-y", `${nextHeroY.toFixed(2)}px`);
    };
    const moveHero = (event: PointerEvent) => {
      if (!heroVisual || reducedMotion || event.pointerType === "touch") return;
      const bounds = heroBounds ?? heroVisual.getBoundingClientRect();
      heroBounds = bounds;
      if (!bounds.width || !bounds.height) return;
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      nextHeroX = x * 10;
      nextHeroY = y * 8;
      if (!heroFrame) heroFrame = window.requestAnimationFrame(renderHero);
    };
    const resetHero = () => {
      heroBounds = null;
      if (heroFrame) window.cancelAnimationFrame(heroFrame);
      heroFrame = 0;
      heroVisual?.style.setProperty("--hero-x", "0px");
      heroVisual?.style.setProperty("--hero-y", "0px");
    };
    const invalidateHeroBounds = () => { heroBounds = null; };
    heroVisual?.addEventListener("pointerenter", measureHero);
    heroVisual?.addEventListener("pointermove", moveHero);
    heroVisual?.addEventListener("pointerleave", resetHero);
    window.addEventListener("resize", invalidateHeroBounds, { passive: true });

    return () => {
      observer?.disconnect();
      if (heroFrame) window.cancelAnimationFrame(heroFrame);
      window.removeEventListener("scroll", syncHeader);
      window.removeEventListener("resize", invalidateHeroBounds);
      heroVisual?.removeEventListener("pointerenter", measureHero);
      heroVisual?.removeEventListener("pointermove", moveHero);
      heroVisual?.removeEventListener("pointerleave", resetHero);
      documentRoot.style.scrollBehavior = previousScrollBehavior;
      delete page.dataset.motionReady;
    };
  }, []);

  return null;
}
