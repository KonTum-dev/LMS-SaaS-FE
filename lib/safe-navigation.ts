export const DEFAULT_LOGIN_DESTINATION = "/dashboard";

const UNSAFE_INTERNAL_PATH_CHARACTER = /[\\\u0000-\u001f\u007f]/u;

export function resolveSafeInternalPath(
  value: string | null | undefined,
  fallback = DEFAULT_LOGIN_DESTINATION,
): string {
  if (!value || value.length > 2_048 || value !== value.trim()) return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    UNSAFE_INTERNAL_PATH_CHARACTER.test(value)
  ) {
    return fallback;
  }

  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      return fallback;
    }
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      UNSAFE_INTERNAL_PATH_CHARACTER.test(decoded)
    ) {
      return fallback;
    }
  }

  try {
    const base = new URL("https://dx-lms.invalid");
    const destination = new URL(value, base);
    if (
      destination.origin !== base.origin ||
      destination.username ||
      destination.password
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return value;
}
