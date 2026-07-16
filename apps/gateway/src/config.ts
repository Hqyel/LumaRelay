import { loadEnvFile } from "node:process";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const ROOT_ENVIRONMENT_PATH = fileURLToPath(
  new URL("../../../.env", import.meta.url),
);

const BooleanStringSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const IntegerStringSchema = z.coerce.number().int().nonnegative();
const DEVELOPMENT_SESSION_SECRET = "development-only-session-secret-32";
const DEVELOPMENT_TOKEN_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

function isIpOrCidr(value: string): boolean {
  const [address, prefix, ...extra] = value.split("/");
  if (!address || extra.length > 0) return false;

  const version = isIP(address);
  if (version === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;

  const prefixLength = Number(prefix);
  return prefixLength <= (version === 4 ? 32 : 128);
}

const TrustProxySchema = z
  .string()
  .default("0")
  .transform((value, context) => {
    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) return Number(normalized);

    const addresses = normalized.split(",").map((address) => address.trim());
    if (
      addresses.length === 0 ||
      addresses.some((address) => !isIpOrCidr(address))
    ) {
      context.addIssue({
        code: "custom",
        message: "Expected a non-negative hop count or explicit IP/CIDR list",
      });
      return z.NEVER;
    }

    return addresses;
  });

function isValidEncryptionKey(value: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  return Buffer.from(value, "base64").byteLength === 32;
}

function looksLikePlaceholder(value: string): boolean {
  return /(change[-_ ]?me|placeholder|replace[-_ ]?with|example)/i.test(value);
}

const EnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEWEMBY_PUBLIC_ORIGIN: z.url().default("http://127.0.0.1:5173"),
    EMBY_BASE_URL: z.url().default("http://127.0.0.1:8096"),
    EMBY_ALLOWED_SERVER_ORIGINS: z.string().default("http://127.0.0.1:8096"),
    GATEWAY_HOST: z.string().min(1).default("127.0.0.1"),
    GATEWAY_PORT: IntegerStringSchema.default(3000),
    GATEWAY_TRUST_PROXY: TrustProxySchema,
    DATABASE_PATH: z.string().min(1).default("./data/newemby.db"),
    SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SESSION_SECRET),
    TOKEN_ENCRYPTION_KEY: z
      .string()
      .refine(isValidEncryptionKey, {
        message: "Must be canonical Base64 that decodes to exactly 32 bytes",
      })
      .default(DEVELOPMENT_TOKEN_KEY),
    COOKIE_SECURE: BooleanStringSchema.default(false),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    BRIDGE_ALLOWED_ORIGINS: z.string().default("http://127.0.0.1:5173"),
  })
  .superRefine((value, context) => {
    const embyOrigin = new URL(value.EMBY_BASE_URL).origin;
    const allowedOrigins = splitOrigins(value.EMBY_ALLOWED_SERVER_ORIGINS);

    if (!allowedOrigins.includes(embyOrigin)) {
      context.addIssue({
        code: "custom",
        message: "Emby base origin must appear in the allowed server list",
        path: ["EMBY_ALLOWED_SERVER_ORIGINS"],
      });
    }

    if (value.NODE_ENV !== "production") return;

    if (new URL(value.NEWEMBY_PUBLIC_ORIGIN).protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "Production public origin must use HTTPS",
        path: ["NEWEMBY_PUBLIC_ORIGIN"],
      });
    }

    if (!value.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        message: "Production cookies must be secure",
        path: ["COOKIE_SECURE"],
      });
    }

    if (new URL(value.EMBY_BASE_URL).protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "Production Emby origin must use HTTPS",
        path: ["EMBY_BASE_URL"],
      });
    }

    if (
      value.SESSION_SECRET === DEVELOPMENT_SESSION_SECRET ||
      looksLikePlaceholder(value.SESSION_SECRET)
    ) {
      context.addIssue({
        code: "custom",
        message: "Production session secret must be independently generated",
        path: ["SESSION_SECRET"],
      });
    }

    if (
      value.TOKEN_ENCRYPTION_KEY === DEVELOPMENT_TOKEN_KEY ||
      looksLikePlaceholder(value.TOKEN_ENCRYPTION_KEY)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Production token encryption key must be independently generated",
        path: ["TOKEN_ENCRYPTION_KEY"],
      });
    }
  });

export interface GatewayConfig {
  allowedBridgeOrigins: string[];
  allowedServerOrigins: string[];
  cookieSecure: boolean;
  databasePath: string;
  embyBaseUrl: string;
  host: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  nodeEnv: "development" | "test" | "production";
  port: number;
  publicOrigin: string;
  sessionSecret: string;
  tokenEncryptionKey: string;
  trustProxy: number | string[];
}

function loadRootEnvironment(): void {
  try {
    loadEnvFile(ROOT_ENVIRONMENT_PATH);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;

    throw error;
  }
}

function splitOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => new URL(origin.trim()).origin)
    .filter((origin, index, origins) => origins.indexOf(origin) === index);
}

export function loadConfig(environment?: NodeJS.ProcessEnv): GatewayConfig {
  if (environment === undefined) loadRootEnvironment();

  const parsed = EnvironmentSchema.parse(environment ?? process.env);

  return {
    allowedBridgeOrigins: splitOrigins(parsed.BRIDGE_ALLOWED_ORIGINS),
    allowedServerOrigins: splitOrigins(parsed.EMBY_ALLOWED_SERVER_ORIGINS),
    cookieSecure: parsed.COOKIE_SECURE,
    databasePath: parsed.DATABASE_PATH,
    embyBaseUrl: new URL(parsed.EMBY_BASE_URL).toString(),
    host: parsed.GATEWAY_HOST,
    logLevel: parsed.LOG_LEVEL,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.GATEWAY_PORT,
    publicOrigin: new URL(parsed.NEWEMBY_PUBLIC_ORIGIN).origin,
    sessionSecret: parsed.SESSION_SECRET,
    tokenEncryptionKey: parsed.TOKEN_ENCRYPTION_KEY,
    trustProxy: parsed.GATEWAY_TRUST_PROXY,
  };
}
