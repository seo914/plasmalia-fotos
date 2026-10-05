import { getStore } from "@netlify/blobs";
import { checkPassword, signToken, cookieName, slugify } from "./_token.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const { nombre, password } = await req.json();
  if (!nombre || !password) {
    return new Response(JSON.stringify({ error: "Escribe el nombre y la contraseña" }), { status: 400 });
  }

  const store = getStore("galerias");
  const base = slugify(nombre);

  let g = await store.get(base, { type: "json" });
  let slug = base;

  if (!g) {
    const { blobs } = await store.list({ prefix: `${base}-` });
    for (const b of blobs) {
      const candidate = await store.get(b.key, { type: "json" });
      if (candidate && checkPassword(password, candidate.passwordHash)) {
        g = candidate;
        slug = b.key;
        break;
      }
    }
  }

  if (!g || !checkPassword(password, g.passwordHash)) {
    return new Response(JSON.stringify({ error: "No encontramos una galería con ese nombre y contraseña" }), { status: 401 });
  }

  const token = signToken(slug);
  return new Response(JSON.stringify({ ok: true, slug, nombre: g.nombre }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${cookieName(slug)}=${token}; Path=/; Max-Age=1209600; SameSite=Lax; Secure; HttpOnly`,
    },
  });
};

export const config = { path: "/api/entrar" };
