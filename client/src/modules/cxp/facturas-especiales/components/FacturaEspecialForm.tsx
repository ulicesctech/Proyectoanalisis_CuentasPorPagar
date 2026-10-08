import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { createCxpFacturaEspecialSchema, cxpToday, type CxpCalculoFacturaEspecial, type CxpFacturaEspecialDetalle } from '@erp/contracts';
import { Button, TextArea, TextInput } from '../../../../shared/ui-kit';
import { RelationSelect } from '../../components/RelationSelect';
import { errorDe, facturasEspecialesApi, formatoMonto, type ResultadoAccion } from '../api';
import { UsuarioOperacionCampo, useUsuarioOperacion } from './UsuarioOperacion';

type Valores = Record<string, string>;

const inicial = (factura?: CxpFacturaEspecialDetalle | null): Valores => ({
  idProveedor: factura ? String(factura.idProveedor) : '',
  proveedorNombre: factura?.proveedorNombre ?? '',
  proveedorNit: factura?.proveedorNit ?? '',
  proveedorCui: factura?.proveedorCui ?? '',
  proveedorDireccion: factura?.proveedorDireccion ?? '',
  idSucursal: factura ? String(factura.idSucursal) : '',
  fechaDocumento: factura?.fechaDocumento ?? cxpToday(),
  fechaVencimiento: factura?.fechaVencimiento ?? '',
  referenciaExterna: factura?.referenciaExterna ?? '',
  descripcionOperacion: factura?.descripcionOperacion ?? '',
  moneda: factura?.moneda ?? 'GTQ',
  tipoCambio: factura ? String(factura.tipoCambio) : '1',
  subtotal: factura ? String(factura.subtotal) : '',
  descuentoTotal: factura ? String(factura.descuentoTotal) : '0',
  idDepartamento: factura?.idDepartamento ? String(factura.idDepartamento) : '',
  centroCosto: factura?.centroCosto ?? '',
  cuentaContable: factura?.cuentaContable ?? '',
  observaciones: factura?.observaciones ?? '',
});

const numero = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));
const opcional = (value: string) => (value.trim() === '' ? null : value.trim());

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4">
    <legend className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">{titulo}</legend>
    {children}
  </fieldset>;
}

export function FacturaEspecialForm({ factura, onSuccess, onCancel }: {
  factura?: CxpFacturaEspecialDetalle | null; onSuccess: (resultado: ResultadoAccion) => void; onCancel: () => void;
}) {
  const [usuario] = useUsuarioOperacion();
  const [valores, setValores] = useState<Valores>(() => inicial(factura));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [calculo, setCalculo] = useState<CxpCalculoFacturaEspecial | null>(null);
  const [calculoError, setCalculoError] = useState<string | null>(null);
  const set = (campo: string) => (value: string) => { setValores(actual => ({ ...actual, [campo]: value })); setErrores(({ [campo]: _, ...resto }) => resto); };
  const input = (campo: string) => ({
    id: `fe-${campo}`, value: valores[campo], error: errores[campo],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(campo)(event.target.value),
  });

  // Vista previa del cálculo con las reglas vigentes en la fecha de la operación.
  useEffect(() => {
    const subtotal = numero(valores.subtotal);
    if (!valores.fechaDocumento || Number.isNaN(subtotal) || valores.moneda.trim().length !== 3) { setCalculo(null); setCalculoError(null); return; }
    let activo = true;
    const timer = window.setTimeout(() => {
      facturasEspecialesApi.calcular({ fechaDocumento: valores.fechaDocumento, moneda: valores.moneda, subtotal, descuentoTotal: numero(valores.descuentoTotal) || 0 })
        .then(result => { if (activo) { setCalculo(result); setCalculoError(null); } })
        .catch(reason => { if (activo) { setCalculo(null); setCalculoError(errorDe(reason).mensaje); } });
    }, 300);
    return () => { activo = false; window.clearTimeout(timer); };
  }, [valores.fechaDocumento, valores.moneda, valores.subtotal, valores.descuentoTotal]);

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!usuario) { setMensaje('Selecciona el usuario de la operación antes de guardar.'); return; }
    setGuardando(true);
    setMensaje(null);
    const datos = {
      idProveedor: numero(valores.idProveedor), idSucursal: numero(valores.idSucursal), fechaDocumento: valores.fechaDocumento,
      fechaVencimiento: opcional(valores.fechaVencimiento), moneda: valores.moneda.trim(), tipoCambio: numero(valores.tipoCambio),
      subtotal: numero(valores.subtotal), descuentoTotal: numero(valores.descuentoTotal) || 0, referenciaExterna: valores.referenciaExterna.trim(),
      proveedorNombre: opcional(valores.proveedorNombre), proveedorNit: opcional(valores.proveedorNit), proveedorCui: opcional(valores.proveedorCui),
      proveedorDireccion: opcional(valores.proveedorDireccion), descripcionOperacion: valores.descripcionOperacion.trim(),
      idDepartamento: valores.idDepartamento ? numero(valores.idDepartamento) : null, centroCosto: opcional(valores.centroCosto),
      cuentaContable: opcional(valores.cuentaContable), observaciones: opcional(valores.observaciones), usuario: Number(usuario),
    };
    // Mismo esquema que valida el servidor: los errores se muestran junto a cada campo.
    const validacion = createCxpFacturaEspecialSchema.safeParse(datos);
    if (!validacion.success) {
      setErrores(Object.fromEntries(validacion.error.issues.map(issue => [String(issue.path[0] ?? ''), issue.message])));
      setMensaje('Revisa los campos indicados.');
      setGuardando(false);
      return;
    }
    try {
      onSuccess(factura ? await facturasEspecialesApi.update(factura.idDocumento, datos) : await facturasEspecialesApi.create(datos));
    } catch (reason) {
      const { mensaje: texto, campos } = errorDe(reason);
      setMensaje(texto);
      setErrores(campos);
    } finally { setGuardando(false); }
  };

  return <form onSubmit={guardar} className="space-y-6" noValidate>
    {mensaje && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{mensaje}</p>}
    <UsuarioOperacionCampo />
    <Seccion titulo="Proveedor">
      <RelationSelect id="fe-proveedor" catalog="proveedores" label="Proveedor" required value={valores.idProveedor} onChange={set('idProveedor')} error={errores.idProveedor} />
      <div className="grid sm:grid-cols-2 gap-4">
        <TextInput {...input('proveedorNombre')} label="Nombre en la factura" placeholder="Se toma del proveedor si se deja vacío" maxLength={200} />
        <TextInput {...input('proveedorDireccion')} label="Dirección" placeholder="Ej: Aldea El Progreso, Chimaltenango" maxLength={300} />
        <TextInput {...input('proveedorNit')} label="NIT" placeholder="Se toma del proveedor si está registrado" maxLength={20} />
        <TextInput {...input('proveedorCui')} label="CUI / DPI" placeholder="Obligatorio si el proveedor no tiene NIT" maxLength={20} />
      </div>
    </Seccion>
    <Seccion titulo="Operación">
      <div className="grid sm:grid-cols-2 gap-4">
        <RelationSelect id="fe-sucursal" catalog="sucursales" label="Sucursal" required value={valores.idSucursal} onChange={set('idSucursal')} error={errores.idSucursal} />
        <TextInput {...input('referenciaExterna')} label="Referencia de la operación" required placeholder="Ej: boleta o recibo del proveedor" maxLength={120}
          helperText="Evita registrar dos veces la misma operación del proveedor." />
        <TextInput {...input('fechaDocumento')} label="Fecha de la operación" required type="date" max={cxpToday()}
          helperText="Determina las reglas tributarias vigentes que se aplican." />
        <TextInput {...input('fechaVencimiento')} label="Fecha de vencimiento" type="date" min={valores.fechaDocumento} />
      </div>
      <TextArea {...input('descripcionOperacion')} label="Descripción de la operación" required rows={3} maxLength={1000}
        placeholder="Bienes o servicios adquiridos, cantidad y condiciones" />
    </Seccion>
    <Seccion titulo="Montos y tributos">
      <div className="grid sm:grid-cols-4 gap-4">
        <TextInput {...input('subtotal')} label="Monto de la operación" required type="number" min="0" step="0.01" placeholder="Ej: 1500.00" />
        <TextInput {...input('descuentoTotal')} label="Descuento" type="number" min="0" step="0.01" />
        <TextInput {...input('moneda')} label="Moneda" required maxLength={3} />
        <TextInput {...input('tipoCambio')} label="Tipo de cambio" required type="number" min="0" step="0.00000001" />
      </div>
      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-2 mb-3"><Calculator size={14} /> Cálculo con las reglas vigentes</p>
        {calculoError ? <p className="text-sm text-red-700">{calculoError}</p>
          : !calculo ? <p className="text-sm text-slate-500">Ingresa la fecha y el monto para ver los tributos.</p>
          : <div className="space-y-3 text-sm">
            {calculo.tributos.length === 0 && <p className="text-amber-800">No hay reglas tributarias vigentes para esta fecha y moneda; configúralas en Reglas tributarias antes de enviar a revisión.</p>}
            {calculo.tributos.map(tributo => <div key={tributo.idReglaTributaria} className="flex justify-between gap-3">
              <span className="text-slate-600">{tributo.nombreTributo} · {tributo.porcentaje}% <span className="text-xs text-slate-400">({tributo.codigoRegla} v{tributo.versionRegla})</span></span>
              <span className={`font-semibold ${tributo.tipoTributo === 'RETENCION' ? 'text-red-700' : 'text-slate-900'}`}>{tributo.tipoTributo === 'RETENCION' ? '−' : '+'} {formatoMonto(tributo.monto, valores.moneda)}</span>
            </div>)}
            <div className="border-t border-slate-200 pt-2 flex justify-between"><span className="font-semibold text-slate-900">Total a pagar al proveedor</span>
              <span className="font-bold text-slate-900">{formatoMonto(calculo.totalNeto, valores.moneda)}</span></div>
          </div>}
      </div>
    </Seccion>
    <Seccion titulo="Información contable (opcional)">
      <div className="grid sm:grid-cols-2 gap-4">
        <RelationSelect id="fe-departamento" catalog="departamentos" label="Departamento" value={valores.idDepartamento} onChange={set('idDepartamento')} />
        <div className="space-y-4">
          <TextInput {...input('centroCosto')} label="Centro de costo" maxLength={50} />
          <TextInput {...input('cuentaContable')} label="Cuenta contable" maxLength={50} />
        </div>
      </div>
      <TextArea {...input('observaciones')} label="Observaciones" rows={2} maxLength={1500} />
    </Seccion>
    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={guardando}>Cancelar</Button>
      <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : factura ? 'Guardar cambios' : 'Registrar factura especial'}</Button>
    </div>
  </form>;
}
