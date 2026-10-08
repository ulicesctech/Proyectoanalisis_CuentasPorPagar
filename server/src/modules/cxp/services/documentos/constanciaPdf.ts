/**
 * Generador mínimo de PDF (1.4) para la constancia de factura especial.
 * Sin dependencias externas: texto con las fuentes estándar Helvetica y
 * WinAnsiEncoding (admite tildes y ñ), líneas y rectángulos. No incluye fechas
 * del sistema, por lo que el mismo registro produce siempre el mismo archivo y
 * su SHA-256 (registrado en CXP_ARCHIVO) permite verificarlo.
 */

export interface ConstanciaData {
  numeroConstancia: string;
  numeroFactura: string;
  estado: 'EMITIDA' | 'ANULADA';
  fechaOperacion: string;
  fechaEmision: string;
  fechaGeneracion: string;
  moneda: string;
  tipoCambio: number;
  proveedor: { nombre: string; nit: string | null; cui: string | null; direccion: string | null };
  descripcion: string;
  referencia: string | null;
  montoOperacion: number;
  descuento: number;
  baseImponible: number;
  tributos: Array<{ tipo: string; codigo: string; nombre: string; porcentaje: number; base: number; monto: number; regla: string }>;
  iva: number;
  isrRetenido: number;
  totalRetenciones: number;
  totalAPagar: number;
  respaldo: {
    idDocumento: number;
    registradoPor: string;
    revisadoPor: string | null;
    aprobadoPor: string[];
    emitidoPor: string;
    codigoVerificacion: string;
  };
  anulacion?: { motivo: string; usuario: string; fecha: string };
}

type Rgb = [number, number, number];
const SLATE_900: Rgb = [0.06, 0.09, 0.16];
const SLATE_500: Rgb = [0.39, 0.45, 0.55];
const SLATE_200: Rgb = [0.89, 0.91, 0.94];
const SLATE_50: Rgb = [0.97, 0.98, 0.99];
const BLUE_600: Rgb = [0.15, 0.39, 0.92];
const RED_600: Rgb = [0.86, 0.15, 0.15];

// Anchos aproximados de Helvetica (1/1000 em) para alinear importes y recortar textos.
const WIDTHS: Record<string, number> = { ' ': 278, '.': 278, ',': 278, ':': 278, ';': 278, '!': 278, '|': 260, '-': 333, '(': 333, ')': 333, '/': 278, '%': 889, '·': 278, '…': 1000, '—': 1000 };
function charWidth(char: string): number {
  if (WIDTHS[char]) return WIDTHS[char];
  if (/\d/.test(char)) return 556;
  if ('ijlI'.includes(char)) return 240;
  if ('ftr'.includes(char)) return 320;
  if ('mw'.includes(char)) return 833;
  if ('MW'.includes(char)) return 890;
  return char === char.toUpperCase() && char !== char.toLowerCase() ? 700 : 540;
}
const textWidth = (text: string, size: number) => [...text].reduce((total, char) => total + charWidth(char), 0) * size / 1000;

// Signos tipográficos de WinAnsi fuera del rango Latin-1.
const WIN_ANSI: Record<string, string> = { '…': '\x85', '—': '\x97', '–': '\x96', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '€': '\x80' };

function encode(text: string): string {
  // WinAnsi coincide con Latin-1 en tildes y ñ; lo que no existe en la fuente se sustituye.
  return [...text.normalize('NFC')].map(char => WIN_ANSI[char] ?? (char.charCodeAt(0) <= 0xff ? char : '?')).join('')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class Page {
  private ops: string[] = [];
  text(x: number, y: number, value: string, options: { size?: number; bold?: boolean; color?: Rgb; align?: 'left' | 'right' } = {}) {
    const size = options.size ?? 9;
    const [r, g, b] = options.color ?? SLATE_900;
    const left = options.align === 'right' ? x - textWidth(value, size) : x;
    this.ops.push(`BT ${r} ${g} ${b} rg /${options.bold ? 'F2' : 'F1'} ${size} Tf ${left.toFixed(2)} ${y.toFixed(2)} Td (${encode(value)}) Tj ET`);
  }
  rect(x: number, y: number, width: number, height: number, fill: Rgb, stroke?: Rgb) {
    const [r, g, b] = fill;
    this.ops.push(`${r} ${g} ${b} rg`);
    if (stroke) this.ops.push(`${stroke.join(' ')} RG 0.8 w ${x} ${y} ${width} ${height} re B`);
    else this.ops.push(`${x} ${y} ${width} ${height} re f`);
  }
  line(x1: number, y1: number, x2: number, y2: number, color: Rgb = SLATE_200, width = 0.8) {
    this.ops.push(`${color.join(' ')} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }
  content() { return this.ops.join('\n'); }
}

/** Recorta un texto al ancho disponible, indicando el recorte con puntos suspensivos. */
function fit(text: string, width: number, size: number): string {
  // Margen del 5 %: los anchos son aproximados y las etiquetas van en negrita.
  if (textWidth(text, size) * 1.05 <= width) return text;
  let value = text;
  while (value.length > 1 && textWidth(`${value}…`, size) * 1.05 > width) value = value.slice(0, -1);
  return `${value.trimEnd()}…`;
}

/** Parte un texto largo en líneas que caben en el ancho indicado. */
function wrap(text: string, width: number, size: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) > width && current) { lines.push(current); current = word; }
    else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

const money = (value: number, moneda: string) =>
  `${moneda} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (value: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}${value.length > 10 ? ` ${value.slice(11, 16)}` : ''}` : '—';

export function buildConstanciaPdf(data: ConstanciaData): Buffer {
  const page = new Page();
  const left = 48;
  const right = 547;
  let y = 800;

  // Encabezado
  page.rect(0, 770, 595, 72, SLATE_900);
  page.text(left, 815, 'CUENTAS POR PAGAR · ERP UNIVERSITARIO', { size: 8, bold: true, color: [0.58, 0.64, 0.72] });
  page.text(left, 795, 'Constancia de factura especial', { size: 18, bold: true, color: [1, 1, 1] });
  page.text(right, 815, 'No. de constancia', { size: 8, color: [0.58, 0.64, 0.72], align: 'right' });
  page.text(right, 795, data.numeroConstancia, { size: 16, bold: true, color: [1, 1, 1], align: 'right' });
  y = 745;

  if (data.anulacion) {
    const lineas = wrap(`${fecha(data.anulacion.fecha)} · ${data.anulacion.usuario} · Motivo: ${data.anulacion.motivo}`, right - left - 24, 8).slice(0, 4);
    const alto = 26 + lineas.length * 11;
    page.rect(left, y - alto + 8, right - left, alto, [1, 0.95, 0.95], RED_600);
    page.text(left + 12, y - 8, 'DOCUMENTO ANULADO', { size: 11, bold: true, color: RED_600 });
    lineas.forEach((linea, index) => page.text(left + 12, y - 22 - index * 11, linea, { size: 8, color: RED_600 }));
    y -= alto + 12;
  }

  const section = (title: string) => {
    page.text(left, y, title.toUpperCase(), { size: 8, bold: true, color: BLUE_600 });
    page.line(left, y - 5, right, y - 5, SLATE_200);
    y -= 20;
  };
  const pair = (x: number, label: string, value: string, width = 160) => {
    page.text(x, y, label, { size: 7.5, color: SLATE_500 });
    page.text(x, y - 12, fit(value, width, 9.5), { size: 9.5, bold: true });
  };

  section('Datos del documento');
  pair(left, 'No. de factura especial', data.numeroFactura);
  pair(left + 170, 'Fecha de la operación', fecha(data.fechaOperacion));
  pair(left + 330, 'Fecha de emisión', fecha(data.fechaEmision));
  y -= 32;
  pair(left, 'Moneda / tipo de cambio', `${data.moneda} · ${data.tipoCambio}`);
  pair(left + 170, 'Referencia de la operación', data.referencia ?? '—');
  pair(left + 330, 'Estado', data.estado);
  y -= 40;

  section('Proveedor');
  pair(left, 'Nombre', data.proveedor.nombre, 320);
  pair(left + 330, 'NIT', data.proveedor.nit ?? '—');
  y -= 32;
  pair(left, 'Dirección', data.proveedor.direccion ?? '—', 320);
  pair(left + 330, 'CUI / DPI', data.proveedor.cui ?? '—');
  y -= 32;
  page.text(left, y, 'Descripción de la operación', { size: 7.5, color: SLATE_500 });
  y -= 12;
  for (const line of wrap(data.descripcion, right - left, 9).slice(0, 4)) { page.text(left, y, line, { size: 9 }); y -= 12; }
  y -= 16;

  section('Detalle tributario');
  page.rect(left, y - 6, right - left, 18, SLATE_50);
  const cols = [left + 6, left + 222, right - 150, right - 82, right - 6];
  page.text(cols[0], y, 'Tributo (regla aplicada)', { size: 7.5, bold: true, color: SLATE_500 });
  page.text(cols[1], y, 'Tipo', { size: 7.5, bold: true, color: SLATE_500 });
  page.text(cols[2], y, 'Base', { size: 7.5, bold: true, color: SLATE_500, align: 'right' });
  page.text(cols[3], y, '%', { size: 7.5, bold: true, color: SLATE_500, align: 'right' });
  page.text(cols[4], y, 'Monto', { size: 7.5, bold: true, color: SLATE_500, align: 'right' });
  y -= 20;
  for (const tributo of data.tributos) {
    page.text(cols[0], y, fit(`${tributo.nombre} (${tributo.regla})`, cols[1] - cols[0] - 8, 8.5), { size: 8.5 });
    page.text(cols[1], y, tributo.tipo === 'RETENCION' ? 'Retención' : 'Impuesto', { size: 8.5 });
    page.text(cols[2], y, money(tributo.base, data.moneda), { size: 8.5, align: 'right' });
    page.text(cols[3], y, `${tributo.porcentaje}%`, { size: 8.5, align: 'right' });
    page.text(cols[4], y, money(tributo.monto, data.moneda), { size: 8.5, align: 'right' });
    page.line(left, y - 6, right, y - 6, SLATE_200, 0.5);
    y -= 18;
  }
  if (!data.tributos.length) { page.text(cols[0], y, 'Sin tributos aplicables.', { size: 8.5, color: SLATE_500 }); y -= 18; }
  y -= 8;

  // Totales
  const totals: Array<[string, number, boolean?]> = [
    ['Monto de la operación', data.montoOperacion],
    ['Descuento', data.descuento],
    ['Base imponible', data.baseImponible],
    ['IVA correspondiente', data.iva],
    ['ISR retenido', data.isrRetenido],
    ['Total de retenciones', data.totalRetenciones],
    ['Total a pagar al proveedor', data.totalAPagar, true],
  ];
  const boxTop = y + 6;
  page.rect(right - 250, boxTop - totals.length * 16 - 8, 250, totals.length * 16 + 8, SLATE_50, SLATE_200);
  for (const [label, value, strong] of totals) {
    page.text(right - 240, y - 6, label, { size: strong ? 9.5 : 8.5, bold: strong, color: strong ? SLATE_900 : SLATE_500 });
    page.text(right - 10, y - 6, money(value, data.moneda), { size: strong ? 9.5 : 8.5, bold: true, align: 'right' });
    y -= 16;
  }
  y -= 30;

  section('Información de respaldo');
  pair(left, 'Documento CXP', `#${data.respaldo.idDocumento}`);
  pair(left + 170, 'Registrado por', data.respaldo.registradoPor);
  pair(left + 330, 'Revisado por', data.respaldo.revisadoPor ?? '—');
  y -= 32;
  pair(left, 'Aprobado por', data.respaldo.aprobadoPor.join(', ') || '—', 320);
  pair(left + 330, 'Emitido por', data.respaldo.emitidoPor);
  y -= 32;
  pair(left, 'Código de verificación (SHA-256 de los datos de emisión)', data.respaldo.codigoVerificacion, right - left);
  y -= 32;
  pair(left, 'Fecha de generación de la constancia', fecha(data.fechaGeneracion));

  page.line(left, 60, right, 60, SLATE_200);
  page.text(left, 46, 'Constancia generada por el módulo de Cuentas por Pagar. Los valores tributarios corresponden a las reglas vigentes', { size: 7, color: SLATE_500 });
  page.text(left, 36, 'en la fecha de la operación y se conservan aunque las reglas cambien posteriormente.', { size: 7, color: SLATE_500 });

  const stream = Buffer.from(page.content(), 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let length = chunks[0].length;
  const push = (buffer: Buffer) => { chunks.push(buffer); length += buffer.length; };
  objects.forEach((body, index) => { offsets.push(length); push(Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, 'latin1')); });
  offsets.push(length);
  push(Buffer.from(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n`, 'latin1'));
  push(stream);
  push(Buffer.from('\nendstream\nendobj\n', 'latin1'));
  const xref = length;
  push(Buffer.from(`xref\n0 7\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
    + `trailer\n<< /Size 7 /Root 1 0 R /Info << /Title (Constancia ${encode(data.numeroConstancia)}) /Producer (ERP CXP) >> >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}
