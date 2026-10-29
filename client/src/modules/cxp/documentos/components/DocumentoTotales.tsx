import type { CxpRecord } from '@erp/contracts';
import { formatDocumentoMoney } from '../documentoView';

export function DocumentoTotales({ preview, moneda, local }: { preview: CxpRecord; moneda: string; local: string }) {
  return <dl aria-label="Totales calculados" aria-live="polite" className="mt-4 grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm sm:grid-cols-3">
    {[['Total bruto', preview.totalBruto, moneda], ['Total neto', preview.totalNeto, moneda], ['Total local', preview.totalLocal, local]]
      .map(([label, value, currency]) => <div key={String(label)}>
        <dt className="text-blue-800">{String(label)}</dt>
        <dd className="font-semibold text-blue-900">{formatDocumentoMoney(value, String(currency))}</dd>
      </div>)}
  </dl>;
}
