import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// These structural regression checks do not replace nginx -t or a VPS smoke test.
function configuration(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/#.*$/gm, "");
}

function locations(source: string): Map<string, string> {
  return new Map(
    Array.from(
      source.matchAll(
        /^[\t ]*location ([^\n]+?) \{[\t ]*\r?\n([\s\S]*?)^[\t ]*\}/gm,
      ),
      (match) => [match[1].trim(), match[2]],
    ),
  );
}

function apiLocation(selector: string): string {
  const body = locations(configuration("./nginx/lms-api-locations.conf")).get(
    selector,
  );
  expect(body, `Missing protected API location: ${selector}`).toBeDefined();
  return body!;
}

function expectDirective(body: string, directive: string): void {
  expect(body.split(";").map((part) => part.trim().replace(/\s+/g, " ")))
    .toContain(directive);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("same-domain Nginx routing", () => {
  it("serves the production domain and includes API routes alongside the FE", () => {
    const frontend = configuration("./lms-frontend.nginx.conf");
    expect(frontend).toMatch(/server_name\s+lms\.dolphinxstudio\.com\s*;/);
    expect(frontend).not.toContain("lms.dolphinx.com");
    const server = frontend.slice(frontend.indexOf("server {"));
    expect(server).toMatch(
      /include\s+\/etc\/nginx\/snippets\/lms-api-locations\.conf\s*;/,
    );
    const root = locations(frontend).get("/");
    expect(root).toBeDefined();
    expectDirective(root!, "proxy_pass http://127.0.0.1:3000");
  });

  it("routes general API traffic to BE without stripping /api/v1 or hiding regex safeguards", () => {
    const source = configuration("./nginx/lms-api-locations.conf");
    expect(locations(source).has("^~ /api/v1/")).toBe(false);
    const api = apiLocation("/api/v1/");
    expectDirective(api, "proxy_pass http://127.0.0.1:4000");
    expectDirective(api, "client_max_body_size 10m");
    expect(source).not.toMatch(/\brewrite\s/);
  });

  it("preserves full request URIs and uses the same loopback BE for every API location", () => {
    const routes = locations(configuration("./nginx/lms-api-locations.conf"));
    expect(routes.size).toBe(10);
    for (const [selector, body] of routes) {
      expect(selector).toContain("/api/v1/");
      const destinations = Array.from(
        body.matchAll(/\bproxy_pass\s+([^;]+);/g),
        (match) => match[1].trim(),
      );
      expect(destinations, selector).toEqual(["http://127.0.0.1:4000"]);
      expectDirective(body, "proxy_http_version 1.1");
      expectDirective(body, "proxy_set_header Host $host");
      if (selector !== "= /api/v1/ready") {
        expectDirective(body, "proxy_set_header X-Real-IP $remote_addr");
        expectDirective(
          body,
          "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for",
        );
        expectDirective(body, "proxy_set_header X-Forwarded-Proto $scheme");
      }
    }
  });

  it.each([
    "= /api/v1/users/me/avatar",
    "= /api/v1/organizations/current/logo",
    '~ "^/api/v1/organizations/[0-9a-fA-F]{24}/logo$"',
  ])("preserves raw image upload protections for %s", (selector) => {
    const body = apiLocation(selector);
    expectDirective(body, "client_max_body_size 6m");
    expectDirective(body, "client_body_timeout 60s");
    expectDirective(body, "proxy_request_buffering off");
    expectDirective(
      body,
      "limit_req zone=lms_same_origin_public_image_upload burst=4 nodelay",
    );
    expectDirective(body, "limit_conn lms_same_origin_upload_connections 2");
    expectDirective(body, "limit_req_status 429");
    expectDirective(body, "limit_conn_status 429");
    expectDirective(body, "proxy_send_timeout 120s");
    expectDirective(body, "proxy_read_timeout 120s");
  });

  it("keeps private media uploads streaming, size-bounded and rate-limited", () => {
    const body = apiLocation("= /api/v1/media/local/upload");
    expectDirective(body, "client_max_body_size 101m");
    expectDirective(body, "client_body_timeout 300s");
    expectDirective(body, "proxy_request_buffering off");
    expectDirective(
      body,
      "limit_req zone=lms_same_origin_private_media_upload burst=20 nodelay",
    );
    expectDirective(body, "limit_conn lms_same_origin_upload_connections 2");
    expectDirective(body, "limit_req_status 429");
    expectDirective(body, "limit_conn_status 429");
    expectDirective(body, "proxy_send_timeout 300s");
    expectDirective(body, "proxy_read_timeout 300s");
  });

  it("does not log download tickets and forwards range requests without buffering", () => {
    const body = apiLocation("= /api/v1/media/local/download");
    expectDirective(body, "access_log off");
    expectDirective(body, "error_log /dev/null crit");
    expectDirective(body, "proxy_buffering off");
    expectDirective(body, "proxy_set_header Range $http_range");
    expectDirective(body, "proxy_read_timeout 120s");
  });

  it.each(["google-drive", "youtube"])(
    "does not log %s OAuth callback credentials and bounds upstream timeouts",
    (provider) => {
      const body = apiLocation(
        `= /api/v1/integrations/${provider}/callback`,
      );
      expectDirective(body, "access_log off");
      expectDirective(body, "error_log /dev/null crit");
      expectDirective(body, "proxy_connect_timeout 10s");
      expectDirective(body, "proxy_send_timeout 30s");
      expectDirective(body, "proxy_read_timeout 30s");
    },
  );

  it("keeps expensive readiness probes available only from loopback", () => {
    const body = apiLocation("= /api/v1/ready");
    expectDirective(body, "allow 127.0.0.1");
    expectDirective(body, "allow ::1");
    expectDirective(body, "deny all");
    expect(body.indexOf("allow 127.0.0.1")).toBeLessThan(body.indexOf("deny all"));
    expect(body.indexOf("allow ::1")).toBeLessThan(body.indexOf("deny all"));
    expectDirective(body, "access_log off");
    expectDirective(body, "proxy_connect_timeout 5s");
    expectDirective(body, "proxy_read_timeout 10s");
  });

  it("preserves the smaller IPN request body limit", () => {
    const body = apiLocation("= /api/v1/billing/ipn");
    expectDirective(body, "client_max_body_size 256k");
    expectDirective(body, "proxy_read_timeout 30s");
  });

  it("declares unique shared zones outside server/location context", () => {
    const limits = configuration("./nginx/lms-api-limits.conf");
    expect(limits).not.toMatch(/\b(?:server|location)\b|[{}]/);
    expectDirective(
      limits,
      "limit_req_zone $binary_remote_addr zone=lms_same_origin_public_image_upload:10m rate=10r/m",
    );
    expectDirective(
      limits,
      "limit_req_zone $binary_remote_addr zone=lms_same_origin_private_media_upload:10m rate=60r/m",
    );
    expectDirective(
      limits,
      "limit_conn_zone $binary_remote_addr zone=lms_same_origin_upload_connections:10m",
    );
    for (const path of [
      "./lms-frontend.nginx.conf",
      "./nginx/lms-api-locations.conf",
    ]) {
      expect(configuration(path)).not.toMatch(/\blimit_(?:req|conn)_zone\b/);
    }
  });

  it("keeps browser API URLs public HTTPS while Nginx owns the private destination", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "NEXT_PUBLIC_API_URL",
      "https://lms.dolphinxstudio.com/api/v1",
    );
    vi.resetModules();
    const { apiRequestUrl } = await import("../lib/api");
    expect(apiRequestUrl("/auth/register")).toBe(
      "https://lms.dolphinxstudio.com/api/v1/auth/register",
    );
    expect(new URL(apiRequestUrl("")).origin).toBe(
      "https://lms.dolphinxstudio.com",
    );
  });
});
