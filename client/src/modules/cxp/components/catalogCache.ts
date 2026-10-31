import type { CxpOption } from '@erp/contracts';
import { registerSessionCleaner } from '../auth/sessionScope';
export const cxpCatalogCache = new Map<string, { expires: number; result: Promise<CxpOption[]> }>();
export const clearCxpCatalogCache = () => cxpCatalogCache.clear();
registerSessionCleaner(clearCxpCatalogCache);
