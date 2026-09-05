import ts from "typescript";
import { userCreationMessages } from "@/components/users/user-creation-messages";
import { accountPolishMessages } from "@/lib/i18n/account-polish-messages";
import { authMessages } from "@/lib/i18n/auth-messages";
import { learningMessages } from "@/lib/i18n/learning-messages";
import { learningPolishMessages, operationsPolishMessages } from "@/lib/i18n/learning-polish-messages";
import { operationsMessages } from "@/lib/i18n/operations-messages";
import { workspacePolishMessages } from "@/lib/i18n/workspace-polish-messages";
import type { UiDictionary } from "@/lib/i18n/translate";

const catalogs: Record<string, UiDictionary> = {
  accountPolishMessages, authMessages, learningMessages, learningPolishMessages,
  operationsMessages, operationsPolishMessages, workspacePolishMessages, userCreationMessages,
};

/** Resolve the catalogs actually passed to useI18n, not every available translation. */
export function viewMessageCatalog(source: ts.SourceFile): UiDictionary {
  const imports = new Map<string, UiDictionary>();
  const values = new Map<string, ts.Expression>();
  const dictionaries: ts.Expression[] = [];
  const collect = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && (node.moduleSpecifier.text.includes("/i18n/")
        || node.moduleSpecifier.text === "@/components/users/user-creation-messages"
        || node.moduleSpecifier.text === "./user-creation-messages")) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const binding of bindings.elements) {
          const catalog = catalogs[(binding.propertyName ?? binding.name).text];
          if (catalog) imports.set(binding.name.text, catalog);
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      values.set(node.name.text, node.initializer);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === "useI18n" && node.arguments[0]) {
      dictionaries.push(node.arguments[0]);
    }
    ts.forEachChild(node, collect);
  };
  collect(source);

  const resolve = (expression: ts.Expression, seen = new Set<string>()): UiDictionary => {
    if (ts.isIdentifier(expression)) {
      const imported = imports.get(expression.text);
      if (imported) return imported;
      const value = values.get(expression.text);
      if (value && !seen.has(expression.text)) {
        return resolve(value, new Set([...seen, expression.text]));
      }
    }
    if (ts.isObjectLiteralExpression(expression)) {
      return Object.assign({}, ...expression.properties.map((property) => {
        if (ts.isSpreadAssignment(property)) return resolve(property.expression, seen);
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)
          && (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))) {
          return { [property.name.text]: property.initializer.text };
        }
        throw new Error(`Unsupported catalog entry in ${source.fileName}: ${property.getText(source)}`);
      }));
    }
    if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)
      || ts.isParenthesizedExpression(expression)) return resolve(expression.expression, seen);
    throw new Error(`Unresolved useI18n catalog in ${source.fileName}: ${expression.getText(source)}`);
  };
  return Object.assign({}, ...dictionaries.map((expression) => resolve(expression)));
}
