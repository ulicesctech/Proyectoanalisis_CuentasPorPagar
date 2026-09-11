import { createCxpParametroSchema, updateCxpParametroSchema } from './parametro';
import { createCxpPeriodoSchema, updateCxpPeriodoSchema } from './periodo';
import { createCxpCuentaBancariaSchema, updateCxpCuentaBancariaSchema } from './cuenta-bancaria';
import { createCxpCompromisoSchema, updateCxpCompromisoSchema } from './compromiso';
import { createCxpDocumentoSchema, updateCxpDocumentoSchema } from './documento';
import { createCxpDocumentoDetalleSchema, updateCxpDocumentoDetalleSchema } from './documento-detalle';
import { createCxpDocumentoTributoSchema, updateCxpDocumentoTributoSchema } from './documento-tributo';
import { createCxpLotePagoSchema, updateCxpLotePagoSchema } from './lote-pago';
import { createCxpPagoSchema, updateCxpPagoSchema } from './pago';
import { createCxpAplicacionSchema, updateCxpAplicacionSchema } from './aplicacion';
import { createCxpReglaAprobacionSchema, updateCxpReglaAprobacionSchema } from './regla-aprobacion';
import { createCxpAprobacionSchema, updateCxpAprobacionSchema } from './aprobacion';
import { createCxpConciliacionProveedorSchema, updateCxpConciliacionProveedorSchema } from './conciliacion-proveedor';
import { createCxpConciliacionProveedorDetalleSchema, updateCxpConciliacionProveedorDetalleSchema } from './conciliacion-proveedor-detalle';
import { createCxpConciliacionPagoSchema, updateCxpConciliacionPagoSchema } from './conciliacion-pago';
import { createCxpEventoSchema, updateCxpEventoSchema } from './evento';
import { createCxpArchivoSchema, updateCxpArchivoSchema } from './archivo';

export const CXP_SCHEMAS = {
  'parametros': { create: createCxpParametroSchema, update: updateCxpParametroSchema },
  'periodos': { create: createCxpPeriodoSchema, update: updateCxpPeriodoSchema },
  'cuentas-bancarias': { create: createCxpCuentaBancariaSchema, update: updateCxpCuentaBancariaSchema },
  'compromisos': { create: createCxpCompromisoSchema, update: updateCxpCompromisoSchema },
  'documentos': { create: createCxpDocumentoSchema, update: updateCxpDocumentoSchema },
  'documentos-detalle': { create: createCxpDocumentoDetalleSchema, update: updateCxpDocumentoDetalleSchema },
  'documentos-tributos': { create: createCxpDocumentoTributoSchema, update: updateCxpDocumentoTributoSchema },
  'lotes-pago': { create: createCxpLotePagoSchema, update: updateCxpLotePagoSchema },
  'pagos': { create: createCxpPagoSchema, update: updateCxpPagoSchema },
  'aplicaciones': { create: createCxpAplicacionSchema, update: updateCxpAplicacionSchema },
  'reglas-aprobacion': { create: createCxpReglaAprobacionSchema, update: updateCxpReglaAprobacionSchema },
  'aprobaciones': { create: createCxpAprobacionSchema, update: updateCxpAprobacionSchema },
  'conciliaciones-proveedor': { create: createCxpConciliacionProveedorSchema, update: updateCxpConciliacionProveedorSchema },
  'conciliaciones-proveedor-detalle': { create: createCxpConciliacionProveedorDetalleSchema, update: updateCxpConciliacionProveedorDetalleSchema },
  'conciliaciones-pago': { create: createCxpConciliacionPagoSchema, update: updateCxpConciliacionPagoSchema },
  'eventos': { create: createCxpEventoSchema, update: updateCxpEventoSchema },
  'archivos': { create: createCxpArchivoSchema, update: updateCxpArchivoSchema },
} as const;
