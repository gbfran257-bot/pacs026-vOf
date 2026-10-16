type ComposeOptions = { cols?: number; gap?: number; background?: string };

const MAX_SIDE = 16000; // los navegadores fallan con canvas más grandes

export function composeCanvases(
  canvasList: HTMLCanvasElement[],
  { cols, gap = 8, background = '#000' }: ComposeOptions = {}
): HTMLCanvasElement {
  const n = canvasList.length;
  const columnas = cols && cols > 0 ? Math.min(cols, n) : Math.ceil(Math.sqrt(n));
  const filas = Math.ceil(n / columnas);

  const cellW = Math.max(...canvasList.map(c => c.width));
  const cellH = Math.max(...canvasList.map(c => c.height));

  const totalW = cellW * columnas + gap * (columnas - 1);
  const totalH = cellH * filas + gap * (filas - 1);
  const scale = Math.min(1, MAX_SIDE / totalW, MAX_SIDE / totalH);

  const combinado = document.createElement('canvas');
  combinado.width = Math.floor(totalW * scale);
  combinado.height = Math.floor(totalH * scale);
  const ctx = combinado.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, totalW, totalH);

  canvasList.forEach((canvas, i) => {
    const col = i % columnas;
    const row = Math.floor(i / columnas);
    const x = col * (cellW + gap) + (cellW - canvas.width) / 2;
    const y = row * (cellH + gap) + (cellH - canvas.height) / 2;
    ctx.drawImage(canvas, x, y);
  });

  return combinado;
}

export function descargarCanvas(canvas: HTMLCanvasElement, filename: string, fileType: string) {
  const mime = fileType === 'png' ? 'image/png' : 'image/jpeg';
  canvas.toBlob(
    blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${fileType}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    mime,
    0.95
  );
}

export function imprimirCanvas(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png');
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(`<html><head><title>Imprimir estudio</title>
    <style>
      @page { margin: 8mm; }
      html, body { margin: 0; background: #fff; }
      img { display: block; max-width: 100%; max-height: 100vh; margin: 0 auto; }
    </style></head>
    <body><img id="im" src="${dataUrl}" /></body></html>`);
  doc.close();

  const cleanup = () => iframe.remove();
  win.onafterprint = cleanup;
  setTimeout(cleanup, 120000);

  const img = doc.getElementById('im') as HTMLImageElement;
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    win.focus();
    win.print();
  };
  img.onload = go;
  if (img.complete && img.naturalWidth) go();
}
