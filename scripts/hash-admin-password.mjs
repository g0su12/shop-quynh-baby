import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const iterations = 210_000;
let password = process.argv[2];

if (!password) {
  const readline = createInterface({ input, output });
  password = await readline.question("Admin password: ");
  readline.close();
}

if (!password || password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const encodedSalt = salt.toString("base64url");
const encodedHash = hash.toString("base64url");

console.log(`pbkdf2_sha256$${iterations}$${encodedSalt}$${encodedHash}`);
