import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Modal } from '../../../shared/components';
import { Button } from '../../../shared/ui-kit';
import { CxpLayout } from '../CxpLayout';
import { FacturaEspecialForm } from './components/FacturaEspecialForm';
import { ListadoFacturas } from './components/ListadoFacturas';
import { UsuarioOperacion } from './components/UsuarioOperacion';

export function CxpFacturasEspecialesPage() {
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  return <CxpLayout screen="facturas-especiales">
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Cuentas por pagar · Facturas especiales</p>
          <h1 className="text-2xl font-bold text-slate-900">Facturas especiales</h1>
          <p className="text-sm text-slate-500 mt-1">Compras a proveedores que no emiten factura propia: preparación, revisión, aprobación, emisión y anulación.</p></div>
        <Button icon={Plus} onClick={() => setCreando(true)}>Nueva factura especial</Button>
      </div>
      <UsuarioOperacion />
      <ListadoFacturas etapas={['', 'PREPARACION', 'REVISION', 'APROBACION', 'APROBADA', 'EMITIDA', 'RECHAZADA', 'ANULADA']} />
      <Modal isOpen={creando} onClose={() => setCreando(false)} size="lg" title="Nueva factura especial"
        description="Queda en preparación con los tributos calculados según las reglas vigentes en la fecha de la operación.">
        {creando && <FacturaEspecialForm onCancel={() => setCreando(false)}
          onSuccess={resultado => navigate(`/cxp/facturas-especiales/${resultado.factura.idDocumento}`, { state: { mensaje: resultado.mensaje } })} />}
      </Modal>
    </div>
  </CxpLayout>;
}
