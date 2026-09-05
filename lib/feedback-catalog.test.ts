import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { isKnownFeedbackText, translateFeedbackText } from "./feedback-catalog";

describe("feedback catalog", () => {
  it.each([
    ["Đã tạo gói thuê bao", "Subscription plan created"],
    ["Đã cập nhật tổ chức", "Organization updated"],
    ["Đã khôi phục thành viên", "Member restored"],
    ["Đã tạo tài khoản nền tảng.", "Platform account created."],
    ["Không thể lưu bài tập", "Could not save the assignment"],
    ["Email không hợp lệ", "Enter a valid email address"],
  ])("translates reviewed copy in both directions: %s", (vi, en) => {
    expect(translateFeedbackText(vi, "en")).toBe(en);
    expect(translateFeedbackText(en, "vi")).toBe(vi);
    expect(translateFeedbackText(vi, "vi")).toBe(vi);
    expect(translateFeedbackText(en, "en")).toBe(en);
    expect(isKnownFeedbackText(vi)).toBe(true);
    expect(isKnownFeedbackText(en)).toBe(true);
  });

  it("explains technical Vietnamese terms without changing the operation", () => {
    expect(
      translateFeedbackText(
        "Đã nạp revision mới và giữ nội dung bạn đang soạn",
        "vi",
      ),
    ).toBe("Đã tải phiên bản mới nhất và giữ nội dung bạn đang soạn");
    expect(
      translateFeedbackText("Đã hoàn tất quét chuỗi audit từ genesis", "vi"),
    ).toBe("Đã kiểm tra nhật ký thay đổi từ bản ghi đầu tiên");
    expect(translateFeedbackText("Đã cập nhật logo workspace", "vi")).toBe(
      "Đã cập nhật logo không gian làm việc",
    );
  });

  it.each([
    ["Đã thêm 1 học viên vào lớp", "1 learner added to the class"],
    ["Đã thêm 2 học viên vào lớp", "2 learners added to the class"],
    ["Đã lưu điểm danh 0 học viên", "Attendance saved for 0 learners"],
    ["Đã lưu điểm danh 1 học viên", "Attendance saved for 1 learner"],
    ["Đã lưu điểm danh 1234 học viên", "Attendance saved for 1,234 learners"],
    ["Đã tạo 1 lời mời", "1 invitation created"],
    ["Đã tạo 1.234 lời mời", "1,234 invitations created"],
    [
      "Bài học chỉ được đính kèm tối đa 1 tệp.",
      "A lesson can have up to 1 attachment.",
    ],
    [
      "Bài làm chỉ được đính kèm tối đa 10 tệp.",
      "A submission can have up to 10 attachments.",
    ],
    [
      "Bản nháp nhận tệp phải có từ 1 đến 10 tệp không trùng lặp.",
      "A file submission draft must contain between 1 and 10 unique files.",
    ],
    [
      "Không tạo được 1 lời mời. Hãy xem chi tiết từng dòng trước khi thử lại.",
      "Could not create 1 invitation. Check each row before trying again.",
    ],
    [
      "Đã tạo 1 lời mời; 2 lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.",
      "1 invitation created; 2 invitations could not be created. Check each row before trying again.",
    ],
  ])("formats known count templates safely: %s", (vi, en) => {
    expect(isKnownFeedbackText(vi)).toBe(true);
    expect(translateFeedbackText(vi, "en")).toBe(en);
    expect(isKnownFeedbackText(en)).toBe(true);
    expect(translateFeedbackText(en, "en")).toBe(en);
    expect(translateFeedbackText(vi, "vi")).toBe(vi);
  });

  it("localizes number grouping when switching back to Vietnamese", () => {
    expect(translateFeedbackText("1,234 invitations created", "vi")).toBe(
      "Đã tạo 1.234 lời mời",
    );
    expect(
      translateFeedbackText(
        "1,234 invitations created; 1 invitation could not be created. Check each row before trying again.",
        "vi",
      ),
    ).toBe(
      "Đã tạo 1.234 lời mời; 1 lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.",
    );
  });

  it.each([
    [
      "Câu 2 có mã không hợp lệ hoặc bị trùng.",
      "Question 2 has an invalid or duplicate ID.",
    ],
    [
      "Lựa chọn 3 của câu 12 đang trống hoặc vượt giới hạn.",
      "Choice 3 in question 12 is empty or exceeds the length limit.",
    ],
    [
      "Câu 1 phải có đúng một đáp án đúng.",
      "Question 1 must have exactly one correct answer.",
    ],
  ])("keeps useful assessment validation detail: %s", (vi, en) => {
    expect(isKnownFeedbackText(vi)).toBe(true);
    expect(translateFeedbackText(vi, "en", "error")).toBe(en);
    expect(translateFeedbackText(en, "vi", "error")).toBe(vi);
  });

  it.each([
    ["Đã thanh toán", "Paid"],
    ["Đã hủy", "Canceled"],
    ["Đã hết hạn", "Expired"],
    ["Cần đối soát", "Needs review"],
    ["Cần hoàn tiền", "Refund required"],
    ["Đang chờ", "Pending"],
  ])("translates the known payment-status template: %s", (vi, en) => {
    const source = `Đã cập nhật đơn thanh toán sang trạng thái “${vi}”`;
    expect(isKnownFeedbackText(source)).toBe(true);
    expect(translateFeedbackText(source, "en")).toBe(
      `Payment order status changed to “${en}”`,
    );
  });

  it.each([
    "A new message not reviewed yet",
    "Một thông báo mới chưa được duyệt",
    "constructor",
    "toString",
    "__proto__",
    "MongoServerError: password=secret",
    "Đã tạo 2 lời mời\nMongoServerError: password=secret",
    "Đã tạo 2 lời mời\n",
    "Đã tạo <script>alert(1)</script> lời mời",
    "Đã tạo 1.25 lời mời",
    "Đã tạo 9007199254740992 lời mời",
    "Đã cập nhật đơn thanh toán sang trạng thái “UNKNOWN_SECRET”",
    "Lựa chọn <script> của câu 2 đang trống hoặc vượt giới hạn.",
    "Không tạo được -1 lời mời. Hãy xem chi tiết từng dòng trước khi thử lại.",
    "Đã tạo 1 lời mời; 9007199254740992 lời mời chưa tạo được. Hãy xem chi tiết từng dòng trước khi thử lại.",
  ])("does not mark arbitrary or malformed text as trusted: %s", (value) => {
    expect(isKnownFeedbackText(value)).toBe(false);
    // The caller's structured error sanitizer owns the final safe fallback.
    expect(translateFeedbackText(value, "en", "error")).toBe(value);
  });

  it("covers contact feedback including its action", () => {
    expect(
      translateFeedbackText("Chưa gửi được yêu cầu", "en", "warning"),
    ).toBe("Your request has not been sent");
    expect(
      translateFeedbackText(
        "Kênh liên hệ đang được hoàn thiện nên thông tin chưa được gửi hoặc lưu. Bạn có thể tạo workspace dùng thử ngay.",
        "en",
      ),
    ).toContain("your information has not been sent or saved");
    expect(translateFeedbackText("Tạo workspace dùng thử", "en")).toBe(
      "Create a trial workspace",
    );
  });
});

interface ToastLiteral {
  file: string;
  line: number;
  text: string;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return /\.[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)
      ? [filename]
      : [];
  });
}

/**
 * Statically checks direct toast literals, conditional branches, fallback helper
 * arguments and numeric templates. It does not pretend to translate arbitrary
 * runtime API text; feedback-errors tests own that separate trust boundary.
 */
function toastLiterals(): ToastLiteral[] {
  const result: ToastLiteral[] = [];
  for (const filename of ["app", "components", "lib"].flatMap(sourceFiles)) {
    const source = ts.createSourceFile(
      filename,
      readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      filename.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function add(node: ts.Node, text: string) {
      if (!/\s/.test(text) || !/[a-zA-ZÀ-ỹ]/.test(text)) return;
      result.push({
        file: filename,
        line:
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        text,
      });
    }
    function collect(node: ts.Node) {
      if (ts.isStringLiteralLike(node)) {
        add(node, node.text);
      } else if (ts.isConditionalExpression(node)) {
        collect(node.whenTrue);
        collect(node.whenFalse);
      } else if (ts.isTemplateExpression(node)) {
        let text = node.head.text;
        for (const span of node.templateSpans) {
          const expression = span.expression.getText(source);
          text +=
            (expression.includes("getBillingStatusPresentation")
              ? "Đã hủy"
              : "2") + span.literal.text;
        }
        add(node, text);
      } else if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            /^(content|title|description)$/.test(property.name.getText(source))
          )
            collect(property.initializer);
        }
      } else if (ts.isCallExpression(node)) {
        node.arguments.forEach(collect);
      } else if (ts.isParenthesizedExpression(node)) {
        collect(node.expression);
      }
    }
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          /message|notification/i.test(
            node.expression.expression.getText(source),
          ) &&
          /^(success|error|warning|info|loading|open)$/.test(
            node.expression.name.text,
          )
        ) {
          if (node.arguments[0]) collect(node.arguments[0]);
        } else if (node.expression.getText(source) === "onActionSuccess") {
          node.arguments.slice(1).forEach(collect);
        } else if (
          /(?:^|\.)reportError$/.test(node.expression.getText(source))
        ) {
          // The first argument is an unknown Error/ApiError; only the explicit
          // fallback is trusted local copy and must be in the catalog.
          node.arguments.slice(1).forEach(collect);
        } else if (
          filename === path.join("lib", "assessment-draft.ts") &&
          node.expression.getText(source) === "issues.push"
        ) {
          node.arguments.forEach(collect);
        }
      }
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === "adminOrderActionSuccessMessage"
      ) {
        function returns(child: ts.Node) {
          if (ts.isReturnStatement(child) && child.expression)
            collect(child.expression);
          ts.forEachChild(child, returns);
        }
        returns(node);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return result;
}

describe("toast source inventory", () => {
  it("requires reviewed English and Vietnamese copy for direct toast text", () => {
    const literals = toastLiterals();
    expect(literals.length).toBeGreaterThan(130);
    const missing = literals.filter(
      (entry) => !isKnownFeedbackText(entry.text),
    );
    expect(
      missing.map(({ file, line, text }) => `${file}:${line} ${text}`),
    ).toEqual([]);
    for (const { text } of literals) {
      const english = translateFeedbackText(text, "en");
      expect(isKnownFeedbackText(english), text).toBe(true);
      expect(english, text).not.toMatch(/[À-ỹ]/);
    }
  });
});
