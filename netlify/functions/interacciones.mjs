import { getStore } from "@netlify/blobs";
import { verifyToken, cookieName } from "./_token.mjs";

function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function agregar(datos) {
  const porFoto = {};
  for (const [foto, d] of Object.entries(datos || {})) {
    const ratings = d.ratings || [];
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    porFoto[foto] = { avg, count: ratings.length, comments: d.comments || [] };
  }
  return porFoto;
}

export default async (req) => {
  const store = getStore("interacciones");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const slug = url.searchParams.get("slug");
    if (!slug) return new Response(JSON.stringify({ error: "falta slug" }), { status: 400 });
    const token = readCookie(req, cookieName(slug));
    if (!verifyToken(token, slug)) {
      return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
    }
    const datos = (await store.get(slug, { type: "json" })) || {};
    return new Response(JSON.stringify({ porFoto: agregar(datos) }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const { slug, foto, rating, nombre, texto } = body;
  if (!slug || !foto) {
    return new Response(JSON.stringify({ error: "faltan datos" }), { status: 400 });
  }
  const token = readCookie(req, cookieName(slug));
  if (!verifyToken(token, slug)) {
    return new Response(JSON.stringify({ error: "no autorizado" }), { status: 401 });
  }

  const tieneRating = Number.isInteger(rating) && rating >= 1 && rating <= 5;
  const tieneComentario = nombre && texto && nombre.trim() && texto.trim();
  if (!tieneRating && !tieneComentario) {
    return new Response(JSON.stringify({ error: "nada que guardar" }), { status: 400 });
  }

  const datos = (await store.get(slug, { type: "json" })) || {};
  if (!datos[foto]) datos[foto] = { ratings: [], comments: [] };

  if (tieneRating) datos[foto].ratings.push(rating);
  if (tieneComentario) {
    datos[foto].comments.push({
      nombre: nombre.trim().slice(0, 60),
      texto: texto.trim().slice(0, 500),
      fecha: new Date().toISOString(),
    });
  }

  await store.setJSON(slug, datos);
  return new Response(JSON.stringify({ ok: true, foto: agregar(datos)[foto] }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/interacciones" };
