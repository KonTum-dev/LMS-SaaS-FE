import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createTranslator } from "./translate";
import { learningMessages } from "./learning-messages";
import { getSubscriptionAccessPresentation } from "@/lib/entitlements";
import { viewMessageCatalog } from "@/test-utils/ui-messages-inventory";

const directories = ["app/(workspace)/dashboard", "app/(workspace)/courses", "app/(workspace)/cohorts", "app/(workspace)/assessments", "app/(workspace)/assignments", "app/(workspace)/reports", "app/(workspace)/audit", "components/assessments", "components/media", "components/integrations", "components/table"];

describe("learning UI message inventory", () => {
  it("has reviewed English copy and preserves interpolation parameters", () => {
    expect(Object.keys(learningMessages).length).toBeGreaterThan(1000);
    for (const [source, english] of Object.entries(learningMessages)) {
      expect(english.trim(), source).not.toBe("");
      expect(english, source).not.toMatch(/[À-ỹĐđ]/u);
      expect([...english.matchAll(/\{([a-zA-Z]\w*)\}/g)].map(match => match[1]).sort(), source)
        .toEqual([...source.matchAll(/\{([a-zA-Z]\w*)\}/g)].map(match => match[1]).sort());
    }
  });

  it("covers every static learning t() source string", () => {
    const missing: string[] = [];
    for (const directory of directories) {
      for (const path of readdirSync(join(process.cwd(), directory), { recursive: true }) as string[]) {
        if (!path.endsWith(".tsx") || path.endsWith(".test.tsx")) continue;
        const file = join(directory, path);
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const translate = createTranslator("en", viewMessageCatalog(source));
        const visit = (node: ts.Node) => {
          if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && ts.isStringLiteral(node.arguments[0])) {
            const text = node.arguments[0].text;
            if (/[À-ỹĐđ]/u.test(translate(text))) missing.push(`${file}: ${text}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
    expect(missing).toEqual([]);
  });

  it("does not reinterpret user content inside translated labels", () => {
    const t = createTranslator("en", learningMessages);
    expect(t("Chỉnh sửa bài tập {p0}", { p0: "Bài kiểm tra {p1}" })).toBe("Edit assignment Bài kiểm tra {p1}");
  });

  it("keeps concise page descriptions and unit enrollment permissions bilingual", () => {
    const english = createTranslator("en", learningMessages);
    const vietnamese = createTranslator("vi", learningMessages);
    const descriptions = {
      "Theo dõi khóa học và hoạt động đào tạo.": "Track courses and learning activity.",
      "Quản lý nội dung, giảng viên và học viên.": "Manage course content, instructors, and learners.",
      "Tạo bài tập, đặt hạn nộp và công bố cho học viên.": "Create assignments, set due dates, and publish to learners.",
      "Bạn quản lý ghi danh trong đơn vị. Nội dung do quản trị viên toàn tổ chức hoặc giảng viên phụ trách quản lý.": "Manage enrollment for your unit. Organization-wide administrators or assigned instructors manage course content.",
    };
    for (const [source, translation] of Object.entries(descriptions)) {
      expect(english(source)).toBe(translation);
      expect(vietnamese(source)).toBe(source);
    }
  });

  it("translates every dashboard subscription status label", () => {
    const english = createTranslator("en", learningMessages);
    expect(["ACTIVE", "GRACE", "READ_ONLY"].map(state =>
      english(getSubscriptionAccessPresentation(state as "ACTIVE" | "GRACE" | "READ_ONLY").label),
    )).toEqual(["Active", "Grace period", "Read-only"]);
  });
});
