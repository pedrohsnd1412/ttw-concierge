import crypto from "crypto";

export const SESSION_COOKIE = "ttw_session";
const SECRET = process.env.TTW_AUTH_SECRET || "ttw-dev-secret";

/** Token de sessão determinístico (HMAC). MVP — em produção use Supabase Auth/JWT. */
export function expectedToken(): string {
  return crypto.createHmac("sha256", SECRET).update("ttw-authenticated").digest("hex");
}

export function checkCredentials(email: string, password: string): boolean {
  const u = process.env.TTW_USER || "consultor@ttw.com";
  const p = process.env.TTW_PASSWORD || "ttwluxo2026";
  return email.trim().toLowerCase() === u.toLowerCase() && password === p;
}
