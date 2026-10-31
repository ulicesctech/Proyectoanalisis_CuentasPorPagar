import type { CxpReglaTributaria } from './factura-especial';
export interface CxpTributoIdentificacion { tipo: string; codigo: string; nombre: string; origen: 'HISTORICO' | 'CONFIGURACION' }
export interface CxpTributosOpciones { identificaciones: CxpTributoIdentificacion[]; reglas: CxpReglaTributaria[] }
