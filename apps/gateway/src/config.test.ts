import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    LUMARELAY_COOKIE_SECURE: "true",
    LUMARELAY_EMBY_ALLOWED_SERVER_ORIGINS: "https://emby.example.com",
    LUMARELAY_EMBY_BASE_URL: "https://emby.example.com/system/emby/",
    LUMARELAY_PUBLIC_ORIGIN: "https://lumarelay.example.com",
    LUMARELAY_SESSION_SECRET: randomBytes(48).toString("base64url"),
    LUMARELAY_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };
}

describe("Gateway configuration", () => {
  it("accepts a secure production configuration", () => {
    const config = loadConfig(productionEnvironment());

    expect(config.allowedServerOrigins).toEqual(["https://emby.example.com"]);
    expect(config.embyBaseUrl).toBe("https://emby.example.com/system/emby/");
  });

  it.each([
    ["the development session secret", { LUMARELAY_SESSION_SECRET: undefined }],
    [
      "the development encryption key",
      { LUMARELAY_TOKEN_ENCRYPTION_KEY: undefined },
    ],
    ["an HTTP public origin", { LUMARELAY_PUBLIC_ORIGIN: "http://localhost" }],
    [
      "an HTTP Emby origin",
      { LUMARELAY_EMBY_BASE_URL: "http://emby.example.com" },
    ],
    [
      "an Emby origin outside the allowlist",
      { LUMARELAY_EMBY_ALLOWED_SERVER_ORIGINS: "https://other.example.com" },
    ],
  ])("rejects %s in production", (_description, override) => {
    expect(() =>
      loadConfig({ ...productionEnvironment(), ...override }),
    ).toThrow();
  });

  it.each(["not-base64", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="])(
    "rejects invalid encryption key %s",
    (tokenEncryptionKey) => {
      expect(() =>
        loadConfig({
          NODE_ENV: "test",
          LUMARELAY_TOKEN_ENCRYPTION_KEY: tokenEncryptionKey,
        }),
      ).toThrow();
    },
  );

  it("accepts proxy hops and explicit IP/CIDR lists", () => {
    expect(loadConfig({ LUMARELAY_TRUST_PROXY: "2" }).trustProxy).toBe(2);
    expect(
      loadConfig({ LUMARELAY_TRUST_PROXY: "127.0.0.1,10.0.0.0/8,::1" })
        .trustProxy,
    ).toEqual(["127.0.0.1", "10.0.0.0/8", "::1"]);
  });

  it.each(["true", "*", "proxy.example.com", "10.0.0.0/99", "-1"])(
    "rejects open or invalid proxy trust %s",
    (trustProxy) => {
      expect(() => loadConfig({ LUMARELAY_TRUST_PROXY: trustProxy })).toThrow();
    },
  );
});
