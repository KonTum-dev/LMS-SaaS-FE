const RESET_TOKEN_PATTERN = /^[a-f\d]{24}\.[A-Za-z0-9_-]{43}$/i;

interface FragmentLocation {
  hash: string;
  pathname: string;
  replace?: (url: string) => void;
  search: string;
}

interface FragmentHistory {
  readonly state: unknown;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

export function passwordValidationError(password: string): string | null {
  if (Array.from(password).length < 8) {
    return "Mật khẩu phải có ít nhất 8 ký tự";
  }
  if (new TextEncoder().encode(password).byteLength > 72) {
    return "Mật khẩu không được vượt quá 72 byte UTF-8";
  }
  return null;
}

export function passwordConfirmationError(password: string, confirmation: string): string | null {
  return password === confirmation ? null : "Mật khẩu xác nhận chưa khớp";
}

export function consumePasswordResetToken(
  location: FragmentLocation,
  history: FragmentHistory,
): string | null {
  const fragment = location.hash;
  const query = new URLSearchParams(location.search);
  let removedQueryToken = false;
  for (const key of [...query.keys()]) {
    if (key.toLocaleLowerCase("en-US") !== "token") continue;
    query.delete(key);
    removedQueryToken = true;
  }
  const safeQuery = query.toString();
  const cleanUrl = `${location.pathname}${safeQuery ? `?${safeQuery}` : ""}`;

  if (fragment || removedQueryToken) {
    try {
      history.replaceState(history.state, "", cleanUrl);
    } catch {
      try { location.replace?.(cleanUrl); } catch { /* Fail closed below. */ }
      return null;
    }
  }
  if (!fragment) return null;

  const params = new URLSearchParams(fragment.slice(1));
  const tokens = params.getAll("token");
  if (tokens.length !== 1 || [...params.keys()].some((key) => key !== "token")) return null;
  return RESET_TOKEN_PATTERN.test(tokens[0]) ? tokens[0] : null;
}
