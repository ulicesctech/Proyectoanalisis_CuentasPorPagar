import type {
  ActorProceso,
  BandejaProceso,
  CxpRecord,
  CxpResource,
  FormaPagoProceso,
  ListaProcesos,
  NuevaContrasena,
  OpcionChequeProceso,
  OpcionesProceso,
  ProcesoPago,
} from '@erp/contracts';

export interface ProcesoTx {
  providerName(id: number): Promise<string>;
  cheques(p: ProcesoPago): Promise<OpcionChequeProceso[]>;
  get(id: number): Promise<ProcesoPago>;
  byKey(key: string): Promise<ProcesoPago | null>;
  insert(p: ProcesoPago, input: NuevaContrasena): Promise<number>;
  save(p: ProcesoPago): Promise<void>;
  reserve(p: ProcesoPago): Promise<void>;
  release(p: ProcesoPago): Promise<void>;
  row(resource: CxpResource, id: number): Promise<CxpRecord>;
  create(resource: CxpResource, input: CxpRecord): Promise<number>;
  update(resource: CxpResource, id: number, input: CxpRecord): Promise<void>;
  rules(): Promise<CxpRecord[]>;
  openPeriod(branch: number, date: string): Promise<void>;
  actorExists(actor: ActorProceso): Promise<void>;
  paymentMethod(id: number): Promise<FormaPagoProceso>;
  bankIssue(p: ProcesoPago, actor: ActorProceso): Promise<Pick<ProcesoPago, 'cheque' | 'transferencia'>>;
  bankAdvance(
    p: ProcesoPago,
    actor: ActorProceso,
    action: 'EJECUTAR' | 'CONFIRMAR' | 'ANULAR',
  ): Promise<Pick<ProcesoPago, 'cheque' | 'transferencia'>>;
  apply(p: ProcesoPago, actor: ActorProceso, now: string): Promise<number[]>;
  reverse(p: ProcesoPago, actor: ActorProceso, now: string, reason: string): Promise<void>;
}

export interface ProcesoStore {
  transaction<T>(fn: (tx: ProcesoTx) => Promise<T>): Promise<T>;
  list(page: number, bandeja?: BandejaProceso, estado?: string): Promise<ListaProcesos>;
  options(search?: string, proveedor?: number): Promise<OpcionesProceso>;
}
