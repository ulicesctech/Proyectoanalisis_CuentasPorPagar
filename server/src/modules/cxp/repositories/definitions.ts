import type { CxpResource } from '@erp/contracts';

export interface CxpTableDefinition {
  table: string;
  idColumn: string;
  columns: Record<string, { column: string; type: string }>;
  foreignKeys: Record<string, { table: string; key: string }>;
  checkNames: string[];
}

export const CXP_TABLES: Record<CxpResource, CxpTableDefinition> = {
  "parametros": {
    "table": "CXP_PARAMETRO",
    "idColumn": "ID_PARAMETRO",
    "columns": {
      "idParametro": {
        "column": "ID_PARAMETRO",
        "type": "NUMBER"
      },
      "grupoParametro": {
        "column": "GRUPO_PARAMETRO",
        "type": "VARCHAR2"
      },
      "codigo": {
        "column": "CODIGO",
        "type": "VARCHAR2"
      },
      "nombre": {
        "column": "NOMBRE",
        "type": "VARCHAR2"
      },
      "valorTexto": {
        "column": "VALOR_TEXTO",
        "type": "VARCHAR2"
      },
      "valorNumero": {
        "column": "VALOR_NUMERO",
        "type": "NUMBER"
      },
      "activo": {
        "column": "ACTIVO",
        "type": "CHAR"
      },
      "modificadoPor": {
        "column": "MODIFICADO_POR",
        "type": "NUMBER"
      },
      "fechaModificacion": {
        "column": "FECHA_MODIFICACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "modificadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_PAR_ACTIVO",
      "CK_CXP_PAR_VALOR"
    ]
  },
  "periodos": {
    "table": "CXP_PERIODO",
    "idColumn": "ID_PERIODO",
    "columns": {
      "idPeriodo": {
        "column": "ID_PERIODO",
        "type": "NUMBER"
      },
      "idSucursal": {
        "column": "ID_SUCURSAL",
        "type": "NUMBER"
      },
      "anio": {
        "column": "ANIO",
        "type": "NUMBER"
      },
      "mes": {
        "column": "MES",
        "type": "NUMBER"
      },
      "fechaInicio": {
        "column": "FECHA_INICIO",
        "type": "DATE"
      },
      "fechaFin": {
        "column": "FECHA_FIN",
        "type": "DATE"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "saldoInicial": {
        "column": "SALDO_INICIAL",
        "type": "NUMBER"
      },
      "movimientosDebe": {
        "column": "MOVIMIENTOS_DEBE",
        "type": "NUMBER"
      },
      "movimientosHaber": {
        "column": "MOVIMIENTOS_HABER",
        "type": "NUMBER"
      },
      "saldoFinal": {
        "column": "SALDO_FINAL",
        "type": "NUMBER"
      },
      "cerradoPor": {
        "column": "CERRADO_POR",
        "type": "NUMBER"
      },
      "fechaCierre": {
        "column": "FECHA_CIERRE",
        "type": "TIMESTAMP"
      },
      "reabiertoPor": {
        "column": "REABIERTO_POR",
        "type": "NUMBER"
      },
      "fechaReapertura": {
        "column": "FECHA_REAPERTURA",
        "type": "TIMESTAMP"
      },
      "motivoReapertura": {
        "column": "MOTIVO_REAPERTURA",
        "type": "VARCHAR2"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idSucursal": {
        "table": "CXC_SUCURSALES",
        "key": "ID_SUCURSAL"
      },
      "cerradoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "reabiertoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_PER_MES",
      "CK_CXP_PER_FECHAS",
      "CK_CXP_PER_ESTADO",
      "CK_CXP_PER_CIERRE",
      "CK_CXP_PER_REAP"
    ]
  },
  "cuentas-bancarias": {
    "table": "CXP_CUENTA_BANCARIA",
    "idColumn": "ID_CUENTA_BANCARIA",
    "columns": {
      "idCuentaBancaria": {
        "column": "ID_CUENTA_BANCARIA",
        "type": "NUMBER"
      },
      "tipoTitular": {
        "column": "TIPO_TITULAR",
        "type": "VARCHAR2"
      },
      "idEmpresa": {
        "column": "ID_EMPRESA",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "bancoNombre": {
        "column": "BANCO_NOMBRE",
        "type": "VARCHAR2"
      },
      "codigoBanco": {
        "column": "CODIGO_BANCO",
        "type": "VARCHAR2"
      },
      "titular": {
        "column": "TITULAR",
        "type": "VARCHAR2"
      },
      "numeroCuenta": {
        "column": "NUMERO_CUENTA",
        "type": "VARCHAR2"
      },
      "tipoCuenta": {
        "column": "TIPO_CUENTA",
        "type": "VARCHAR2"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "pais": {
        "column": "PAIS",
        "type": "VARCHAR2"
      },
      "codigoSwift": {
        "column": "CODIGO_SWIFT",
        "type": "VARCHAR2"
      },
      "codigoIban": {
        "column": "CODIGO_IBAN",
        "type": "VARCHAR2"
      },
      "esPrincipal": {
        "column": "ES_PRINCIPAL",
        "type": "CHAR"
      },
      "titularCoincide": {
        "column": "TITULAR_COINCIDE",
        "type": "CHAR"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "estadoAprobacion": {
        "column": "ESTADO_APROBACION",
        "type": "VARCHAR2"
      },
      "motivoBloqueo": {
        "column": "MOTIVO_BLOQUEO",
        "type": "VARCHAR2"
      },
      "fechaVerificacion": {
        "column": "FECHA_VERIFICACION",
        "type": "TIMESTAMP"
      },
      "verificadoPor": {
        "column": "VERIFICADO_POR",
        "type": "NUMBER"
      },
      "creadoPor": {
        "column": "CREADO_POR",
        "type": "NUMBER"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      },
      "modificadoPor": {
        "column": "MODIFICADO_POR",
        "type": "NUMBER"
      },
      "fechaModificacion": {
        "column": "FECHA_MODIFICACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idEmpresa": {
        "table": "CXC_EMPRESAS",
        "key": "ID_EMPRESA"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "verificadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "creadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "modificadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_CTA_DUENO",
      "CK_CXP_CTA_TIPO",
      "CK_CXP_CTA_MONEDA",
      "CK_CXP_CTA_SINO",
      "CK_CXP_CTA_ESTADO",
      "CK_CXP_CTA_APROB",
      "CK_CXP_CTA_VERIFICADA",
      "CK_CXP_CTA_BLOQUEO"
    ]
  },
  "compromisos": {
    "table": "CXP_COMPROMISO",
    "idColumn": "ID_COMPROMISO",
    "columns": {
      "idCompromiso": {
        "column": "ID_COMPROMISO",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idSucursal": {
        "column": "ID_SUCURSAL",
        "type": "NUMBER"
      },
      "idDepartamento": {
        "column": "ID_DEPARTAMENTO",
        "type": "NUMBER"
      },
      "tipoCompromiso": {
        "column": "TIPO_COMPROMISO",
        "type": "VARCHAR2"
      },
      "numeroReferencia": {
        "column": "NUMERO_REFERENCIA",
        "type": "VARCHAR2"
      },
      "descripcion": {
        "column": "DESCRIPCION",
        "type": "VARCHAR2"
      },
      "fechaInicio": {
        "column": "FECHA_INICIO",
        "type": "DATE"
      },
      "fechaFin": {
        "column": "FECHA_FIN",
        "type": "DATE"
      },
      "frecuencia": {
        "column": "FRECUENCIA",
        "type": "VARCHAR2"
      },
      "numeroCuotas": {
        "column": "NUMERO_CUOTAS",
        "type": "NUMBER"
      },
      "diaVencimiento": {
        "column": "DIA_VENCIMIENTO",
        "type": "NUMBER"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "montoTotal": {
        "column": "MONTO_TOTAL",
        "type": "NUMBER"
      },
      "saldoCapital": {
        "column": "SALDO_CAPITAL",
        "type": "NUMBER"
      },
      "tasaInteres": {
        "column": "TASA_INTERES",
        "type": "NUMBER"
      },
      "valorCuota": {
        "column": "VALOR_CUOTA",
        "type": "NUMBER"
      },
      "garantiaDescripcion": {
        "column": "GARANTIA_DESCRIPCION",
        "type": "VARCHAR2"
      },
      "cuentaContable": {
        "column": "CUENTA_CONTABLE",
        "type": "VARCHAR2"
      },
      "centroCosto": {
        "column": "CENTRO_COSTO",
        "type": "VARCHAR2"
      },
      "proyecto": {
        "column": "PROYECTO",
        "type": "VARCHAR2"
      },
      "responsablePor": {
        "column": "RESPONSABLE_POR",
        "type": "NUMBER"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "creadoPor": {
        "column": "CREADO_POR",
        "type": "NUMBER"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      },
      "modificadoPor": {
        "column": "MODIFICADO_POR",
        "type": "NUMBER"
      },
      "fechaModificacion": {
        "column": "FECHA_MODIFICACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idSucursal": {
        "table": "CXC_SUCURSALES",
        "key": "ID_SUCURSAL"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "idDepartamento": {
        "table": "DEPARTAMENTO",
        "key": "DEP_ID_DEPARTAMENTO"
      },
      "responsablePor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "creadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "modificadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_COMP_TIPO",
      "CK_CXP_COMP_FECHAS",
      "CK_CXP_COMP_FREC",
      "CK_CXP_COMP_DIA",
      "CK_CXP_COMP_MONTOS",
      "CK_CXP_COMP_ESTADO"
    ]
  },
  "documentos": {
    "table": "CXP_DOCUMENTO",
    "idColumn": "ID_DOCUMENTO",
    "columns": {
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idSucursal": {
        "column": "ID_SUCURSAL",
        "type": "NUMBER"
      },
      "idCondicionCredito": {
        "column": "ID_CONDICION_CREDITO",
        "type": "NUMBER"
      },
      "idCompromiso": {
        "column": "ID_COMPROMISO",
        "type": "NUMBER"
      },
      "idDocumentoRelacionado": {
        "column": "ID_DOCUMENTO_RELACIONADO",
        "type": "NUMBER"
      },
      "noFacturaCompra": {
        "column": "NO_FACTURA_COMPRA",
        "type": "VARCHAR2"
      },
      "noOrdenCompra": {
        "column": "NO_ORDEN_COMPRA",
        "type": "VARCHAR2"
      },
      "noRecepcion": {
        "column": "NO_RECEPCION",
        "type": "VARCHAR2"
      },
      "tipoDocumento": {
        "column": "TIPO_DOCUMENTO",
        "type": "VARCHAR2"
      },
      "naturaleza": {
        "column": "NATURALEZA",
        "type": "CHAR"
      },
      "origenIngreso": {
        "column": "ORIGEN_INGRESO",
        "type": "VARCHAR2"
      },
      "tipoRegistro": {
        "column": "TIPO_REGISTRO",
        "type": "VARCHAR2"
      },
      "serie": {
        "column": "SERIE",
        "type": "VARCHAR2"
      },
      "numeroDocumento": {
        "column": "NUMERO_DOCUMENTO",
        "type": "VARCHAR2"
      },
      "uuidFiscal": {
        "column": "UUID_FISCAL",
        "type": "VARCHAR2"
      },
      "nitEmisor": {
        "column": "NIT_EMISOR",
        "type": "VARCHAR2"
      },
      "referenciaExterna": {
        "column": "REFERENCIA_EXTERNA",
        "type": "VARCHAR2"
      },
      "hashOrigen": {
        "column": "HASH_ORIGEN",
        "type": "VARCHAR2"
      },
      "fechaDocumento": {
        "column": "FECHA_DOCUMENTO",
        "type": "DATE"
      },
      "fechaRecepcion": {
        "column": "FECHA_RECEPCION",
        "type": "TIMESTAMP"
      },
      "fechaContabilizacion": {
        "column": "FECHA_CONTABILIZACION",
        "type": "DATE"
      },
      "fechaVencimiento": {
        "column": "FECHA_VENCIMIENTO",
        "type": "DATE"
      },
      "diasCredito": {
        "column": "DIAS_CREDITO",
        "type": "NUMBER"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "tipoCambio": {
        "column": "TIPO_CAMBIO",
        "type": "NUMBER"
      },
      "fuenteTipoCambio": {
        "column": "FUENTE_TIPO_CAMBIO",
        "type": "VARCHAR2"
      },
      "fechaTipoCambio": {
        "column": "FECHA_TIPO_CAMBIO",
        "type": "DATE"
      },
      "subtotal": {
        "column": "SUBTOTAL",
        "type": "NUMBER"
      },
      "descuentoTotal": {
        "column": "DESCUENTO_TOTAL",
        "type": "NUMBER"
      },
      "impuestoTotal": {
        "column": "IMPUESTO_TOTAL",
        "type": "NUMBER"
      },
      "retencionTotal": {
        "column": "RETENCION_TOTAL",
        "type": "NUMBER"
      },
      "recargoTotal": {
        "column": "RECARGO_TOTAL",
        "type": "NUMBER"
      },
      "gastoAdicionalTotal": {
        "column": "GASTO_ADICIONAL_TOTAL",
        "type": "NUMBER"
      },
      "diferenciaRedondeo": {
        "column": "DIFERENCIA_REDONDEO",
        "type": "NUMBER"
      },
      "totalBruto": {
        "column": "TOTAL_BRUTO",
        "type": "NUMBER"
      },
      "totalNeto": {
        "column": "TOTAL_NETO",
        "type": "NUMBER"
      },
      "totalLocal": {
        "column": "TOTAL_LOCAL",
        "type": "NUMBER"
      },
      "montoAplicado": {
        "column": "MONTO_APLICADO",
        "type": "NUMBER"
      },
      "saldoPendiente": {
        "column": "SALDO_PENDIENTE",
        "type": "NUMBER"
      },
      "idDepartamento": {
        "column": "ID_DEPARTAMENTO",
        "type": "NUMBER"
      },
      "centroCosto": {
        "column": "CENTRO_COSTO",
        "type": "VARCHAR2"
      },
      "proyecto": {
        "column": "PROYECTO",
        "type": "VARCHAR2"
      },
      "cuentaContable": {
        "column": "CUENTA_CONTABLE",
        "type": "VARCHAR2"
      },
      "solicitadoPor": {
        "column": "SOLICITADO_POR",
        "type": "NUMBER"
      },
      "responsablePor": {
        "column": "RESPONSABLE_POR",
        "type": "NUMBER"
      },
      "justificacionSinOc": {
        "column": "JUSTIFICACION_SIN_OC",
        "type": "VARCHAR2"
      },
      "numeroCuota": {
        "column": "NUMERO_CUOTA",
        "type": "NUMBER"
      },
      "capitalCuota": {
        "column": "CAPITAL_CUOTA",
        "type": "NUMBER"
      },
      "interesCuota": {
        "column": "INTERES_CUOTA",
        "type": "NUMBER"
      },
      "comisionCuota": {
        "column": "COMISION_CUOTA",
        "type": "NUMBER"
      },
      "resultadoTresVias": {
        "column": "RESULTADO_TRES_VIAS",
        "type": "VARCHAR2"
      },
      "diferenciaCantidad": {
        "column": "DIFERENCIA_CANTIDAD",
        "type": "NUMBER"
      },
      "diferenciaPrecio": {
        "column": "DIFERENCIA_PRECIO",
        "type": "NUMBER"
      },
      "diferenciaImpuesto": {
        "column": "DIFERENCIA_IMPUESTO",
        "type": "NUMBER"
      },
      "diferenciaTotal": {
        "column": "DIFERENCIA_TOTAL",
        "type": "NUMBER"
      },
      "prioridad": {
        "column": "PRIORIDAD",
        "type": "VARCHAR2"
      },
      "estadoContable": {
        "column": "ESTADO_CONTABLE",
        "type": "VARCHAR2"
      },
      "numeroAsientoExt": {
        "column": "NUMERO_ASIENTO_EXT",
        "type": "VARCHAR2"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "posibleDuplicado": {
        "column": "POSIBLE_DUPLICADO",
        "type": "CHAR"
      },
      "motivoRechazo": {
        "column": "MOTIVO_RECHAZO",
        "type": "VARCHAR2"
      },
      "motivoBloqueo": {
        "column": "MOTIVO_BLOQUEO",
        "type": "VARCHAR2"
      },
      "motivoAnulacion": {
        "column": "MOTIVO_ANULACION",
        "type": "VARCHAR2"
      },
      "anuladoPor": {
        "column": "ANULADO_POR",
        "type": "NUMBER"
      },
      "fechaAnulacion": {
        "column": "FECHA_ANULACION",
        "type": "TIMESTAMP"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      },
      "creadoPor": {
        "column": "CREADO_POR",
        "type": "NUMBER"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      },
      "modificadoPor": {
        "column": "MODIFICADO_POR",
        "type": "NUMBER"
      },
      "fechaModificacion": {
        "column": "FECHA_MODIFICACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idSucursal": {
        "table": "CXC_SUCURSALES",
        "key": "ID_SUCURSAL"
      },
      "idCondicionCredito": {
        "table": "CXC_CONDICIONES_CREDITO",
        "key": "ID_CONDICION"
      },
      "idCompromiso": {
        "table": "CXP_COMPROMISO",
        "key": "ID_COMPROMISO"
      },
      "idDocumentoRelacionado": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "noFacturaCompra": {
        "table": "CMP_FACTURA_CXP",
        "key": "FAC_NO_FACTURA"
      },
      "noOrdenCompra": {
        "table": "CMP_ORDEN_COMPRA",
        "key": "OCO_NO_PO"
      },
      "noRecepcion": {
        "table": "CMP_RECEPCION_BODEGA",
        "key": "RBO_NO_RECEPCION"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "idDepartamento": {
        "table": "DEPARTAMENTO",
        "key": "DEP_ID_DEPARTAMENTO"
      },
      "solicitadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "responsablePor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "anuladoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "creadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "modificadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_DOC_TIPO",
      "CK_CXP_DOC_NAT",
      "CK_CXP_DOC_ORIGEN",
      "CK_CXP_DOC_REGISTRO",
      "CK_CXP_DOC_OC_REQ",
      "CK_CXP_DOC_COMPRA_REQ",
      "CK_CXP_DOC_MONEDA",
      "CK_CXP_DOC_MONTOS",
      "CK_CXP_DOC_CALCULO",
      "CK_CXP_DOC_TRES_VIAS",
      "CK_CXP_DOC_PRIORIDAD",
      "CK_CXP_DOC_CONTABLE",
      "CK_CXP_DOC_DUP",
      "CK_CXP_DOC_ESTADO",
      "CK_CXP_DOC_RECHAZO",
      "CK_CXP_DOC_BLOQUEO",
      "CK_CXP_DOC_ANULACION",
      "CK_CXP_DOC_REL_DIST"
    ]
  },
  "documentos-detalle": {
    "table": "CXP_DOCUMENTO_DETALLE",
    "idColumn": "ID_DETALLE",
    "columns": {
      "idDetalle": {
        "column": "ID_DETALLE",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "codigoArticulo": {
        "column": "CODIGO_ARTICULO",
        "type": "VARCHAR2"
      },
      "idDetalleOc": {
        "column": "ID_DETALLE_OC",
        "type": "NUMBER"
      },
      "idDetalleRecepcion": {
        "column": "ID_DETALLE_RECEPCION",
        "type": "NUMBER"
      },
      "numeroLinea": {
        "column": "NUMERO_LINEA",
        "type": "NUMBER"
      },
      "descripcion": {
        "column": "DESCRIPCION",
        "type": "VARCHAR2"
      },
      "cantidad": {
        "column": "CANTIDAD",
        "type": "NUMBER"
      },
      "unidadMedida": {
        "column": "UNIDAD_MEDIDA",
        "type": "VARCHAR2"
      },
      "precioUnitario": {
        "column": "PRECIO_UNITARIO",
        "type": "NUMBER"
      },
      "descuento": {
        "column": "DESCUENTO",
        "type": "NUMBER"
      },
      "subtotal": {
        "column": "SUBTOTAL",
        "type": "NUMBER"
      },
      "impuesto": {
        "column": "IMPUESTO",
        "type": "NUMBER"
      },
      "retencion": {
        "column": "RETENCION",
        "type": "NUMBER"
      },
      "totalLinea": {
        "column": "TOTAL_LINEA",
        "type": "NUMBER"
      },
      "cuentaContable": {
        "column": "CUENTA_CONTABLE",
        "type": "VARCHAR2"
      },
      "centroCosto": {
        "column": "CENTRO_COSTO",
        "type": "VARCHAR2"
      },
      "idDepartamento": {
        "column": "ID_DEPARTAMENTO",
        "type": "NUMBER"
      },
      "proyecto": {
        "column": "PROYECTO",
        "type": "VARCHAR2"
      },
      "cantidadOrdenada": {
        "column": "CANTIDAD_ORDENADA",
        "type": "NUMBER"
      },
      "cantidadRecibida": {
        "column": "CANTIDAD_RECIBIDA",
        "type": "NUMBER"
      },
      "cantidadFacturada": {
        "column": "CANTIDAD_FACTURADA",
        "type": "NUMBER"
      },
      "precioOrdenado": {
        "column": "PRECIO_ORDENADO",
        "type": "NUMBER"
      },
      "precioFacturado": {
        "column": "PRECIO_FACTURADO",
        "type": "NUMBER"
      },
      "diferenciaCantidad": {
        "column": "DIFERENCIA_CANTIDAD",
        "type": "NUMBER"
      },
      "diferenciaPrecio": {
        "column": "DIFERENCIA_PRECIO",
        "type": "NUMBER"
      },
      "resultadoTresVias": {
        "column": "RESULTADO_TRES_VIAS",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "codigoArticulo": {
        "table": "CMP_ARTICULO",
        "key": "ART_CODIGO_ARTICULO"
      },
      "idDetalleOc": {
        "table": "CMP_DETALLE_ORDEN_COMPRA",
        "key": "DOC_ID_DETALLE_PO"
      },
      "idDetalleRecepcion": {
        "table": "CMP_DETALLE_RECEPCION",
        "key": "DRE_ID_DETALLE_RECEPCION"
      },
      "idDepartamento": {
        "table": "DEPARTAMENTO",
        "key": "DEP_ID_DEPARTAMENTO"
      }
    },
    "checkNames": [
      "CK_CXP_DDET_MONTOS",
      "CK_CXP_DDET_TRES"
    ]
  },
  "documentos-tributos": {
    "table": "CXP_DOCUMENTO_TRIBUTO",
    "idColumn": "ID_TRIBUTO",
    "columns": {
      "idTributo": {
        "column": "ID_TRIBUTO",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idDetalle": {
        "column": "ID_DETALLE",
        "type": "NUMBER"
      },
      "tipoTributo": {
        "column": "TIPO_TRIBUTO",
        "type": "VARCHAR2"
      },
      "codigoTributo": {
        "column": "CODIGO_TRIBUTO",
        "type": "VARCHAR2"
      },
      "nombreTributo": {
        "column": "NOMBRE_TRIBUTO",
        "type": "VARCHAR2"
      },
      "baseImponible": {
        "column": "BASE_IMPONIBLE",
        "type": "NUMBER"
      },
      "porcentaje": {
        "column": "PORCENTAJE",
        "type": "NUMBER"
      },
      "monto": {
        "column": "MONTO",
        "type": "NUMBER"
      },
      "montoRecuperable": {
        "column": "MONTO_RECUPERABLE",
        "type": "NUMBER"
      },
      "montoNoRecuperable": {
        "column": "MONTO_NO_RECUPERABLE",
        "type": "NUMBER"
      },
      "incluidoPrecio": {
        "column": "INCLUIDO_PRECIO",
        "type": "CHAR"
      },
      "numeroConstancia": {
        "column": "NUMERO_CONSTANCIA",
        "type": "VARCHAR2"
      },
      "periodoFiscal": {
        "column": "PERIODO_FISCAL",
        "type": "VARCHAR2"
      },
      "fechaAplicacion": {
        "column": "FECHA_APLICACION",
        "type": "DATE"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "generadoPor": {
        "column": "GENERADO_POR",
        "type": "NUMBER"
      },
      "fechaGeneracion": {
        "column": "FECHA_GENERACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idDetalle": {
        "table": "CXP_DOCUMENTO_DETALLE",
        "key": "ID_DETALLE"
      },
      "generadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_TRIB_TIPO",
      "CK_CXP_TRIB_MONTOS",
      "CK_CXP_TRIB_PRECIO",
      "CK_CXP_TRIB_ESTADO"
    ]
  },
  "lotes-pago": {
    "table": "CXP_LOTE_PAGO",
    "idColumn": "ID_LOTE",
    "columns": {
      "idLote": {
        "column": "ID_LOTE",
        "type": "NUMBER"
      },
      "idSucursal": {
        "column": "ID_SUCURSAL",
        "type": "NUMBER"
      },
      "idCuentaOrigen": {
        "column": "ID_CUENTA_ORIGEN",
        "type": "NUMBER"
      },
      "codigoLote": {
        "column": "CODIGO_LOTE",
        "type": "VARCHAR2"
      },
      "tipoLote": {
        "column": "TIPO_LOTE",
        "type": "VARCHAR2"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      },
      "fechaEjecucion": {
        "column": "FECHA_EJECUCION",
        "type": "DATE"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "cantidadPagos": {
        "column": "CANTIDAD_PAGOS",
        "type": "NUMBER"
      },
      "montoTotal": {
        "column": "MONTO_TOTAL",
        "type": "NUMBER"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "creadoPor": {
        "column": "CREADO_POR",
        "type": "NUMBER"
      },
      "enviadoPor": {
        "column": "ENVIADO_POR",
        "type": "NUMBER"
      },
      "fechaEnvio": {
        "column": "FECHA_ENVIO",
        "type": "TIMESTAMP"
      },
      "motivoRechazo": {
        "column": "MOTIVO_RECHAZO",
        "type": "VARCHAR2"
      },
      "motivoAnulacion": {
        "column": "MOTIVO_ANULACION",
        "type": "VARCHAR2"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idSucursal": {
        "table": "CXC_SUCURSALES",
        "key": "ID_SUCURSAL"
      },
      "idCuentaOrigen": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "creadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "enviadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_LOTE_TIPO",
      "CK_CXP_LOTE_MONEDA",
      "CK_CXP_LOTE_MONTOS",
      "CK_CXP_LOTE_ESTADO",
      "CK_CXP_LOTE_ENVIO"
    ]
  },
  "pagos": {
    "table": "CXP_PAGO",
    "idColumn": "ID_PAGO",
    "columns": {
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idLote": {
        "column": "ID_LOTE",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idSucursal": {
        "column": "ID_SUCURSAL",
        "type": "NUMBER"
      },
      "idFormaPago": {
        "column": "ID_FORMA_PAGO",
        "type": "NUMBER"
      },
      "idCuentaOrigen": {
        "column": "ID_CUENTA_ORIGEN",
        "type": "NUMBER"
      },
      "idCuentaDestino": {
        "column": "ID_CUENTA_DESTINO",
        "type": "NUMBER"
      },
      "idPagoOrigen": {
        "column": "ID_PAGO_ORIGEN",
        "type": "NUMBER"
      },
      "codigoPago": {
        "column": "CODIGO_PAGO",
        "type": "VARCHAR2"
      },
      "tipoPago": {
        "column": "TIPO_PAGO",
        "type": "VARCHAR2"
      },
      "fechaProgramada": {
        "column": "FECHA_PROGRAMADA",
        "type": "DATE"
      },
      "fechaPago": {
        "column": "FECHA_PAGO",
        "type": "TIMESTAMP"
      },
      "fechaEfectiva": {
        "column": "FECHA_EFECTIVA",
        "type": "DATE"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "tipoCambio": {
        "column": "TIPO_CAMBIO",
        "type": "NUMBER"
      },
      "fuenteTipoCambio": {
        "column": "FUENTE_TIPO_CAMBIO",
        "type": "VARCHAR2"
      },
      "fechaTipoCambio": {
        "column": "FECHA_TIPO_CAMBIO",
        "type": "DATE"
      },
      "montoObligacion": {
        "column": "MONTO_OBLIGACION",
        "type": "NUMBER"
      },
      "montoDescuento": {
        "column": "MONTO_DESCUENTO",
        "type": "NUMBER"
      },
      "montoRetencion": {
        "column": "MONTO_RETENCION",
        "type": "NUMBER"
      },
      "montoComision": {
        "column": "MONTO_COMISION",
        "type": "NUMBER"
      },
      "montoTransferido": {
        "column": "MONTO_TRANSFERIDO",
        "type": "NUMBER"
      },
      "montoAplicado": {
        "column": "MONTO_APLICADO",
        "type": "NUMBER"
      },
      "montoNoAplicado": {
        "column": "MONTO_NO_APLICADO",
        "type": "NUMBER"
      },
      "numeroCheque": {
        "column": "NUMERO_CHEQUE",
        "type": "VARCHAR2"
      },
      "numeroTransferencia": {
        "column": "NUMERO_TRANSFERENCIA",
        "type": "VARCHAR2"
      },
      "referenciaBancaria": {
        "column": "REFERENCIA_BANCARIA",
        "type": "VARCHAR2"
      },
      "concepto": {
        "column": "CONCEPTO",
        "type": "VARCHAR2"
      },
      "respuestaBanco": {
        "column": "RESPUESTA_BANCO",
        "type": "VARCHAR2"
      },
      "estadoContable": {
        "column": "ESTADO_CONTABLE",
        "type": "VARCHAR2"
      },
      "numeroAsientoExt": {
        "column": "NUMERO_ASIENTO_EXT",
        "type": "VARCHAR2"
      },
      "claveIdempotencia": {
        "column": "CLAVE_IDEMPOTENCIA",
        "type": "VARCHAR2"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "programadoPor": {
        "column": "PROGRAMADO_POR",
        "type": "NUMBER"
      },
      "ejecutadoPor": {
        "column": "EJECUTADO_POR",
        "type": "NUMBER"
      },
      "conciliadoPor": {
        "column": "CONCILIADO_POR",
        "type": "NUMBER"
      },
      "motivoRechazo": {
        "column": "MOTIVO_RECHAZO",
        "type": "VARCHAR2"
      },
      "motivoDevolucion": {
        "column": "MOTIVO_DEVOLUCION",
        "type": "VARCHAR2"
      },
      "motivoAnulacion": {
        "column": "MOTIVO_ANULACION",
        "type": "VARCHAR2"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      },
      "fechaModificacion": {
        "column": "FECHA_MODIFICACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idLote": {
        "table": "CXP_LOTE_PAGO",
        "key": "ID_LOTE"
      },
      "idSucursal": {
        "table": "CXC_SUCURSALES",
        "key": "ID_SUCURSAL"
      },
      "idFormaPago": {
        "table": "CXC_FORMAS_PAGO",
        "key": "ID_FORMA_PAGO"
      },
      "idCuentaOrigen": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "idCuentaDestino": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "idPagoOrigen": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "programadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "ejecutadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "conciliadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_PAGO_CUENTAS",
      "CK_CXP_PAGO_TIPO",
      "CK_CXP_PAGO_MONEDA",
      "CK_CXP_PAGO_MONTOS",
      "CK_CXP_PAGO_REVERSA",
      "CK_CXP_PAGO_CONTABLE",
      "CK_CXP_PAGO_ESTADO",
      "CK_CXP_PAGO_RECHAZO",
      "CK_CXP_PAGO_DEV",
      "CK_CXP_PAGO_ANUL",
      "CK_CXP_PAGO_SOD",
      "CK_CXP_PAGO_ORIG_DIST",
      "CK_CXP_PAGO_EJEC"
    ]
  },
  "aplicaciones": {
    "table": "CXP_APLICACION",
    "idColumn": "ID_APLICACION",
    "columns": {
      "idAplicacion": {
        "column": "ID_APLICACION",
        "type": "NUMBER"
      },
      "idDocumentoDestino": {
        "column": "ID_DOCUMENTO_DESTINO",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idDocumentoOrigen": {
        "column": "ID_DOCUMENTO_ORIGEN",
        "type": "NUMBER"
      },
      "idDocumentoCxc": {
        "column": "ID_DOCUMENTO_CXC",
        "type": "NUMBER"
      },
      "tipoAplicacion": {
        "column": "TIPO_APLICACION",
        "type": "VARCHAR2"
      },
      "fechaAplicacion": {
        "column": "FECHA_APLICACION",
        "type": "TIMESTAMP"
      },
      "montoPrincipal": {
        "column": "MONTO_PRINCIPAL",
        "type": "NUMBER"
      },
      "montoDescuento": {
        "column": "MONTO_DESCUENTO",
        "type": "NUMBER"
      },
      "montoRetencion": {
        "column": "MONTO_RETENCION",
        "type": "NUMBER"
      },
      "diferenciaCambiaria": {
        "column": "DIFERENCIA_CAMBIARIA",
        "type": "NUMBER"
      },
      "montoTotalAplicado": {
        "column": "MONTO_TOTAL_APLICADO",
        "type": "NUMBER"
      },
      "saldoAnterior": {
        "column": "SALDO_ANTERIOR",
        "type": "NUMBER"
      },
      "saldoPosterior": {
        "column": "SALDO_POSTERIOR",
        "type": "NUMBER"
      },
      "estadoCxc": {
        "column": "ESTADO_CXC",
        "type": "VARCHAR2"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "aplicadoPor": {
        "column": "APLICADO_POR",
        "type": "NUMBER"
      },
      "revertidoPor": {
        "column": "REVERTIDO_POR",
        "type": "NUMBER"
      },
      "fechaReverso": {
        "column": "FECHA_REVERSO",
        "type": "TIMESTAMP"
      },
      "motivoReverso": {
        "column": "MOTIVO_REVERSO",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idDocumentoDestino": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idDocumentoOrigen": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idDocumentoCxc": {
        "table": "CXC_DOCUMENTOS",
        "key": "ID_DOCUMENTO"
      },
      "aplicadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "revertidoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_APL_TIPO",
      "CK_CXP_APL_FUENTE",
      "CK_CXP_APL_MONTOS",
      "CK_CXP_APL_CXC",
      "CK_CXP_APL_ESTADO",
      "CK_CXP_APL_REVERSO"
    ]
  },
  "reglas-aprobacion": {
    "table": "CXP_REGLA_APROBACION",
    "idColumn": "ID_REGLA",
    "columns": {
      "idRegla": {
        "column": "ID_REGLA",
        "type": "NUMBER"
      },
      "tipoEntidad": {
        "column": "TIPO_ENTIDAD",
        "type": "VARCHAR2"
      },
      "nombreRegla": {
        "column": "NOMBRE_REGLA",
        "type": "VARCHAR2"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idDepartamento": {
        "column": "ID_DEPARTAMENTO",
        "type": "NUMBER"
      },
      "centroCosto": {
        "column": "CENTRO_COSTO",
        "type": "VARCHAR2"
      },
      "proyecto": {
        "column": "PROYECTO",
        "type": "VARCHAR2"
      },
      "moneda": {
        "column": "MONEDA",
        "type": "VARCHAR2"
      },
      "montoDesde": {
        "column": "MONTO_DESDE",
        "type": "NUMBER"
      },
      "montoHasta": {
        "column": "MONTO_HASTA",
        "type": "NUMBER"
      },
      "requiereSinOc": {
        "column": "REQUIERE_SIN_OC",
        "type": "CHAR"
      },
      "requiereDiferencia": {
        "column": "REQUIERE_DIFERENCIA",
        "type": "CHAR"
      },
      "nivel": {
        "column": "NIVEL",
        "type": "NUMBER"
      },
      "idRolAprobador": {
        "column": "ID_ROL_APROBADOR",
        "type": "NUMBER"
      },
      "cantidadAprobadores": {
        "column": "CANTIDAD_APROBADORES",
        "type": "NUMBER"
      },
      "permiteDelegacion": {
        "column": "PERMITE_DELEGACION",
        "type": "CHAR"
      },
      "vigenteDesde": {
        "column": "VIGENTE_DESDE",
        "type": "DATE"
      },
      "vigenteHasta": {
        "column": "VIGENTE_HASTA",
        "type": "DATE"
      },
      "activa": {
        "column": "ACTIVA",
        "type": "CHAR"
      },
      "creadaPor": {
        "column": "CREADA_POR",
        "type": "NUMBER"
      },
      "fechaCreacion": {
        "column": "FECHA_CREACION",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "idDepartamento": {
        "table": "DEPARTAMENTO",
        "key": "DEP_ID_DEPARTAMENTO"
      },
      "idRolAprobador": {
        "table": "ROL",
        "key": "ROL_ID_ROL"
      },
      "creadaPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_REG_ENTIDAD",
      "CK_CXP_REG_MONTOS",
      "CK_CXP_REG_SINO",
      "CK_CXP_REG_VIGENCIA",
      "CK_CXP_REG_NIVEL"
    ]
  },
  "aprobaciones": {
    "table": "CXP_APROBACION",
    "idColumn": "ID_APROBACION",
    "columns": {
      "idAprobacion": {
        "column": "ID_APROBACION",
        "type": "NUMBER"
      },
      "idRegla": {
        "column": "ID_REGLA",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idLote": {
        "column": "ID_LOTE",
        "type": "NUMBER"
      },
      "idCuentaBancaria": {
        "column": "ID_CUENTA_BANCARIA",
        "type": "NUMBER"
      },
      "idCompromiso": {
        "column": "ID_COMPROMISO",
        "type": "NUMBER"
      },
      "idPeriodo": {
        "column": "ID_PERIODO",
        "type": "NUMBER"
      },
      "nivel": {
        "column": "NIVEL",
        "type": "NUMBER"
      },
      "idRolAprobador": {
        "column": "ID_ROL_APROBADOR",
        "type": "NUMBER"
      },
      "idUsuarioAprobador": {
        "column": "ID_USUARIO_APROBADOR",
        "type": "NUMBER"
      },
      "delegadoPor": {
        "column": "DELEGADO_POR",
        "type": "NUMBER"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "accion": {
        "column": "ACCION",
        "type": "VARCHAR2"
      },
      "fechaSolicitud": {
        "column": "FECHA_SOLICITUD",
        "type": "TIMESTAMP"
      },
      "fechaDecision": {
        "column": "FECHA_DECISION",
        "type": "TIMESTAMP"
      },
      "observacion": {
        "column": "OBSERVACION",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idRegla": {
        "table": "CXP_REGLA_APROBACION",
        "key": "ID_REGLA"
      },
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idLote": {
        "table": "CXP_LOTE_PAGO",
        "key": "ID_LOTE"
      },
      "idCuentaBancaria": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "idCompromiso": {
        "table": "CXP_COMPROMISO",
        "key": "ID_COMPROMISO"
      },
      "idPeriodo": {
        "table": "CXP_PERIODO",
        "key": "ID_PERIODO"
      },
      "idRolAprobador": {
        "table": "ROL",
        "key": "ROL_ID_ROL"
      },
      "idUsuarioAprobador": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "delegadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_APR_ENTIDAD",
      "CK_CXP_APR_ESTADO",
      "CK_CXP_APR_DECISION",
      "CK_CXP_APR_NIVEL"
    ]
  },
  "conciliaciones-proveedor": {
    "table": "CXP_CONCILIACION_PROVEEDOR",
    "idColumn": "ID_CONCILIACION_PROV",
    "columns": {
      "idConciliacionProv": {
        "column": "ID_CONCILIACION_PROV",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "periodoDesde": {
        "column": "PERIODO_DESDE",
        "type": "DATE"
      },
      "periodoHasta": {
        "column": "PERIODO_HASTA",
        "type": "DATE"
      },
      "saldoEmpresa": {
        "column": "SALDO_EMPRESA",
        "type": "NUMBER"
      },
      "saldoProveedor": {
        "column": "SALDO_PROVEEDOR",
        "type": "NUMBER"
      },
      "diferencia": {
        "column": "DIFERENCIA",
        "type": "NUMBER"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "elaboradaPor": {
        "column": "ELABORADA_POR",
        "type": "NUMBER"
      },
      "fechaElaboracion": {
        "column": "FECHA_ELABORACION",
        "type": "TIMESTAMP"
      },
      "cerradaPor": {
        "column": "CERRADA_POR",
        "type": "NUMBER"
      },
      "fechaCierre": {
        "column": "FECHA_CIERRE",
        "type": "TIMESTAMP"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "elaboradaPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "cerradaPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_CPROV_FECHAS",
      "CK_CXP_CPROV_ESTADO",
      "CK_CXP_CPROV_CIERRE"
    ]
  },
  "conciliaciones-proveedor-detalle": {
    "table": "CXP_CONCILIACION_PROV_DET",
    "idColumn": "ID_DET_CONCILIACION",
    "columns": {
      "idDetConciliacion": {
        "column": "ID_DET_CONCILIACION",
        "type": "NUMBER"
      },
      "idConciliacionProv": {
        "column": "ID_CONCILIACION_PROV",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "tipoRegistro": {
        "column": "TIPO_REGISTRO",
        "type": "VARCHAR2"
      },
      "referenciaProveedor": {
        "column": "REFERENCIA_PROVEEDOR",
        "type": "VARCHAR2"
      },
      "fechaEmpresa": {
        "column": "FECHA_EMPRESA",
        "type": "DATE"
      },
      "fechaProveedor": {
        "column": "FECHA_PROVEEDOR",
        "type": "DATE"
      },
      "montoEmpresa": {
        "column": "MONTO_EMPRESA",
        "type": "NUMBER"
      },
      "montoProveedor": {
        "column": "MONTO_PROVEEDOR",
        "type": "NUMBER"
      },
      "diferencia": {
        "column": "DIFERENCIA",
        "type": "NUMBER"
      },
      "resultado": {
        "column": "RESULTADO",
        "type": "VARCHAR2"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idConciliacionProv": {
        "table": "CXP_CONCILIACION_PROVEEDOR",
        "key": "ID_CONCILIACION_PROV"
      },
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      }
    },
    "checkNames": [
      "CK_CXP_CPD_TIPO",
      "CK_CXP_CPD_ORIGEN",
      "CK_CXP_CPD_RESULT"
    ]
  },
  "conciliaciones-pago": {
    "table": "CXP_CONCILIACION_PAGO",
    "idColumn": "ID_CONCILIACION_PAGO",
    "columns": {
      "idConciliacionPago": {
        "column": "ID_CONCILIACION_PAGO",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idCuentaBancaria": {
        "column": "ID_CUENTA_BANCARIA",
        "type": "NUMBER"
      },
      "referenciaMovimiento": {
        "column": "REFERENCIA_MOVIMIENTO",
        "type": "VARCHAR2"
      },
      "fechaMovimiento": {
        "column": "FECHA_MOVIMIENTO",
        "type": "DATE"
      },
      "montoBanco": {
        "column": "MONTO_BANCO",
        "type": "NUMBER"
      },
      "montoSistema": {
        "column": "MONTO_SISTEMA",
        "type": "NUMBER"
      },
      "diferenciaMonto": {
        "column": "DIFERENCIA_MONTO",
        "type": "NUMBER"
      },
      "tipoCoincidencia": {
        "column": "TIPO_COINCIDENCIA",
        "type": "VARCHAR2"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "conciliadoPor": {
        "column": "CONCILIADO_POR",
        "type": "NUMBER"
      },
      "fechaConciliacion": {
        "column": "FECHA_CONCILIACION",
        "type": "TIMESTAMP"
      },
      "observaciones": {
        "column": "OBSERVACIONES",
        "type": "VARCHAR2"
      }
    },
    "foreignKeys": {
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idCuentaBancaria": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "conciliadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_CPAGO_MONTOS",
      "CK_CXP_CPAGO_TIPO",
      "CK_CXP_CPAGO_ESTADO",
      "CK_CXP_CPAGO_CIERRE"
    ]
  },
  "eventos": {
    "table": "CXP_EVENTO",
    "idColumn": "ID_EVENTO",
    "columns": {
      "idEvento": {
        "column": "ID_EVENTO",
        "type": "NUMBER"
      },
      "idEventoPadre": {
        "column": "ID_EVENTO_PADRE",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idCuentaBancaria": {
        "column": "ID_CUENTA_BANCARIA",
        "type": "NUMBER"
      },
      "idCompromiso": {
        "column": "ID_COMPROMISO",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idLote": {
        "column": "ID_LOTE",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idAplicacion": {
        "column": "ID_APLICACION",
        "type": "NUMBER"
      },
      "idConciliacionProv": {
        "column": "ID_CONCILIACION_PROV",
        "type": "NUMBER"
      },
      "idPeriodo": {
        "column": "ID_PERIODO",
        "type": "NUMBER"
      },
      "tipoEvento": {
        "column": "TIPO_EVENTO",
        "type": "VARCHAR2"
      },
      "asunto": {
        "column": "ASUNTO",
        "type": "VARCHAR2"
      },
      "detalle": {
        "column": "DETALLE",
        "type": "VARCHAR2"
      },
      "estadoAnterior": {
        "column": "ESTADO_ANTERIOR",
        "type": "VARCHAR2"
      },
      "estadoNuevo": {
        "column": "ESTADO_NUEVO",
        "type": "VARCHAR2"
      },
      "montoRelacionado": {
        "column": "MONTO_RELACIONADO",
        "type": "NUMBER"
      },
      "canal": {
        "column": "CANAL",
        "type": "VARCHAR2"
      },
      "mencionesJson": {
        "column": "MENCIONES_JSON",
        "type": "CLOB"
      },
      "resultadoJson": {
        "column": "RESULTADO_JSON",
        "type": "CLOB"
      },
      "prioridad": {
        "column": "PRIORIDAD",
        "type": "VARCHAR2"
      },
      "estado": {
        "column": "ESTADO",
        "type": "VARCHAR2"
      },
      "usuarioAsignado": {
        "column": "USUARIO_ASIGNADO",
        "type": "NUMBER"
      },
      "fechaLimite": {
        "column": "FECHA_LIMITE",
        "type": "TIMESTAMP"
      },
      "usuarioEvento": {
        "column": "USUARIO_EVENTO",
        "type": "NUMBER"
      },
      "fechaEvento": {
        "column": "FECHA_EVENTO",
        "type": "TIMESTAMP"
      },
      "fechaCierre": {
        "column": "FECHA_CIERRE",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idEventoPadre": {
        "table": "CXP_EVENTO",
        "key": "ID_EVENTO"
      },
      "idCuentaBancaria": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "idCompromiso": {
        "table": "CXP_COMPROMISO",
        "key": "ID_COMPROMISO"
      },
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idLote": {
        "table": "CXP_LOTE_PAGO",
        "key": "ID_LOTE"
      },
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idAplicacion": {
        "table": "CXP_APLICACION",
        "key": "ID_APLICACION"
      },
      "idConciliacionProv": {
        "table": "CXP_CONCILIACION_PROVEEDOR",
        "key": "ID_CONCILIACION_PROV"
      },
      "idPeriodo": {
        "table": "CXP_PERIODO",
        "key": "ID_PERIODO"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "usuarioAsignado": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      },
      "usuarioEvento": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_EVT_ENTIDAD",
      "CK_CXP_EVT_PRIORIDAD",
      "CK_CXP_EVT_ESTADO",
      "CK_CXP_EVT_CIERRE"
    ]
  },
  "archivos": {
    "table": "CXP_ARCHIVO",
    "idColumn": "ID_ARCHIVO",
    "columns": {
      "idArchivo": {
        "column": "ID_ARCHIVO",
        "type": "NUMBER"
      },
      "idProveedor": {
        "column": "ID_PROVEEDOR",
        "type": "NUMBER"
      },
      "idCuentaBancaria": {
        "column": "ID_CUENTA_BANCARIA",
        "type": "NUMBER"
      },
      "idCompromiso": {
        "column": "ID_COMPROMISO",
        "type": "NUMBER"
      },
      "idDocumento": {
        "column": "ID_DOCUMENTO",
        "type": "NUMBER"
      },
      "idLote": {
        "column": "ID_LOTE",
        "type": "NUMBER"
      },
      "idPago": {
        "column": "ID_PAGO",
        "type": "NUMBER"
      },
      "idAplicacion": {
        "column": "ID_APLICACION",
        "type": "NUMBER"
      },
      "idConciliacionProv": {
        "column": "ID_CONCILIACION_PROV",
        "type": "NUMBER"
      },
      "idEvento": {
        "column": "ID_EVENTO",
        "type": "NUMBER"
      },
      "categoria": {
        "column": "CATEGORIA",
        "type": "VARCHAR2"
      },
      "nombreArchivo": {
        "column": "NOMBRE_ARCHIVO",
        "type": "VARCHAR2"
      },
      "tipoMime": {
        "column": "TIPO_MIME",
        "type": "VARCHAR2"
      },
      "tamanoBytes": {
        "column": "TAMANO_BYTES",
        "type": "NUMBER"
      },
      "uriAlmacenamiento": {
        "column": "URI_ALMACENAMIENTO",
        "type": "VARCHAR2"
      },
      "hashSha256": {
        "column": "HASH_SHA256",
        "type": "VARCHAR2"
      },
      "versionArchivo": {
        "column": "VERSION_ARCHIVO",
        "type": "NUMBER"
      },
      "esVersionActual": {
        "column": "ES_VERSION_ACTUAL",
        "type": "CHAR"
      },
      "cargadoPor": {
        "column": "CARGADO_POR",
        "type": "NUMBER"
      },
      "fechaCarga": {
        "column": "FECHA_CARGA",
        "type": "TIMESTAMP"
      }
    },
    "foreignKeys": {
      "idCuentaBancaria": {
        "table": "CXP_CUENTA_BANCARIA",
        "key": "ID_CUENTA_BANCARIA"
      },
      "idCompromiso": {
        "table": "CXP_COMPROMISO",
        "key": "ID_COMPROMISO"
      },
      "idDocumento": {
        "table": "CXP_DOCUMENTO",
        "key": "ID_DOCUMENTO"
      },
      "idLote": {
        "table": "CXP_LOTE_PAGO",
        "key": "ID_LOTE"
      },
      "idPago": {
        "table": "CXP_PAGO",
        "key": "ID_PAGO"
      },
      "idAplicacion": {
        "table": "CXP_APLICACION",
        "key": "ID_APLICACION"
      },
      "idConciliacionProv": {
        "table": "CXP_CONCILIACION_PROVEEDOR",
        "key": "ID_CONCILIACION_PROV"
      },
      "idEvento": {
        "table": "CXP_EVENTO",
        "key": "ID_EVENTO"
      },
      "idProveedor": {
        "table": "PROVEEDOR",
        "key": "PRO_ID_PROVEEDOR"
      },
      "cargadoPor": {
        "table": "USUARIO",
        "key": "USU_ID_USUARIO"
      }
    },
    "checkNames": [
      "CK_CXP_ARCH_ENTIDAD",
      "CK_CXP_ARCH_TAMANO",
      "CK_CXP_ARCH_ACTUAL",
      "CK_CXP_ARCH_HASH"
    ]
  }
};

export interface CxpCatalogDefinition { table: string; key: string; numeric: boolean; label: string; labelCandidates: string[]; }
export const CXP_CATALOGS: Record<string, CxpCatalogDefinition> = {
  "usuarios": {
    "table": "USUARIO",
    "key": "USU_ID_USUARIO",
    "numeric": true,
    "label": "Usuario",
    "labelCandidates": [
      "USU_NOMBRE_USUARIO",
      "USU_NOMBRE",
      "USU_USUARIO",
      "USU_CORREO"
    ]
  },
  "parametros": {
    "table": "CXP_PARAMETRO",
    "key": "ID_PARAMETRO",
    "numeric": true,
    "label": "Parámetro",
    "labelCandidates": [
      "GRUPO_PARAMETRO",
      "CODIGO"
    ]
  },
  "sucursales": {
    "table": "CXC_SUCURSALES",
    "key": "ID_SUCURSAL",
    "numeric": true,
    "label": "Sucursal",
    "labelCandidates": [
      "NOMBRE"
    ]
  },
  "periodos": {
    "table": "CXP_PERIODO",
    "key": "ID_PERIODO",
    "numeric": true,
    "label": "Período",
    "labelCandidates": [
      "ESTADO"
    ]
  },
  "empresas": {
    "table": "CXC_EMPRESAS",
    "key": "ID_EMPRESA",
    "numeric": true,
    "label": "Empresa",
    "labelCandidates": [
      "NOMBRE"
    ]
  },
  "proveedores": {
    "table": "PROVEEDOR",
    "key": "PRO_ID_PROVEEDOR",
    "numeric": true,
    "label": "Proveedor",
    "labelCandidates": [
      "PRO_NOMBRE_ENTIDAD",
      "PRO_NIT"
    ]
  },
  "cuentas-bancarias": {
    "table": "CXP_CUENTA_BANCARIA",
    "key": "ID_CUENTA_BANCARIA",
    "numeric": true,
    "label": "Cuenta bancaria",
    "labelCandidates": [
      "TIPO_TITULAR",
      "BANCO_NOMBRE"
    ]
  },
  "departamentos": {
    "table": "DEPARTAMENTO",
    "key": "DEP_ID_DEPARTAMENTO",
    "numeric": true,
    "label": "Departamento",
    "labelCandidates": [
      "DEP_NOMBRE_DEPARTAMENTO",
      "DEP_NOMBRE",
      "DEP_DESCRIPCION"
    ]
  },
  "compromisos": {
    "table": "CXP_COMPROMISO",
    "key": "ID_COMPROMISO",
    "numeric": true,
    "label": "Compromiso",
    "labelCandidates": [
      "TIPO_COMPROMISO",
      "NUMERO_REFERENCIA"
    ]
  },
  "condiciones-credito": {
    "table": "CXC_CONDICIONES_CREDITO",
    "key": "ID_CONDICION",
    "numeric": true,
    "label": "Condición de crédito",
    "labelCandidates": [
      "NOMBRE",
      "DESCRIPCION"
    ]
  },
  "documentos": {
    "table": "CXP_DOCUMENTO",
    "key": "ID_DOCUMENTO",
    "numeric": true,
    "label": "Documento",
    "labelCandidates": [
      "TIPO_DOCUMENTO",
      "NUMERO_DOCUMENTO"
    ]
  },
  "facturas-compra": {
    "table": "CMP_FACTURA_CXP",
    "key": "FAC_NO_FACTURA",
    "numeric": false,
    "label": "Factura de compra",
    "labelCandidates": [
      "FAC_NO_FACTURA"
    ]
  },
  "ordenes-compra": {
    "table": "CMP_ORDEN_COMPRA",
    "key": "OCO_NO_PO",
    "numeric": false,
    "label": "Orden de compra",
    "labelCandidates": [
      "OCO_NO_PO"
    ]
  },
  "recepciones": {
    "table": "CMP_RECEPCION_BODEGA",
    "key": "RBO_NO_RECEPCION",
    "numeric": false,
    "label": "Recepción",
    "labelCandidates": [
      "RBO_NO_RECEPCION"
    ]
  },
  "articulos": {
    "table": "CMP_ARTICULO",
    "key": "ART_CODIGO_ARTICULO",
    "numeric": false,
    "label": "Artículo",
    "labelCandidates": [
      "ART_NOMBRE",
      "ART_DESCRIPCION",
      "ART_CODIGO_ARTICULO"
    ]
  },
  "detalles-orden-compra": {
    "table": "CMP_DETALLE_ORDEN_COMPRA",
    "key": "DOC_ID_DETALLE_PO",
    "numeric": true,
    "label": "Detalle de orden",
    "labelCandidates": [
      "DOC_DESCRIPCION",
      "DOC_ID_DETALLE_PO"
    ]
  },
  "detalles-recepcion": {
    "table": "CMP_DETALLE_RECEPCION",
    "key": "DRE_ID_DETALLE_RECEPCION",
    "numeric": true,
    "label": "Detalle de recepción",
    "labelCandidates": [
      "DRE_DESCRIPCION",
      "DRE_ID_DETALLE_RECEPCION"
    ]
  },
  "documentos-detalle": {
    "table": "CXP_DOCUMENTO_DETALLE",
    "key": "ID_DETALLE",
    "numeric": true,
    "label": "Detalle de documento",
    "labelCandidates": [
      "DESCRIPCION"
    ]
  },
  "documentos-tributos": {
    "table": "CXP_DOCUMENTO_TRIBUTO",
    "key": "ID_TRIBUTO",
    "numeric": true,
    "label": "Tributo de documento",
    "labelCandidates": [
      "TIPO_TRIBUTO",
      "NOMBRE_TRIBUTO"
    ]
  },
  "lotes-pago": {
    "table": "CXP_LOTE_PAGO",
    "key": "ID_LOTE",
    "numeric": true,
    "label": "Lote de pago",
    "labelCandidates": [
      "CODIGO_LOTE",
      "MONEDA"
    ]
  },
  "formas-pago": {
    "table": "CXC_FORMAS_PAGO",
    "key": "ID_FORMA_PAGO",
    "numeric": true,
    "label": "Forma de pago",
    "labelCandidates": [
      "NOMBRE"
    ]
  },
  "pagos": {
    "table": "CXP_PAGO",
    "key": "ID_PAGO",
    "numeric": true,
    "label": "Pago",
    "labelCandidates": [
      "CODIGO_PAGO",
      "MONEDA"
    ]
  },
  "documentos-cxc": {
    "table": "CXC_DOCUMENTOS",
    "key": "ID_DOCUMENTO",
    "numeric": true,
    "label": "Documento de CxC",
    "labelCandidates": [
      "NUMERO_DOCUMENTO",
      "SERIE"
    ]
  },
  "aplicaciones": {
    "table": "CXP_APLICACION",
    "key": "ID_APLICACION",
    "numeric": true,
    "label": "Aplicación",
    "labelCandidates": [
      "TIPO_APLICACION",
      "ESTADO"
    ]
  },
  "roles": {
    "table": "ROL",
    "key": "ROL_ID_ROL",
    "numeric": true,
    "label": "Rol",
    "labelCandidates": [
      "ROL_NOMBRE_ROL",
      "ROL_NOMBRE",
      "ROL_DESCRIPCION"
    ]
  },
  "reglas-aprobacion": {
    "table": "CXP_REGLA_APROBACION",
    "key": "ID_REGLA",
    "numeric": true,
    "label": "Regla de aprobación",
    "labelCandidates": [
      "TIPO_ENTIDAD",
      "NOMBRE_REGLA"
    ]
  },
  "aprobaciones": {
    "table": "CXP_APROBACION",
    "key": "ID_APROBACION",
    "numeric": true,
    "label": "Aprobación",
    "labelCandidates": [
      "ESTADO"
    ]
  },
  "conciliaciones-proveedor": {
    "table": "CXP_CONCILIACION_PROVEEDOR",
    "key": "ID_CONCILIACION_PROV",
    "numeric": true,
    "label": "Conciliación de proveedor",
    "labelCandidates": [
      "ESTADO"
    ]
  },
  "conciliaciones-proveedor-detalle": {
    "table": "CXP_CONCILIACION_PROV_DET",
    "key": "ID_DET_CONCILIACION",
    "numeric": true,
    "label": "Detalle de conciliación",
    "labelCandidates": [
      "TIPO_REGISTRO",
      "REFERENCIA_PROVEEDOR"
    ]
  },
  "conciliaciones-pago": {
    "table": "CXP_CONCILIACION_PAGO",
    "key": "ID_CONCILIACION_PAGO",
    "numeric": true,
    "label": "Conciliación de pago",
    "labelCandidates": [
      "REFERENCIA_MOVIMIENTO",
      "ESTADO"
    ]
  },
  "eventos": {
    "table": "CXP_EVENTO",
    "key": "ID_EVENTO",
    "numeric": true,
    "label": "Evento",
    "labelCandidates": [
      "TIPO_EVENTO",
      "ASUNTO"
    ]
  },
  "archivos": {
    "table": "CXP_ARCHIVO",
    "key": "ID_ARCHIVO",
    "numeric": true,
    "label": "Archivo",
    "labelCandidates": [
      "CATEGORIA",
      "NOMBRE_ARCHIVO"
    ]
  }
};
