#!/bin/sh
# Traduce los textos de mediciones y del tour del visor OHIF al español.
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
  -e 's/"Scrolling Through Images"/"Desplazarse por las imágenes"/g' \
  -e 's/"You can scroll through the images using the mouse wheel or scrollbar\."/"Puedes desplazarte por las imágenes con la rueda del ratón o la barra de desplazamiento."/g' \
  -e 's/"Zooming In and Out"/"Acercar y alejar"/g' \
  -e 's/"You can zoom the images using the right click\."/"Puedes acercar o alejar las imágenes con el clic derecho."/g' \
  -e 's/"Panning the Image"/"Mover la imagen"/g' \
  -e 's/"You can pan the images using the middle click\."/"Puedes mover las imágenes con el clic central."/g' \
  -e 's/"Adjusting Window Level"/"Ajustar el nivel de ventana"/g' \
  -e 's/"You can modify the window level using the left click\."/"Puedes modificar el nivel de ventana con el clic izquierdo."/g' \
  -e 's/"Using the Measurement Tools"/"Uso de las herramientas de medición"/g' \
  -e 's/"You can measure the length of a region using the Length tool\."/"Puedes medir la longitud de una región con la herramienta Longitud."/g' \
  -e 's/"Drawing Length Annotations"/"Dibujar anotaciones de longitud"/g' \
  -e 's/"Use the length tool on the viewport to measure the length of a region\."/"Usa la herramienta de longitud en el visor para medir la longitud de una región."/g' \
  -e 's/"Tracking Measurements in the Panel"/"Seguimiento de mediciones en el panel"/g' \
  -e 's/"Click yes to track the measurements in the measurement panel\."/"Haz clic en Sí para dar seguimiento a las mediciones en el panel de mediciones."/g' \
  -e 's/"Opening the Measurements Panel"/"Abrir el panel de mediciones"/g' \
  -e 's/"Click the measurements button to open the measurements panel\."/"Haz clic en el botón de mediciones para abrir el panel de mediciones."/g' \
  -e 's/"Scrolling Away from a Measurement"/"Alejarse de una medición"/g' \
  -e 's/"Scroll the images using the mouse wheel away from the measurement\."/"Desplázate por las imágenes con la rueda del ratón, alejándote de la medición."/g' \
  -e 's/"Jumping to Measurements in the Panel"/"Ir a una medición desde el panel"/g' \
  -e 's/"Click the measurement in the measurement panel to jump to it\."/"Haz clic en la medición en el panel de mediciones para ir a ella."/g' \
  -e 's/"Changing Layout"/"Cambiar el diseño"/g' \
  -e 's/"You can change the layout of the viewer using the layout button\."/"Puedes cambiar el diseño del visor con el botón de diseño."/g' \
  -e 's/"Selecting the MPR Layout"/"Seleccionar el diseño MPR"/g' \
  -e 's/"Select the MPR layout to view the images in MPR mode\."/"Selecciona el diseño MPR para ver las imágenes en modo MPR."/g' \
  -e 's/text:"Skip all"/text:"Omitir todo"/g' \
  "$TARGET_DIR"/*.js

echo "Patch de traducción aplicado en $TARGET_DIR"
