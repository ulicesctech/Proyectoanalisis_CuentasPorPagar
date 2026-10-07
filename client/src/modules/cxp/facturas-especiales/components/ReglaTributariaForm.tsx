import { useState } from 'react';
import {
  createCxpReglaTributariaSchema, cxpToday, finalizarReglaTributariaSchema, nuevaVersionReglaTributariaSchema, type CxpReglaTributaria,
} from '@erp/contracts';
import { Button, Select, TextArea, TextInput } from '../../../../shared/ui-kit';
import { errorDe, reglasTributariasApi } from '../api';
import { UsuarioOperacionCampo, useUsuarioOperacion } from './UsuarioOperacion';

export type ModoRegla = 'crear' | 'version' | 'finalizar';

const numero = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

/**
 * Crear una regla, registrar una versión nueva (el único modo de cambiar sus valores)
 * o finalizar su vigencia. Las reglas no se editan ni se eliminan: se conserva el historial.
 */
export function ReglaTributariaForm({ modo, regla, onSuccess, onCancel }: {
  modo: ModoRegla; regla?: CxpReglaTributaria; onSuccess: (regla: CxpReglaTributaria) => void; onCancel: () => void;
}) {
  const [usuario] = useUsuarioOperacion();
  const [valores, setValores] = useState<Record<string, string>>({
    codigoRegla: '', tipoTributo: 'RETENCION', codigoTributo: '', nombreTributo: '', moneda: '',
    porcentaje: regla ? String(regla.porcentaje) : '', montoFijo: regla ? String(regla.montoFijo) : '0',
    baseDesde: regla ? String(regla.baseDesde) : '0', baseHasta: regla?.baseHasta != null ? String(regla.baseHasta) : '',
    sobreExcedente: regla?.sobreExcedente ?? 'N', vigenteDesde: cxpToday(), vigenteHasta: '', motivoCambio: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const campo = (name: string) => ({
    id: `rt-${name}`, value: valores[name], error: errores[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValores(actual => ({ ...actual, [name]: event.target.value }));
      setErrores(({ [name]: _, ...resto }) => resto);
    },
  });

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usuario) { setMensaje('Selecciona el usuario de la operación antes de guardar.'); return; }
    const calculo = {
      porcentaje: numero(valores.porcentaje), montoFijo: numero(valores.montoFijo) || 0, baseDesde: numero(valores.baseDesde) || 0,
      baseHasta: valores.baseHasta.trim() ? numero(valores.baseHasta) : null, sobreExcedente: valores.sobreExcedente,
    };
    const [schema, datos] = modo === 'crear'
      ? [createCxpReglaTributariaSchema, { ...calculo, codigoRegla: valores.codigoRegla, tipoTributo: valores.tipoTributo, codigoTributo: valores.codigoTributo,
        nombreTributo: valores.nombreTributo, moneda: valores.moneda.trim() || null, vigenteDesde: valores.vigenteDesde,
        vigenteHasta: valores.vigenteHasta || null, creadaPor: Number(usuario) }]
      : modo === 'version'
        ? [nuevaVersionReglaTributariaSchema, { ...calculo, vigenteDesde: valores.vigenteDesde, motivoCambio: valores.motivoCambio, usuario: Number(usuario) }]
        : [finalizarReglaTributariaSchema, { vigenteHasta: valores.vigenteHasta, motivoCambio: valores.motivoCambio, usuario: Number(usuario) }];
    const validacion = schema.safeParse(datos);
    if (!validacion.success) {
      setErrores(Object.fromEntries(validacion.error.issues.map(issue => [String(issue.path[0] ?? ''), issue.message])));
      setMensaje('Revisa los campos indicados.');
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      onSuccess(modo === 'crear' ? await reglasTributariasApi.create(datos)
        : modo === 'version' ? await reglasTributariasApi.nuevaVersion(regla!.idReglaTributaria, datos)
        : await reglasTributariasApi.finalizar(regla!.idReglaTributaria, datos));
    } catch (reason) {
      const { mensaje: texto, campos } = errorDe(reason);
      setMensaje(texto);
      setErrores(campos);
    } finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="space-y-5" noValidate>
    {mensaje && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{mensaje}</p>}
    <UsuarioOperacionCampo />
    {regla && <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">{regla.codigoRegla} v{regla.versionRegla} · {regla.nombreTributo}</p>
      <p>{regla.porcentaje}%{regla.montoFijo ? ` + ${regla.montoFijo}` : ''} · vigente desde {regla.vigenteDesde}{regla.vigenteHasta ? ` hasta ${regla.vigenteHasta}` : ''}</p>
    </div>}
    {modo === 'crear' && <div className="grid sm:grid-cols-2 gap-4">
      <TextInput {...campo('codigoRegla')} label="Código de la regla" required maxLength={30} placeholder="Ej: ISR-FE-TRAMO1" helperText="Identifica la regla y todas sus versiones." />
      <TextInput {...campo('nombreTributo')} label="Nombre del tributo" required maxLength={120} placeholder="Ej: ISR retenido" />
      <Select {...campo('tipoTributo')} label="Tipo" required placeholder="" options={[{ value: 'RETENCION', label: 'Retención (se descuenta del pago)' }, { value: 'IMPUESTO', label: 'Impuesto (se suma a la operación)' }]} />
      <TextInput {...campo('codigoTributo')} label="Código del tributo" required maxLength={30} placeholder="Ej: IVA o ISR" helperText="IVA e ISR se identifican por este código en la constancia." />
      <TextInput {...campo('moneda')} label="Moneda" maxLength={3} placeholder="Vacío = cualquier moneda" />
    </div>}
    {modo !== 'finalizar' && <>
      <div className="grid sm:grid-cols-3 gap-4">
        <TextInput {...campo('porcentaje')} label="Porcentaje (%)" required type="number" min="0" max="100" step="0.000001" />
        <TextInput {...campo('montoFijo')} label="Monto fijo" type="number" min="0" step="0.01" helperText="Se suma al cálculo porcentual." />
        <Select {...campo('sobreExcedente')} label="Porcentaje aplicado sobre" placeholder="" options={[{ value: 'N', label: 'Toda la base' }, { value: 'S', label: 'El excedente de la base mínima' }]} />
        <TextInput {...campo('baseDesde')} label="Base mínima" type="number" min="0" step="0.01" />
        <TextInput {...campo('baseHasta')} label="Base máxima" type="number" min="0" step="0.01" placeholder="Sin límite" />
      </div>
      <p className="text-xs text-slate-500">Para tramos, registra una regla por tramo con bases que no se crucen. No se asumen porcentajes: ingresa los valores vigentes según la normativa.</p>
    </>}
    <div className="grid sm:grid-cols-2 gap-4">
      {modo !== 'finalizar' && <TextInput {...campo('vigenteDesde')} label={modo === 'version' ? 'Aplica desde' : 'Vigente desde'} required type="date"
        min={modo === 'version' ? cxpToday() : undefined} helperText={modo === 'version' ? 'Hoy o una fecha futura. La versión actual se cierra el día anterior.' : undefined} />}
      {modo !== 'version' && <TextInput {...campo('vigenteHasta')} label={modo === 'finalizar' ? 'Vigente hasta' : 'Vigente hasta (opcional)'} required={modo === 'finalizar'} type="date"
        min={modo === 'finalizar' ? cxpToday() : valores.vigenteDesde} />}
    </div>
    {modo !== 'crear' && <TextArea {...campo('motivoCambio')} label="Motivo del cambio" required rows={2} maxLength={500} placeholder="Ej: actualización del porcentaje según nueva normativa" />}
    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={guardando}>Cancelar</Button>
      <Button type="submit" variant={modo === 'finalizar' ? 'danger' : 'primary'} disabled={guardando}>
        {guardando ? 'Guardando…' : modo === 'crear' ? 'Crear regla' : modo === 'version' ? 'Registrar nueva versión' : 'Finalizar vigencia'}</Button>
    </div>
  </form>;
}
