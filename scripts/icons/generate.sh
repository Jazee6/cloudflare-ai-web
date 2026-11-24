#!/bin/sh
# Regenerates the PWA icons in public/ from the SVG sources here (macOS sips).
set -e
cd "$(dirname "$0")"
out=../../public
sips -s format png -z 192 192 app.svg --out "$out/icon-192.png" >/dev/null
sips -s format png -z 512 512 app.svg --out "$out/icon-512.png" >/dev/null
sips -s format png -z 512 512 maskable.svg --out "$out/icon-maskable-512.png" >/dev/null
sips -s format png -z 180 180 maskable.svg --out "$out/apple-touch-icon.png" >/dev/null
