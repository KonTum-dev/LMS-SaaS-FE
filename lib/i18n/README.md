# DX LMS UI localization

Supported locales are `vi` (default) and `en`. The existing language selector now controls the entire application, Ant Design, and feedback. A preference cookie (`dx-lms-locale`) selects server-rendered copy and metadata; the original local-storage key is retained for migration and cross-tab synchronization.

## Client views

Use `useI18n(featureMessages)` from `components/i18n/i18n-provider`. Keep dictionaries at module scope and add the original Vietnamese text plus its reviewed English translation to the relevant feature catalog. Wrap only application-owned labels, validation messages and presentation status names with `t(...)`.

```tsx
const { t, formatNumber, formatDate } = useI18n(learningMessages);
const label = t("Học viên");
```

Never translate user names, emails, IDs, API enum values, course content, submitted answers, uploaded filenames, or audit evidence. Translate presentation labels separately from the values sent to the API. Preserve the existing form and authority scopes when switching languages.

Use named placeholders for full sentences instead of concatenating translated fragments. Interpolation preserves values verbatim and runs once. Format a displayed count with `formatNumber` explicitly; raw numeric placeholders may also represent years, IDs or indices. Currency formatting defaults to VND. Dates use `Asia/Ho_Chi_Minh` by default on both server and client; callers can override the time zone.

Store raw error causes/source copy in component state, and translate when rendering. Use the safe feedback-error mapper for server failures rather than displaying arbitrary `Error.message`. Keep notification toasts on `useFeedback()` so their accessible roles, durations, allowlisted error handling, and authority protections stay intact.

## Server views

Use `await getServerI18n(featureMessages)` from `lib/i18n/server`. Locale is read per request from the cookie; never store a mutable global current language. `LocaleRouteRefresh` refreshes server-owned content after a selection without changing the route or remounting form/auth providers, and corrects out-of-order language responses.

## Verification

`lib/i18n/translate.test.ts` checks dictionary parity, placeholder preservation, source precedence, interpolation safety, and number/date formatting. Feature inventories cover literal UI copy. Provider and route-refresh tests cover persistence, cross-tab updates, unchanged form values, and rapid language switches. Add both VI and EN assertions when adding a new feature, then run `npm test`, `npm run lint`, and `npm run build`.

Translation catalogs contain product UI and product-authored public pages. User-authored and backend data is intentionally not machine-translated.
