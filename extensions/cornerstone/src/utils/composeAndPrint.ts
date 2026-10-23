type ComposeOptions = { cols?: number; gap?: number; background?: string };

export type Membrete = {
  logoUrl?: string; // ej. `${window.PUBLIC_URL || '/'}assets/logo-clinica.png` o data:image/png;base64,...
  nombre?: string; // "Clínica San Antonio"
  lineas?: string[]; // dirección, teléfono, correo...
  paciente?: string;
  fecha?: string;
  pie?: string;
};

// Valores por defecto: edítalos una sola vez aquí y todas las impresiones los usan
export const MEMBRETE_DEFAULT: Membrete = {
  logoUrl: `${(window as any).PUBLIC_URL || '/'}assets/logo-clinica.png`,
  nombre: 'Clínica San Antonio',
  lineas: ['Tu dirección', 'Tel. 000 000 0000', 'correo@clinica.com'],
  pie: 'Departamento de Imagenología · Clínica San Antonio',
};

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

const esc = (s = '') =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function imprimirCanvas(canvas: HTMLCanvasElement, membrete: Membrete = {}) {
  const m: Membrete = { ...MEMBRETE_DEFAULT, ...membrete };
  const dataUrl = canvas.toDataURL('image/png');

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;

  const logoAbs = m.logoUrl ? new URL(m.logoUrl, window.location.origin).href : '';
  const fecha = m.fecha || new Date().toLocaleDateString('es-MX');

  doc.open();
  doc.write(`<html><head><title>${esc(m.nombre || 'Estudio')}</title>
    <style>
      /* margin 0 en @page evita que el navegador imprima su encabezado/pie (URL, fecha, "1 de 1") */
      @page { size: landscape; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #fff; font-family: Arial, sans-serif; color: #111; }
      body { height: 100vh; padding: 8mm; display: flex; flex-direction: column; }
      .membrete {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 2px solid #0b5ea8; padding-bottom: 6px; margin-bottom: 8px;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .membrete img { height: 18mm; }
      .membrete .nombre { font-size: 16px; font-weight: bold; color: #0b5ea8; }
      .membrete .datos { text-align: right; font-size: 11px; line-height: 1.5; }
      .estudio { flex: 1; min-height: 0; display: flex; }
      .estudio img { margin: auto; max-width: 100%; max-height: 100%; object-fit: contain; }
      .pie { border-top: 1px solid #999; margin-top: 6px; padding-top: 4px;
             font-size: 10px; text-align: center; color: #555; }
    </style></head>
    <body>
      <div class="membrete">
        <div style="display:flex;align-items:center;gap:10px">
          ${logoAbs ? `<img id="logo" src="${logoAbs}" />` : ''}
          <div>
            <div class="nombre">${esc(m.nombre || '')}</div>
            <div style="font-size:11px">${(m.lineas || []).map(esc).join('<br>')}</div>
          </div>
        </div>
        <div class="datos">
          ${m.paciente ? `Paciente: <b>${esc(m.paciente)}</b><br>` : ''}
          Fecha: ${esc(fecha)}
        </div>
      </div>
      <div class="estudio"><img id="im" src="${dataUrl}" /></div>
      ${m.pie ? `<div class="pie">${esc(m.pie)}</div>` : ''}
    </body></html>`);
  doc.close();

  const cleanup = () => iframe.remove();
  win.onafterprint = cleanup;
  setTimeout(cleanup, 120000);

  // espera a que carguen la imagen del estudio y el logo antes de imprimir
  const esperar = (el: HTMLImageElement | null) =>
    new Promise<void>(res => {
      if (!el || (el.complete && el.naturalWidth)) return res();
      el.onload = el.onerror = () => res();
    });

  Promise.all([
    esperar(doc.getElementById('im') as HTMLImageElement),
    esperar(doc.getElementById('logo') as HTMLImageElement | null),
  ]).then(() => {
    win.focus();
    win.print();
  });
}
