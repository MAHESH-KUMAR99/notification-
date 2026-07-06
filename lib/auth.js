import crypto from "crypto";

const COOKIE_NAME = "admin_session";

function getSecret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set in the environment");
  }
  return password;
}

export function createSessionToken() {
  return crypto.createHash("sha256").update(getSecret()).digest("hex");
}

export function verifyPassword(password) {
  return typeof password === "string" && password === getSecret();
}

export function verifySessionToken(token) {
  return typeof token === "string" && token === createSessionToken();
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
