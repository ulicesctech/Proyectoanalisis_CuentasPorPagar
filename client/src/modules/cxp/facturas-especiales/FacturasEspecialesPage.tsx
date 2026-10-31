import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { CxpCaptureDialog } from '../components/CxpCaptureDialog';
import { CxpButton as Button } from '../components/CxpButton';
import { CxpPageHeader } from '../components/CxpPageHeader';
import { CxpLayout } from '../CxpLayout';
import { FacturaEspecialForm } from './components/FacturaEspecialForm';
import { ListadoFacturas } from './components/ListadoFacturas';
import { useCxpFormGuard } from '../components/CxpFormGuard';

export function CxpFacturasEspecialesPage() {
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  const [formStatus, setFormStatus] = useState({ dirty: false, busy: false });
  const { discard } = useCxpFormGuard();
  const close = () => {
    if (!formStatus.busy) void discard(() => setCreando(false), formStatus.dirty);
  };
  return <CxpLayout screen="facturas-especiales">
    <div className="space-y-5">
      <CxpPageHeader title="Facturas especiales" group="Facturas especiales"
        description="Compras a proveedores que no emiten factura propia: preparación, revisión, aprobación, emisión y anulación."
        actions={<Button icon={Plus} onClick={() => { setFormStatus({dirty:false,busy:false}); setCreando(true); }}>Nueva factura especial</Button>} />
      <ListadoFacturas etapas={['', 'PREPARACION', 'REVISION', 'APROBACION', 'APROBADA', 'EMITIDA', 'RECHAZADA', 'ANULADA']} />
      {creando && <CxpCaptureDialog onClose={close} busy={formStatus.busy} title="Nueva factura especial"
        description="Queda en preparación con los tributos calculados según las reglas vigentes en la fecha de la operación.">
        <FacturaEspecialForm onCancel={close} onStatusChange={setFormStatus}
          onSuccess={resultado => navigate(`/cxp/facturas-especiales/${resultado.factura.idDocumento}`, { state: { mensaje: resultado.mensaje } })} />
      </CxpCaptureDialog>}
    </div>
  </CxpLayout>;
}
