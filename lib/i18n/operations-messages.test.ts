import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { operationsMessages } from "./operations-messages";
import { createTranslator } from "./translate";
import { passwordValidationError } from "@/lib/password-security";
import { viewMessageCatalog } from "@/test-utils/ui-messages-inventory";

const views = [
  "app/(workspace)/admin/page.tsx",
  "app/(workspace)/admin/accounts/page.tsx",
  "app/(workspace)/admin/audit/page.tsx",
  "app/(workspace)/admin/billing/page.tsx",
  "app/(workspace)/admin/notification-events/page.tsx",
  "app/(workspace)/admin/tenants/page.tsx",
  "app/(workspace)/billing/page.tsx",
  "app/(workspace)/billing/status/[id]/page.tsx",
  "app/(workspace)/users/page.tsx",
  "app/(workspace)/users/import/page.tsx",
  "app/(workspace)/organization/page.tsx",
  "app/(workspace)/organization/access/page.tsx",
  "app/(workspace)/settings/page.tsx",
  "app/(workspace)/tuition/page.tsx",
  "app/(workspace)/guardians/page.tsx",
  "app/(workspace)/communications/page.tsx",
  "components/users/tenant-members-manager.tsx",
  "components/audit/audit-ledger-view.tsx",
];

describe("operations source inventory", () => {
  it.each([
    [
      "short",
      "Mật khẩu phải có ít nhất 8 ký tự",
      "The password must have at least 8 characters",
    ],
    [
      "a".repeat(73),
      "Mật khẩu không được vượt quá 72 byte UTF-8",
      "The password must not exceed 72 UTF-8 bytes",
    ],
  ])(
    "localizes the tenant password validator for %s",
    (password, viMessage, enMessage) => {
      const issue = passwordValidationError(password);
      expect(issue).toBe(viMessage);
      expect(createTranslator("vi", operationsMessages)(issue!)).toBe(
        viMessage,
      );
      expect(createTranslator("en", operationsMessages)(issue!)).toBe(
        enMessage,
      );
    },
  );
  it.each(views)(
    "has English copy for every Vietnamese translation key in %s",
    (file) => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const tree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const translate = createTranslator("en", viewMessageCatalog(tree));
      const missing: string[] = [];
      let count = 0;
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (/[À-ỹĐđ]/u.test(key)) {
            count += 1;
            if (translate(key) === key) missing.push(key);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(tree);
      expect(count).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    },
  );

  it("preserves user data and replaces placeholders only once", () => {
    const translate = createTranslator("en", operationsMessages);
    expect(
      translate("Không giới hạn {resource}", {
        resource: "Nguyễn Văn Học {count}",
      }),
    ).toBe("Unlimited Nguyễn Văn Học {count}");
  });
});
