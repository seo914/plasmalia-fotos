#!/usr/bin/env python3
"""
Sube una carpeta de fotos de boda a una galería de plasmalia-fotos.netlify.app.

Uso:
  python3 subir_boda.py \
    --src "/ruta/a/la/carpeta/de/fotos" \
    --nombre "Ana y Luis" \
    --fecha "12 de julio de 2026" \
    --password "ContraseñaParaLosNovios" \
    --review-link "https://g.page/r/CQFLR931l4HyEAE/review" \
    --pin TU_PIN_ADMIN

Requisitos: exiftool y magick (ImageMagick) instalados (brew install exiftool imagemagick).

Por defecto ordena las fotos por fecha de captura EXIF (sirve bien si todas las
fotos son de una sola cámara/reportaje continuo). Si la boda tiene varias cámaras
en paralelo (ej. preparativos de novia y novio a la vez), el orden EXIF puro
mezclará las dos escenas — en ese caso, generar primero hojas de contacto
(ver abajo) y pasar --orden-manual con la lista de archivos en el orden correcto.

Para generar hojas de contacto y revisar visualmente el orden antes de subir:
  cd "<carpeta de fotos>"
  find . -maxdepth 1 -iname "*.jpg" ! -name "._*" | sed 's|^\\./||' | sort > /tmp/locales.txt
  mkdir -p /tmp/contact_thumbs
  for f in $(cat /tmp/locales.txt); do
    magick "$f" -auto-orient -resize 260x260 -gravity south -background white -splice 0x22 \\
      -font /System/Library/Fonts/Helvetica.ttc -pointsize 16 -fill black -annotate +0+3 "${f%.jpg}" \\
      "/tmp/contact_thumbs/${f%.jpg}.jpg"
  done
  # luego montar de 20 en 20 con `magick montage ... -tile 5x4` y revisarlas con el visor de imágenes.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

SITE = "https://plasmalia-fotos.netlify.app"


def resize(src, dst, maxdim, quality):
    subprocess.run(
        ["magick", src, "-auto-orient", "-resize", f"{maxdim}x{maxdim}>", "-quality", str(quality), dst],
        check=True, capture_output=True,
    )


def fecha_captura(path):
    try:
        out = subprocess.run(
            ["exiftool", "-T", "-DateTimeOriginal", "-s3", path],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        if out and out != "-":
            return out
    except Exception:
        pass
    return "9999"


def crear_galeria(pin, nombre, slug, fecha, password, review_link):
    body = json.dumps({
        "pin": pin, "action": "crear", "nombre": nombre, "slug": slug,
        "fecha": fecha, "password": password, "reviewLink": review_link,
    }).encode()
    req = urllib.request.Request(f"{SITE}/api/admin", data=body, method="POST",
                                  headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def subir_blob(pin, slug, kind, path):
    with open(path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(
        f"{SITE}/api/subir", data=data, method="POST",
        headers={"x-pin": pin, "x-slug": slug, "x-kind": kind, "content-type": "application/octet-stream"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["key"]


def confirmar(pin, slug, lote):
    body = json.dumps({"pin": pin, "action": "confirmar", "slug": slug, "photos": lote}).encode()
    req = urllib.request.Request(f"{SITE}/api/admin", data=body, method="POST",
                                  headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def fijar_hero(pin, slug, hero_keys):
    body = json.dumps({"pin": pin, "action": "fijar_hero", "slug": slug, "heroKeys": hero_keys}).encode()
    req = urllib.request.Request(f"{SITE}/api/admin", data=body, method="POST",
                                  headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="Carpeta con las fotos .jpg")
    ap.add_argument("--nombre", required=True, help='Ej: "Ana y Luis"')
    ap.add_argument("--slug", default=None, help="Por defecto se genera del nombre")
    ap.add_argument("--fecha", default="", help='Ej: "12 de julio de 2026"')
    ap.add_argument("--password", required=True)
    ap.add_argument("--review-link", default="", help="Enlace g.page/r/.../review")
    ap.add_argument("--pin", required=True)
    ap.add_argument("--orden-manual", default=None,
                     help="Fichero .txt con un nombre de archivo por línea, en el orden deseado")
    ap.add_argument("--hero", default=None,
                     help="Fichero .txt con hasta 10 nombres de archivo para el slide de cabecera")
    ap.add_argument("--lote-size", type=int, default=8)
    args = ap.parse_args()

    if args.orden_manual:
        with open(args.orden_manual) as f:
            files = [l.strip() for l in f if l.strip()]
    else:
        locales = [f for f in os.listdir(args.src) if f.lower().endswith(".jpg") and not f.startswith("._")]
        files = sorted(locales, key=lambda f: fecha_captura(os.path.join(args.src, f)))

    print(f"Total fotos: {len(files)}")

    res = crear_galeria(args.pin, args.nombre, args.slug, args.fecha, args.password, args.review_link)
    if "error" in res:
        print("ERROR creando galería:", res, file=sys.stderr)
        sys.exit(1)
    slug = res["slug"]
    print(f"Galería creada: {slug}")

    tmp = "/tmp/_resize_boda"
    os.makedirs(tmp, exist_ok=True)
    thumb_keys = {}
    lote = []
    for i, fname in enumerate(files, 1):
        src = os.path.join(args.src, fname)
        thumb_path = os.path.join(tmp, f"thumb_{fname}")
        entrega_path = os.path.join(tmp, f"entrega_{fname}")
        try:
            resize(src, thumb_path, 500, 80)
            resize(src, entrega_path, 2800, 85)
            thumb_key = subir_blob(args.pin, slug, "thumb", thumb_path)
            orig_key = subir_blob(args.pin, slug, "orig", entrega_path)
            thumb_keys[fname] = thumb_key
            lote.append({"filename": fname, "origKey": orig_key, "thumbKey": thumb_key})
            print(f"[{i}/{len(files)}] {fname} OK")
        except Exception as e:
            print(f"[{i}/{len(files)}] {fname} ERROR: {e}", file=sys.stderr)
        finally:
            for p in (thumb_path, entrega_path):
                if os.path.exists(p):
                    os.remove(p)
        if len(lote) >= args.lote_size or i == len(files):
            if lote:
                r = confirmar(args.pin, slug, lote)
                print(f"  -> lote confirmado, total: {r.get('total')}")
                lote = []

    if args.hero:
        with open(args.hero) as f:
            hero_files = [l.strip() for l in f if l.strip()]
        hero_keys = [thumb_keys[f] for f in hero_files if f in thumb_keys]
        print("hero fijado:", fijar_hero(args.pin, slug, hero_keys))

    print(f"Listo. Enlace: {SITE}/boda/{slug}  Contraseña: {args.password}")


if __name__ == "__main__":
    main()
