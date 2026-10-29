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

test('captura operativa: aceptación, edición, recuperación, tributos generales y eliminación', {skip: !browser, timeout: 120000}, async t => {
  const artifacts=path.join(client,'node_modules/.cache/componentes-browser',String(Date.now())); await mkdir(artifacts,{recursive:true});
  const writes=[],unexpected=[],runtimeErrors=[];
  const {createRequire}=await import('node:module'); const require=createRequire(import.meta.url);
  const {calcularDocumentoComponentes,componenteLineaDatos,componenteTributoDatos,documentoComponentesSchema}=require('@erp/contracts');
  let context={ documento:{idDocumento:99,idProveedor:1,idSucursal:1,creadoPor:7,estado:'RECIBIDO',tipoDocumento:'FACTURA',naturaleza:'D',serie:'A',numeroDocumento:'COMP-PRUEBA',origenIngreso:'FACTURACION_ELECTRONICA',fechaDocumento:'2026-09-01',fechaVencimiento:'2026-09-01',fechaRecepcion:'2026-09-01T10:00:00',diasCredito:0,moneda:'GTQ',tipoCambio:1,subtotal:600,descuentoTotal:50,impuestoTotal:0,retencionTotal:0,totalNeto:550,totalBruto:550,totalLocal:550,montoAplicado:0,saldoPendiente:550},
    version:'a'.repeat(64), lineas:[], tributos:[], editable:true,catalogo:[],advertencias:[],adoptarTotales:false,confirmarEliminaciones:[]};
  let nextLine=1,nextTax=1;
  const api=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin??'*');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token');res.setHeader('Access-Control-Allow-Methods','GET,PATCH,OPTIONS');res.setHeader('Content-Type','application/json');
    if(req.method==='OPTIONS'){res.end();return;} const url=new URL(req.url,'http://localhost'); const json=value=>res.end(JSON.stringify(value));
    if(url.pathname==='/api/auth/session')return json({username:'operador.simulado',name:'Operador simulado',mustChangePassword:false,actor:{id:7,nombre:'Operador simulado',roles:[1],permisos:['CREAR']},csrfToken:'prueba'});
    if(url.pathname==='/api/cxp/documentos/99/componentes'){
      if(req.method==='GET')return json(context);
      let raw='';for await(const bytes of req)raw+=bytes;const input=documentoComponentesSchema.parse(JSON.parse(raw));writes.push(input);
      const calculated=calcularDocumentoComponentes(context.documento,input.lineas,input.tributos);
      if(calculated.issues.length){res.statusCode=422;return json({error:'Revisión pendiente',details:calculated.issues});}
      const assigned=new Map();const lineas=calculated.lineas.map(line=>{const id=line.idDetalle??nextLine++;assigned.set(line.clave,'linea-'+id);return{clave:'linea-'+id,idDetalle:id,numeroLinea:line.numeroLinea??id,datos:componenteLineaDatos.parse(Object.fromEntries(Object.keys(componenteLineaDatos.shape).map(key=>[key,line.datos[key]])))}});
      const tributos=calculated.tributos.map(tax=>{const id=tax.idTributo??nextTax++;return{clave:'tributo-'+id,idTributo:id,linea:tax.linea===null?null:assigned.get(tax.linea),calculo:tax.calculo,base:tax.base,tratamiento:tax.tratamiento,baseRevisadaPara:tax.referencia,datos:componenteTributoDatos.parse(tax.datos)}});
      context={...context,documento:input.adoptarTotales?calculated.totales:context.documento,lineas,tributos,version:String(writes.length).repeat(64)};return json(context);
    }
    if(url.pathname==='/api/cxp/documentos/99/expediente'){const calc=calcularDocumentoComponentes(context.documento,context.lineas,context.tributos);return json({documento:{...context.documento,proveedorNombre:'Proveedor simulado',sucursalNombre:'Sucursal simulada'},lineas:calc.lineas.map(row=>({...row.datos,idDetalle:row.idDetalle,numeroLinea:row.numeroLinea})),tributos:calc.tributos.map(row=>({...row.datos,idTributo:row.idTributo})),archivos:[],aplicaciones:[]});}
    if(url.pathname==='/api/cxp/documentos/99/aprobacion')return json({reglas:[],decisiones:[],actor:null});
    if(url.pathname==='/api/cxp/documentos/99/archivos')return json([]);
    if(url.pathname==='/api/cxp/documentos/99/pagos-disponibles')return json([]);
    if(url.pathname.startsWith('/api/cxp/catalogos/'))return json([{id:1,label:'Proveedor simulado'}]);
    unexpected.push(req.method+' '+url.pathname);res.statusCode=404;json({error:'Ruta no simulada'});
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  // Sin --force de prueba: la configuración real debe invalidar los contratos CJS anteriores.
  const dev = spawn(process.execPath, [path.join(client, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: client, windowsHide: true, stdio: 'pipe', env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` },
  });
  let output = ''; dev.stdout.on('data', bytes => { output += bytes; }); dev.stderr.on('data', bytes => { output += bytes; });
  const profile = path.join(artifacts, 'profile');
  const chrome = spawn(browser, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, '--window-size=1440,1100', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    await until(async () => { if (dev.exitCode !== null) throw new Error(output); try { return (await fetch(`http://127.0.0.1:${port}`)).ok; } catch { return false; } }, 'Vite no inició');
    const debug = await until(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return false; } }, 'Chrome no inició CDP');
    const pages = await (await fetch(`http://127.0.0.1:${debug}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl); await once(socket, 'open');
    const send = connect(socket);
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') {
        const error = message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text;
        runtimeErrors.push(error); t.diagnostic(error);
      }
    });
    await send('Runtime.enable');
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const input = async (id, value, blur = false) => {
      await evaluate(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus();
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
      await delay(60);
      if (blur) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
        await delay(60);
      }
    };
    const invalid = id => evaluate(`document.getElementById(${JSON.stringify(id)})?.getAttribute('aria-invalid') === 'true'`);
    const value = id => evaluate(`document.getElementById(${JSON.stringify(id)})?.value`);
    const click = async text => { await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}).click()`); await delay(80); };
    const catalog = async id => {
      await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
      await until(() => evaluate(`!!document.querySelector('#${id}-option-0')`), `No cargó ${id}`);
      await evaluate(`document.querySelector('#${id}-option-0').click()`); await delay(60);
    };
    const capture = async name => {
      const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(path.join(artifacts, name + '.png'), Buffer.from(image.data, 'base64'));
    };
    await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/cxp/documentos/99'});
    await until(()=>evaluate(`!!document.querySelector('[aria-label="Captura de conceptos"] table')`),'No abrió conceptos');
    await evaluate('window.confirm=()=>true');
    const button=async(text,scope='document')=>{await evaluate('[...'+scope+'.querySelectorAll("button")].find(el=>el.textContent.trim()==='+JSON.stringify(text)+').click()');await delay(100)};
    const rowAction=async(name,text)=>{await evaluate(`([...document.querySelectorAll('table[aria-label="Conceptos del documento"] tbody tr')].find(row=>row.textContent.includes(${JSON.stringify(name)}))).querySelectorAll('button')[${({'Editar':0,'Agregar tributo':1,'Quitar':2}[text])}].click()`);await delay(100)};
    const taxAction=async(index)=>{await evaluate(`document.querySelectorAll('table[aria-label="Tributos de conceptos"] tbody tr')[${index}].querySelector('button').click()`);await delay(100)};
    const addLine=async(name,quantity,price,discount)=>{await button('Agregar línea');await input('concepto-descripcion',name,true);await input('concepto-cantidad',quantity,true);await input('concepto-precioUnitario',price,true);await input('concepto-descuento',discount,true);await click('Aplicar línea');};
    const addTax=async(name)=>{await rowAction(name,'Agregar tributo');assert.match(await evaluate('document.getElementById("concepto-aplicacion").selectedOptions[0].textContent'),new RegExp(name));await input('concepto-codigoTributo','PRUEBA10',true);await input('concepto-nombreTributo','Impuesto ficticio 10 %',true);await input('concepto-porcentaje','10',true);assert.equal(await value('concepto-monto'),name==='Teclados'?'30':'25');assert.equal(await evaluate('document.getElementById("concepto-monto").disabled'),true);await capture('formulario-tributo');await click('Aplicar tributo');};
    await button('Agregar línea');assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"] nav').length`),0);
    await input('concepto-cantidad','-1');assert.equal(await invalid('concepto-cantidad'),true);
    await click('Aplicar línea');assert.equal(await invalid('concepto-descripcion'),true);assert.equal(writes.length,0);await click('Cancelar');
    await addLine('Teclados','2','150','0');await addTax('Teclados');await addLine('Mouse','3','100','50');await addTax('Mouse');
    assert.equal(writes.length,0);await evaluate(`document.getElementById('conceptos-documento').scrollIntoView({block:'start'})`);await capture('aceptacion-antes-guardar');
    assert.match(await evaluate(`document.querySelector('table[aria-label="Declarado y calculado"]').textContent`),/GTQ 605.00/);
    await button('Guardar conceptos');await until(()=>writes.length===1,'No guardó conceptos');await until(()=>evaluate(`!!document.querySelector('table[aria-label="Conceptos del documento"] tbody tr')`),'No recargó conceptos');
    assert.equal(context.documento.totalNeto,550);assert.equal(writes[0].tributos[0].datos.monto,30);assert.equal(Object.hasOwn(writes[0].tributos[0].datos,'generadoPor'),false);assert.equal(Object.hasOwn(writes[0].lineas[0].datos,'impuesto'),false);
    await button('Guardar y adoptar totales calculados');await until(()=>writes.length===2,'No adoptó totales');await until(()=>evaluate(`!!document.querySelector('table[aria-label="Conceptos del documento"] tbody tr')`),'No recargó declaración');assert.equal(context.documento.totalNeto,605);
    await taxAction(0);await input('concepto-tratamiento','RECUPERABLE',true);await click('Aplicar tributo');
    await taxAction(0);await input('concepto-tratamiento','PARCIAL',true);await input('concepto-montoRecuperable','12',true);await input('concepto-montoNoRecuperable','18',true);await click('Aplicar tributo');
    await rowAction('Teclados','Editar');await input('concepto-cantidad','3',true);await capture('formulario-linea');await click('Aplicar línea');assert.match(await evaluate(`document.querySelector('[aria-label="Captura de conceptos"]').textContent`),/deben sumar el monto/);
    await taxAction(0);await input('concepto-montoRecuperable','20',true);await input('concepto-montoNoRecuperable','25',true);await click('Aplicar tributo');
    await button('Agregar tributo general');await input('concepto-tipoTributo','RETENCION',true);assert.equal(await evaluate('document.getElementById("concepto-tratamiento")===null'),true);await input('concepto-codigoTributo','RET-PRUEBA',true);await input('concepto-nombreTributo','Retención ficticia 5 %',true);await input('concepto-porcentaje','5',true);assert.equal(await value('concepto-monto'),'35');await click('Aplicar tributo');
    await button('Agregar tributo general');await input('concepto-codigoTributo','INC-PRUEBA',true);await input('concepto-nombreTributo','Impuesto incluido prueba',true);await input('concepto-porcentaje','10',true);await input('concepto-incluidoPrecio','S',true);await click('Aplicar tributo');assert.match(await evaluate(`document.querySelector('[aria-label="Captura de conceptos"]').textContent`),/incluidos en precio/);
    await evaluate(`document.querySelectorAll('table[aria-label="Tributos de conceptos"] tbody tr')[3].querySelectorAll('button')[1].click()`);await delay(80);
    await rowAction('Mouse','Quitar');assert.equal(await evaluate(`document.querySelectorAll('table[aria-label="Conceptos del documento"] tbody tr').length`),1);assert.equal(await evaluate(`document.querySelectorAll('table[aria-label="Tributos de conceptos"] tbody tr').length`),2);
    await evaluate(`document.getElementById('conceptos-documento').scrollIntoView({block:'start'})`);await capture('edicion-parcial-retencion-y-eliminacion');await button('Guardar y adoptar totales calculados');await until(()=>writes.length===3,'No guardó edición');assert.deepEqual(writes[2].confirmarEliminaciones,[2]);assert.equal(context.documento.totalNeto,472.5);assert.equal(context.tributos[0].datos.montoRecuperable,20);assert.equal(context.tributos[0].datos.montoNoRecuperable,25);
    await send('Page.reload',{ignoreCache:true});await until(()=>evaluate(`document.querySelector('table[aria-label="Declarado y calculado"]')?.textContent.includes('472.50')`),'No conservó totales al recargar');
    context.documento.estado='APROBADA';context.editable=false;await send('Page.reload',{ignoreCache:true});await until(()=>evaluate(`document.querySelector('[aria-label="Captura de conceptos"]')?.textContent.includes('Consulta de conceptos')`),'No aplicó solo lectura');assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Agregar línea')`),false);
    assert.deepEqual(unexpected,[]);assert.deepEqual(runtimeErrors,[]);t.diagnostic('Capturas: '+artifacts+'. Datos y API simulados.');
  } finally {socket?.close();chrome.kill();dev.kill();api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
});
