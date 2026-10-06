import { getStore } from "@netlify/blobs";
import { verifyToken, cookieName } from "./_token.mjs";

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return new Response(JSON.stringify({ error: "falta slug" }), { status: 400 });

  const token = readCookie(req, cookieName(slug));
  if (!verifyToken(token, slug)) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }

  const store = getStore("galerias");
  const g = await store.get(slug, { type: "json" });
  if (!g) return new Response(JSON.stringify({ error: "no existe" }), { status: 404 });

  const photos = (g.photos || []).map((p) => ({
    filename: p.filename,
    thumbKey: p.thumbKey,
    origKey: p.origKey,
  }));

  return new Response(JSON.stringify({ nombre: g.nombre, fecha: g.fecha || null, reviewLink: g.reviewLink, heroKeys: g.heroKeys || [], photos }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};

export const config = { path: "/api/fotos" };
