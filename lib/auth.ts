import crypto from "crypto";

export const SESSION_COOKIE = "ttw_session";

/** Token de sessão determinístico assinado com o segredo configurado no ambiente. */
export function expectedToken(): string {
  const secret = process.env.TTW_AUTH_SECRET;
  if (!secret) throw new Error("TTW_AUTH_SECRET não configurado.");
  return crypto.createHmac("sha256", secret).update("ttw-authenticated").digest("hex");
}

/** Comparação de tempo constante (evita timing attack na checagem de senha). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(email: string, password: string): boolean {
  const u = process.env.TTW_USER;
  const p = process.env.TTW_PASSWORD;
  if (!u || !p) return false;
  return email.trim().toLowerCase() === u.toLowerCase() && safeEqual(password, p);
}
