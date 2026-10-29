import { useEffect, useState } from 'react';
import type { CxpOption } from '@erp/contracts';
import { useAuth } from '../auth/session';
import { apiClient } from '../api';
import { TextInput } from '../../../shared/ui-kit';

/** Presentación de autoría; nunca ofrece un selector de personas. */
export function CxpActorReadOnly({ id, label, actorId }: { id: string; label: string; actorId: unknown }) {
  const { session } = useAuth();
  const current = Number(actorId) === session?.actor?.id;
  const [name, setName] = useState('');
  useEffect(() => {
    let active = true;
    setName('');
    if (!actorId || current) return;
    apiClient.get<CxpOption[]>(`/cxp/catalogos/usuarios?selected=${encodeURIComponent(String(actorId))}`)
      .then(rows => { if (active) setName(rows.find(row => Number(row.id) === Number(actorId))?.label ?? ''); })
      .catch(() => {});
    return () => { active = false; };
  }, [actorId, current]);
  return <TextInput id={id} label={label} isReadOnly
    value={current ? session.actor.nombre : name || (actorId ? `Usuario #${actorId}` : 'Sin registrar')}
    helperText="La autoría la registra el servidor desde la sesión." />;
}
