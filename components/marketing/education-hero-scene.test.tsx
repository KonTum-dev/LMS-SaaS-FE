// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EducationHeroScene } from "./education-hero-scene";

const componentPath = "components/marketing/education-hero-scene";
const css = readFileSync(resolve(process.cwd(), `${componentPath}.module.css`), "utf8");
const source = readFileSync(resolve(process.cwd(), `${componentPath}.tsx`), "utf8");

afterEach(cleanup);

describe("education hero scene", () => {
  it("exposes the supplied localized description only on the main scene", () => {
    const alt = "Giáo viên hướng dẫn hai học sinh cùng học tại bàn.";
    const { container, rerender } = render(<EducationHeroScene alt={alt} />);
    const mainImage = screen.getByRole("img", { name: alt });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(decodeURIComponent(mainImage.getAttribute("src") ?? ""))
      .toContain("/marketing/illustrations/learning-together-v2.png");
    expect(mainImage.getAttribute("width")).toBe("1448");
    expect(mainImage.getAttribute("height")).toBe("1086");

    const decorations = container.querySelectorAll('span[aria-hidden="true"] img');
    expect(decorations).toHaveLength(3);
    for (const decoration of decorations) {
      expect(decoration.getAttribute("alt")).toBe("");
      expect(decoration.getAttribute("draggable")).toBe("false");
    }

    const english = "A teacher helps two students study together at a desk.";
    rerender(<EducationHeroScene alt={english} />);
    expect(screen.getByRole("img", { name: english })).toBe(mainImage);
    expect(screen.queryByRole("img", { name: alt })).toBeNull();
  });

  it("keeps one stable pointer target separate from the inner transform", () => {
    const { container } = render(<EducationHeroScene alt="Learning together" />);
    const roots = container.querySelectorAll("[data-hero-visual]");
    expect(roots).toHaveLength(1);
    expect(roots[0].querySelector("[data-reveal]")).toBeNull();
    expect(roots[0].hasAttribute("data-reveal")).toBe(false);
    expect(container.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
    expect(source).not.toMatch(/addEventListener|useEffect|onPointer\w+\s*=/);
    expect(css).toContain("translate3d(var(--hero-x, 0px), var(--hero-y, 0px), 0)");
    expect(css).toContain("pointer-events: none");
  });

  it("reserves a 4:3 image area and preloads only the main scene", () => {
    render(<EducationHeroScene alt="Learning together" />);
    const image = screen.getByRole("img", { name: "Learning together" });
    expect(image.getAttribute("sizes")).toBe(
      "(max-width: 620px) 100vw, (max-width: 999px) 620px, (max-width: 1462px) 52vw, 760px",
    );
    expect(source.match(/\bpreload\b/g)).toHaveLength(1);
    expect(css).toContain("aspect-ratio: 4 / 3");
    expect(css).toContain("max-width: 760px");
    expect(css).toMatch(/@media \(max-width: 999px\)\s*\{\s*\.scene \{ max-width: 620px; \}/);
    expect(css).toContain("object-fit: contain");
    expect(css).not.toMatch(/object-fit:\s*cover/);
  });

  it("ships the full-sized 4:3 scene and square transparent stationery assets", () => {
    const assets = [
      ["learning-together-v2.png", 1448, 1086],
      ["pencil-v1.png", 1254, 1254],
      ["ruler-v1.png", 1254, 1254],
      ["eraser-v1.png", 1254, 1254],
    ] as const;

    for (const [name, width, height] of assets) {
      const image = readFileSync(resolve(process.cwd(), "public/marketing/illustrations", name));
      expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(image.readUInt32BE(16), name).toBe(width);
      expect(image.readUInt32BE(20), name).toBe(height);
      if (name !== "learning-together-v2.png") {
        expect(image[25], `${name} should have an alpha channel`).toBe(6);
      }
    }
  });

  it("limits automatic stationery motion to one 4.5-second sequence that settles", () => {
    expect(css).toContain("animation: stationeryArrival 4.5s ease-in-out 1 both");
    expect(css).toContain("0%, 100% { transform: translateY(0) rotate(0); }");
    expect(css).not.toMatch(/infinite|animation-delay/);
    const sceneRules = css.split(".stationery", 1)[0];
    expect(sceneRules).not.toMatch(/animation\s*:/);
  });

  it("disables both parallax and stationery animation when reduced motion is requested", () => {
    const reduced = css.split("@media (prefers-reduced-motion: reduce)", 2)[1];
    expect(reduced).toBeDefined();
    expect(reduced).toMatch(/\.parallax\s*\{[^}]*transform: none;[^}]*transition: none;/);
    expect(reduced).toMatch(/\.stationery\s*\{[^}]*animation: none;[^}]*transform: none;/);
  });

  it("blends only the outer five percent without cropping the people", () => {
    expect(css).toContain("linear-gradient(to right, transparent, #000 5%, #000 95%, transparent)");
    expect(css).toContain("linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)");
    expect(css).toContain("mask-composite: intersect");
    expect(css).not.toMatch(/overflow:\s*hidden|clip-path/);
  });
});
