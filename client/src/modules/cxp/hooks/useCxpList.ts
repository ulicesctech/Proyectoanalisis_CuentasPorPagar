import { useCallback, useEffect, useState } from 'react';
import type { CxpRecord, PaginatedResponse, PaginationMeta } from '@erp/contracts';
import { apiClient, ApiError, buildQueryString } from '../../../shared/api';

export function useCxpList(resource: string, params: { page: number; search: string; filterField?: string; filterValue?: string }) {
  const [data, setData] = useState<CxpRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const refetch = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    const filter = params.filterField && params.filterValue ? { filterField: params.filterField, filterValue: params.filterValue } : {};
    apiClient.get<PaginatedResponse<CxpRecord>>(`/cxp/${resource}${buildQueryString({ page: params.page, limit: 10, search: params.search, ...filter })}`)
      .then(result => { if (active) { setData(result.data); setMeta({ ...result.meta, totalPages: Math.max(1, result.meta.totalPages) }); } })
      .catch(reason => { if (active) { setData([]); setError(reason instanceof ApiError ? reason.message : 'No se pudo cargar la información. Comprueba que el servidor esté iniciado.'); } })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [resource, params.page, params.search, params.filterField, params.filterValue, refresh]);
  return { data, meta, isLoading, error, refetch };
}
