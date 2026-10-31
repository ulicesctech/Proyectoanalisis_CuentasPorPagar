import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSessionScope, sessionEpoch } from '../src/modules/cxp/auth/sessionScope';
import { cxpCatalogCache } from '../src/modules/cxp/components/catalogCache';

test('cambiar de sesión invalida la generación y limpia los catálogos privados', () => {
  const before=sessionEpoch();
  cxpCatalogCache.set('cuenta-A',{expires:Date.now()+1000,result:Promise.resolve([{id:1,label:'Privado A'}])});
  clearSessionScope(); assert.equal(sessionEpoch(),before+1); assert.equal(cxpCatalogCache.size,0);
});
test('limpia claves CXP sin borrar preferencias ajenas al módulo', () => {
  const previous=(globalThis as any).window;
  const storage={ 'cxp.openProcessId':'8', 'cxp.actor':'1', 'otro.modulo':'conservar', removeItem(key:string){delete this[key];} };
  (globalThis as any).window={sessionStorage:storage,localStorage:storage};
  try {
    clearSessionScope();assert.equal(storage['cxp.openProcessId'],undefined);assert.equal(storage['cxp.actor'],undefined);assert.equal(storage['otro.modulo'],'conservar');
  } finally {(globalThis as any).window=previous;}
});
