import { useEffect, useState } from 'react';
import { apiClient } from '../../../shared/api';
import { Button, TextInput, DataTable } from '../../../shared/ui-kit';
import { clearCxpCatalogCache } from '../components/RelationSelect';

interface ProveedorItem {
  idProveedor: number;
  nit: string;
  nombreEntidad: string;
  activo: boolean;
  cuentasAprobadas: number;
  archivosRespaldo: number;
  datosCompletosCxP: boolean;
}

export function CxpProveedorPage() {
  const [proveedores, setProveedores] = useState<ProveedorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newNit, setNewNit] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadProveedores = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: ProveedorItem[]; total: number }>('/cxp/proveedores');
      setProveedores(res.data ?? []);
    } catch {
      setErrorMsg('No se pudieron cargar los proveedores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProveedores();
  }, []);

  const handleCreate = async () => {
    if (!newNit.trim() || !newNombre.trim()) {
      setErrorMsg('El NIT y la Razón Social son obligatorios');
      return;
    }
    setCreating(true);
    setErrorMsg(null);
    try {
      await apiClient.post('/cxp/proveedores', {
        nit: newNit.trim(),
        nombreEntidad: newNombre.trim(),
      });
      clearCxpCatalogCache();
      setShowModal(false);
      setNewNit('');
      setNewNombre('');
      await loadProveedores();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el proveedor');
    } finally {
      setCreating(false);
    }
  };

  const filtered = proveedores.filter(p =>
    p.nombreEntidad.toLowerCase().includes(search.toLowerCase()) ||
    p.nit.toLowerCase().includes(search.toLowerCase()) ||
    String(p.idProveedor).includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores CxP</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestión y consulta de proveedores para relaciones de adquisición, compromisos, documentos y pagos.
          </p>
        </div>
        <Button onClick={() => { setShowModal(true); setErrorMsg(null); }}>
          + Nuevo Proveedor
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="w-72">
          <TextInput
            placeholder="Buscar por nombre, NIT o ID…"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} proveedor(es) registrado(s)
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Cargando proveedores…</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">NIT</th>
                <th className="py-3 px-4">Razón Social / Entidad</th>
                <th className="py-3 px-4">Cuentas Aprobadas</th>
                <th className="py-3 px-4">Archivos Respaldo</th>
                <th className="py-3 px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No se encontraron proveedores.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.idProveedor} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">#{p.idProveedor}</td>
                    <td className="py-3 px-4 font-mono text-slate-800">{p.nit}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.nombreEntidad}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.cuentasAprobadas > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {p.cuentasAprobadas} cuenta(s)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.archivosRespaldo} archivo(s)</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.activo ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600'}`}>
                        {p.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Registrar Proveedor (CxP)</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIT *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. 1234567-8"
                  value={newNit}
                  onChange={e => setNewNit(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Razón Social / Nombre Entidad *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej. Comercial Distribuidora S.A."
                  value={newNombre}
                  onChange={e => setNewNombre(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={creating}
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                disabled={creating || !newNit.trim() || !newNombre.trim()}
                onClick={handleCreate}
              >
                {creating ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
