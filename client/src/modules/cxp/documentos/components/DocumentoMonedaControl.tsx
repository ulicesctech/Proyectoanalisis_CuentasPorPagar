import { useEffect, useState } from 'react';
import { CXP_DOCUMENTO_MONEDA_LOCAL, type CxpDocumentoMonedas } from '@erp/contracts';
import { apiClient } from '../../api';
import { Select, TextInput } from '../../../../shared/ui-kit';

export function useDocumentoMonedas(enabled = true) {
  const [config, setConfig] = useState<CxpDocumentoMonedas | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    apiClient.get<CxpDocumentoMonedas>('/cxp/documentos/monedas')
      .then(result => { if (active) { setConfig(result); setError(''); } })
      .catch(() => { if (active) setError('No se pudo cargar el catálogo de monedas. Vuelve a abrir el formulario.'); });
    return () => { active = false; };
  }, [enabled]);
  return { config, error };
}

export function DocumentoMonedaControl({ name, id, values, config, error, onChange, onBlur, readOnly = false }: {
  name: 'moneda' | 'tipoCambio'; id: string; values: Record<string, string>;
  config: CxpDocumentoMonedas | null; error?: string;
  onChange: (name: string, value: string) => void; onBlur?: () => void; readOnly?: boolean;
}) {
  const local = config?.monedaLocal ?? CXP_DOCUMENTO_MONEDA_LOCAL;
  const messageId = `${id}-error`;
  const common = { id, error: error ? <span id={messageId} role="status">{error}</span> : undefined,
    'aria-invalid': !!error || undefined, 'aria-describedby': error ? messageId : name === 'tipoCambio' ? `${id}-help` : undefined, onBlur };
  if (name === 'moneda') return <Select {...common} label="Moneda" value={values.moneda} required
    isReadOnly={readOnly || !config} placeholder="Selecciona una moneda"
    options={[...(config?.monedas ?? []).map(row => ({ value: row.codigo, label: `${row.nombre} (${row.codigo})` })),
      ...(config && values.moneda && !config.monedas.some(row => row.codigo === values.moneda)
        ? [{ value: values.moneda, label: `${values.moneda} (moneda del registro; no está activa)` }] : [])]}
    onChange={event => onChange(name, event.target.value)} />;
  const isLocal = values.moneda === local;
  return <div>
    <TextInput {...common} label="Tipo de cambio" value={values.tipoCambio} required
      inputMode="decimal" isReadOnly={readOnly || isLocal} onChange={event => onChange(name, event.target.value)} />
    <p id={`${id}-help`} className="mt-1 text-xs text-slate-600">
      1 {values.moneda || 'unidad del documento'} = {values.tipoCambio || '…'} {local}.
      {' '}{isLocal ? 'Moneda local: tipo de cambio 1.' : 'Unidades de moneda local por unidad del documento. Ingresa una tasa positiva; no hay tasas configuradas.'}
      {!isLocal && values.fechaTipoCambio && <> Tasa manual para {values.fechaTipoCambio}.</>}
    </p>
  </div>;
}
