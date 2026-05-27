// Rutas del Microservicio de Mensajes
// Define los endpoints REST y asigna middlewares.
// Todas las rutas requieren autenticación JWT (excepto health).

import { Router } from 'express';
import { MensajesController } from '../controllers/MensajesController';
import { middlewareJWT } from '../../infrastructure/middleware/jwtMiddleware';

export function crearRutas(controller: MensajesController): Router {
  const router = Router();

  // --- Health check (sin autenticación) ---
  router.get('/health', (req, res) => controller.health(req, res));

  // --- Middleware JWT para todas las rutas siguientes ---
  router.use(middlewareJWT);

  // POST /api/mensajes — Enviar un nuevo mensaje
  router.post('/', (req, res, next) => controller.enviar(req, res, next));

  // GET /api/conversaciones — Listar conversaciones del usuario autenticado
  router.get('/conversaciones', (req, res, next) =>
    controller.listarConversaciones(req, res, next)
  );

  // GET /api/conversaciones/:conversacion_id/mensajes — Historial de una conversación
  router.get('/conversaciones/:conversacion_id/mensajes', (req, res, next) =>
    controller.obtenerHistorial(req, res, next)
  );

  // PATCH /api/conversaciones/:conversacion_id/leido — Marcar mensajes como leídos
  router.patch('/conversaciones/:conversacion_id/leido', (req, res, next) =>
    controller.marcarLeidos(req, res, next)
  );

  return router;
}
