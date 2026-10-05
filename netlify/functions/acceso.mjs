import { getStore } from "@netlify/blobs";
import { checkPassword, signToken, cookieName } from "./_token.mjs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const { slug, password } = await req.json();
  if (!slug || !password) {
    return new Response(JSON.stringify({ error: "faltan datos" }), { status: 400 });
  }

  const store = getStore("galerias");
  const g = await store.get(slug, { type: "json" });
  if (!g || !checkPassword(password, g.passwordHash)) {
    return new Response(JSON.stringify({ error: "Contraseña incorrecta" }), { status: 401 });
  }

  const token = signToken(slug);
  return new Response(JSON.stringify({ ok: true, nombre: g.nombre }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${cookieName(slug)}=${token}; Path=/; Max-Age=1209600; SameSite=Lax; Secure; HttpOnly`,
    },
  });
};

export const config = { path: "/api/acceso" };
