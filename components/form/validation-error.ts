export function isFormValidationError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "errorFields" in error
    && Array.isArray((error as { errorFields?: unknown }).errorFields),
  );
}
