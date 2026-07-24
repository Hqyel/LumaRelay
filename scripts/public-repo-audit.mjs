import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { isIP } from "node:net";

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  });

const findings = [];
const textExtensions = new Set([
  "",
  ".cs",
  ".csproj",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".lock",
  ".md",
  ".mjs",
  ".props",
  ".sln",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

function addFinding(path, message) {
  findings.push(`${path}: ${message}`);
}

function isSafeUrlHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".example.com") ||
    normalized.endsWith(".example.net") ||
    normalized.endsWith(".example.org")
  ) {
    return true;
  }

  if (isIP(normalized) === 4) {
    return normalized.startsWith("127.") || normalized.startsWith("192.0.2.");
  }

  return isIP(normalized) === 0;
}

function isDocumentationServerHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".example.com") ||
    normalized.endsWith(".example.net") ||
    normalized.endsWith(".example.org")
  ) {
    return true;
  }

  return (
    isIP(normalized) === 4 &&
    (normalized.startsWith("127.") || normalized.startsWith("192.0.2."))
  );
}

for (const path of trackedFiles) {
  const normalized = path.replaceAll("\\", "/");
  const basename = normalized.split("/").at(-1) ?? normalized;

  if (
    basename === ".env" ||
    (basename.startsWith(".env.") && basename !== ".env.example")
  ) {
    addFinding(path, "local environment file must not be tracked");
  }

  if (/\.(?:db|db-shm|db-wal|log)$/i.test(basename)) {
    addFinding(path, "runtime data must not be tracked");
  }

  if (!textExtensions.has(extname(basename).toLowerCase())) continue;

  const contents = readFileSync(path, "utf8");
  const legacyBrand = ["new", "emby"].join("");
  if (new RegExp(legacyBrand, "i").test(contents)) {
    addFinding(path, "legacy brand remains in the public tree");
  }

  for (const match of contents.matchAll(/https?:\/\/[^\s"'`<>()\]}]+/g)) {
    try {
      const url = new URL(match[0].replace(/[.,;:]$/, ""));
      const usesDocumentedPlaceholder =
        url.username === "user" && url.password === "";
      if (
        !usesDocumentedPlaceholder &&
        (url.username !== "" || url.password !== "")
      ) {
        addFinding(path, "URL contains embedded credentials");
      }
      if (!isSafeUrlHost(url.hostname)) {
        addFinding(path, `URL contains non-documentation IP ${url.hostname}`);
      }
    } catch {
      // Source-code fragments do not always contain complete URLs.
    }
  }

  for (const line of contents.split(/\r?\n/)) {
    const assignment = line.match(
      /^\s*LUMARELAY_EMBY_(?:SMOKE_)?(?:USERNAME|PASSWORD)\s*=\s*(.+)\s*$/i,
    );
    if (
      assignment !== null &&
      assignment[1] !== "" &&
      !/^(?:example|placeholder|replace-me|test)$/i.test(assignment[1])
    ) {
      addFinding(path, "Emby username or password is assigned a real value");
    }

    const serverAssignment = line.match(
      /^\s*LUMARELAY_EMBY_(?:SMOKE_)?BASE_URL\s*=\s*(.+)\s*$/i,
    );
    if (serverAssignment !== null) {
      try {
        const serverUrl = new URL(serverAssignment[1]);
        if (!isDocumentationServerHost(serverUrl.hostname)) {
          addFinding(path, "Emby server URL is not a reserved example");
        }
      } catch {
        addFinding(path, "Emby server URL assignment is invalid");
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Public repository audit failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Public repository audit passed for ${trackedFiles.length} files.`);
