/** Datos maestros existentes; no incluye dirección ni CUI porque PROVEEDOR no los declara. */
export interface CxpProveedorIdentidad {
  idProveedor: number;
  nit: string | null;
  nombre: string;
  activo: boolean;
}
export interface CxpProveedorCoincidencias {
  proveedores: CxpProveedorIdentidad[];
  coincidenciasExactas: number;
  limitado: boolean;
}
