export type CxpResource =
  | 'parametros' | 'periodos' | 'cuentas-bancarias' | 'compromisos'
  | 'documentos' | 'documentos-detalle' | 'documentos-tributos'
  | 'lotes-pago' | 'pagos' | 'aplicaciones'
  | 'reglas-aprobacion' | 'aprobaciones'
  | 'conciliaciones-proveedor' | 'conciliaciones-proveedor-detalle' | 'conciliaciones-pago'
  | 'eventos' | 'archivos';

export type CxpValue = string | number | null;
export type CxpRecord = Record<string, CxpValue>;
export interface CxpOption { id: number | string; label: string; }
export interface CxpValidationIssue { campo: string; mensaje: string; }

export interface CxpFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'textarea';
  required: boolean;
  section: string;
  options?: readonly string[];
  maxLength?: number;
  precision?: number;
  scale?: number;
  integer?: boolean;
  defaultValue?: string | number;
  readOnly?: boolean;
  identity?: boolean;
  calculated?: boolean;
  lookup?: string;
}

export interface CxpEntityDefinition {
  resource: CxpResource;
  title: string;
  singular: string;
  group: string;
  idField: string;
  columns: readonly string[];
  fields: readonly CxpFieldDefinition[];
  associationFields?: readonly string[];
}

export interface CxpListQuery {
  page?: string;
  limit?: string;
  search?: string;
  filterField?: string;
  filterValue?: string;
}
