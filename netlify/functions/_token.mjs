import crypto from "node:crypto";

export const DIAS_GALERIA = 90;

// Fecha de caducidad: la guardada en la galería o, si no tiene, creado + DIAS_GALERIA
export function caducidad(g) {
  if (g.caduca) return new Date(g.caduca);
  const base = g.creado ? new Date(g.creado) : new Date();
  return new Date(base.getTime() + DIAS_GALERIA * 864e5);
}

function secret() {
  const s = Netlify.env.get("GALLERY_SECRET");
  if (!s) throw new Error("falta GALLERY_SECRET");
  return s;
}

export function signToken(slug, ttlSeconds = 60 * 60 * 24 * 14) {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${slug}.${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token, slug) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokSlug, exp, sig] = parts;
  if (tokSlug !== slug) return false;
  if (Date.now() > Number(exp)) return false;
  const expected = crypto.createHmac("sha256", secret()).update(`${tokSlug}.${exp}`).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

export function cookieName(slug) {
  return `pl_fotos_${slug}`;
}

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
