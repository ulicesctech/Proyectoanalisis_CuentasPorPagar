import type { CxpEntityDefinition } from './types';

export const CXP_ENTITIES: readonly CxpEntityDefinition[] = [
  {
    "resource": "parametros",
    "title": "Parámetros",
    "singular": "Parámetro",
    "group": "Configuración",
    "idField": "idParametro",
    "columns": [
      "grupoParametro",
      "codigo",
      "nombre",
      "valorTexto",
      "valorNumero",
      "activo"
    ],
    "fields": [
      {
        "name": "idParametro",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "grupoParametro",
        "label": "Grupo parámetro",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "codigo",
        "label": "Código",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 60
      },
      {
        "name": "nombre",
        "label": "Nombre",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 150
      },
      {
        "name": "valorTexto",
        "label": "Valor texto",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 500
      },
      {
        "name": "valorNumero",
        "label": "Valor número",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 6
      },
      {
        "name": "activo",
        "label": "Activo",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "S"
      },
      {
        "name": "modificadoPor",
        "label": "Modificado por",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaModificacion",
        "label": "Fecha modificación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "periodos",
    "title": "Períodos",
    "singular": "Período",
    "group": "Configuración",
    "idField": "idPeriodo",
    "columns": [
      "idSucursal",
      "anio",
      "mes",
      "fechaInicio",
      "fechaFin",
      "estado"
    ],
    "fields": [
      {
        "name": "idPeriodo",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idSucursal",
        "label": "Sucursal",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "sucursales",
        "integer": true
      },
      {
        "name": "anio",
        "label": "Año",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 4,
        "scale": 0,
        "integer": true
      },
      {
        "name": "mes",
        "label": "Mes",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 2,
        "scale": 0,
        "integer": true
      },
      {
        "name": "fechaInicio",
        "label": "Fecha inicio",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "fechaFin",
        "label": "Fecha fin",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "ABIERTO",
          "EN_CIERRE",
          "CERRADO",
          "REABIERTO"
        ],
        "maxLength": 20,
        "defaultValue": "ABIERTO"
      },
      {
        "name": "saldoInicial",
        "label": "Saldo inicial",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "movimientosDebe",
        "label": "Movimientos debe",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "movimientosHaber",
        "label": "Movimientos haber",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "saldoFinal",
        "label": "Saldo final",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "cerradoPor",
        "label": "Cerrado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCierre",
        "label": "Fecha cierre",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "reabiertoPor",
        "label": "Reabierto por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaReapertura",
        "label": "Fecha reapertura",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "motivoReapertura",
        "label": "Motivo reapertura",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 500
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "cuentas-bancarias",
    "title": "Cuentas bancarias",
    "singular": "Cuenta bancaria",
    "group": "Configuración",
    "idField": "idCuentaBancaria",
    "columns": [
      "tipoTitular",
      "bancoNombre",
      "titular",
      "numeroCuenta",
      "moneda",
      "estado",
      "estadoAprobacion"
    ],
    "fields": [
      {
        "name": "idCuentaBancaria",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "tipoTitular",
        "label": "Tipo titular",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "EMPRESA",
          "PROVEEDOR"
        ],
        "maxLength": 12
      },
      {
        "name": "idEmpresa",
        "label": "Empresa",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "empresas",
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "bancoNombre",
        "label": "Banco nombre",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "codigoBanco",
        "label": "Código banco",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 30
      },
      {
        "name": "titular",
        "label": "Titular",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 200
      },
      {
        "name": "numeroCuenta",
        "label": "Número cuenta",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "tipoCuenta",
        "label": "Tipo cuenta",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "MONETARIA",
          "AHORRO",
          "TARJETA",
          "OTRA"
        ],
        "maxLength": 20
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 3,
        "defaultValue": "GTQ"
      },
      {
        "name": "pais",
        "label": "Pais",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 80,
        "defaultValue": "GUATEMALA"
      },
      {
        "name": "codigoSwift",
        "label": "Código swift",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 20
      },
      {
        "name": "codigoIban",
        "label": "Código iban",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "esPrincipal",
        "label": "Es principal",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "N"
      },
      {
        "name": "titularCoincide",
        "label": "Titular coincide",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "N"
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "ACTIVA",
          "INACTIVA",
          "BLOQUEADA"
        ],
        "maxLength": 20,
        "defaultValue": "ACTIVA"
      },
      {
        "name": "estadoAprobacion",
        "label": "Estado aprobación",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "APROBADA",
          "RECHAZADA",
          "REQUIERE_REVALIDACION"
        ],
        "maxLength": 25,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "motivoBloqueo",
        "label": "Motivo bloqueo",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 500
      },
      {
        "name": "fechaVerificacion",
        "label": "Fecha verificación",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "verificadoPor",
        "label": "Verificado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "creadoPor",
        "label": "Creado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "modificadoPor",
        "label": "Modificado por",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaModificacion",
        "label": "Fecha modificación",
        "type": "datetime",
        "required": false,
        "section": "Auditoría",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "compromisos",
    "title": "Compromisos",
    "singular": "Compromiso",
    "group": "Configuración",
    "idField": "idCompromiso",
    "columns": [
      "numeroReferencia",
      "descripcion",
      "tipoCompromiso",
      "idProveedor",
      "montoTotal",
      "saldoCapital",
      "estado"
    ],
    "fields": [
      {
        "name": "idCompromiso",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idSucursal",
        "label": "Sucursal",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "sucursales",
        "integer": true
      },
      {
        "name": "idDepartamento",
        "label": "Departamento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "departamentos",
        "integer": true
      },
      {
        "name": "tipoCompromiso",
        "label": "Tipo compromiso",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "RECURRENTE",
          "CONTRATO",
          "PRESTAMO",
          "ARRENDAMIENTO",
          "FONDO_CAJA_CHICA",
          "OBLIGACION_FISCAL",
          "OTRO"
        ],
        "maxLength": 25
      },
      {
        "name": "numeroReferencia",
        "label": "Número referencia",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "descripcion",
        "label": "Descripción",
        "type": "textarea",
        "required": true,
        "section": "Información adicional",
        "maxLength": 500
      },
      {
        "name": "fechaInicio",
        "label": "Fecha inicio",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "fechaFin",
        "label": "Fecha fin",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "frecuencia",
        "label": "Frecuencia",
        "type": "text",
        "required": false,
        "section": "Estado y control",
        "options": [
          "SEMANAL",
          "QUINCENAL",
          "MENSUAL",
          "BIMESTRAL",
          "TRIMESTRAL",
          "SEMESTRAL",
          "ANUAL",
          "VARIABLE"
        ],
        "maxLength": 20
      },
      {
        "name": "numeroCuotas",
        "label": "Número cuotas",
        "type": "number",
        "required": false,
        "section": "Datos generales",
        "precision": 6,
        "scale": 0,
        "integer": true
      },
      {
        "name": "diaVencimiento",
        "label": "Día vencimiento",
        "type": "number",
        "required": false,
        "section": "Datos generales",
        "precision": 2,
        "scale": 0,
        "integer": true
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 3,
        "defaultValue": "GTQ"
      },
      {
        "name": "montoTotal",
        "label": "Monto total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "saldoCapital",
        "label": "Saldo capital",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "tasaInteres",
        "label": "Tasa interés",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 9,
        "scale": 6,
        "defaultValue": 0.0
      },
      {
        "name": "valorCuota",
        "label": "Valor cuota",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "garantiaDescripcion",
        "label": "Garantía descripción",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 500
      },
      {
        "name": "cuentaContable",
        "label": "Cuenta contable",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "centroCosto",
        "label": "Centro costo",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "proyecto",
        "label": "Proyecto",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "responsablePor",
        "label": "Responsable por",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "BORRADOR",
          "PENDIENTE_APROBACION",
          "ACTIVO",
          "SUSPENDIDO",
          "FINALIZADO",
          "ANULADO"
        ],
        "maxLength": 25,
        "defaultValue": "ACTIVO"
      },
      {
        "name": "creadoPor",
        "label": "Creado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "modificadoPor",
        "label": "Modificado por",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaModificacion",
        "label": "Fecha modificación",
        "type": "datetime",
        "required": false,
        "section": "Auditoría",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "documentos",
    "title": "Documentos",
    "singular": "Documento",
    "group": "Documentos",
    "idField": "idDocumento",
    "columns": [
      "numeroDocumento",
      "tipoDocumento",
      "idProveedor",
      "fechaVencimiento",
      "totalNeto",
      "saldoPendiente",
      "estado"
    ],
    "fields": [
      {
        "name": "idDocumento",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idSucursal",
        "label": "Sucursal",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "sucursales",
        "integer": true
      },
      {
        "name": "idCondicionCredito",
        "label": "Condición de crédito",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "condiciones-credito",
        "integer": true
      },
      {
        "name": "idCompromiso",
        "label": "Compromiso",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "compromisos",
        "integer": true
      },
      {
        "name": "idDocumentoRelacionado",
        "label": "Documento relacionado",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "noFacturaCompra",
        "label": "Factura de compra",
        "type": "text",
        "required": false,
        "section": "Relaciones",
        "maxLength": 50,
        "lookup": "facturas-compra"
      },
      {
        "name": "noOrdenCompra",
        "label": "Orden de compra",
        "type": "text",
        "required": false,
        "section": "Relaciones",
        "maxLength": 20,
        "lookup": "ordenes-compra"
      },
      {
        "name": "noRecepcion",
        "label": "Recepción de compra",
        "type": "text",
        "required": false,
        "section": "Relaciones",
        "maxLength": 20,
        "lookup": "recepciones"
      },
      {
        "name": "tipoDocumento",
        "label": "Tipo documento",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "FACTURA",
          "FACTURA_CAMBIARIA",
          "NOTA_CREDITO",
          "NOTA_DEBITO",
          "RECIBO",
          "REEMBOLSO",
          "LIQUIDACION_VIATICO",
          "GASTO_CAJA_CHICA",
          "CUOTA_CONTRATO",
          "CUOTA_PRESTAMO",
          "OBLIGACION_FISCAL",
          "SALDO_INICIAL",
          "COMPROBANTE_SERVICIO",
          "OTRO"
        ],
        "maxLength": 30
      },
      {
        "name": "naturaleza",
        "label": "Naturaleza",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "D",
          "C"
        ],
        "maxLength": 1,
        "defaultValue": "D"
      },
      {
        "name": "origenIngreso",
        "label": "Origen ingreso",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "MANUAL",
          "ARCHIVO",
          "CORREO",
          "IMPORTACION",
          "COMPRAS",
          "CARGA_MASIVA",
          "INTEGRACION",
          "PORTAL_PROVEEDOR",
          "FACTURACION_ELECTRONICA"
        ],
        "maxLength": 25,
        "defaultValue": "MANUAL"
      },
      {
        "name": "tipoRegistro",
        "label": "Tipo registro",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "CON_OC",
          "SIN_OC",
          "RECURRENTE",
          "SALDO_INICIAL",
          "IMPORTADO"
        ],
        "maxLength": 20,
        "defaultValue": "SIN_OC"
      },
      {
        "name": "serie",
        "label": "Serie",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 40
      },
      {
        "name": "numeroDocumento",
        "label": "Número documento",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "uuidFiscal",
        "label": "UUID fiscal",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "nitEmisor",
        "label": "NIT del emisor",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 20
      },
      {
        "name": "referenciaExterna",
        "label": "Referencia externa",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "hashOrigen",
        "label": "Hash origen",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 128
      },
      {
        "name": "fechaDocumento",
        "label": "Fecha documento",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "fechaRecepcion",
        "label": "Fecha recepción",
        "type": "datetime",
        "required": true,
        "section": "Fechas",
        "defaultValue": "SYSTIMESTAMP"
      },
      {
        "name": "fechaContabilizacion",
        "label": "Fecha contabilización",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "fechaVencimiento",
        "label": "Fecha vencimiento",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "diasCredito",
        "label": "Días crédito",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 4,
        "scale": 0,
        "defaultValue": 0.0,
        "integer": true
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 3,
        "defaultValue": "GTQ"
      },
      {
        "name": "tipoCambio",
        "label": "Tipo cambio",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 8,
        "defaultValue": 1.0
      },
      {
        "name": "fuenteTipoCambio",
        "label": "Fuente tipo cambio",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "fechaTipoCambio",
        "label": "Fecha tipo cambio",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "subtotal",
        "label": "Subtotal",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "descuentoTotal",
        "label": "Descuento total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "impuestoTotal",
        "label": "Impuesto total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "retencionTotal",
        "label": "Retención total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "recargoTotal",
        "label": "Recargo total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "gastoAdicionalTotal",
        "label": "Gasto adicional total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaRedondeo",
        "label": "Diferencia redondeo",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "totalBruto",
        "label": "Total bruto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "totalNeto",
        "label": "Total neto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "totalLocal",
        "label": "Total local",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "montoAplicado",
        "label": "Monto aplicado",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "saldoPendiente",
        "label": "Saldo pendiente",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "idDepartamento",
        "label": "Departamento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "departamentos",
        "integer": true
      },
      {
        "name": "centroCosto",
        "label": "Centro costo",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "proyecto",
        "label": "Proyecto",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "cuentaContable",
        "label": "Cuenta contable",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "solicitadoPor",
        "label": "Solicitado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "responsablePor",
        "label": "Responsable por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "justificacionSinOc",
        "label": "Justificación sin orden de compra",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      },
      {
        "name": "numeroCuota",
        "label": "Número cuota",
        "type": "number",
        "required": false,
        "section": "Datos generales",
        "precision": 6,
        "scale": 0,
        "integer": true
      },
      {
        "name": "capitalCuota",
        "label": "Capital cuota",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "interesCuota",
        "label": "Interés cuota",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "comisionCuota",
        "label": "Comisión cuota",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "resultadoTresVias",
        "label": "Resultado tres vias",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "NO_APLICA",
          "COINCIDE",
          "DENTRO_TOLERANCIA",
          "DIFERENCIA",
          "DIF_PRECIO",
          "DIF_CANTIDAD",
          "NO_RECIBIDO",
          "SUPERA_ORDEN",
          "SIN_RECEPCION",
          "ORDEN_CERRADA",
          "ORDEN_ANULADA",
          "EN_INVESTIGACION",
          "DIFERENCIA_APROBADA",
          "BLOQUEADO"
        ],
        "maxLength": 30,
        "defaultValue": "NO_APLICA"
      },
      {
        "name": "diferenciaCantidad",
        "label": "Diferencia cantidad",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaPrecio",
        "label": "Diferencia precio",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaImpuesto",
        "label": "Diferencia impuesto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaTotal",
        "label": "Diferencia total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "prioridad",
        "label": "Prioridad",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "CRITICA",
          "ALTA",
          "NORMAL",
          "BAJA"
        ],
        "maxLength": 10,
        "defaultValue": "NORMAL"
      },
      {
        "name": "estadoContable",
        "label": "Estado contable",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "ENVIADO",
          "CONTABILIZADO",
          "ERROR",
          "REVERTIDO",
          "NO_APLICA"
        ],
        "maxLength": 20,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "numeroAsientoExt",
        "label": "Número asiento ext",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "RECIBIDO",
          "PENDIENTE_CLASIFICACION",
          "BORRADOR",
          "PENDIENTE_REVISION",
          "EN_VALIDACION",
          "DUPLICADO",
          "CON_DIFERENCIAS",
          "PENDIENTE_APROBACION",
          "APROBADA",
          "RECHAZADA",
          "CONTABILIZADA",
          "PENDIENTE_PAGO",
          "PROGRAMADA_PAGO",
          "PARCIALMENTE_PAGADA",
          "PAGADA",
          "VENCIDA",
          "BLOQUEADA",
          "EN_DISPUTA",
          "PARCIALMENTE_APLICADA",
          "APLICADA",
          "ANULADA",
          "CERRADA"
        ],
        "maxLength": 30,
        "defaultValue": "RECIBIDO"
      },
      {
        "name": "posibleDuplicado",
        "label": "Posible duplicado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "N"
      },
      {
        "name": "motivoRechazo",
        "label": "Motivo rechazo",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "motivoBloqueo",
        "label": "Motivo bloqueo",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "motivoAnulacion",
        "label": "Motivo anulación",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "anuladoPor",
        "label": "Anulado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaAnulacion",
        "label": "Fecha anulación",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1500
      },
      {
        "name": "creadoPor",
        "label": "Creado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "modificadoPor",
        "label": "Modificado por",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaModificacion",
        "label": "Fecha modificación",
        "type": "datetime",
        "required": false,
        "section": "Auditoría",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "documentos-detalle",
    "title": "Detalle de documentos",
    "singular": "Detalle de documento",
    "group": "Documentos",
    "idField": "idDetalle",
    "columns": [
      "idDocumento",
      "numeroLinea",
      "descripcion",
      "cantidad",
      "precioUnitario",
      "totalLinea"
    ],
    "fields": [
      {
        "name": "idDetalle",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "codigoArticulo",
        "label": "Artículo",
        "type": "text",
        "required": false,
        "section": "Relaciones",
        "maxLength": 20,
        "lookup": "articulos"
      },
      {
        "name": "idDetalleOc",
        "label": "Detalle de orden de compra",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "detalles-orden-compra",
        "integer": true
      },
      {
        "name": "idDetalleRecepcion",
        "label": "Detalle de recepción",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "detalles-recepcion",
        "integer": true
      },
      {
        "name": "numeroLinea",
        "label": "Número linea",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 6,
        "scale": 0,
        "integer": true
      },
      {
        "name": "descripcion",
        "label": "Descripción",
        "type": "textarea",
        "required": true,
        "section": "Información adicional",
        "maxLength": 500
      },
      {
        "name": "cantidad",
        "label": "Cantidad",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4
      },
      {
        "name": "unidadMedida",
        "label": "Unidad medida",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 30,
        "defaultValue": "UNIDAD"
      },
      {
        "name": "precioUnitario",
        "label": "Precio unitario",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 6
      },
      {
        "name": "descuento",
        "label": "Descuento",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "subtotal",
        "label": "Subtotal",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "impuesto",
        "label": "Impuesto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "retencion",
        "label": "Retención",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "totalLinea",
        "label": "Total linea",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "cuentaContable",
        "label": "Cuenta contable",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "centroCosto",
        "label": "Centro costo",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "idDepartamento",
        "label": "Departamento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "departamentos",
        "integer": true
      },
      {
        "name": "proyecto",
        "label": "Proyecto",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "cantidadOrdenada",
        "label": "Cantidad ordenada",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4
      },
      {
        "name": "cantidadRecibida",
        "label": "Cantidad recibida",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4
      },
      {
        "name": "cantidadFacturada",
        "label": "Cantidad facturada",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4
      },
      {
        "name": "precioOrdenado",
        "label": "Precio ordenado",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 6
      },
      {
        "name": "precioFacturado",
        "label": "Precio facturado",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 6
      },
      {
        "name": "diferenciaCantidad",
        "label": "Diferencia cantidad",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 4,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaPrecio",
        "label": "Diferencia precio",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "resultadoTresVias",
        "label": "Resultado tres vias",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "NO_APLICA",
          "COINCIDE",
          "DENTRO_TOLERANCIA",
          "DIFERENCIA",
          "BLOQUEADO"
        ],
        "maxLength": 25,
        "defaultValue": "NO_APLICA"
      }
    ]
  },
  {
    "resource": "documentos-tributos",
    "title": "Tributos de documentos",
    "singular": "Tributo de documento",
    "group": "Documentos",
    "idField": "idTributo",
    "columns": [
      "idDocumento",
      "tipoTributo",
      "nombreTributo",
      "baseImponible",
      "porcentaje",
      "monto",
      "estado"
    ],
    "fields": [
      {
        "name": "idTributo",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idDetalle",
        "label": "Detalle de documento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos-detalle",
        "integer": true
      },
      {
        "name": "tipoTributo",
        "label": "Tipo tributo",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "IMPUESTO",
          "RETENCION",
          "PERCEPCION"
        ],
        "maxLength": 15
      },
      {
        "name": "codigoTributo",
        "label": "Código tributo",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 30
      },
      {
        "name": "nombreTributo",
        "label": "Nombre tributo",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "baseImponible",
        "label": "Base imponible",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "porcentaje",
        "label": "Porcentaje",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 9,
        "scale": 6,
        "defaultValue": 0.0
      },
      {
        "name": "monto",
        "label": "Monto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "montoRecuperable",
        "label": "Monto recuperable",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoNoRecuperable",
        "label": "Monto no recuperable",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "incluidoPrecio",
        "label": "Incluido precio",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "N"
      },
      {
        "name": "numeroConstancia",
        "label": "Número constancia",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "periodoFiscal",
        "label": "Período fiscal",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 20
      },
      {
        "name": "fechaAplicacion",
        "label": "Fecha aplicación",
        "type": "date",
        "required": true,
        "section": "Fechas",
        "defaultValue": "SYSDATE"
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "CALCULADO",
          "APLICADO",
          "ANULADO"
        ],
        "maxLength": 20,
        "defaultValue": "CALCULADO"
      },
      {
        "name": "generadoPor",
        "label": "Generado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaGeneracion",
        "label": "Fecha generación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "lotes-pago",
    "title": "Lotes de pago",
    "singular": "Lote de pago",
    "group": "Pagos",
    "idField": "idLote",
    "columns": [
      "codigoLote",
      "fechaEjecucion",
      "moneda",
      "cantidadPagos",
      "montoTotal",
      "estado"
    ],
    "fields": [
      {
        "name": "idLote",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idSucursal",
        "label": "Sucursal",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "sucursales",
        "integer": true
      },
      {
        "name": "idCuentaOrigen",
        "label": "Cuenta de origen",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "codigoLote",
        "label": "Código lote",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 40
      },
      {
        "name": "tipoLote",
        "label": "Tipo lote",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PROVEEDORES",
          "IMPUESTOS",
          "NOMINA",
          "CAJA_CHICA",
          "REEMBOLSOS",
          "OTRO"
        ],
        "maxLength": 30,
        "defaultValue": "PROVEEDORES"
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "fechaEjecucion",
        "label": "Fecha ejecución",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 3,
        "defaultValue": "GTQ"
      },
      {
        "name": "cantidadPagos",
        "label": "Cantidad pagos",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 8,
        "scale": 0,
        "defaultValue": 0.0,
        "integer": true
      },
      {
        "name": "montoTotal",
        "label": "Monto total",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "BORRADOR",
          "PENDIENTE_APROBACION",
          "APROBADO",
          "ENVIADO",
          "EN_PROCESO",
          "EJECUTADO",
          "PARCIAL",
          "RECHAZADO",
          "ANULADO"
        ],
        "maxLength": 30,
        "defaultValue": "BORRADOR"
      },
      {
        "name": "creadoPor",
        "label": "Creado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "enviadoPor",
        "label": "Enviado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaEnvio",
        "label": "Fecha envío",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "motivoRechazo",
        "label": "Motivo rechazo",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "motivoAnulacion",
        "label": "Motivo anulación",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "pagos",
    "title": "Pagos",
    "singular": "Pago",
    "group": "Pagos",
    "idField": "idPago",
    "columns": [
      "codigoPago",
      "idProveedor",
      "fechaProgramada",
      "moneda",
      "montoObligacion",
      "montoTransferido",
      "estado"
    ],
    "fields": [
      {
        "name": "idPago",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idLote",
        "label": "Lote de pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "lotes-pago",
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idSucursal",
        "label": "Sucursal",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "sucursales",
        "integer": true
      },
      {
        "name": "idFormaPago",
        "label": "Forma de pago",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "formas-pago",
        "integer": true
      },
      {
        "name": "idCuentaOrigen",
        "label": "Cuenta de origen",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "idCuentaDestino",
        "label": "Cuenta de destino",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "idPagoOrigen",
        "label": "Pago de origen",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "codigoPago",
        "label": "Código pago",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "tipoPago",
        "label": "Tipo pago",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "ORDINARIO",
          "ANTICIPO",
          "REEMBOLSO",
          "REPOSICION_CAJA",
          "DEVOLUCION",
          "REVERSO",
          "COMPENSACION"
        ],
        "maxLength": 25,
        "defaultValue": "ORDINARIO"
      },
      {
        "name": "fechaProgramada",
        "label": "Fecha programada",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "fechaPago",
        "label": "Fecha pago",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "fechaEfectiva",
        "label": "Fecha efectiva",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 3,
        "defaultValue": "GTQ"
      },
      {
        "name": "tipoCambio",
        "label": "Tipo cambio",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 8,
        "defaultValue": 1.0
      },
      {
        "name": "fuenteTipoCambio",
        "label": "Fuente tipo cambio",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "fechaTipoCambio",
        "label": "Fecha tipo cambio",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "montoObligacion",
        "label": "Monto obligación",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "montoDescuento",
        "label": "Monto descuento",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoRetencion",
        "label": "Monto retención",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoComision",
        "label": "Monto comisión",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoTransferido",
        "label": "Monto transferido",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "montoAplicado",
        "label": "Monto aplicado",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "montoNoAplicado",
        "label": "Monto no aplicado",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "numeroCheque",
        "label": "Número cheque",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "numeroTransferencia",
        "label": "Número transferencia",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "referenciaBancaria",
        "label": "Referencia bancaria",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "concepto",
        "label": "Concepto",
        "type": "textarea",
        "required": true,
        "section": "Información adicional",
        "maxLength": 500
      },
      {
        "name": "respuestaBanco",
        "label": "Respuesta banco",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      },
      {
        "name": "estadoContable",
        "label": "Estado contable",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "ENVIADO",
          "CONTABILIZADO",
          "ERROR",
          "REVERTIDO",
          "NO_APLICA"
        ],
        "maxLength": 20,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "numeroAsientoExt",
        "label": "Número asiento ext",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 80
      },
      {
        "name": "claveIdempotencia",
        "label": "Clave idempotencia",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "BORRADOR",
          "PROGRAMADO",
          "PENDIENTE_APROBACION",
          "APROBADO",
          "ENVIADO",
          "EN_PROCESO",
          "EJECUTADO",
          "CONFIRMADO",
          "PARCIALMENTE_APLICADO",
          "APLICADO",
          "CONCILIADO",
          "RECHAZADO",
          "DEVUELTO",
          "ANULADO"
        ],
        "maxLength": 30,
        "defaultValue": "BORRADOR"
      },
      {
        "name": "programadoPor",
        "label": "Programado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "ejecutadoPor",
        "label": "Ejecutado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "conciliadoPor",
        "label": "Conciliado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "motivoRechazo",
        "label": "Motivo rechazo",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "motivoDevolucion",
        "label": "Motivo devolución",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "motivoAnulacion",
        "label": "Motivo anulación",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "fechaModificacion",
        "label": "Fecha modificación",
        "type": "datetime",
        "required": false,
        "section": "Auditoría",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "aplicaciones",
    "title": "Aplicaciones",
    "singular": "Aplicación",
    "group": "Pagos",
    "idField": "idAplicacion",
    "columns": [
      "idDocumentoDestino",
      "tipoAplicacion",
      "fechaAplicacion",
      "montoTotalAplicado",
      "saldoPosterior",
      "estado"
    ],
    "fields": [
      {
        "name": "idAplicacion",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idDocumentoDestino",
        "label": "Documento de destino",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "idDocumentoOrigen",
        "label": "Documento de origen",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idDocumentoCxc",
        "label": "Documento de CxC",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos-cxc",
        "integer": true
      },
      {
        "name": "tipoAplicacion",
        "label": "Tipo aplicación",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PAGO",
          "ANTICIPO",
          "NOTA_CREDITO",
          "COMPENSACION_CXC",
          "AJUSTE"
        ],
        "maxLength": 25
      },
      {
        "name": "fechaAplicacion",
        "label": "Fecha aplicación",
        "type": "datetime",
        "required": true,
        "section": "Fechas",
        "defaultValue": "SYSTIMESTAMP"
      },
      {
        "name": "montoPrincipal",
        "label": "Monto principal",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoDescuento",
        "label": "Monto descuento",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoRetencion",
        "label": "Monto retención",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "diferenciaCambiaria",
        "label": "Diferencia cambiaria",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoTotalAplicado",
        "label": "Monto total aplicado",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "saldoAnterior",
        "label": "Saldo anterior",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "saldoPosterior",
        "label": "Saldo posterior",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "readOnly": true,
        "calculated": true
      },
      {
        "name": "estadoCxc",
        "label": "Estado cxc",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "NO_APLICA",
          "PENDIENTE",
          "CONFIRMADA",
          "RECHAZADA"
        ],
        "maxLength": 25,
        "defaultValue": "NO_APLICA"
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "APLICADA",
          "REVERTIDA",
          "CANCELADA"
        ],
        "maxLength": 20,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "aplicadoPor",
        "label": "Aplicado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "revertidoPor",
        "label": "Revertido por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaReverso",
        "label": "Fecha reverso",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "motivoReverso",
        "label": "Motivo reverso",
        "type": "textarea",
        "required": false,
        "section": "Estado y control",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "reglas-aprobacion",
    "title": "Reglas de aprobación",
    "singular": "Regla de aprobación",
    "group": "Control",
    "idField": "idRegla",
    "columns": [
      "nombreRegla",
      "tipoEntidad",
      "nivel",
      "idRolAprobador",
      "montoDesde",
      "montoHasta",
      "activa"
    ],
    "fields": [
      {
        "name": "idRegla",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "tipoEntidad",
        "label": "Tipo entidad",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "DOCUMENTO",
          "PAGO",
          "LOTE",
          "CUENTA_BANCARIA",
          "COMPROMISO",
          "PERIODO"
        ],
        "maxLength": 25
      },
      {
        "name": "nombreRegla",
        "label": "Nombre regla",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 150
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idDepartamento",
        "label": "Departamento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "departamentos",
        "integer": true
      },
      {
        "name": "centroCosto",
        "label": "Centro costo",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 50
      },
      {
        "name": "proyecto",
        "label": "Proyecto",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 100
      },
      {
        "name": "moneda",
        "label": "Moneda",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 3
      },
      {
        "name": "montoDesde",
        "label": "Monto desde",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "montoHasta",
        "label": "Monto hasta",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "requiereSinOc",
        "label": "Requiere documento sin orden de compra",
        "type": "text",
        "required": false,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1
      },
      {
        "name": "requiereDiferencia",
        "label": "Requiere diferencia",
        "type": "text",
        "required": false,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1
      },
      {
        "name": "nivel",
        "label": "Nivel",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 4,
        "scale": 0,
        "integer": true
      },
      {
        "name": "idRolAprobador",
        "label": "Rol aprobador",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "roles",
        "integer": true
      },
      {
        "name": "cantidadAprobadores",
        "label": "Cantidad aprobadores",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 3,
        "scale": 0,
        "defaultValue": 1.0,
        "integer": true
      },
      {
        "name": "permiteDelegacion",
        "label": "Permite delegación",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "S"
      },
      {
        "name": "vigenteDesde",
        "label": "Vigente desde",
        "type": "date",
        "required": true,
        "section": "Fechas",
        "defaultValue": "SYSDATE"
      },
      {
        "name": "vigenteHasta",
        "label": "Vigente hasta",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "activa",
        "label": "Activa",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "S"
      },
      {
        "name": "creadaPor",
        "label": "Creada por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCreacion",
        "label": "Fecha creación",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      }
    ]
  },
  {
    "resource": "aprobaciones",
    "title": "Aprobaciones",
    "singular": "Aprobación",
    "group": "Control",
    "idField": "idAprobacion",
    "columns": [
      "idDocumento",
      "idPago",
      "nivel",
      "idRolAprobador",
      "fechaSolicitud",
      "estado"
    ],
    "fields": [
      {
        "name": "idAprobacion",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idRegla",
        "label": "Regla de aprobación",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "reglas-aprobacion",
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "idLote",
        "label": "Lote de pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "lotes-pago",
        "integer": true
      },
      {
        "name": "idCuentaBancaria",
        "label": "Cuenta bancaria",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "idCompromiso",
        "label": "Compromiso",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "compromisos",
        "integer": true
      },
      {
        "name": "idPeriodo",
        "label": "Período",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "periodos",
        "integer": true
      },
      {
        "name": "nivel",
        "label": "Nivel",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 4,
        "scale": 0,
        "integer": true
      },
      {
        "name": "idRolAprobador",
        "label": "Rol aprobador",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "roles",
        "integer": true
      },
      {
        "name": "idUsuarioAprobador",
        "label": "Usuario aprobador",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "delegadoPor",
        "label": "Delegado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "APROBADA",
          "RECHAZADA",
          "DELEGADA",
          "CANCELADA"
        ],
        "maxLength": 20,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "accion",
        "label": "Accion",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 30
      },
      {
        "name": "fechaSolicitud",
        "label": "Fecha solicitud",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "fechaDecision",
        "label": "Fecha decisión",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "observacion",
        "label": "Observación",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ],
    "associationFields": [
      "idDocumento",
      "idPago",
      "idLote",
      "idCuentaBancaria",
      "idCompromiso",
      "idPeriodo"
    ]
  },
  {
    "resource": "conciliaciones-proveedor",
    "title": "Conciliaciones de proveedor",
    "singular": "Conciliación de proveedor",
    "group": "Conciliaciones",
    "idField": "idConciliacionProv",
    "columns": [
      "idProveedor",
      "periodoDesde",
      "periodoHasta",
      "saldoEmpresa",
      "saldoProveedor",
      "diferencia",
      "estado"
    ],
    "fields": [
      {
        "name": "idConciliacionProv",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "periodoDesde",
        "label": "Período desde",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "periodoHasta",
        "label": "Período hasta",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "saldoEmpresa",
        "label": "Saldo empresa",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "saldoProveedor",
        "label": "Saldo proveedor",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "diferencia",
        "label": "Diferencia",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "BORRADOR",
          "EN_REVISION",
          "CONCILIADA",
          "CERRADA"
        ],
        "maxLength": 20,
        "defaultValue": "BORRADOR"
      },
      {
        "name": "elaboradaPor",
        "label": "Elaborada por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaElaboracion",
        "label": "Fecha elaboración",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "cerradaPor",
        "label": "Cerrada por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCierre",
        "label": "Fecha cierre",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "conciliaciones-proveedor-detalle",
    "title": "Detalle de conciliaciones",
    "singular": "Detalle de conciliación",
    "group": "Conciliaciones",
    "idField": "idDetConciliacion",
    "columns": [
      "idConciliacionProv",
      "tipoRegistro",
      "referenciaProveedor",
      "montoEmpresa",
      "montoProveedor",
      "diferencia",
      "resultado"
    ],
    "fields": [
      {
        "name": "idDetConciliacion",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idConciliacionProv",
        "label": "Conciliación de proveedor",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "conciliaciones-proveedor",
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "tipoRegistro",
        "label": "Tipo registro",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "DOCUMENTO",
          "PAGO",
          "AJUSTE_EXTERNO"
        ],
        "maxLength": 20
      },
      {
        "name": "referenciaProveedor",
        "label": "Referencia proveedor",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "fechaEmpresa",
        "label": "Fecha empresa",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "fechaProveedor",
        "label": "Fecha proveedor",
        "type": "date",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "montoEmpresa",
        "label": "Monto empresa",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "montoProveedor",
        "label": "Monto proveedor",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "diferencia",
        "label": "Diferencia",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "resultado",
        "label": "Resultado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "COINCIDE",
          "DIFERENCIA_FECHA",
          "DIFERENCIA_MONTO",
          "NO_REGISTRADO_EMPRESA",
          "NO_REGISTRADO_PROVEEDOR",
          "EN_REVISION"
        ],
        "maxLength": 30
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "conciliaciones-pago",
    "title": "Conciliaciones de pago",
    "singular": "Conciliación de pago",
    "group": "Conciliaciones",
    "idField": "idConciliacionPago",
    "columns": [
      "idPago",
      "referenciaMovimiento",
      "fechaMovimiento",
      "montoBanco",
      "montoSistema",
      "diferenciaMonto",
      "estado"
    ],
    "fields": [
      {
        "name": "idConciliacionPago",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "idCuentaBancaria",
        "label": "Cuenta bancaria",
        "type": "number",
        "required": true,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "referenciaMovimiento",
        "label": "Referencia movimiento",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 150
      },
      {
        "name": "fechaMovimiento",
        "label": "Fecha movimiento",
        "type": "date",
        "required": true,
        "section": "Fechas"
      },
      {
        "name": "montoBanco",
        "label": "Monto banco",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "montoSistema",
        "label": "Monto sistema",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "diferenciaMonto",
        "label": "Diferencia monto",
        "type": "number",
        "required": true,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2,
        "defaultValue": 0.0
      },
      {
        "name": "tipoCoincidencia",
        "label": "Tipo coincidencia",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "AUTOMATICA",
          "MANUAL",
          "TOLERANCIA",
          "SIN_COINCIDENCIA"
        ],
        "maxLength": 25
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "PENDIENTE",
          "CONCILIADO_AUTOMATICO",
          "CONCILIADO_MANUAL",
          "EN_REVISION",
          "RECHAZADO"
        ],
        "maxLength": 30,
        "defaultValue": "PENDIENTE"
      },
      {
        "name": "conciliadoPor",
        "label": "Conciliado por",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaConciliacion",
        "label": "Fecha conciliación",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "observaciones",
        "label": "Observaciones",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 1000
      }
    ]
  },
  {
    "resource": "eventos",
    "title": "Eventos",
    "singular": "Evento",
    "group": "Control",
    "idField": "idEvento",
    "columns": [
      "asunto",
      "tipoEvento",
      "prioridad",
      "fechaEvento",
      "usuarioAsignado",
      "estado"
    ],
    "fields": [
      {
        "name": "idEvento",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idEventoPadre",
        "label": "Evento padre",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "eventos",
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idCuentaBancaria",
        "label": "Cuenta bancaria",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "idCompromiso",
        "label": "Compromiso",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "compromisos",
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idLote",
        "label": "Lote de pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "lotes-pago",
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "idAplicacion",
        "label": "Aplicación",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "aplicaciones",
        "integer": true
      },
      {
        "name": "idConciliacionProv",
        "label": "Conciliación de proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "conciliaciones-proveedor",
        "integer": true
      },
      {
        "name": "idPeriodo",
        "label": "Período",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "periodos",
        "integer": true
      },
      {
        "name": "tipoEvento",
        "label": "Tipo evento",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 30
      },
      {
        "name": "asunto",
        "label": "Asunto",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 250
      },
      {
        "name": "detalle",
        "label": "Detalle",
        "type": "textarea",
        "required": false,
        "section": "Información adicional",
        "maxLength": 2000
      },
      {
        "name": "estadoAnterior",
        "label": "Estado anterior",
        "type": "text",
        "required": false,
        "section": "Estado y control",
        "maxLength": 50
      },
      {
        "name": "estadoNuevo",
        "label": "Estado nuevo",
        "type": "text",
        "required": false,
        "section": "Estado y control",
        "maxLength": 50
      },
      {
        "name": "montoRelacionado",
        "label": "Monto relacionado",
        "type": "number",
        "required": false,
        "section": "Importes y cantidades",
        "precision": 18,
        "scale": 2
      },
      {
        "name": "canal",
        "label": "Canal",
        "type": "text",
        "required": false,
        "section": "Datos generales",
        "maxLength": 20
      },
      {
        "name": "mencionesJson",
        "label": "Menciones (JSON)",
        "type": "textarea",
        "required": false,
        "section": "Información adicional"
      },
      {
        "name": "resultadoJson",
        "label": "Resultado (JSON)",
        "type": "textarea",
        "required": false,
        "section": "Información adicional"
      },
      {
        "name": "prioridad",
        "label": "Prioridad",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "CRITICA",
          "ALTA",
          "NORMAL",
          "BAJA"
        ],
        "maxLength": 10,
        "defaultValue": "NORMAL"
      },
      {
        "name": "estado",
        "label": "Estado",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "ABIERTO",
          "EN_PROCESO",
          "CERRADO",
          "CANCELADO"
        ],
        "maxLength": 20,
        "defaultValue": "ABIERTO"
      },
      {
        "name": "usuarioAsignado",
        "label": "Usuario asignado",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaLimite",
        "label": "Fecha límite",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      },
      {
        "name": "usuarioEvento",
        "label": "Usuario evento",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaEvento",
        "label": "Fecha evento",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      },
      {
        "name": "fechaCierre",
        "label": "Fecha cierre",
        "type": "datetime",
        "required": false,
        "section": "Fechas"
      }
    ],
    "associationFields": [
      "idProveedor",
      "idCuentaBancaria",
      "idCompromiso",
      "idDocumento",
      "idLote",
      "idPago",
      "idAplicacion",
      "idConciliacionProv",
      "idPeriodo"
    ]
  },
  {
    "resource": "archivos",
    "title": "Archivos",
    "singular": "Archivo",
    "group": "Control",
    "idField": "idArchivo",
    "columns": [
      "nombreArchivo",
      "categoria",
      "tipoMime",
      "tamanoBytes",
      "versionArchivo",
      "esVersionActual"
    ],
    "fields": [
      {
        "name": "idArchivo",
        "label": "ID",
        "type": "number",
        "required": false,
        "section": "Auditoría",
        "readOnly": true,
        "identity": true,
        "integer": true
      },
      {
        "name": "idProveedor",
        "label": "Proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "proveedores",
        "integer": true
      },
      {
        "name": "idCuentaBancaria",
        "label": "Cuenta bancaria",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "cuentas-bancarias",
        "integer": true
      },
      {
        "name": "idCompromiso",
        "label": "Compromiso",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "compromisos",
        "integer": true
      },
      {
        "name": "idDocumento",
        "label": "Documento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "documentos",
        "integer": true
      },
      {
        "name": "idLote",
        "label": "Lote de pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "lotes-pago",
        "integer": true
      },
      {
        "name": "idPago",
        "label": "Pago",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "pagos",
        "integer": true
      },
      {
        "name": "idAplicacion",
        "label": "Aplicación",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "aplicaciones",
        "integer": true
      },
      {
        "name": "idConciliacionProv",
        "label": "Conciliación de proveedor",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "conciliaciones-proveedor",
        "integer": true
      },
      {
        "name": "idEvento",
        "label": "Evento",
        "type": "number",
        "required": false,
        "section": "Relaciones",
        "lookup": "eventos",
        "integer": true
      },
      {
        "name": "categoria",
        "label": "Categoría",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 40
      },
      {
        "name": "nombreArchivo",
        "label": "Nombre archivo",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 255
      },
      {
        "name": "tipoMime",
        "label": "Tipo de archivo (MIME)",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 120
      },
      {
        "name": "tamanoBytes",
        "label": "Tamaño en bytes",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 18,
        "scale": 0,
        "integer": true
      },
      {
        "name": "uriAlmacenamiento",
        "label": "Ubicación del archivo (URI)",
        "type": "textarea",
        "required": true,
        "section": "Información adicional",
        "maxLength": 1000
      },
      {
        "name": "hashSha256",
        "label": "Hash SHA-256",
        "type": "text",
        "required": true,
        "section": "Datos generales",
        "maxLength": 64
      },
      {
        "name": "versionArchivo",
        "label": "Versión archivo",
        "type": "number",
        "required": true,
        "section": "Datos generales",
        "precision": 6,
        "scale": 0,
        "defaultValue": 1.0,
        "integer": true
      },
      {
        "name": "esVersionActual",
        "label": "Es versión actual",
        "type": "text",
        "required": true,
        "section": "Estado y control",
        "options": [
          "S",
          "N"
        ],
        "maxLength": 1,
        "defaultValue": "S"
      },
      {
        "name": "cargadoPor",
        "label": "Cargado por",
        "type": "number",
        "required": true,
        "section": "Auditoría",
        "lookup": "usuarios",
        "integer": true
      },
      {
        "name": "fechaCarga",
        "label": "Fecha carga",
        "type": "datetime",
        "required": true,
        "section": "Auditoría",
        "defaultValue": "SYSTIMESTAMP",
        "readOnly": true
      }
    ],
    "associationFields": [
      "idProveedor",
      "idCuentaBancaria",
      "idCompromiso",
      "idDocumento",
      "idLote",
      "idPago",
      "idAplicacion",
      "idConciliacionProv",
      "idEvento"
    ]
  }
];

export const getCxpEntity = (resource: string): CxpEntityDefinition | undefined => CXP_ENTITIES.find(entity => entity.resource === resource);
