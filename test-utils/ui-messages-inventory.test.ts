import ts from "typescript";
import { describe, expect, it } from "vitest";
import { viewMessageCatalog } from "./ui-messages-inventory";

function catalog(code: string) {
  return viewMessageCatalog(ts.createSourceFile("test-view.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
}

describe("view message catalog inventory", () => {
  it.each(["@/components/users/user-creation-messages", "./user-creation-messages"])("resolves the account-creation catalog from %s", (module) => {
    const result = catalog(`
      import { userCreationMessages as accountCopy } from "${module}";
      const { t } = useI18n(accountCopy);
    `);
    expect(result["Mật khẩu cần ít nhất 12 ký tự"]).toBe("Use at least 12 characters");
  });

  it("follows import aliases and composed dictionaries", () => {
    const result = catalog(`
      import { operationsMessages as operations } from "@/lib/i18n/operations-messages";
      import { workspacePolishMessages as polish } from "@/lib/i18n/workspace-polish-messages";
      const messages = { ...operations, ...polish };
      const { t } = useI18n(messages);
    `);
    expect(result["Thời điểm lỗi"]).toBe("Failed at");
    expect(result["Không giới hạn {resource}"]).toBe("Unlimited {resource}");
  });

  it("does not let unused imported translations hide missing copy", () => {
    const result = catalog(`
      import { operationsMessages } from "@/lib/i18n/operations-messages";
      import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
      const { t } = useI18n(operationsMessages);
    `);
    expect(result["Thời điểm lỗi"]).toBeUndefined();
  });

  it("fails closed for an unsupported dictionary expression", () => {
    expect(() => catalog("const { t } = useI18n(getMessages());")).toThrow("Unresolved useI18n catalog");
  });
});
