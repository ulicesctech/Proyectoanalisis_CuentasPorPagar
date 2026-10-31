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

test('CXP: administracion por tarea, permisos, cierre estricto y pantallas estrechas', {skip:!browser,timeout:180000}, async t=>{
  const artifacts=path.join(client,'node_modules/.cache/cxp-administracion-browser',String(Date.now()));await mkdir(artifacts,{recursive:true});
  const errors=[],unexpected=[],writes=[],queries=[];
  let kind='approver',failEdit=true,failClose=true;
  const actors={approver:{id:2,nombre:'Aprobadora de prueba',nombreRol:'APROBADOR_CXP',roles:[3],permisos:['APROBAR']},operator:{id:1,nombre:'Operador de prueba',nombreRol:'OPERADOR_CXP',roles:[2],permisos:['CREAR']},maker:{id:5,nombre:'Tesorería elaboradora',nombreRol:'TESORERIA_CXP',roles:[4],permisos:['TESORERIA']},closer:{id:4,nombre:'Tesorería revisora',nombreRol:'TESORERIA_CXP',roles:[4],permisos:['TESORERIA']}};
  const data={
    parametros:[{idParametro:1,grupoParametro:'CXP_FACTURA_ESPECIAL',codigo:'SERIE',nombre:'Serie de facturas especiales',valorTexto:'FESP',valorNumero:null,activo:'S',modificadoPor:2},{idParametro:2,grupoParametro:'CXP_FACTURA_ESPECIAL',codigo:'CORRELATIVO_FACTURA',nombre:'Numeración utilizada',valorNumero:80,activo:'S'},{idParametro:3,grupoParametro:'CXP_FE_APROBADOR_ROL',codigo:'ROL_APROBADOR',nombre:'Rol aprobador de facturas',valorNumero:3,activo:'S'}],
    'reglas-aprobacion':[{idRegla:1,nombreRegla:'Revisión de documentos',tipoEntidad:'DOCUMENTO',idRolAprobador:3,nivel:1,montoDesde:0,montoHasta:10000,moneda:'GTQ',activa:'S'}],
    aprobaciones:[{idAprobacion:1,idRegla:1,idDocumento:101,idRolAprobador:3,nivel:1,estado:'APROBADA',fechaDecision:'2026-10-30'}],
    eventos:[{idEvento:1,asunto:'Aplicación registrada',tipoEvento:'APLICACION',estado:'COMPLETADO',prioridad:'NORMAL',usuarioEvento:1,fechaEvento:'2026-10-30',idDocumento:101}],
    archivos:[{idArchivo:1,nombreArchivo:'factura-ejemplo.xml',categoria:'DTE',idDocumento:101,versionArchivo:1,fechaCarga:'2026-10-30'}],
    periodos:[{idPeriodo:1,idSucursal:1,anio:2026,mes:10,fechaInicio:'2026-10-01',fechaFin:'2026-10-31',estado:'ABIERTO',totalDocumentos:0,totalAplicaciones:0}],
    'cuentas-bancarias':[{idCuentaBancaria:1,tipoTitular:'PROVEEDOR',idProveedor:1,bancoNombre:'Banco de prueba',titular:'Proveedor Alfa',numeroCuenta:'SIM-0001',tipoCuenta:'MONETARIA',moneda:'GTQ',estadoAprobacion:'PENDIENTE',estado:'ACTIVA',creadoPor:1}],
    compromisos:[{idCompromiso:1,numeroReferencia:'FONDO-SIM',descripcion:'Fondo de comprobación',tipoCompromiso:'FONDO_CAJA_CHICA',idProveedor:1,idSucursal:1,moneda:'GTQ',montoTotal:500,saldoCapital:425,responsablePor:1,estado:'ACTIVO'}],
    'conciliaciones-proveedor':[],'conciliaciones-proveedor-detalle':[],
    'conciliaciones-pago':[{idConciliacionPago:1,idPago:8,idCuentaBancaria:1,referenciaMovimiento:'EXTRACTO-SIM',fechaMovimiento:'2026-10-30',montoSistema:300,montoBanco:300,diferenciaMonto:0,estado:'PENDIENTE',tipoCoincidencia:'MANUAL'}],
  };
  const idFields={parametros:'idParametro','reglas-aprobacion':'idRegla',aprobaciones:'idAprobacion',eventos:'idEvento',archivos:'idArchivo',periodos:'idPeriodo','cuentas-bancarias':'idCuentaBancaria',compromisos:'idCompromiso','conciliaciones-proveedor':'idConciliacionProv','conciliaciones-proveedor-detalle':'idDetConciliacion','conciliaciones-pago':'idConciliacionPago'};
  const row=registro=>({registro,etiquetas:{idSucursal:'Sucursal Central',idProveedor:'Proveedor Alfa',idRolAprobador:'APROBADOR_CXP',usuarioEvento:'Operador de prueba',responsablePor:'Operador de prueba',creadoPor:'Operador de prueba',idDocumento:'SIM · FACT-101',idPago:'CP-00000008',...(registro.codigo==='ROL_APROBADOR'?{valorNumero:'APROBADOR_CXP'}:{})}});
  const lines=()=>data['conciliaciones-proveedor-detalle'];
  const issues=()=>lines().filter(l=>l.resultado!=='COINCIDE'||l.montoEmpresa!==l.montoProveedor).map(l=>`Detalle #${l.idDetConciliacion}: revisa importe y fecha; ${l.resultado}.`);
  const api=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin??'*');res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');res.setHeader('Content-Type','application/json');
    if(req.method==='OPTIONS'){res.end();return;}
    const url=new URL(req.url,'http://localhost'),p=url.pathname,json=v=>res.end(JSON.stringify(v));let body;
    if(req.method!=='GET'){let raw='';for await(const bytes of req)raw+=bytes;body=JSON.parse(raw||'{}');writes.push({p,body});}
    if(p==='/api/auth/session')return json({username:'cuenta-simulada',name:actors[kind].nombre,mustChangePassword:false,actor:actors[kind],csrfToken:'token-simulado'});
    if(p==='/api/cxp/administracion/permisos')return json({configuracion:kind==='approver',periodos:kind==='approver',registrarCuenta:kind==='operator',decidirCuenta:kind==='approver',registrarCompromiso:kind==='operator',elaborarConciliacion:['maker','closer'].includes(kind),cerrarConciliacion:['maker','closer'].includes(kind)});
    if(p.startsWith('/api/cxp/catalogos/')){const catalog=p.split('/').pop();return json([{id:catalog==='roles'?3:catalog==='pagos'?8:1,label:catalog==='roles'?'APROBADOR_CXP':catalog==='proveedores'?'Proveedor Alfa':catalog==='pagos'?'CP-00000008':'Sucursal Central'}]);}
    if(p==='/api/cxp/facturas-especiales/configuracion')return json({fechaDocumento:'2026-10-30',moneda:'GTQ',serie:'FESP',puedeRegistrar:true,impedimentos:[],advertencias:[],reglasVigentes:2});
    if(p==='/api/cxp/administracion/periodos/consulta')return json({idSucursal:1,fecha:'2026-10-30',disponible:false,motivo:'Hay 2 períodos superpuestos; debe existir exactamente uno, incluso si alguno está cerrado.',periodos:[{idPeriodo:1,estado:'ABIERTO',fechaInicio:'2026-10-01',fechaFin:'2026-10-31'},{idPeriodo:2,estado:'CERRADO',fechaInicio:'2026-10-30',fechaFin:'2026-11-01'}]});
    if(p==='/api/cxp/administracion/conciliaciones-proveedor/fuentes')return json({moneda:'GTQ',base:'Saldo actual',saldoEmpresa:300,saldoProveedor:300,diferencia:0,fuentes:[100,200].map((monto,i)=>({titulo:'2026-10-30',referencia:'FACT-'+(101+i),estado:'RECIBIDA',moneda:'GTQ',monto})),avisos:['Saldo actual; no reconstruye un saldo contable histórico.']});
    if(p==='/api/cxp/administracion/conciliaciones-proveedor/preparar'){
      data['conciliaciones-proveedor']=[{idConciliacionProv:1,idProveedor:1,periodoDesde:'2026-10-01',periodoHasta:'2026-10-30',saldoEmpresa:300,saldoProveedor:300,diferencia:0,estado:'BORRADOR',elaboradaPor:5}];
      data['conciliaciones-proveedor-detalle']=[100,200].map((montoEmpresa,i)=>({idDetConciliacion:i+1,idConciliacionProv:1,idDocumento:101+i,tipoRegistro:'DOCUMENTO',fechaEmpresa:'2026-10-30',montoEmpresa,montoProveedor:null,fechaProveedor:null,diferencia:montoEmpresa,resultado:'EN_REVISION'}));return json(data['conciliaciones-proveedor'][0]);
    }
    const match=p.match(/^\/api\/cxp\/administracion\/([^/]+)(?:\/(\d+))?(?:\/([^/]+))?$/);
    if(match&&data[match[1]]){
      const [,resource,rawId,action]=match,id=Number(rawId),record=data[resource].find(r=>r[idFields[resource]]===id);
      if(req.method==='GET'&&!rawId){queries.push(url);let records=data[resource];if(url.searchParams.get('search')==='SIN-RESULTADO')records=[];return json({data:records.map(row),meta:{page:1,limit:20,total:records.length,totalPages:1}});}
      if(req.method==='GET'&&record){const hechos=[],avisos=[],relacionados=[];
        if(resource==='reglas-aprobacion')hechos.push({nombre:'Solicitudes o decisiones vinculadas',valor:'1'});
        if(resource==='cuentas-bancarias')avisos.push('No hay una cuenta compatible en Bancos. Registrar o aprobar la cuenta CXP no la crea allí.');
        if(resource==='compromisos'){hechos.push({nombre:'Importe comprometido',valor:'500 GTQ'},{nombre:'Disponible del fondo',valor:'425 GTQ'},{nombre:'Importe utilizado del fondo',valor:'75 GTQ'});}
        if(['aprobaciones','eventos','archivos','compromisos'].includes(resource))relacionados.push({titulo:'Documento',referencia:'SIM · FACT-101',ruta:'/cxp/documentos/101',moneda:'GTQ',monto:300,estado:'RECIBIDA'});
        return json({item:row(record),version:'version-'+resource,hechos,avisos,relacionados,...(resource==='conciliaciones-proveedor'?{conciliacion:{lineas:lines(),moneda:'GTQ',impedimentos:issues()}}:{})});}
      if(req.method==='PATCH'&&record){if(failEdit){failEdit=false;res.statusCode=503;return json({error:'No se pudo guardar; vuelve a intentarlo.'});}Object.assign(record,body.cambios);return json(record);}
      if(req.method==='POST'&&!rawId){const created={...body,[idFields[resource]]:data[resource].length+1,...(resource==='periodos'?{estado:'ABIERTO',anio:2027,mes:1}:{})};data[resource].push(created);return json(created);}
      if(resource==='periodos'&&action){record.estado=action==='cerrar'?'CERRADO':action==='reabrir'?'REABIERTO':'EN_CIERRE';return json(record);}
      if(resource==='cuentas-bancarias'&&action){record.estadoAprobacion=action==='aprobar'?'APROBADA':'RECHAZADA';return json(record);}
      if(resource==='conciliaciones-proveedor'&&action==='comparar'){const line=lines().find(l=>l.idDetConciliacion===body.idDetalle);Object.assign(line,body);line.diferencia=line.montoEmpresa-line.montoProveedor;line.resultado=line.diferencia===0&&line.fechaEmpresa===line.fechaProveedor?'COINCIDE':'DIFERENCIA_MONTO';record.estado=issues().length?'EN_REVISION':'CONCILIADA';return json(record);}
      if(resource==='conciliaciones-proveedor'&&action==='cerrar'){if(failClose){failClose=false;res.statusCode=409;return json({error:'La conciliación cambió; revisa antes de cerrar.'});}assert.equal(issues().length,0);assert.equal(kind,'closer');record.estado='CERRADA';return json(record);}
    }
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
    const navigate = async route => { await send('Page.navigate', { url: `http://127.0.0.1:${port}${route}` }); await until(() => evaluate(`!!document.querySelector('h1')`), 'No cargó ' + route); await evaluate(`window.confirmations=[];window.acceptChoice=false;window.confirm=message=>{window.confirmations.push(message);return window.acceptChoice;}`); };
    const capture = async name => { await delay(380); const shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(path.join(artifacts, name + '.png'), Buffer.from(shot.data, 'base64')); };
    const catalog = async (id, index = 0) => { await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`); await until(() => evaluate(`!!document.getElementById(${JSON.stringify(id + '-option-' + index)})`), 'No cargó catálogo ' + id); await evaluate(`document.getElementById(${JSON.stringify(id + '-option-' + index)}).click()`); await delay(100); };



    const top=`[...document.querySelectorAll('[role="dialog"]')].at(-1)`;
    const dialogCount=()=>evaluate(`document.querySelectorAll('[role="dialog"]').length`);
    const waitText=text=>until(()=>evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`),'No mostró '+text);
    const detail=async(index=0)=>{await until(()=>evaluate(`document.querySelectorAll('button[aria-label^="Ver detalle"]').length>${index}`),'Sin detalle');await evaluate(`document.querySelectorAll('button[aria-label^="Ver detalle"]')[${index}].click()`);await until(()=>evaluate(`!!document.querySelector('[role="dialog"] details')`),'No cargó detalle');};
    const closeDetail=async()=>{await click('Cerrar',top);await until(()=>dialogCount().then(n=>n===0),'No cerró detalle');};
    const narrow=async name=>{await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await capture(name+'-movil');assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'Desbordamiento de página: '+name);await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});};
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await navigate('/cxp/parametros');await waitText('Serie de facturas especiales');await click('Comprobar configuración de facturas especiales');await waitText('Serie FESP');
    await input('admin-grupoParametro','CXP_FACTURA_ESPECIAL');await input('admin-activo','S');await input('admin-buscar','Serie');await until(()=>Promise.resolve(queries.some(q=>q.searchParams.get('grupoParametro')==='CXP_FACTURA_ESPECIAL'&&q.searchParams.get('activo')==='S'&&q.searchParams.get('search')==='Serie')),'No combinó filtros');await click('Limpiar filtros');
    await detail(0);await click('Editar configuración');await until(()=>evaluate(`!!document.getElementById('cxp-valorTexto')`),'No abrió editor');assert.equal(await evaluate(`!!document.getElementById('cxp-creadoPor')`),false);await input('cxp-valorTexto','FESP-NUEVA');await click('Guardar configuración',top);await waitText('No se pudo guardar');assert.equal(await value('cxp-valorTexto'),'FESP-NUEVA');await click('Guardar configuración',top);await until(()=>dialogCount().then(n=>n===1),'No terminó edición');await waitText('FESP-NUEVA');await capture('parametros-escritorio');await narrow('parametros');await closeDetail();
    await detail(1);assert.equal(await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].some(b=>b.textContent==='Editar configuración')`),false);await closeDetail();
    await detail(2);await click('Editar configuración');await until(()=>evaluate(`!!document.getElementById('cxp-valorNumero')`),'Sin selector de rol');assert.equal(await evaluate(`document.getElementById('cxp-valorNumero').getAttribute('role')`),'combobox');await click('Cancelar',top);await closeDetail();
    await click('Nuevo parámetro');await input('cxp-grupoParametro','PENDIENTE');await click('Cancelar',top);await waitText('Salir sin guardar');await click('Seguir editando',`document.querySelector('[role="alertdialog"]')`);assert.equal(await value('cxp-grupoParametro'),'PENDIENTE');await click('Cancelar',top);await click('Salir sin guardar',`document.querySelector('[role="alertdialog"]')`);await until(()=>dialogCount().then(n=>n===0),'No descartó captura');
    await navigate('/cxp/eventos');await waitText('Aplicación registrada');assert.equal(await evaluate(`document.body.innerText.includes('Nuevo registro')`),false);await detail();assert.equal(await evaluate(`!!document.querySelector('a[href="/cxp/documentos/101"]')`),true);await capture('control-escritorio');await narrow('control');await closeDetail();
    for(const route of ['/cxp/aprobaciones/registros','/cxp/archivos','/cxp/reglas-aprobacion']){await navigate(route);await detail();if(route.includes('reglas'))assert.equal(await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent==='Editar configuración').disabled`),true);await closeDetail();}
    await navigate('/cxp/periodos');await catalog('periodo-consulta-sucursal');await click('Comprobar cobertura');await waitText('2 períodos superpuestos');await click('Crear y abrir período');await until(()=>evaluate(`!!document.getElementById('cxp-fechaInicio')`),'No abrió período');assert.equal(await evaluate(`!!document.getElementById('cxp-anio')||!!document.getElementById('cxp-totalDocumentos')||!!document.getElementById('cxp-estado')`),false);await catalog('cxp-idSucursal');await input('cxp-fechaInicio','2027-01-01');await input('cxp-fechaFin','2027-01-31');await click('Crear y abrir período',top);await until(()=>dialogCount().then(n=>n===0),'No creó período');await detail(0);await click('Cerrar período');await click('Cerrar período',top);await until(()=>dialogCount().then(n=>n===1),'No cerró período');await waitText('Reabrir período');await click('Reabrir período');assert.equal(await evaluate(`[...${top}.querySelectorAll('button')].find(b=>b.textContent==='Reabrir período').disabled`),true);await input('admin-motivo','Reapertura documentada');await click('Reabrir período',top);await until(()=>dialogCount().then(n=>n===1),'No reabrió período');await waitText('REABIERTO');await capture('periodos-escritorio');await narrow('periodos');await closeDetail();
    await navigate('/cxp/cuentas-bancarias');await detail();await click('Aprobar cuenta CXP');assert.equal(await evaluate(`[...${top}.querySelectorAll('button')].find(b=>b.textContent==='Aprobar cuenta CXP').disabled`),true);await evaluate(`${top}.querySelector('input[type="checkbox"]').click()`);await click('Aprobar cuenta CXP',top);await until(()=>dialogCount().then(n=>n===1),'No aprobó cuenta');await waitText('APROBADA');await waitText('No hay una cuenta compatible en Bancos');await capture('cuentas-escritorio');await narrow('cuentas');await closeDetail();
    kind='operator';await navigate('/cxp/cuentas-bancarias');await click('Registrar cuenta');await until(()=>evaluate(`!!document.getElementById('cxp-numeroCuenta')`),'No abrió cuenta');assert.equal(await evaluate(`!!document.getElementById('cxp-estadoAprobacion')||!!document.getElementById('cxp-aprobadoPor')`),false);await capture('cuenta-captura');await click('Cancelar',top);
    await navigate('/cxp/parametros');await waitText('FESP-NUEVA');assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Nuevo parámetro')`),false);
    await navigate('/cxp/compromisos');await detail();await waitText('75 GTQ');assert.equal(await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].some(b=>/Eliminar|Editar|Cancelar compromiso/.test(b.textContent))`),false);await capture('compromisos-escritorio');await narrow('compromisos');await closeDetail();await input('admin-buscar','SIN-RESULTADO');await waitText('No hay compromisos con esos filtros');
    kind='maker';await navigate('/cxp/conciliaciones-proveedor');await catalog('conciliar-proveedor');await input('conciliar-saldo-proveedor','300');await click('Consultar fuentes');await waitText('Saldo empresa 300 GTQ');await click('Preparar conciliación');await waitText('Conciliación preparada');await detail();await waitText('Debe cerrar otra persona');assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Cerrar conciliación').disabled`),true);
    const compare=async(index,amount)=>{await evaluate(`[...document.querySelectorAll('button')].filter(b=>b.textContent==='Registrar comparación')[${index}].click()`);await until(()=>evaluate(`!!document.getElementById('cxp-montoProveedor')`),'No abrió comparación');await input('cxp-montoProveedor',String(amount));await input('cxp-fechaProveedor','2026-10-30');await input('cxp-referenciaProveedor','EXT-'+(index+1));await click('Registrar comparación',top);await until(()=>dialogCount().then(n=>n===1),'No guardó comparación');await delay(200);};
    await compare(0,100);await compare(1,190);await waitText('DIFERENCIA_MONTO');await capture('conciliacion-pendiente');await closeDetail();
    kind='closer';await navigate('/cxp/conciliaciones-proveedor');await detail();assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Cerrar conciliación').disabled`),true);await compare(1,200);await until(()=>evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Cerrar conciliación'&&!b.disabled)`),'No habilitó cierre estricto');await capture('conciliacion-escritorio');await narrow('conciliacion');await click('Cerrar conciliación');await input('admin-motivo','Revisado por otra persona');await click('Cerrar conciliación',top);await waitText('La conciliación cambió');assert.equal(await value('admin-motivo'),'Revisado por otra persona');await click('Cerrar conciliación',top);await until(()=>dialogCount().then(n=>n===1),'No cerró conciliación');await waitText('CERRADA');assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Registrar comparación')`),false);await closeDetail();
    for(const route of ['/cxp/conciliaciones-proveedor-detalle','/cxp/conciliaciones-pago']){await navigate(route);await detail();await closeDetail();}
    assert.equal(await evaluate(`!!document.querySelector('a[href="/cxp"]')`),true);
    for(const request of writes){assert.equal('creadoPor'in request.body,false);assert.equal('saldoCapital'in request.body,false);assert.equal('usuarioCierre'in request.body,false);}
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
    await writeFile(path.join(artifacts,'resultado.json'),JSON.stringify({writes,queries:queries.map(q=>q.pathname+q.search),errors,unexpected},null,2));t.diagnostic('Capturas: '+artifacts);
  }catch(error){if(evaluate)t.diagnostic(await evaluate('document.body.innerText'));t.diagnostic(JSON.stringify(unexpected));throw error;}
  finally{socket?.close();chrome.kill();dev.kill();api.closeAllConnections();await new Promise(r=>api.close(r));}
});
