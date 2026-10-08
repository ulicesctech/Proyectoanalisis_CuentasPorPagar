import { useState } from 'react';
import { Modal } from '../../../../shared/components';
import { Button, TextArea } from '../../../../shared/ui-kit';
import { errorDe, facturasEspecialesApi, type AccionFlujo, type ResultadoAccion } from '../api';
import { UsuarioOperacionCampo, useUsuarioOperacion } from './UsuarioOperacion';
import { ACCIONES } from './acciones';

/** Botón estándar de una acción del flujo: mismo texto, icono, color y tamaño en todas las pantallas. */
export function BotonAccion({ accion, onClick }: { accion: AccionFlujo; onClick: () => void }) {
  const config = ACCIONES[accion];
  return <Button variant={config.variante} icon={config.icon} onClick={onClick}>{config.label}</Button>;
}

export function AccionDialog({ idDocumento, accion, onClose, onDone }: {
  idDocumento: number; accion: AccionFlujo | null; onClose: () => void; onDone: (resultado: ResultadoAccion) => void;
}) {
  const [usuario] = useUsuarioOperacion();
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const config = accion ? ACCIONES[accion] : null;
  const cerrar = () => { if (!enviando) { setTexto(''); setError(null); onClose(); } };

  const confirmar = async () => {
    if (!accion || !config) return;
    if (!usuario) { setError('Selecciona el usuario que realiza la operación.'); return; }
    if (config.texto === 'motivo' && texto.trim().length < 5) { setError('Describe el motivo (mínimo 5 caracteres).'); return; }
    setEnviando(true);
    setError(null);
    try {
      const body = config.texto === 'motivo' ? { usuario: Number(usuario), motivo: texto.trim() }
        : { usuario: Number(usuario), ...(config.texto && texto.trim() ? { observacion: texto.trim() } : {}) };
      const resultado = await facturasEspecialesApi.accion(idDocumento, accion, body);
      setTexto('');
      onDone(resultado);
    } catch (reason) { setError(errorDe(reason).mensaje); }
    finally { setEnviando(false); }
  };

  return <Modal isOpen={!!config} onClose={cerrar} title={config?.titulo ?? ''} size="sm">
    {config && <div className="space-y-4">
      <p className="text-sm text-slate-600">{config.descripcion}</p>
      <UsuarioOperacionCampo />
      {config.texto && <TextArea id="fe-accion-texto" label={config.texto === 'motivo' ? 'Motivo' : 'Observación (opcional)'} required={config.texto === 'motivo'}
        rows={3} maxLength={1000} value={texto} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(event.target.value)} />}
      {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={cerrar} disabled={enviando}>Cancelar</Button>
        {/* Confirmar usa el color de la acción; una acción neutra se confirma con el azul principal. */}
        <Button variant={config.variante === 'secondary' ? 'primary' : config.variante} icon={config.icon} onClick={confirmar} disabled={enviando}>
          {enviando ? 'Procesando…' : config.label}</Button>
      </div>
    </div>}
  </Modal>;
}
