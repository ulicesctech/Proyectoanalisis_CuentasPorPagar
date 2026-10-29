import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cxcRoutes from './modules/cxc/routes';
import cxpRoutes from './modules/cxp/routes';
import { cxpErrorHandler } from './modules/cxp/controllers/errorHandler';
import { errorHandler } from './middlewares';
import { initOraclePool, closeOraclePool } from './config/database';
import { config } from './config';
import authRoutes, { authErrorHandler, requireAllowedOrigin, requireSession, requireCsrf } from './modules/auth/routes';

const app = express();
const PORT = config.port;
const HOST = config.host;

// Solo los orígenes configurados (CORS_ORIGINS). CXP comprueba sesión y CSRF
// en el servidor; CORS por sí mismo no autentica solicitudes.
app.use(cors((req, callback) => {
  const sessionRoute = req.path.startsWith('/api/auth') || req.path.startsWith('/api/cxp');
  callback(null, {
    origin: config.corsOrigins,
    credentials: sessionRoute,
    allowedHeaders: sessionRoute
      ? ['Content-Type', 'X-CSRF-Token', 'X-File-Name']
      : ['Content-Type', 'X-CXP-Actor-Id', 'X-File-Name'],
    exposedHeaders: ['Content-Disposition'],
  });
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de salud básica
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
  });
});

// Rutas del módulo Cuentas por Cobrar
app.use('/api/cxc', cxcRoutes);
app.use('/api/auth', authRoutes, authErrorHandler);
app.use('/api/cxp', requireAllowedOrigin, requireSession, requireCsrf, cxpRoutes, cxpErrorHandler);
// TODO: cuando estén listos, agregar de la misma forma:
// app.use('/api/compras', comprasRoutes);
// app.use('/api/bancos', bancosRoutes);

// Manejo de errores
app.use(errorHandler);

async function bootstrap() {
  try {
    await initOraclePool();

    const server = app.listen(PORT, HOST, () => {
      console.log(
        `[ERP Server]: API base corriendo en http://${HOST}:${PORT}`,
      );
      console.log(`[ERP Server]: CORS permitido para ${config.corsOrigins.join(', ')}`);
      console.log('[ERP Server]: CXP requiere una sesión autenticada');
    });

    const shutdown = async () => {
      console.log('\n[ERP Server]: Cerrando servidor...');

      server.close(async () => {
        await closeOraclePool();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[ERP Server]: Error fatal al iniciar', {
      name: error instanceof Error ? error.name : 'Error',
      code: (error as { code?: string })?.code,
    });
    process.exit(1);
  }
}

void bootstrap();
