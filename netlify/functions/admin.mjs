import { getStore } from "@netlify/blobs";
import { hashPassword } from "./_token.mjs";

function checkPin(pin) {
  const real = Netlify.env.get("FOTOS_ADMIN_PIN");
  return real && pin === real;
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async (req) => {
  const store = getStore("galerias");

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (!checkPin(url.searchParams.get("pin"))) {
      return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401 });
    }
    const { blobs } = await store.list();
    const galerias = await Promise.all(
      blobs.map(async (b) => {
        const g = await store.get(b.key, { type: "json" });
        return { slug: b.key, nombre: g?.nombre, numFotos: g?.photos?.length || 0, creado: g?.creado };
      })
    );
    return new Response(JSON.stringify({ galerias }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  if (!checkPin(body.pin)) {
    return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401 });
  }

  if (body.action === "crear") {
    if (!body.nombre || !body.password) {
      return new Response(JSON.stringify({ error: "faltan datos" }), { status: 400 });
    }
    let slug = slugify(body.slug || body.nombre);
    let suffix = 0;
    while (await store.get(slug)) {
      suffix += 1;
      slug = `${slugify(body.slug || body.nombre)}-${suffix}`;
    }
    await store.setJSON(slug, {
      nombre: body.nombre,
      passwordHash: hashPassword(body.password),
      reviewLink: body.reviewLink || null,
      photos: [],
      creado: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ slug }), {
      headers: { "content-type": "application/json" },
    });
  }

  if (body.action === "confirmar") {
    const { slug, photos } = body;
    const g = await store.get(slug, { type: "json" });
    if (!g) return new Response(JSON.stringify({ error: "galeria no existe" }), { status: 404 });
    g.photos = [...(g.photos || []), ...photos];
    await store.setJSON(slug, g);
    return new Response(JSON.stringify({ ok: true, total: g.photos.length }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "accion desconocida" }), { status: 400 });
};

export const config = { path: "/api/admin" };
