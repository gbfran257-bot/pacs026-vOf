#!/bin/sh
# Traduce los textos de mediciones del visor OHIF al español.
# Usa comodines (*.js) porque el hash del nombre de archivo
# cambia en cada build de webpack.

set -e

TARGET_DIR="${1:-/var/www/html}"

sed -i \
  -e 's/Radius: Oblique not supported/Radio: no soportado en oblicuo/g' \
  -e 's/Area: Oblique not supported/Área: no soportado en oblicuo/g' \
  -e 's/Radius: \${/Radio: ${/g' \
  -e 's/Area: \${/Área: ${/g' \
  -e 's/Mean: \${/Media: ${/g' \
  -e 's/Max: \${/Máximo: ${/g' \
  -e 's/Min: \${/Mínimo: ${/g' \
  -e 's/Std Dev: \${/Desv. Est.: ${/g' \
  -e 's/Length: \${/Longitud: ${/g' \
  -e 's/Width: \${/Ancho: ${/g' \
  -e 's/L: \${/Long: ${/g' \
  -e 's/W: \${/Ancho: ${/g' \
  "$TARGET_DIR"/*.js

echo "Patch de traducción aplicado en $TARGET_DIR"
