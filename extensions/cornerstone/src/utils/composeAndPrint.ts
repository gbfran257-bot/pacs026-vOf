type ComposeOptions = { cols?: number; gap?: number; background?: string };

// ---- MEMBRETE: edita solo estos datos ----
export const MEMBRETE = {
  logoUrl: `${(window as any).PUBLIC_URL || '/'}assets/logo-clinica.png`,
  nombre: 'Clínica San Antonio',
  lineas: ['Tu dirección', 'Tel. 000 000 0000', 'correo@clinica.com'],
  pie: 'Departamento de Imagenología · Clínica San Antonio',
};

// ---- ENCABEZADO DE LA HOJA IMPRESA (valores por defecto, editables en la vista previa) ----
const CLAVE_ENC = 'membrete_encabezado_v1';
const ENC_DEFECTO = {
  titulo: 'Informe Imagenología',
  lineas: [
    'Dra. Ma. Victoria Aguilera Navarro',
    'Médico Radiólogo\u00a0\u00a0Ced. de Esp. 3175254 BUAP',
    'Certificado Consejo Mexicano Radiología e Imagen',
    'Asiste de 10 a 15 hrs.',
  ],
};

const leerEnc = (): { titulo: string; lineas: string[] } => {
  try {
    const raw = localStorage.getItem(CLAVE_ENC);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o.titulo === 'string' && Array.isArray(o.lineas)) {
        return o;
      }
    }
  } catch (e) {
    /* sin almacenamiento: se usan los valores por defecto */
  }
  return ENC_DEFECTO;
};

// ---- DATOS DEL ESTUDIO (se llenan desde los metadatos DICOM) ----
export type InfoEstudio = {
  paciente?: string;
  id?: string;
  nacimiento?: string;
  edad?: string;
  sexo?: string;
  fechaEstudio?: string;
  medicoInforma?: string; // quien lee o realiza el estudio (encabezado)
  medicoSolicita?: string; // médico referente (cuerpo)
  institucion?: string;
};

// DICOM PN: Apellido^Nombre^Segundo^Prefijo^Sufijo -> "Prefijo Nombre Segundo Apellido Sufijo"
const pn = (v: any): string => {
  if (!v) return '';
  if (Array.isArray(v)) return pn(v[0]);
  const raw = typeof v === 'string' ? v : v.Alphabetic || v.alphabetic || '';
  const [fam = '', giv = '', mid = '', pre = '', suf = ''] = String(raw).split('^');
  return [pre, giv, mid, fam, suf]
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ');
};

const fechaDicom = (d?: string) =>
  d && /^\d{8}$/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : '';

const edadDicom = (a?: string) => {
  const m = /^(\d+)([DWMY])$/.exec(a || '');
  if (!m) return '';
  const n = parseInt(m[1], 10);
  const u = { D: 'días', W: 'semanas', M: 'meses', Y: 'años' }[m[2] as 'D' | 'W' | 'M' | 'Y'];
  return `${n} ${u}`;
};

export function infoDesdeInstancia(inst: any): InfoEstudio {
  if (!inst) return {};
  const sexo =
    ({ M: 'Masculino', F: 'Femenino', O: 'Otro' } as Record<string, string>)[inst.PatientSex] || '';
  return {
    paciente: pn(inst.PatientName),
    id: inst.PatientID || '',
    nacimiento: fechaDicom(inst.PatientBirthDate),
    edad: edadDicom(inst.PatientAge),
    sexo,
    fechaEstudio: fechaDicom(inst.StudyDate),
    medicoInforma: pn(inst.NameOfPhysiciansReadingStudy) || pn(inst.PerformingPhysicianName) || '',
    medicoSolicita: pn(inst.ReferringPhysicianName),
    institucion: inst.InstitutionName || '',
  };
}

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

function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
}

// Devuelve un canvas nuevo con el membrete arriba, la imagen en medio y el pie abajo
async function agregarMembrete(
  canvas: HTMLCanvasElement,
  info: InfoEstudio = {}
): Promise<HTMLCanvasElement> {
  const m = MEMBRETE;
  const u = Math.max(canvas.width / 1000, 0.6); // unidad que escala con la imagen
  const pad = 20 * u;
  const headerH = 110 * u;
  const footerH = m.pie ? 36 * u : 0;

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = Math.floor(canvas.height + headerH + footerH);
  const ctx = out.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);

  let x = pad;
  const logo = m.logoUrl
    ? await cargarImagen(new URL(m.logoUrl, window.location.origin).href)
    : null;
  if (logo) {
    const h = 80 * u;
    const w = (logo.width * h) / logo.height;
    ctx.drawImage(logo, x, 15 * u, w, h);
    x += w + 16 * u;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0b5ea8';
  ctx.font = `bold ${24 * u}px Arial, sans-serif`;
  ctx.fillText(m.nombre, x, 42 * u);
  ctx.fillStyle = '#111';
  ctx.font = `${14 * u}px Arial, sans-serif`;
  m.lineas.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, (64 + i * 18) * u));

  ctx.textAlign = 'right';
  ctx.font = `${15 * u}px Arial, sans-serif`;
  ctx.fillText(
    `Fecha: ${info.fechaEstudio || new Date().toLocaleDateString('es-MX')}`,
    out.width - pad,
    42 * u
  );
  // Datos del paciente y médico (solo si el estudio los trae)
  ctx.font = `${13 * u}px Arial, sans-serif`;
  let ly = 64;
  if (info.paciente) {
    ctx.fillText(`Paciente: ${info.paciente}`, out.width - pad, ly * u);
    ly += 18;
  }
  if (info.medicoInforma) {
    ctx.fillText(info.medicoInforma, out.width - pad, ly * u);
  }

  ctx.fillStyle = '#0b5ea8';
  ctx.fillRect(pad, headerH - 6 * u, out.width - 2 * pad, 2 * u);

  ctx.drawImage(canvas, 0, headerH);

  if (m.pie) {
    const fy = headerH + canvas.height;
    ctx.fillStyle = '#999';
    ctx.fillRect(pad, fy + 6 * u, out.width - 2 * pad, 1 * u);
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.font = `${13 * u}px Arial, sans-serif`;
    ctx.fillText(m.pie, out.width / 2, fy + 26 * u);
  }

  return out;
}

export async function descargarCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  fileType: string,
  info: InfoEstudio = {}
) {
  const conMembrete = await agregarMembrete(canvas, info);
  const mime = fileType === 'png' ? 'image/png' : 'image/jpeg';
  conMembrete.toBlob(
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

const htmlLineasEnc = (ls: string[]) =>
  ls.map(l => `<p contenteditable="true">${esc(l)}</p>`).join('');

// Abre una vista previa editable (título, encabezado y datos) y desde ahí se imprime
export function imprimirCanvas(canvas: HTMLCanvasElement, info: InfoEstudio = {}) {
  const m = MEMBRETE;
  const dataUrl = canvas.toDataURL('image/png');
  const logoAbs = m.logoUrl ? new URL(m.logoUrl, window.location.origin).href : '';
  const enc = leerEnc();
  const lineasEnc = info.medicoInforma
    ? [info.medicoInforma, info.institucion || ''].filter(Boolean)
    : enc.lineas;

  // ---------- Contenedor con barra de herramientas ----------
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#3a3a3a;display:flex;flex-direction:column;align-items:center;font-family:Arial,sans-serif;';

  const bar = document.createElement('div');
  bar.style.cssText =
    'width:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;background:#111;color:#fff;font-size:14px;flex:none;box-sizing:border-box;';
  const msg = document.createElement('span');
  msg.style.cssText = 'flex:1;min-width:200px;';
  msg.textContent =
    'Haz clic en el título, el encabezado o los datos del paciente para editarlos antes de imprimir.';
  bar.appendChild(msg);

  const mkBtn = (txt: string, onClick: () => void, primary = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = `padding:6px 14px;border:0;border-radius:6px;cursor:pointer;font-size:14px;color:${
      primary ? '#000' : '#fff'
    };background:${primary ? '#16c1e0' : '#444'};`;
    b.onclick = onClick;
    bar.appendChild(b);
    return b;
  };

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'border:0;background:#fff;margin-top:12px;flex:none;';

  overlay.appendChild(bar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  // La hoja se previsualiza con la proporción de carta; el tamaño real lo eliges al imprimir
  let horizontal = true;
  const ajustar = () => {
    const r = horizontal ? 279.4 / 215.9 : 215.9 / 279.4;
    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - bar.offsetHeight - 36;
    const w = Math.max(200, Math.min(maxW, maxH * r));
    iframe.style.width = `${w}px`;
    iframe.style.height = `${w / r}px`;
  };

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(`<html><head><title>Imprimir estudio</title>
    <style>
      @page { margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }

      /* Todo se mide con --m (1 mm de la hoja). Se calcula con el ancho de la hoja que elijas en
         el cuadro de impresión (vertical u horizontal), así que el encabezado y el pie conservan
         su tamaño aunque cambies orientación, papel o escala. Van fijos arriba y abajo. */
      :root { --m: calc(100vw / 215.9); }
      @media (orientation: landscape) { :root { --m: calc(100vw / 279.4); } }

      /* ---------- EDITABLE (no se imprime el contorno) ---------- */
      [contenteditable] { cursor: text; outline: none; }
      [contenteditable]:hover { outline: 1px dashed #7ab51d; }
      [contenteditable]:focus { outline: 2px solid #0b5ea8; background: rgba(255,255,255,.7); }
      @media print { [contenteditable], [contenteditable]:hover, [contenteditable]:focus {
        outline: none !important; background: none !important; } }

      /* ---------- ENCABEZADO ---------- */
      .encabezado { position: fixed; top: 0; left: 0; right: 0; height: calc(38 * var(--m)); background: #f6f6f6;
        display: flex; align-items: center; padding: 0 calc(8 * var(--m)); overflow: hidden; }
      .encabezado .logo { height: calc(30 * var(--m)); max-width: calc(60 * var(--m)); object-fit: contain; }
      .encabezado .barra-a { position: absolute; top: calc(3 * var(--m)); left: calc(78 * var(--m));
        right: calc(-8 * var(--m)); height: calc(3.6 * var(--m)); background: #2e2a6e;
        border-radius: calc(3 * var(--m)) 0 0 calc(3 * var(--m)); transform: skewX(-30deg); }
      .encabezado .barra-b { position: absolute; top: calc(8 * var(--m)); left: calc(92 * var(--m));
        right: calc(-8 * var(--m)); height: calc(3 * var(--m)); background: #7ab51d;
        border-radius: calc(3 * var(--m)) 0 0 calc(3 * var(--m)); transform: skewX(-30deg); }
      .encabezado .hoja { position: absolute; top: calc(8 * var(--m)); left: calc(70 * var(--m));
        width: calc(9 * var(--m)); height: calc(5 * var(--m)); background: #7ab51d;
        border-radius: 0 100% 0 100%; }
      .encabezado .info { position: absolute; right: calc(8 * var(--m)); bottom: calc(3 * var(--m));
        width: calc(112 * var(--m)); text-align: center; color: #2e2a6e; }
      .encabezado .titulo { font-size: calc(7.76 * var(--m)); line-height: 1.1;
        margin: 0 0 calc(2 * var(--m)); font-weight: 500; }
      .encabezado .info p { margin: 0; font-size: calc(3.18 * var(--m)); line-height: 1.35; min-height: calc(3 * var(--m)); }

      /* Datos del paciente, a un lado del logo */
      .encabezado .datos-enc { position: absolute; left: calc(70 * var(--m)); top: calc(14 * var(--m));
        width: calc(84 * var(--m)); color: #222; font-size: calc(2.9 * var(--m)); line-height: 1.25; }
      .encabezado .datos-enc .f { display: flex; gap: calc(1.5 * var(--m)); align-items: baseline; }
      .encabezado .datos-enc b { color: #2e2a6e; white-space: nowrap; font-weight: 600; }
      .encabezado .datos-enc .v { flex: 1; min-width: 0; min-height: calc(3.4 * var(--m));
        overflow: hidden; white-space: nowrap; }
      @media (orientation: portrait) {
        .encabezado .logo { max-width: calc(45 * var(--m)); }
        .encabezado .info { width: calc(88 * var(--m)); }
        .encabezado .datos-enc { left: calc(55 * var(--m)); width: calc(62 * var(--m)); }
      }

      /* ---------- CUERPO (fondo blanco) ---------- */
      .cuerpo { position: fixed; left: 0; right: 0; top: calc(38 * var(--m)); bottom: calc(30 * var(--m)); background: #fff; padding: calc(6 * var(--m)) calc(8 * var(--m));
        display: flex; flex-direction: column; gap: calc(4 * var(--m)); }
      .estudio { position: relative; flex: 1; min-height: 0; }
      .estudio img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }

      /* ---------- PIE ---------- */
      .pie { position: fixed; left: 0; right: 0; bottom: 0; height: calc(30 * var(--m)); background: #f6f6f6;
        padding: calc(4 * var(--m)) calc(8 * var(--m)) calc(3 * var(--m));
        display: flex; flex-direction: column; justify-content: space-between; color: #2e2a6e; }
      .pie .fila { display: flex; align-items: center; gap: calc(4 * var(--m)); }
      .pie .hojas { display: flex; align-items: flex-end; gap: calc(1 * var(--m)); }
      .pie .hoja-v { width: calc(9 * var(--m)); height: calc(10 * var(--m)); background: #7ab51d;
        border-radius: 0 100% 0 100%; }
      .pie .hoja-a { width: calc(4.5 * var(--m)); height: calc(7 * var(--m)); background: #2e2a6e;
        border-radius: 0 100% 0 100%; }
      .pie .gracias { flex: 1; text-align: center; font-size: calc(5.29 * var(--m)); }
      .pie .linea { height: calc(4 * var(--m)); background: #2e2a6e; border-radius: calc(2 * var(--m)); }
      .pie .contacto { display: flex; justify-content: space-between; font-size: calc(2.65 * var(--m)); }
    </style></head>
    <body>
      <div class="pagina">

        <div class="encabezado">
          ${logoAbs ? `<img id="logo" class="logo" src="${logoAbs}" />` : ''}
          <div class="barra-a"></div>
          <div class="hoja"></div>
          <div class="barra-b"></div>
          <div class="info" id="info">
            <div class="titulo" contenteditable="true">${esc(enc.titulo)}</div>
            ${htmlLineasEnc(lineasEnc)}
          </div>
          <div class="datos-enc">
            <div class="f"><b>Paciente:</b><span class="v" contenteditable="true">${esc(info.paciente || '')}</span></div>
            <div class="f"><b>ID:</b><span class="v" contenteditable="true">${esc(info.id || '')}</span></div>
            <div class="f"><b>Fecha:</b><span class="v" contenteditable="true">${esc(info.fechaEstudio || new Date().toLocaleDateString('es-MX'))}</span></div>
            <div class="f"><b>Nacimiento:</b><span class="v" contenteditable="true">${esc(info.nacimiento || '')}${info.edad ? ` (${esc(info.edad)})` : ''}</span></div>
            <div class="f"><b>Sexo:</b><span class="v" contenteditable="true">${esc(info.sexo || '')}</span></div>
            <div class="f"><b>Médico:</b><span class="v" contenteditable="true">${esc(info.medicoSolicita || '')}</span></div>
          </div>
        </div>

        <div class="cuerpo">
          <div class="estudio"><img id="im" src="${dataUrl}" /></div>
        </div>

        <div class="pie">
          <div class="fila">
            <div class="hojas"><div class="hoja-v"></div><div class="hoja-a"></div></div>
            <div class="gracias">Agradecemos su preferencia por nuestro servicio</div>
          </div>
          <div class="linea"></div>
          <div class="contacto">
            <span>&#8962; Manuel Mazarik No.8 Col. Progreso Axochiapan Mor.</span>
            <span>&#9990;&#xFE0E; 01 (769) 351 1945 al 46 Ó 735 183 02 12</span>
            <span>&#9993;&#xFE0E; imagencsa13@gmail.com</span>
          </div>
        </div>

      </div>
    </body></html>`);
  doc.close();

  // espera la imagen del estudio y el logo antes de abrir el cuadro de impresión
  const esperar = (el: HTMLImageElement | null) =>
    new Promise<void>(res => {
      if (!el || (el.complete && el.naturalWidth)) return res();
      el.onload = el.onerror = () => res();
    });

  // guarda el título y las líneas del encabezado para la próxima vez
  const guardarEncabezado = () => {
    try {
      const titulo = (doc.querySelector('.encabezado .titulo') as HTMLElement)?.innerText.trim();
      const lineas = Array.from(doc.querySelectorAll('.encabezado .info p'))
        .flatMap(p => (p as HTMLElement).innerText.split('\n'))
        .map(s => s.trim())
        .filter(Boolean);
      localStorage.setItem(
        CLAVE_ENC,
        JSON.stringify({
          titulo: titulo || ENC_DEFECTO.titulo,
          // si las líneas vienen del estudio, se conservan las que ya estaban guardadas
          lineas: info.medicoInforma ? enc.lineas : lineas,
        })
      );
    } catch (e) {
      /* sin almacenamiento: no pasa nada */
    }
  };

  const cerrar = () => {
    window.removeEventListener('resize', ajustar);
    overlay.remove();
  };

  mkBtn('Vertical / Horizontal', () => {
    horizontal = !horizontal;
    ajustar();
  });
  mkBtn('Restaurar encabezado', () => {
    try {
      localStorage.removeItem(CLAVE_ENC);
    } catch (e) {
      /* ignorar */
    }
    const inf = doc.getElementById('info');
    if (inf) {
      inf.innerHTML = `<div class="titulo" contenteditable="true">${esc(ENC_DEFECTO.titulo)}</div>${htmlLineasEnc(
        ENC_DEFECTO.lineas
      )}`;
    }
  });
  mkBtn('Cerrar', cerrar);
  mkBtn(
    'Imprimir',
    async () => {
      guardarEncabezado();
      await Promise.all([
        esperar(doc.getElementById('im') as HTMLImageElement),
        esperar(doc.getElementById('logo') as HTMLImageElement | null),
      ]);
      win.focus();
      win.print();
    },
    true
  );

  window.addEventListener('resize', ajustar);
  ajustar();
}