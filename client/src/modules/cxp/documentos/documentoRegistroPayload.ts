import type { CxpRecord } from '@erp/contracts';

// El contrato agrega valores predeterminados al validar. Solo enviamos los campos
// presentes en el formulario para que el servidor calcule los términos de pago.
export function documentoRegistroPayload(input: CxpRecord, validated: CxpRecord): CxpRecord {
  return Object.fromEntries(Object.keys(input).map(key => [key, validated[key]]));
}
