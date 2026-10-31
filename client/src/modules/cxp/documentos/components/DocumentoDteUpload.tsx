import { Upload, X } from 'lucide-react';
import { CxpButton } from '../../components/CxpButton';

export function DocumentoDteUpload({file,busy,error,onFile,onUpload,conceptsPending}:{
  file:File|null;busy:boolean;error:string|null;onFile:(file:File|null)=>void;onUpload:()=>void;conceptsPending:boolean;
}){
  return <section aria-label="Adjuntar DTE" className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <label htmlFor="expediente-dte" className="block text-sm font-semibold text-slate-900">DTE en PDF o XML</label>
    <input id="expediente-dte" type="file" disabled={busy} accept=".pdf,.xml,application/pdf,application/xml,text/xml"
      onChange={event=>onFile(event.target.files?.[0]??null)} className="block w-full text-sm text-slate-700" />
    {file&&<><p className="break-all text-sm text-slate-700">Seleccionado: <strong>{file.name}</strong> · Pendiente de adjuntar</p>
      <div className="flex flex-wrap gap-2"><CxpButton variant="secondary" disabled={busy} onClick={()=>document.getElementById('expediente-dte')?.click()}>Reemplazar archivo</CxpButton>
        <CxpButton variant="ghost" icon={X} disabled={busy} onClick={()=>{onFile(null);const input=document.getElementById('expediente-dte') as HTMLInputElement|null;if(input)input.value='';}}>Retirar selección</CxpButton></div></>}
    <p className="text-xs text-slate-600">Seleccionar no carga el archivo. Confirma aquí para adjuntarlo al expediente; no extrae ni sustituye los datos del comprobante.</p>
    {conceptsPending&&<p className="text-xs text-amber-800">Tienes conceptos pendientes. Puedes adjuntar el DTE sin descartarlos; guárdalos antes de validar el documento.</p>}
    <CxpButton icon={Upload} disabled={!file||busy} onClick={onUpload}>{busy?'Adjuntando…':'Adjuntar DTE'}</CxpButton>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
