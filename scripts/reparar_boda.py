#!/usr/bin/env python3
"""
Repara una galería tras una subida con errores: sube las fotos que falten,
restaura el orden de --orden-manual y vuelve a fijar el hero.

Uso:
  python3 reparar_boda.py --src "<carpeta>" --slug alvaro-y-marta --password "..." \
    --pin TU_PIN_ADMIN --orden-manual orden.txt [--hero hero.txt]
"""
import argparse
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from subir_boda import SITE, resize, subir_blob, confirmar, fijar_hero  # noqa: E402


def admin(payload):
    req = urllib.request.Request(f"{SITE}/api/admin", data=json.dumps(payload).encode(), method="POST",
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def fotos_actuales(slug, password):
    req = urllib.request.Request(f"{SITE}/api/acceso", method="POST",
                                 data=json.dumps({"slug": slug, "password": password}).encode(),
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        cookie = r.headers["set-cookie"].split(";")[0]
    req = urllib.request.Request(f"{SITE}/api/fotos?slug={slug}", headers={"cookie": cookie})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--pin", required=True)
    ap.add_argument("--orden-manual", required=True)
    ap.add_argument("--hero", default=None)
    args = ap.parse_args()

    with open(args.orden_manual) as f:
        orden = [l.strip() for l in f if l.strip()]

    data = fotos_actuales(args.slug, args.password)
    por_nombre = {p["filename"]: p for p in data["photos"]}
    faltan = [f for f in orden if f not in por_nombre]
    print(f"En galería: {len(por_nombre)}  Faltan: {faltan}")

    tmp = "/tmp/_resize_boda_rep"
    os.makedirs(tmp, exist_ok=True)
    nuevas = []
    for fname in faltan:
        src = os.path.join(args.src, fname)
        thumb, entrega = os.path.join(tmp, f"t_{fname}"), os.path.join(tmp, f"e_{fname}")
        resize(src, thumb, 500, 80)
        resize(src, entrega, 2800, 85)
        p = {"filename": fname,
             "thumbKey": subir_blob(args.pin, args.slug, "thumb", thumb),
             "origKey": subir_blob(args.pin, args.slug, "orig", entrega)}
        os.remove(thumb)
        os.remove(entrega)
        nuevas.append(p)
        por_nombre[fname] = p
        print(f"  subida {fname}")
    if nuevas:
        confirmar(args.pin, args.slug, nuevas)

    ordenadas = [{"filename": f, "origKey": por_nombre[f]["origKey"], "thumbKey": por_nombre[f]["thumbKey"]}
                 for f in orden if f in por_nombre]
    print("reordenar:", admin({"pin": args.pin, "action": "reordenar", "slug": args.slug, "photos": ordenadas}))

    if args.hero:
        with open(args.hero) as f:
            hero = [l.strip() for l in f if l.strip()]
        keys = [por_nombre[f]["thumbKey"] for f in hero if f in por_nombre]
        print("hero:", fijar_hero(args.pin, args.slug, keys))


if __name__ == "__main__":
    main()
