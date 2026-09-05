// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "app/lms-theme.css"), "utf8");

describe("admin form modal viewport bounds", () => {
  it("overrides AntD's default top offset at desktop and mobile breakpoints", () => {
    // Both classes are needed to win over AntD's modal positioning rule.
    expect(css).toMatch(/\.ant-modal\.admin-form-modal\s*\{\s*top:\s*24px;/);
    expect(css).toMatch(/@media\s*\(max-width:\s*600px\)\s*\{\s*\.ant-modal\.admin-form-modal\s*\{\s*top:\s*12px;/);
    expect(css).not.toMatch(/(?:^|\n)\s*\.admin-form-modal\s*\{\s*top:/);
  });

  it("reserves viewport gutters and scrolls form content without shrinking footer actions", () => {
    expect(css).toMatch(/\.admin-form-modal \.ant-modal-container\s*\{[^}]*max-height:\s*calc\(100dvh - 48px\)/);
    expect(css).toMatch(/\.admin-form-modal \.ant-modal-container\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\)/);
    expect(css).toMatch(/\.admin-form-modal \.ant-modal-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.admin-form-modal \.ant-modal-footer\s*\{[^}]*flex:\s*none/);
  });
});
