import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Navegador real y API simulada: no conecta al ERP ni escribe en Oracle.
const client = fileURLToPath(new URL('..', import.meta.url));
const browser = process.env.CXP_TEST_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { const value = await fn(); if (value) return value; await delay(80); }
  throw new Error(message);
}
function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data), request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
}

test('CXP: cambios pendientes, NIT, tributos, DTE y mensajes en escritorio y m?vil', {skip:!browser,timeout:180000}, async t=>{
  const artifacts=path.join(client,'node_modules/.cache/cxp-experiencia-browser',String(Date.now()));await mkdir(artifacts,{recursive:true});
  const writes=[],queries=[],unexpected=[],errors=[];
  const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
  const {calcularDocumentoComponentes,documentoComponentesSchema}=require('@erp/contracts');
  const suppliers=[{idProveedor:1,nit:'123-1',nombre:'Proveedor Alfa',activo:true},{idProveedor:2,nit:'456-2',nombre:'Proveedor Beta',activo:true},{idProveedor:3,nit:null,nombre:'Proveedor sin NIT',activo:true},{idProveedor:4,nit:'777-7',nombre:'Compartido Uno',activo:true},{idProveedor:5,nit:'777-7',nombre:'Compartido Dos',activo:true}];
  let context={documento:{idDocumento:99,idProveedor:1,idSucursal:1,creadoPor:7,estado:'RECIBIDO',tipoDocumento:'FACTURA',naturaleza:'D',serie:'A',numeroDocumento:'UX-99',nitEmisor:'EMISOR-HIST',origenIngreso:'MANUAL',tipoRegistro:'SIN_OC',fechaDocumento:'2026-10-30',fechaVencimiento:'2026-10-30',fechaRecepcion:'2026-10-30T10:00:00',diasCredito:0,idCondicionCredito:1,moneda:'GTQ',tipoCambio:1,subtotal:100,descuentoTotal:0,impuestoTotal:0,retencionTotal:0,recargoTotal:0,gastoAdicionalTotal:0,diferenciaRedondeo:0,totalBruto:100,totalNeto:100,totalLocal:100,montoAplicado:0,saldoPendiente:100},
    version:'a'.repeat(64),lineas:[{clave:'linea-1',idDetalle:1,numeroLinea:1,datos:{descripcion:'Concepto original',cantidad:1,unidadMedida:'UNIDAD',precioUnitario:100,descuento:0}}],
    tributos:[{clave:'tributo-1',idTributo:1,linea:'linea-1',calculo:'CONSERVAR',base:'MANUAL',tratamiento:'CONSERVAR',baseRevisadaPara:100,datos:{tipoTributo:'IMPUESTO',codigoTributo:'HIST10',nombreTributo:'Tributo histórico ficticio',baseImponible:100,porcentaje:10,monto:10,incluidoPrecio:'N',montoRecuperable:0,montoNoRecuperable:10}}],editable:true,catalogo:[{tipo:'IMPUESTO',codigo:'HIST10',nombre:'Tributo histórico ficticio'}],advertencias:[],adoptarTotales:false,confirmarEliminaciones:[]};
  let failSave=true,conflictSave=false,failUpload=true,attached=false,uploads=0,patches=0,validationState='PENDIENTE_APROBACION';
  const fe={idDocumento:500,serie:'FESP',numeroDocumento:'00000050',idProveedor:1,idSucursal:1,proveedorNombre:'Nombre histórico de factura',proveedorNit:'NIT-HIST-FE',proveedorCui:null,proveedorDireccion:'Dirección histórica',descripcionOperacion:'Operación histórica',fechaDocumento:'2026-10-30',fechaVencimiento:'2026-10-30',moneda:'GTQ',tipoCambio:1,subtotal:100,descuentoTotal:0,totalNeto:110,retencionTotal:0,estado:'BORRADOR',etapa:'PREPARACION'};
  const api=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin??'*');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token, X-File-Name');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');res.setHeader('Content-Type','application/json');
    if(req.method==='OPTIONS'){res.end();return;}const url=new URL(req.url,'http://localhost'),p=url.pathname;const json=v=>res.end(JSON.stringify(v));let body;
    if(req.method!=='GET'){let raw='';for await(const bytes of req)raw+=bytes;body=p.endsWith('/archivos')?raw:JSON.parse(raw||'{}');}
    if(p==='/api/auth/session')return json({username:'ux.simulada',name:'Operador UX',mustChangePassword:false,actor:{id:7,nombre:'Operador UX',nombreRol:'OPERADOR_CXP',roles:[2],permisos:['CREAR']},csrfToken:'simulado'});
    if(p==='/api/cxp/proveedores/identidad'){
      const nit=(url.searchParams.get('nit')||'').trim().toUpperCase(),id=Number(url.searchParams.get('id')||0);
      if(nit==='123')await delay(650);
      const found=id?suppliers.filter(row=>row.idProveedor===id):suppliers.filter(row=>row.nit?.includes(nit));queries.push(nit||'id:'+id);
      return json({proveedores:found,coincidenciasExactas:suppliers.filter(row=>row.nit===nit).length,limitado:false});
    }
    if(p.startsWith('/api/cxp/catalogos/'))return json(p.endsWith('proveedores')?suppliers.map(row=>({id:row.idProveedor,label:row.nombre+' · '+(row.nit||'Sin NIT')})):[{id:1,label:p.endsWith('sucursales')?'Sucursal Central':'Contado'}]);
    if(p==='/api/cxp/documentos/monedas')return json({monedaLocal:'GTQ',fuenteTasas:null,monedas:[{codigo:'GTQ',nombre:'Quetzal'}]});
    if(p==='/api/cxp/documentos/calcular-vencimiento')return json({idCondicionCredito:1,diasCredito:0,fechaVencimiento:body.fechaDocumento,tipo:'CONTADO'});
    if(p==='/api/cxp/documentos')return json({data:[context.documento],meta:{page:1,limit:10,total:1,totalPages:1}});
    if(p==='/api/cxp/documentos/99')return json(context.documento);
    if(p.endsWith('/expediente'))return json({documento:context.documento,lineas:context.lineas,tributos:context.tributos,archivos:attached?[{idArchivo:11,nombreArchivo:'dte_demo.xml',categoria:'DTE',versionArchivo:1,fechaCarga:'2026-10-30'}]:[],aplicaciones:[]});
    if(p.endsWith('/aprobacion'))return json({reglas:[],decisiones:[],actor:null});
    if(p.endsWith('/opciones-tributos'))return json({identificaciones:[{tipo:'RETENCION',codigo:'REF5',nombre:'Referencia histórica de retención',origen:'HISTORICO'}],reglas:[]});
    if(p.endsWith('/componentes')){
      if(req.method==='PATCH'){
        await delay(200);
        patches++;writes.push(body);
        if(failSave){failSave=false;res.statusCode=500;return json({error:'Fallo simulado: captura conservada'});}
        if(conflictSave){conflictSave=false;context={...context,version:'e'.repeat(64),lineas:context.lineas.map(row=>({...row,datos:{...row.datos,descripcion:'Cambio externo'}}))};res.statusCode=409;return json({error:'El documento cambió. Recarga antes de guardar; tus cambios no se aplicaron.'});}
        assert.equal(body.version,context.version);const input=documentoComponentesSchema.parse(body),computed=calcularDocumentoComponentes(context.documento,input.lineas,input.tributos);
        context={...context,...input,lineas:computed.lineas,tributos:computed.tributos,version:String.fromCharCode(98+patches).repeat(64)};
        if(body.adoptarTotales)context.documento={...context.documento,...computed.totales,saldoPendiente:computed.totales.totalNeto};
      }return json(context);
    }
    if(p.endsWith('/contexto-pagos'))return json({reservadoDocumento:0,ordinariosDisponibles:0,motivos:context.documento.saldoPendiente?['Completa y valida el expediente antes de continuar con su aprobación y pago.']:['El documento ya no tiene saldo pendiente. No debe volver a aplicarse.'],procesos:[]});
    if(p.endsWith('/archivos')){
      if(req.method==='POST'){uploads++;if(failUpload){failUpload=false;res.statusCode=500;return json({error:'Fallo simulado al adjuntar'});}attached=true;return json({idArchivo:11,nombreArchivo:'dte_demo.xml'});}
      return json(attached?[{idArchivo:11,categoria:'DTE',nombreArchivo:'dte_demo.xml',tamanoBytes:100,versionArchivo:1,disponible:true}]:[]);
    }
    if(p.endsWith('/validar')){context.documento.estado=validationState;context.editable=false;return json(context.documento);}
    if(p==='/api/cxp/facturas-especiales/configuracion')return json({fechaDocumento:'2026-10-30',moneda:'GTQ',serie:'FESP',puedeRegistrar:true,impedimentos:[],advertencias:[],reglasVigentes:1});
    if(p==='/api/cxp/facturas-especiales/calcular')return json({subtotal:body.subtotal,descuentoTotal:body.descuentoTotal,impuestoTotal:0,retencionTotal:0,totalBruto:body.subtotal,totalNeto:body.subtotal,tributos:[]});
    if(p==='/api/cxp/facturas-especiales')return json({data:[fe],meta:{page:1,limit:10,total:1,totalPages:1}});
    if(p==='/api/cxp/facturas-especiales/500')return json(fe);
    unexpected.push(req.method+' '+p);res.statusCode=404;return json({error:'Ruta sin simulación'});
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(r => probe.close(r));
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: client, windowsHide: true, stdio: 'pipe', env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` } });
  let output = ''; dev.stdout.on('data', b => output += b); dev.stderr.on('data', b => output += b);
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket, evaluate;
  try {
    await until(async () => { if (dev.exitCode !== null) throw Error(output); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, 'Vite no inició');
    const debug = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'Chrome no inició');
    const pages = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json(); socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl); await once(socket, 'open');
    const send = connect(socket);
    socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); });
    await send('Runtime.enable'); await send('Page.enable');
    evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const input = async (id, value) => { await evaluate(`(() => {const el=document.getElementById(${JSON.stringify(id)});el.focus();const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`); await delay(80); };
    const click = async (text, scope = 'document') => { await evaluate(`[...${scope}.querySelectorAll('button')].find(el=>el.getClientRects().length && el.textContent.trim()===${JSON.stringify(text)}).click()`); await delay(120); };
    const value = id => evaluate(`document.getElementById(${JSON.stringify(id)}).value`);
    const key = async key => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Escape' ? 27 : 40 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key }); await delay(120); };
    const navigate = async route => { await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` }); await until(() => evaluate(`!!document.querySelector('h1')`), 'No cargó ' + route); await evaluate(`window.confirmations=[];window.acceptChoice=false;window.confirm=message=>{window.confirmations.push(message);return window.acceptChoice;}`); };
    const capture = async name => { await delay(380); const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64')); };
    const catalog = async (id, index = 0) => { await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); await until(() => evaluate(`!!document.getElementById(${JSON.stringify(id + '-option-' + index)})`), 'No cargó catálogo ' + id); await evaluate(`document.getElementById(${JSON.stringify(id + '-option-' + index)}).click()`); await delay(100); };
    const search = async (text, ids) => { await input('cxp-document-search', text); await until(() => evaluate(`JSON.stringify([...document.querySelectorAll('#cxp-document-suggestions [role="option"]')].map(el=>Number(el.id.split('-').pop())))===${JSON.stringify(JSON.stringify(ids))}`), 'Sugerencias incorrectas: ' + text); };
    const chosen = () => evaluate(`[...document.querySelectorAll('.cxp-create-dialog input[type="checkbox"]:checked')].map(el=>el.closest('label').textContent.trim())`);
    const openCreate = async () => { await until(() => evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Nueva contraseña'&&!el.disabled)`), 'No habilitó captura'); await click('Nueva contraseña'); await until(() => evaluate(`!!document.getElementById('cxp-document-search')`), 'No abrió captura'); };



    const answer=async label=>{await until(()=>evaluate(`!!document.querySelector('[role="alertdialog"]')`),'No abrió confirmación');await click(label,`document.querySelector('[role="alertdialog"]')`);};
    const supplier=async(id,index)=>{await catalog(id,index);await delay(120);};
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/cxp/documentos');await click('Nuevo documento');await click('Cerrar',`document.querySelector('[role="dialog"]')`);
    assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
    await click('Nuevo documento');await input('registro-numeroDocumento','CAMBIO');await click('Cerrar',`document.querySelector('[role="dialog"]')`);await capture('salir-sin-guardar-escritorio');await answer('Seguir editando');
    assert.equal(await value('registro-numeroDocumento'),'CAMBIO');await input('registro-numeroDocumento','');await click('Cerrar',`document.querySelector('[role="dialog"]')`);assert.equal(await evaluate(`!!document.querySelector('[role="dialog"]')`),false);
    await click('Nuevo documento');await input('registro-nitEmisor','12');await until(()=>evaluate(`!!document.getElementById('registro-nitEmisor-nit-0')`),'No encontró NIT parcial');assert.match(await evaluate(`document.getElementById('registro-idProveedor').innerText`),/Seleccionar/);
    await input('registro-nitEmisor','123-1');await until(()=>evaluate(`document.getElementById('registro-idProveedor').innerText.includes('Alfa')`),'No resolvió NIT exacto');
    await supplier('registro-idProveedor',1);assert.equal(await value('registro-nitEmisor'),'456-2');
    await input('registro-nitEmisor','777-7');await until(()=>evaluate(`document.body.innerText.includes('Varias fichas comparten')`),'No detectó NIT ambiguo');assert.match(await evaluate(`document.getElementById('registro-idProveedor').innerText`),/Seleccionar/);
    await key('ArrowDown');await key('Enter');await until(()=>evaluate(`document.getElementById('registro-idProveedor').innerText.includes('Compartido Uno')`),'No seleccionó con teclado');
    await input('registro-nitEmisor','999');await until(()=>evaluate(`document.body.innerText.includes('No hay proveedores con ese NIT')`),'No explicó NIT desconocido');assert.equal(await value('registro-nitEmisor'),'999');
    await supplier('registro-idProveedor',2);await answer('Usar proveedor');assert.equal(await value('registro-nitEmisor'),'');assert.match(await evaluate('document.body.innerText'),/no tiene NIT registrado/);
    await input('registro-nitEmisor','123');await delay(330);await input('registro-nitEmisor','456');await delay(800);assert.equal(await evaluate(`document.getElementById('registro-nitEmisor-nit-0').innerText.includes('Beta')`),true);assert.match(await evaluate(`document.getElementById('registro-idProveedor').innerText`),/sin NIT/);
    await input('registro-nitEmisor','456-2');await until(()=>evaluate(`document.getElementById('registro-idProveedor').innerText.includes('Beta')`),'No resolvió NIT tras respuesta tardía');
    await click('Cerrar',`document.querySelector('[role="dialog"]')`);await answer('Salir sin guardar');
    await navigate('/cxp/facturas-especiales');await click('Nueva factura especial');await supplier('fe-proveedor',0);assert.equal(await value('fe-proveedorNit'),'123-1');assert.equal(await value('fe-proveedorNombre'),'Proveedor Alfa');
    await input('fe-proveedorNit','456-2');await until(()=>evaluate(`document.getElementById('fe-proveedorNombre').value==='Proveedor Beta'`),'No actualizó nombre autocompletado al cambiar NIT');await supplier('fe-proveedor',0);
    await input('fe-proveedorNombre','Nombre específico del comprobante');await supplier('fe-proveedor',1);assert.equal(await value('fe-proveedorNit'),'456-2');assert.equal(await value('fe-proveedorNombre'),'Nombre específico del comprobante');
    await input('fe-proveedorNit','777-7');await until(()=>evaluate(`document.body.innerText.includes('Varias fichas comparten')`),'FE no detectó NIT duplicado');await key('Escape');assert.match(await evaluate(`document.getElementById('fe-proveedor').innerText`),/Seleccionar/);
    await input('fe-proveedorNit','123-1');await until(()=>evaluate(`document.getElementById('fe-proveedor').innerText.includes('Alfa')`),'FE no resolvió NIT');await supplier('fe-proveedor',2);assert.equal(await value('fe-proveedorNit'),'');await input('fe-proveedorCui','1234567890123');
    await click('Cancelar',`document.querySelector('[role="dialog"]')`);await answer('Seguir editando');assert.equal(await value('fe-proveedorCui'),'1234567890123');await click('Cancelar',`document.querySelector('[role="dialog"]')`);await answer('Salir sin guardar');
    await evaluate(`document.querySelector('[aria-label="Editar factura FESP-00000050"]').click()`);await until(()=>evaluate(`!!document.getElementById('fe-proveedorNit')`),'No abrió FE histórica');await delay(300);assert.equal(await value('fe-proveedorNit'),'NIT-HIST-FE');assert.equal(await value('fe-proveedorNombre'),'Nombre histórico de factura');await click('Cancelar',`document.querySelector('[role="dialog"]')`);assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
    await navigate('/cxp/documentos/99');await until(()=>evaluate(`!!document.querySelector('[aria-label="Captura de conceptos"] table')`),'No cargó conceptos');
    await click('Editar cabecera');await until(()=>evaluate(`!!document.getElementById('cxp-nitEmisor')`),'No abrió cabecera');await delay(300);assert.equal(await value('cxp-nitEmisor'),'EMISOR-HIST');await click('Cancelar',`document.querySelector('[role="dialog"]')`);assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
    const disabled=label=>evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)}).disabled`);
    assert.equal(await disabled('Guardar conceptos'),true);assert.equal(await disabled('Guardar y adoptar totales calculados'),false);
    const editLine=async text=>{await evaluate(`document.querySelector('table[aria-label="Conceptos del documento"] tbody button').click()`);await until(()=>evaluate(`!!document.getElementById('concepto-descripcion')`),'No abrió línea');await input('concepto-descripcion',text);};
    await editLine('Cambiar y deshacer');await input('concepto-descripcion','Concepto original');await click('Cancelar',`document.querySelector('[role="dialog"]')`);assert.equal(await evaluate(`!!document.querySelector('[role="alertdialog"]')`),false);
    await editLine('Concepto local');await click('Aplicar línea',`document.querySelector('[role="dialog"]')`);assert.equal(await disabled('Guardar conceptos'),false);
    assert.equal(await evaluate(`(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()`),true);
    await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Guardar conceptos');button.click();button.click();})()`);await until(()=>evaluate(`document.body.innerText.includes('Fallo simulado: captura conservada')`),'No mostró fallo');assert.equal(patches,1);assert.match(await evaluate(`document.querySelector('[aria-label="Conceptos del documento"] tbody').innerText`),/Concepto local/);assert.equal(await disabled('Guardar conceptos'),false);
    await click('Guardar conceptos');await until(()=>evaluate(`document.body.innerText.includes('Todos los conceptos están guardados.')`),'No limpió cambios al guardar');assert.equal(await disabled('Guardar conceptos'),true);assert.equal(await disabled('Guardar y adoptar totales calculados'),false);
    assert.equal(await evaluate(`(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()`),false);
    await click('Guardar y adoptar totales calculados');await answer('Guardar y adoptar');await until(()=>evaluate(`document.body.innerText.includes('Todos los conceptos están guardados.')`),'No adoptó');assert.equal(context.documento.totalNeto,110);assert.equal(await disabled('Guardar y adoptar totales calculados'),true);
    await editLine('Conflicto local');await click('Aplicar línea',`document.querySelector('[role="dialog"]')`);conflictSave=true;await click('Guardar conceptos');await until(()=>evaluate(`document.body.innerText.includes('El documento cambió.')`),'No conservó conflicto');assert.match(await evaluate(`document.querySelector('[aria-label="Conceptos del documento"] tbody').innerText`),/Conflicto local/);
    await click('Recargar conceptos');await answer('Seguir editando');assert.match(await evaluate(`document.querySelector('[aria-label="Conceptos del documento"] tbody').innerText`),/Conflicto local/);await click('Recargar conceptos');await answer('Salir sin guardar');await until(()=>evaluate(`document.querySelector('[aria-label="Conceptos del documento"] tbody').innerText.includes('Cambio externo')`),'No recuperó versión ajena');
    await click('Agregar tributo general');await until(()=>evaluate(`!!document.getElementById('concepto-tributo-opcion')`),'No abrió tributo');await catalog('concepto-tributo-opcion',1);assert.equal(await value('concepto-codigoTributo'),'REF5');assert.equal(await value('concepto-porcentaje'),'');await input('concepto-porcentaje','5');await until(()=>evaluate(`document.getElementById('concepto-monto').value==='5'`),'No calculó 5% sin inventar tasa');await click('Cancelar',`document.querySelector('[role="dialog"]')`);await answer('Salir sin guardar');
    await editLine('Concepto antes del adjunto');await click('Aplicar línea',`document.querySelector('[role="dialog"]')`);
    const fileNode=await send('DOM.getDocument');const fileInput=await send('DOM.querySelector',{nodeId:fileNode.root.nodeId,selector:'#expediente-dte'});await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[path.resolve(client,'../database/oracle/instalacion/fixtures/dte_demo.xml')]});await delay(120);assert.equal(uploads,0);assert.match(await evaluate(`document.querySelector('[aria-label="Adjuntar DTE"]').innerText`),/dte_demo.xml/);
    await click('Adjuntar DTE');await until(()=>evaluate(`document.body.innerText.includes('Fallo simulado al adjuntar')`),'No mostró fallo de adjunto');assert.match(await evaluate(`document.querySelector('[aria-label="Adjuntar DTE"]').innerText`),/dte_demo.xml/);assert.equal(await disabled('Adjuntar DTE'),false);
    await capture('conceptos-y-dte-pendientes');await click('Adjuntar DTE');await until(()=>evaluate(`document.body.innerText.includes('DTE adjuntado.')`),'No confirmó carga');assert.match(await evaluate(`document.querySelector('[aria-label="Conceptos del documento"] tbody').innerText`),/Concepto antes del adjunto/);assert.equal(await disabled('Guardar conceptos'),false);
    await evaluate(`document.querySelector('a[href="/cxp/documentos"]').click()`);await answer('Seguir editando');assert.equal(await evaluate('location.pathname'),'/cxp/documentos/99');
    await click('Guardar conceptos');await until(()=>evaluate(`document.body.innerText.includes('Todos los conceptos están guardados.')`),'No guardó tras adjuntar');
    validationState='APROBADA';await click('Validar documento');await until(()=>evaluate(`document.body.innerText.includes('La comprobación terminó. Estado actual:')`),'No distinguió otra respuesta de validación');assert.equal(await evaluate(`document.body.innerText.includes('Documento validado y enviado a aprobación')`),false);
    context.documento.estado='RECIBIDO';context.editable=true;validationState='PENDIENTE_APROBACION';await send('Page.reload',{ignoreCache:true});await until(()=>evaluate(`!![...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Validar documento')`),'No recargó documento recibido');
    await click('Validar documento');await until(()=>evaluate(`document.body.innerText.includes('Documento validado y enviado a aprobación')`),'No mostró mensaje de aprobación');assert.match(await evaluate('document.body.innerText'),/Un usuario autorizado debe revisarlo/);
    context.documento.estado='PAGADA';context.documento.saldoPendiente=0;context.documento.montoAplicado=110;await send('Page.reload',{ignoreCache:true});await until(()=>evaluate(`document.body.innerText.includes('Historial de pagos y procesos')`),'No priorizó historial pagado');assert.equal(await evaluate(`!!document.getElementById('payment-select')`),false);assert.equal(await evaluate(`document.querySelector('[aria-label="Pagos del documento"]').innerText.includes('debe estar aprobado')`),false);await capture('documento-pagado-historial');
    await navigate('/cxp/documentos');await click('Nuevo documento');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await input('registro-nitEmisor','777-7');await until(()=>evaluate(`document.body.innerText.includes('Varias fichas comparten')`),'No sugirió en móvil');await capture('nit-movil');await key('Escape');await click('Cerrar',`document.querySelector('[role="dialog"]')`);await capture('salir-sin-guardar-movil');await answer('Seguir editando');assert.equal(await value('registro-nitEmisor'),'777-7');await click('Cerrar',`document.querySelector('[role="dialog"]')`);await answer('Salir sin guardar');
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);t.diagnostic('API simulada; capturas: '+artifacts);
  }catch(error){if(evaluate)t.diagnostic(await evaluate('document.body.innerText'));t.diagnostic(JSON.stringify(unexpected));throw error;}
  finally{socket?.close();chrome.kill();dev.kill();api.closeAllConnections();await new Promise(r=>api.close(r));}
});
