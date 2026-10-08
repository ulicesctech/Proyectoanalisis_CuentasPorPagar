import type { Connection } from 'oracledb';
import {
  createCxpReglaTributariaSchema, finalizarReglaTributariaSchema, nuevaVersionReglaTributariaSchema, cxpToday,
  type CxpReglaTributaria,
} from '@erp/contracts';
import { withCxpTransaction } from '../../repositories/crud.repository';
import { listReglasTributarias, reglaTributariaTx } from '../../repositories/documentos/reglaTributaria.repository';
import { CxpError } from '../errors';

const TIPO_DOCUMENTO = 'FACTURA_ESPECIAL';

/** Resta días a una fecha YYYY-MM-DD sin depender de la zona horaria del proceso. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function checkSolapamiento(connection: Connection, regla: Parameters<ReturnType<typeof reglaTributariaTx>['findSolapadas']>[0]) {
  const solapadas = await reglaTributariaTx(connection).findSolapadas(regla);
  if (solapadas.length) {
    const otra = solapadas[0];
    throw new CxpError(
      `La regla se cruza con ${otra.codigoRegla} v${otra.versionRegla} (${otra.codigoTributo}, ${otra.tipoTributo}) en vigencia y tramo de base. `
      + 'Ajusta las fechas o los montos desde/hasta para que solo una regla aplique a cada operación.', 409,
    );
  }
}

export const cxpReglaTributariaService = {
  list(query: { codigoRegla?: string; estado?: string; search?: string }) {
    if (query.estado && !['VIGENTE', 'REEMPLAZADA', 'FINALIZADA'].includes(query.estado)) throw new CxpError('Estado de regla inválido');
    return listReglasTributarias(query);
  },

  async create(raw: unknown): Promise<CxpReglaTributaria> {
    const input = createCxpReglaTributariaSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = reglaTributariaTx(connection);
      if (await tx.lockUltimaVersion(input.codigoRegla)) {
        throw new CxpError(`Ya existe la regla ${input.codigoRegla}. Para cambiar sus valores registra una nueva versión.`, 409);
      }
      const regla = {
        codigoRegla: input.codigoRegla, versionRegla: 1, idReglaAnterior: null, tipoDocumento: TIPO_DOCUMENTO,
        tipoTributo: input.tipoTributo, codigoTributo: input.codigoTributo, nombreTributo: input.nombreTributo,
        porcentaje: input.porcentaje, montoFijo: input.montoFijo, baseDesde: input.baseDesde, baseHasta: input.baseHasta ?? null,
        sobreExcedente: input.sobreExcedente, moneda: input.moneda ?? null, vigenteDesde: input.vigenteDesde,
        vigenteHasta: input.vigenteHasta ?? null, motivoCambio: null, creadaPor: input.creadaPor,
      };
      await checkSolapamiento(connection, regla);
      const id = await tx.insert(regla);
      return (await tx.findById(id))!;
    });
  },

  /**
   * Modificar una regla = registrar una versión nueva desde una fecha (hoy o futura).
   * La versión anterior se conserva con su vigencia cerrada el día previo, por lo que
   * las facturas ya calculadas mantienen su porcentaje y su vínculo con esa versión.
   */
  async nuevaVersion(id: number, raw: unknown): Promise<CxpReglaTributaria> {
    const input = nuevaVersionReglaTributariaSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = reglaTributariaTx(connection);
      const actual = await tx.findById(id);
      if (!actual) throw new CxpError('Regla tributaria no encontrada', 404);
      const ultima = (await tx.lockUltimaVersion(actual.codigoRegla))!;
      if (ultima.idReglaTributaria !== actual.idReglaTributaria) {
        throw new CxpError(`Solo se puede versionar la última versión de ${actual.codigoRegla} (v${ultima.versionRegla}).`, 409);
      }
      if (ultima.estado !== 'VIGENTE') throw new CxpError('La regla ya fue finalizada; registra una regla nueva con otro código.', 409);
      if (input.vigenteDesde <= ultima.vigenteDesde) {
        throw new CxpError(`La nueva versión debe iniciar después del ${ultima.vigenteDesde}, fecha en que inició la versión actual.`);
      }
      if (ultima.vigenteHasta && input.vigenteDesde > addDays(ultima.vigenteHasta, 1)) {
        throw new CxpError(`La versión actual termina el ${ultima.vigenteHasta}; la nueva debe iniciar a más tardar el día siguiente para no dejar periodos sin regla.`);
      }
      const aplicada = await tx.ultimaFechaAplicada(ultima.idReglaTributaria);
      if (aplicada && aplicada >= input.vigenteDesde) {
        throw new CxpError(`Hay facturas con fecha ${aplicada} calculadas con la versión actual. La nueva versión debe iniciar después de esa fecha.`, 409);
      }
      const regla = {
        codigoRegla: ultima.codigoRegla, versionRegla: ultima.versionRegla + 1, idReglaAnterior: ultima.idReglaTributaria,
        tipoDocumento: ultima.tipoDocumento, tipoTributo: ultima.tipoTributo, codigoTributo: ultima.codigoTributo,
        nombreTributo: ultima.nombreTributo, porcentaje: input.porcentaje, montoFijo: input.montoFijo,
        baseDesde: input.baseDesde, baseHasta: input.baseHasta ?? null, sobreExcedente: input.sobreExcedente,
        moneda: ultima.moneda, vigenteDesde: input.vigenteDesde, vigenteHasta: ultima.vigenteHasta,
        motivoCambio: input.motivoCambio, creadaPor: input.usuario,
      };
      await checkSolapamiento(connection, regla);
      await tx.cerrar(ultima.idReglaTributaria, { vigenteHasta: addDays(input.vigenteDesde, -1), estado: 'REEMPLAZADA', usuario: input.usuario });
      const nuevoId = await tx.insert(regla);
      return (await tx.findById(nuevoId))!;
    });
  },

  /** Finaliza la vigencia sin reemplazo. No borra la regla: queda como historial. */
  async finalizar(id: number, raw: unknown): Promise<CxpReglaTributaria> {
    const input = finalizarReglaTributariaSchema.parse(raw);
    return withCxpTransaction(async connection => {
      const tx = reglaTributariaTx(connection);
      const actual = await tx.findById(id);
      if (!actual) throw new CxpError('Regla tributaria no encontrada', 404);
      const ultima = (await tx.lockUltimaVersion(actual.codigoRegla))!;
      if (ultima.idReglaTributaria !== actual.idReglaTributaria || ultima.estado !== 'VIGENTE') {
        throw new CxpError('Solo se puede finalizar la versión vigente más reciente de la regla.', 409);
      }
      if (input.vigenteHasta < ultima.vigenteDesde) throw new CxpError(`La vigencia no puede terminar antes de su inicio (${ultima.vigenteDesde}).`);
      if (input.vigenteHasta < cxpToday()) throw new CxpError('La vigencia no puede finalizar en una fecha pasada.');
      const aplicada = await tx.ultimaFechaAplicada(ultima.idReglaTributaria);
      if (aplicada && input.vigenteHasta < aplicada) {
        throw new CxpError(`Hay facturas con fecha ${aplicada} calculadas con esta regla; la vigencia debe cubrir esa fecha.`, 409);
      }
      await tx.cerrar(ultima.idReglaTributaria, { vigenteHasta: input.vigenteHasta, estado: 'FINALIZADA', usuario: input.usuario, motivo: `Finalizada: ${input.motivoCambio}` });
      return (await tx.findById(id))!;
    });
  },
};
