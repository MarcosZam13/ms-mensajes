// Punto de entrada principal del Microservicio de Mensajes
// Inicializa Express, conexiones a BD/Service Bus, WebSocket,
// y ensambla todas las dependencias (inyección manual).

import express from 'express';
import cors from 'cors';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { conectarBaseDeDatos } from './infrastructure/database/connection';
import { ServiceBusPublisher } from './infrastructure/messaging/ServiceBusPublisher';
import { inicializarSocket } from './infrastructure/websocket/socketSetup';
import { errorHandler } from './infrastructure/middleware/errorHandler';
import { swaggerSpec } from './infrastructure/swagger/swaggerSpec';

// Repositorios (implementaciones concretas)
import { MongoConversacionRepository } from './infrastructure/database/repositories/MongoConversacionRepository';
import { MongoMensajeRepository } from './infrastructure/database/repositories/MongoMensajeRepository';

// Casos de uso
import { EnviarMensaje } from './application/use-cases/EnviarMensaje';
import { ObtenerHistorico } from './application/use-cases/ObtenerHistorico';
import { ListarConversaciones } from './application/use-cases/ListarConversaciones';
import { MarcarLeidos } from './application/use-cases/MarcarLeidos';

// Controladores y rutas
import { MensajesController } from './interfaces/controllers/MensajesController';
import { crearRutas } from './interfaces/routes/mensajesRoutes';

async function iniciarServidor(): Promise<void> {
  // 1. Conectar a Azure Cosmos DB
  await conectarBaseDeDatos();
  console.log('[Server] Base de datos conectada');

  // 2. Inicializar publicador de Azure Service Bus
  const serviceBusPublisher = new ServiceBusPublisher();
  console.log('[Server] Service Bus inicializado');

  // 3. Instanciar repositorios (implementaciones concretas)
  const conversacionRepo = new MongoConversacionRepository();
  const mensajeRepo = new MongoMensajeRepository();

  // 4. Instanciar casos de uso (inyección de dependencias manual)
  const enviarMensajeUC = new EnviarMensaje(
    conversacionRepo,
    mensajeRepo,
    serviceBusPublisher
  );
  const obtenerHistoricoUC = new ObtenerHistorico(conversacionRepo, mensajeRepo);
  const listarConversacionesUC = new ListarConversaciones(conversacionRepo);
  const marcarLeidosUC = new MarcarLeidos(conversacionRepo, mensajeRepo);

  // 5. Instanciar controlador
  const mensajesController = new MensajesController(
    enviarMensajeUC,
    obtenerHistoricoUC,
    listarConversacionesUC,
    marcarLeidosUC
  );

  // 6. Crear app Express
  const app = express();

  // --- Middlewares globales ---
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json({ limit: '10kb' })); // Limitar tamaño de payload

  // Logging básico de peticiones (en producción usarías Application Insights)
  app.use((req, _res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // --- Swagger UI ---
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // --- Rutas ---
  const rutas = crearRutas(mensajesController);
  app.use('/api/mensajes', rutas);

  // --- Health check a nivel raíz ---
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', servicio: 'microservicio-mensajes' });
  });

  // --- Middleware de errores (debe ir al final) ---
  app.use(errorHandler);

  // 7. Crear servidor HTTP y configurar WebSocket
  const server = http.createServer(app);
  inicializarSocket(server);

  // 8. Iniciar servidor
  server.listen(config.puerto, () => {
    console.log(
      `[Server] Microservicio de Mensajes ejecutándose en puerto ${config.puerto}`
    );
    console.log(`[Server] Ambiente: ${config.nodeEnv}`);
    console.log(`[Server] CORS permitido: ${config.cors.origin}`);
    console.log(`[Server] Health check: http://localhost:${config.puerto}/health`);
  });

  // 9. Manejo de señales de terminación (graceful shutdown)
  const gracefulShutdown = async (signal: string) => {
    console.log(`[Server] Recibida señal ${signal}. Cerrando gracefully...`);
    await serviceBusPublisher.cerrar();
    server.close(() => {
      console.log('[Server] Servidor HTTP cerrado');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

iniciarServidor().catch((error) => {
  console.error('[Server] Error fatal al iniciar:', error);
  process.exit(1);
});
