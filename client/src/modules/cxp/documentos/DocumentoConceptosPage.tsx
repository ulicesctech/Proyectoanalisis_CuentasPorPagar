import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CxpLayout } from '../CxpLayout';
import { DocumentoCatalogPicker } from './components/DocumentoCatalogPicker';
import { apiClient } from '../api';

/** Conserva enlaces anteriores, pero toda captura se realiza dentro de su documento. */
export function DocumentoConceptosPage({ resource }: { resource: 'documentos-detalle' | 'documentos-tributos' }) {
  const [params] = useSearchParams();
  const parent = params.get('filterField') === 'idDocumento' ? params.get('filterValue') : null;
  const [selected, setSelected] = useState(parent && /^\d+$/.test(parent) ? parent : '');
  const [error, setError] = useState('');
  useEffect(() => {
    const record = params.get('registro');
    if (!record || !/^\d+$/.test(record)) return;
    let active = true;
    apiClient.get<{ idDocumento: number }>(`/cxp/${resource}/${record}`).then(row => { if (active) setSelected(String(row.idDocumento)); })
      .catch(() => { if (active) setError('No se pudo resolver el documento del enlace anterior.'); });
    return () => { active = false; };
  }, [resource, params.get('registro')]);
  if (selected) return <Navigate to={`/cxp/documentos/${selected}#conceptos-documento`} replace />;
  return <CxpLayout resource="documentos"><section className="max-w-2xl space-y-4 rounded-xl border bg-white p-5">
    <h1 className="text-xl font-bold">Líneas y tributos del documento</h1>
    <p className="text-sm text-slate-600">Selecciona el documento para capturar sus conceptos en una sola vista.</p>
    {error && <p role="alert">{error}</p>}
    <DocumentoCatalogPicker id="conceptos-documento-selector" catalog="documentos" label="Documento" value="" onChange={setSelected} />
    <Link to="/cxp/documentos" className="text-sm font-semibold text-blue-700">Volver a documentos y saldos</Link>
  </section></CxpLayout>;
}
