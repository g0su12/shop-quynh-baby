import { pbkdf2Sync, randomBytes } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const outputPath = new URL("../.dev.vars", import.meta.url);
const iterations = 210_000;

try {
  await access(outputPath, constants.F_OK);
  console.error(
    ".dev.vars already exists. Delete it first if you want to replace the local admin password.",
  );
  process.exit(1);
} catch {
  // The file does not exist yet.
}

const readline = createInterface({ input, output });
const password = await readline.question(
  "Local admin password (at least 10 characters): ",
);
readline.close();

if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const passwordHash = [
  "pbkdf2_sha256",
  iterations,
  salt.toString("base64url"),
  hash.toString("base64url"),
].join("$");
const sessionSecret = randomBytes(48).toString("base64url");
const contents = [
  `ADMIN_PASSWORD_HASH="${passwordHash}"`,
  `ADMIN_SESSION_SECRET="${sessionSecret}"`,
  "",
].join("\n");

await writeFile(outputPath, contents, { mode: 0o600 });

console.log(
  "Created .dev.vars. Restart `npm run cf:dev` before logging in locally.",
);
