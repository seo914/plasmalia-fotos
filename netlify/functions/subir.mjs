import { getStore } from "@netlify/blobs";

function checkPin(pin) {
  const real = Netlify.env.get("FOTOS_ADMIN_PIN");
  return real && pin === real;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const pin = req.headers.get("x-pin");
  const slug = req.headers.get("x-slug");
  const kind = req.headers.get("x-kind");

  if (!checkPin(pin)) {
    return new Response(JSON.stringify({ error: "PIN incorrecto" }), { status: 401 });
  }
  if (!slug || !["orig", "thumb"].includes(kind)) {
    return new Response(JSON.stringify({ error: "faltan datos" }), { status: 400 });
  }

  const bytes = await req.arrayBuffer();
  if (bytes.byteLength === 0) {
    return new Response(JSON.stringify({ error: "archivo vacio" }), { status: 400 });
  }

  const key = `${slug}/${kind}/${crypto.randomUUID()}`;
  const store = getStore("fotos");
  await store.set(key, bytes);

  return new Response(JSON.stringify({ key }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { path: "/api/subir" };
