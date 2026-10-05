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
  const key = url.searchParams.get("key");
  const filename = url.searchParams.get("filename");
  if (!slug || !key || !key.startsWith(`${slug}/`)) {
    return new Response("Bad request", { status: 400 });
  }

  const token = readCookie(req, cookieName(slug));
  if (!verifyToken(token, slug)) {
    return new Response("No autorizado", { status: 401 });
  }

  const store = getStore("fotos");
  const data = await store.get(key, { type: "arrayBuffer" });
  if (!data) return new Response("No encontrado", { status: 404 });

  const headers = { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" };
  if (filename) {
    headers["content-disposition"] = `attachment; filename="${filename.replace(/"/g, "")}"`;
  }
  return new Response(data, { headers });
};

export const config = { path: "/api/img" };
