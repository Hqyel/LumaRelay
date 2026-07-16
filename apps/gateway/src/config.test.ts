import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    COOKIE_SECURE: "true",
    EMBY_ALLOWED_SERVER_ORIGINS: "https://emby.example.com",
    EMBY_BASE_URL: "https://emby.example.com/system/emby/",
    NEWEMBY_PUBLIC_ORIGIN: "https://newemby.example.com",
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };
}

describe("Gateway configuration", () => {
  it("accepts a secure production configuration", () => {
    const config = loadConfig(productionEnvironment());

    expect(config.allowedServerOrigins).toEqual(["https://emby.example.com"]);
    expect(config.embyBaseUrl).toBe("https://emby.example.com/system/emby/");
  });

  it.each([
    ["the development session secret", { SESSION_SECRET: undefined }],
    ["the development encryption key", { TOKEN_ENCRYPTION_KEY: undefined }],
    ["an HTTP public origin", { NEWEMBY_PUBLIC_ORIGIN: "http://localhost" }],
    ["an HTTP Emby origin", { EMBY_BASE_URL: "http://emby.example.com" }],
    [
      "an Emby origin outside the allowlist",
      { EMBY_ALLOWED_SERVER_ORIGINS: "https://other.example.com" },
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
          TOKEN_ENCRYPTION_KEY: tokenEncryptionKey,
        }),
      ).toThrow();
    },
  );

  it("accepts proxy hops and explicit IP/CIDR lists", () => {
    expect(loadConfig({ GATEWAY_TRUST_PROXY: "2" }).trustProxy).toBe(2);
    expect(
      loadConfig({ GATEWAY_TRUST_PROXY: "127.0.0.1,10.0.0.0/8,::1" })
        .trustProxy,
    ).toEqual(["127.0.0.1", "10.0.0.0/8", "::1"]);
  });

  it.each(["true", "*", "proxy.example.com", "10.0.0.0/99", "-1"])(
    "rejects open or invalid proxy trust %s",
    (trustProxy) => {
      expect(() => loadConfig({ GATEWAY_TRUST_PROXY: trustProxy })).toThrow();
    },
  );
});
