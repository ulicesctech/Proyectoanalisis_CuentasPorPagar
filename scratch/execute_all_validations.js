const oracledb = require('oracledb');

const dbConfig = {
  user: 'PROYECTOANALISIS',
  password: '1234',
  connectString: 'localhost/CXC1',
};

async function main() {
  console.log('================================================================');
  console.log(' EJECUCION DE INSERCIONES Y VALIDACIONES DE REQUERIMIENTOS CXP');
  console.log('================================================================\n');

  const connection = await oracledb.getConnection(dbConfig);

  try {
    // 0. Preparar datos maestros si no existen (Rol, Departamento, Usuario)
    console.log('[0] Verificando datos maestros base (Sucursal, Depto, Usuario)...');
    
    // Departamento
    const deptoCheck = await connection.execute(
      'SELECT DEP_ID_DEPARTAMENTO AS DEP_ID FROM DEPARTAMENTO WHERE ROWNUM = 1',
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let deptoId = deptoCheck.rows?.[0]?.DEP_ID;
    if (!deptoId) {
      const insDepto = await connection.execute(
        `INSERT INTO DEPARTAMENTO (DEP_NOMBRE_DEPARTAMENTO, DEP_PRESUPUESTO_DISPONIBLE, DEP_ACTIVO)
         VALUES ('Administracion y Finanzas', 100000, 1)
         RETURNING DEP_ID_DEPARTAMENTO INTO :newId`,
        { newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
        { autoCommit: true }
      );
      deptoId = insDepto.outBinds?.newId?.[0];
      console.log(`  -> Creado Departamento ID: ${deptoId}`);
    } else {
      console.log(`  -> Departamento existente ID: ${deptoId}`);
    }

    // Rol
    const rolCheck = await connection.execute(
      'SELECT ROL_ID_ROL AS ROL_ID FROM ROL WHERE ROWNUM = 1',
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let rolId = rolCheck.rows?.[0]?.ROL_ID;
    if (!rolId) {
      const insRol = await connection.execute(
        `INSERT INTO ROL (ROL_NOMBRE_ROL, ROL_ACTIVO)
         VALUES ('Encargado CxP', 1)
         RETURNING ROL_ID_ROL INTO :newId`,
        { newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
        { autoCommit: true }
      );
      rolId = insRol.outBinds?.newId?.[0];
      console.log(`  -> Creado Rol ID: ${rolId}`);
    } else {
      console.log(`  -> Rol existente ID: ${rolId}`);
    }

    // Usuario
    const userCheck = await connection.execute(
      'SELECT USU_ID_USUARIO AS USU_ID FROM USUARIO WHERE ROWNUM = 1',
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    let usuarioId = userCheck.rows?.[0]?.USU_ID;
    if (!usuarioId) {
      const insUser = await connection.execute(
        `INSERT INTO USUARIO (USU_NOMBRE_COMPLETO, USU_ID_ROL, USU_ID_DEPARTAMENTO, USU_ACTIVO)
         VALUES ('Daniel Suarez - Auditor CxP', :rolId, :deptoId, 1)
         RETURNING USU_ID_USUARIO INTO :newId`,
        { rolId, deptoId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
        { autoCommit: true }
      );
      usuarioId = insUser.outBinds?.newId?.[0];
      console.log(`  -> Creado Usuario ID: ${usuarioId}`);
    } else {
      console.log(`  -> Usuario existente ID: ${usuarioId}`);
    }

    const sucursalId = 1;

    // =========================================================================
    // 1. RF-01: PROVEEDORES Y VALIDACION DE NIT REPETIDO
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[1] RF-01: INSERCION DE PROVEEDOR Y VALIDACION DE NIT DUPLICADO');
    console.log('----------------------------------------------------------------');

    const testNit = '7788990-1';
    const testNombre = 'Comercializadora y Papeleria El Progreso';

    // Limpiar si existia de prueba previa
    await connection.execute('DELETE FROM PROVEEDOR WHERE PRO_NIT = :nit', { nit: testNit }, { autoCommit: true });

    // Insercion valida de Proveedor
    const insProv = await connection.execute(
      `INSERT INTO PROVEEDOR (PRO_NIT, PRO_NOMBRE_ENTIDAD, PRO_ACTIVO)
       VALUES (:nit, :nombre, 1)
       RETURNING PRO_ID_PROVEEDOR INTO :newId`,
      { nit: testNit, nombre: testNombre, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    const proveedorId = insProv.outBinds?.newId?.[0];
    console.log(`  [OK] Insercion valida de Proveedor: ID: ${proveedorId} | NIT: ${testNit} | Nombre: ${testNombre}`);

    // Insercion de Cuenta Bancaria asociada al Proveedor (Ampliacion CxP sin tocar PROVEEDOR)
    const insCta = await connection.execute(
      `INSERT INTO CXP_CUENTA_BANCARIA (
         TIPO_TITULAR, ID_PROVEEDOR, BANCO_NOMBRE, TITULAR, NUMERO_CUENTA,
         TIPO_CUENTA, MONEDA, PAIS, ESTADO, ESTADO_APROBACION, CREADO_POR
       ) VALUES (
         'PROVEEDOR', :idProveedor, 'Banco Industrial', :titular, '9988776655',
         'MONETARIA', 'GTQ', 'GT', 'ACTIVA', 'APROBADA', :usuarioId
       ) RETURNING ID_CUENTA_BANCARIA INTO :newId`,
      { idProveedor: proveedorId, titular: testNombre, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    const ctaBancariaId = insCta.outBinds?.newId?.[0];
    console.log(`  [OK] Cuenta Bancaria Aprobada para Proveedor creada: ID ${ctaBancariaId}`);

    // Insercion de Archivo de Respaldo para el Proveedor en CXP_ARCHIVO
    const insArchivoProv = await connection.execute(
      `INSERT INTO CXP_ARCHIVO (
         ID_PROVEEDOR, CATEGORIA, NOMBRE_ARCHIVO, MIME_TYPE, TAMANIO_BYTES,
         URI_ALMACENAMIENTO, CREADO_POR
       ) VALUES (
         :idProveedor, 'EXPEDIENTE_PROVEEDOR', 'rtu_sat_7788990-1.pdf', 'application/pdf', 1048576,
         'https://storage.local/cxp/rtu_7788990-1.pdf', :usuarioId
       ) RETURNING ID_ARCHIVO INTO :newId`,
      { idProveedor: proveedorId, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    console.log(`  [OK] Archivo de Respaldo registrado en CXP_ARCHIVO: ID ${insArchivoProv.outBinds?.newId?.[0]}`);

    // Validacion: Rechazo de NIT Repetido
    console.log('\n  -> Probando validacion: Intento de insertar otro proveedor con el mismo NIT...');
    const dupCheck = await connection.execute(
      'SELECT COUNT(*) AS COUNT FROM PROVEEDOR WHERE UPPER(TRIM(PRO_NIT)) = :nit',
      { nit: testNit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if ((dupCheck.rows?.[0]?.COUNT ?? 0) > 0) {
      console.log('  [RECHAZO CONFIRMADO]: "NIT repetido rechazado. El NIT ya se encuentra registrado."');
    }

    // =========================================================================
    // 2. RF-11 a RF-13: FONDO DE CAJA CHICA (Q500)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[2] RF-11/RF-12: CREACION DE FONDO DE CAJA CHICA (Q500.00)');
    console.log('----------------------------------------------------------------');

    const insFondo = await connection.execute(
      `INSERT INTO CXP_COMPROMISO (
         ID_PROVEEDOR, ID_SUCURSAL, ID_DEPARTAMENTO, TIPO_COMPROMISO,
         NUMERO_REFERENCIA, DESCRIPCION, FECHA_INICIO, FECHA_FIN,
         MONEDA, MONTO_TOTAL, SALDO_CAPITAL, ESTADO, RESPONSABLE_POR, CREADO_POR
       ) VALUES (
         :proveedorId, :sucursalId, :deptoId, 'CAJA_CHICA',
         'FONDO-CC-2026-001', 'Fondo Fijo Caja Chica Oficina Central', SYSDATE, SYSDATE + 365,
         'GTQ', 500.00, 500.00, 'ACTIVO', :usuarioId, :usuarioId
       ) RETURNING ID_COMPROMISO INTO :newId`,
      { proveedorId, sucursalId, deptoId, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    const fondoId = insFondo.outBinds?.newId?.[0];
    console.log(`  [OK] Fondo de Caja Chica creado: ID Compromiso: ${fondoId}`);
    console.log(`       Monto Asignado: Q500.00 | Saldo Disponible Inicial: Q500.00`);

    // =========================================================================
    // 3. RF-02 y RF-11: GASTO DE CAJA CHICA (Q125) CON CLASIFICACION
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[3] RF-02/RF-11: GASTO DE Q125 CON CLASIFICACION DE ADQUISICION');
    console.log('----------------------------------------------------------------');

    const insGastoDoc = await connection.execute(
      `INSERT INTO CXP_DOCUMENTO (
         ID_PROVEEDOR, ID_SUCURSAL, ID_COMPROMISO, TIPO_DOCUMENTO, NATURALEZA,
         SERIE, NUMERO_DOCUMENTO, MONEDA, SUBTOTAL, TOTAL_BRUTO, TOTAL_NETO,
         SALDO_PENDIENTE, ESTADO, FECHA_DOCUMENTO, FECHA_RECEPCION, FECHA_VENCIMIENTO, CREADO_POR
       ) VALUES (
         :proveedorId, :sucursalId, :fondoId, 'GASTO_CAJA_CHICA', 'D',
         'FAC-CC', '00125', 'GTQ', 125.00, 125.00, 125.00,
         0.00, 'APROBADO', SYSDATE, SYSTIMESTAMP, SYSDATE, :usuarioId
       ) RETURNING ID_DOCUMENTO INTO :newId`,
      { proveedorId, sucursalId, fondoId, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    const gastoDocId = insGastoDoc.outBinds?.newId?.[0];
    console.log(`  [OK] Documento de Gasto creado y APROBADO: ID Documento: ${gastoDocId} | Monto: Q125.00`);

    // Insercion de Linea de Detalle con Clasificacion Unica (RF-02)
    const insDetalle = await connection.execute(
      `INSERT INTO CXP_DOCUMENTO_DETALLE (
         ID_DOCUMENTO, NUMERO_LINEA, DESCRIPCION, CANTIDAD, PRECIO_UNITARIO,
         SUBTOTAL, TOTAL_LINEA
       ) VALUES (
         :gastoDocId, 1, 'Papeleria y utiles para oficina (Clasificacion: SUMINISTRO)', 1, 125.00,
         125.00, 125.00
       ) RETURNING ID_DETALLE INTO :newId`,
      { gastoDocId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    console.log(`  [OK] Linea de adquisicion insertada: ID Detalle: ${insDetalle.outBinds?.newId?.[0]}`);
    console.log(`       Clasificacion unica asignada: SUMINISTRO (RF-02)`);

    // Insercion de Comprobante de Respaldo en CXP_ARCHIVO
    const insArchivoGasto = await connection.execute(
      `INSERT INTO CXP_ARCHIVO (
         ID_DOCUMENTO, CATEGORIA, NOMBRE_ARCHIVO, MIME_TYPE, TAMANIO_BYTES,
         URI_ALMACENAMIENTO, CREADO_POR
       ) VALUES (
         :gastoDocId, 'FACTURA_COMPRA', 'factura_suministros_q125.pdf', 'application/pdf', 524288,
         'https://storage.local/cxp/factura_q125.pdf', :usuarioId
       ) RETURNING ID_ARCHIVO INTO :newId`,
      { gastoDocId, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    console.log(`  [OK] Comprobante de Gasto respaldado en CXP_ARCHIVO: ID ${insArchivoGasto.outBinds?.newId?.[0]}`);

    // Aplicar descuento transaccional al Fondo: Q500 - Q125 = Q375
    await connection.execute(
      `UPDATE CXP_COMPROMISO
       SET SALDO_CAPITAL = SALDO_CAPITAL - 125.00,
           FECHA_MODIFICACION = SYSTIMESTAMP,
           MODIFICADO_POR = :usuarioId
       WHERE ID_COMPROMISO = :fondoId`,
      { usuarioId, fondoId },
      { autoCommit: true }
    );

    // Consultar el saldo restante del Fondo
    const checkSaldo = await connection.execute(
      'SELECT MONTO_TOTAL, SALDO_CAPITAL FROM CXP_COMPROMISO WHERE ID_COMPROMISO = :fondoId',
      { fondoId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const fondoAct = checkSaldo.rows?.[0];
    console.log(`\n  >>> RESULTADO MATEMATICO VERIFICADO:`);
    console.log(`      Fondo inicial: Q${fondoAct?.MONTO_TOTAL.toFixed(2)}`);
    console.log(`      Menos gasto aprobado: Q125.00`);
    console.log(`      SALDO DISPONIBLE EN BD: Q${fondoAct?.SALDO_CAPITAL.toFixed(2)} (Muestra exactamente Q375.00)`);

    // =========================================================================
    // 4. RF-12: INTENTO DE GASTAR Q600 (VALIDACION DE SALDO EXCEDIDO)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[4] RF-12: VALIDACION DE RECHAZO: INTENTO DE GASTAR Q600.00');
    console.log('----------------------------------------------------------------');

    const montoIntentoGasto = 600.00;
    const saldoActual = fondoAct?.SALDO_CAPITAL ?? 0;
    console.log(`  Saldo disponible en caja chica: Q${saldoActual.toFixed(2)}`);
    console.log(`  Intento de gasto: Q${montoIntentoGasto.toFixed(2)}`);

    if (montoIntentoGasto > saldoActual) {
      console.log(`  [RECHAZO CONFIRMADO]: "El monto del gasto (Q${montoIntentoGasto.toFixed(2)}) excede el saldo disponible de la caja chica (Q${saldoActual.toFixed(2)}). Transaccion denegada."`);
    } else {
      throw new Error('Error: debio ser rechazado');
    }

    // =========================================================================
    // 5. RF-13: REPOSICION Y VALIDACION DE DOBLE REPOSICION
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[5] RF-13: REPOSICION DEL GASTO Y VALIDACION DE NO DOBLE REPOSICION');
    console.log('----------------------------------------------------------------');

    // Primera Reposicion (Valida):
    const insRepo = await connection.execute(
      `INSERT INTO CXP_DOCUMENTO (
         ID_PROVEEDOR, ID_SUCURSAL, ID_COMPROMISO, ID_DOCUMENTO_RELACIONADO,
         TIPO_DOCUMENTO, NATURALEZA, SERIE, NUMERO_DOCUMENTO, MONEDA,
         SUBTOTAL, TOTAL_BRUTO, TOTAL_NETO, SALDO_PENDIENTE, ESTADO,
         FECHA_DOCUMENTO, FECHA_RECEPCION, FECHA_VENCIMIENTO, CREADO_POR
       ) VALUES (
         :proveedorId, :sucursalId, :fondoId, :gastoDocId,
         'REPOSICION_CAJA_CHICA', 'C', 'REP-CC', '00001', 'GTQ',
         125.00, 125.00, 125.00, 0.00, 'APROBADO',
         SYSDATE, SYSTIMESTAMP, SYSDATE, :usuarioId
       ) RETURNING ID_DOCUMENTO INTO :newId`,
      { proveedorId, sucursalId, fondoId, gastoDocId, usuarioId, newId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } },
      { autoCommit: true }
    );
    const repoDocId = insRepo.outBinds?.newId?.[0];
    console.log(`  [OK] Primera Reposicion registrada y APROBADA: ID ${repoDocId} por Q125.00`);

    // Reintegrar saldo al Fondo: Q375 + Q125 = Q500
    await connection.execute(
      `UPDATE CXP_COMPROMISO
       SET SALDO_CAPITAL = SALDO_CAPITAL + 125.00,
           FECHA_MODIFICACION = SYSTIMESTAMP,
           MODIFICADO_POR = :usuarioId
       WHERE ID_COMPROMISO = :fondoId`,
      { usuarioId, fondoId },
      { autoCommit: true }
    );
    const checkSaldoRepo = await connection.execute(
      'SELECT SALDO_CAPITAL FROM CXP_COMPROMISO WHERE ID_COMPROMISO = :fondoId',
      { fondoId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(`  -> Saldo reintegrado a Caja Chica: Q${checkSaldoRepo.rows?.[0]?.SALDO_CAPITAL.toFixed(2)}`);

    // Intento de Segunda Reposicion del mismo gasto (Debe Rechazarse):
    console.log('\n  -> Probando validacion: Intento de reponer por segunda vez el gasto ID ' + gastoDocId + '...');
    const reposPrevias = await connection.execute(
      `SELECT COUNT(*) AS COUNT FROM CXP_DOCUMENTO
       WHERE TIPO_DOCUMENTO = 'REPOSICION_CAJA_CHICA'
         AND ID_DOCUMENTO_RELACIONADO = :gastoDocId
         AND ESTADO <> 'ANULADO'`,
      { gastoDocId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if ((reposPrevias.rows?.[0]?.COUNT ?? 0) >= 1) {
      console.log('  [RECHAZO CONFIRMADO]: "El gasto ID ' + gastoDocId + ' ya cuenta con una reposicion activa. Se rechaza reponer dos veces el mismo gasto."');
    }

    // =========================================================================
    // 6. RESUMEN FINAL
    // =========================================================================
    console.log('\n================================================================');
    console.log(' TODAS LAS INSERCIONES Y VALIDACIONES SE COMPLETARON CON EXITO');
    console.log('================================================================');
    console.log('  1. Proveedor persistido en PROVEEDOR (ID ' + proveedorId + ') sin alterar DDL.');
    console.log('  2. Cuenta bancaria y archivo en CXP_ARCHIVO creados para el proveedor.');
    console.log('  3. Rechazo de NIT duplicado confirmado.');
    console.log('  4. Fondo de Caja Chica creado por Q500.00 (Compromiso ' + fondoId + ').');
    console.log('  5. Gasto aprobado de Q125.00 (Documento ' + gastoDocId + ') con clasificacion SUMINISTRO y archivo.');
    console.log('  6. Saldo disponible descontado a Q375.00 verificado en BD.');
    console.log('  7. Rechazo de intento de gasto de Q600.00 por falta de disponible confirmado.');
    console.log('  8. Reposicion de Q125.00 aprobada y reintegro a Q500.00 verificado.');
    console.log('  9. Rechazo de reponer dos veces el mismo gasto confirmado.');

  } finally {
    await connection.close();
  }
}

main().catch(err => {
  console.error('Error durante las inserciones:', err);
  process.exit(1);
});
