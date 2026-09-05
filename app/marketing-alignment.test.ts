// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "app/marketing-v2.module.css"),
  "utf8",
);
const desktopCss = css.split("@media", 1)[0];

function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  expect(body, `Expected CSS rule ${selector}`).toBeDefined();
  return body ?? "";
}

function media(maxWidth: number): string {
  const body = css.match(
    new RegExp(`@media \\(max-width: ${maxWidth}px\\) \\{([\\s\\S]*?)^\\}`, "m"),
  )?.[1];
  expect(body, `Expected ${maxWidth}px breakpoint`).toBeDefined();
  return body ?? "";
}

describe("public marketing alignment", () => {
  it("keeps all three onboarding cards in the same row without a middle offset", () => {
    expect(rule(desktopCss, ".steps")).toContain(
      "grid-template-columns: repeat(3, minmax(0, 1fr))",
    );
    const card = rule(desktopCss, ".stepCard");
    expect(card).toContain("display: flex");
    expect(card).toContain("flex-direction: column");
    expect(card).toContain("align-items: flex-start");
    expect(card).toContain("min-width: 0");
    expect(css).not.toMatch(/\.stepCard:nth-child\(2\)/);
  });

  it("keeps concise headings readable without clipping or fixed-height boxes", () => {
    const heading = rule(desktopCss, ".stepCard h3");
    expect(heading).toContain("line-height: 1.4");
    expect(heading).not.toContain("overflow: hidden");
    expect(heading).not.toMatch(/(?:^|;)\s*height:/);
  });

  it("uses open steps rather than nested cards and redundant actions", () => {
    expect(rule(desktopCss, ".stepCard")).not.toContain("box-shadow");
    expect(rule(desktopCss, ".stepCard p")).toContain("line-height: 1.7");
  });

  it("removes decorative dotted connectors from the rendered onboarding markup", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/marketing/home-sections.tsx"),
      "utf8",
    );
    const steps = source.split("export function GettingStartedSteps()", 2)[1]
      ?.split("export function Benefits()", 1)[0];
    expect(steps).toBeDefined();
    expect(steps).not.toContain("styles.stepLine");
    expect(steps).not.toContain("href={step.href}");
    expect(rule(desktopCss, ".stepLine")).toContain("display: none");
  });

  it("lets stacked mobile cards and headings use their natural content height", () => {
    const mobile = media(809);
    expect(rule(mobile, ".steps")).toContain("grid-template-columns: 1fr");
    expect(rule(mobile, ".stepCard")).toContain("min-height: 0");
    expect(rule(mobile, ".stepCard h3")).toContain("min-height: 0");
  });

  it("overrides the more specific contact desktop grid on mobile", () => {
    const mobile = media(809);
    expect(rule(mobile, '.pageHero[data-visual="contact"]')).toContain(
      "min-height: auto",
    );
    const contactGrid = rule(mobile, '.pageHero[data-visual="contact"] .pageHeroInner');
    expect(contactGrid).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(contactGrid).toContain("gap: 32px");
  });

  it("applies contact heading font sizes with matching selector specificity", () => {
    const selector = '.pageHero[data-visual="contact"] h1';
    expect(rule(media(809), selector)).toContain("font-size: clamp(34px,9vw,48px)");
    expect(rule(media(560), selector)).toContain("font-size: 32px");
  });
});
