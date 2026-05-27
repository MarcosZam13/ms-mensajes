// Configuración de WebSocket con socket.io
// Permite emitir eventos en tiempo real a los usuarios conectados.
// Los usuarios se unen a una sala con su ID para recibir mensajes dirigidos.
//
// SEGURIDAD:
//   - Middleware `io.use()` valida el JWT enviado por el cliente en `socket.handshake.auth.token`.
//   - El userId se deriva del claim `sub` del token verificado, NUNCA del payload del evento
//     'autenticar' enviado por el cliente.
//   - Conexiones sin token válido son rechazadas antes de entrar al handler de events.

import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

let io: SocketServer | null = null;

// Mapa de conexiones: userId -> Set de socket IDs
// (un usuario puede tener múltiples conexiones desde distintos dispositivos)
const usuariosConectados = new Map<string, Set<string>>();

export function inicializarSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Configuración optimizada para Azure APIM con sticky sessions
    transports: ['websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Middleware de autenticación JWT ──────────────────────────────────────────
  // El cliente debe enviar el token en socket.handshake.auth.token
  // (io(URL, { auth: { token } }))
  // El userId se extrae del claim `sub` del token — el cliente no puede
  // suplantar a otro usuario aunque envíe un userId distinto en 'autenticar'.
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;

    if (!token) {
      console.warn(`[Socket] Conexión rechazada (sin token): ${socket.id}`);
      next(new Error('TOKEN_REQUERIDO'));
      return;
    }

    const options: jwt.VerifyOptions = { algorithms: ['HS256'] };
    if (config.jwt.audience) options.audience = config.jwt.audience;
    if (config.jwt.issuer)   options.issuer   = config.jwt.issuer;

    jwt.verify(token, config.jwt.secret, options, (err, decoded) => {
      if (err) {
        console.warn(`[Socket] Token inválido: ${err.message}`);
        next(new Error('TOKEN_INVALIDO'));
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      const userId  = payload.sub ?? payload.user_id ?? payload.id;

      if (!userId) {
        next(new Error('TOKEN_SIN_SUBJECT'));
        return;
      }

      // Adjuntar identidad verificada al socket — disponible en todos los handlers
      socket.data.userId   = String(userId);
      socket.data.userName = String(payload.name ?? userId);
      next();
    });
  });
  // ─────────────────────────────────────────────────────────────────────────────

  io.on('connection', (socket) => {
    // userId ya está verificado por el middleware JWT
    const userId = socket.data.userId as string;
    console.log(`[Socket] Nueva conexión verificada: ${socket.id} (usuario ${userId})`);

    // El cliente envía 'autenticar' para que el servidor una la sala.
    // Ignoramos el userId que manda el cliente — usamos el del token (socket.data.userId).
    socket.on('autenticar', (_clientUserId: unknown) => {
      // Unir al usuario a su sala privada usando el userId del JWT (verificado)
      socket.join(`usuario:${userId}`);

      // Registrar en el mapa de conexiones
      if (!usuariosConectados.has(userId)) {
        usuariosConectados.set(userId, new Set());
      }
      usuariosConectados.get(userId)!.add(socket.id);

      console.log(
        `[Socket] Usuario ${userId} unido a sala. ` +
        `Conexiones activas: ${usuariosConectados.get(userId)!.size}`
      );

      socket.emit('autenticado', { mensaje: 'Conectado al servicio de mensajería' });
    });

    socket.on('disconnect', () => {
      // Limpiar el mapa de conexiones
      for (const [uid, sockets] of usuariosConectados.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          console.log(
            `[Socket] Usuario ${uid} desconectado: ${socket.id}. ` +
            `Conexiones restantes: ${sockets.size}`
          );
          if (sockets.size === 0) {
            usuariosConectados.delete(uid);
          }
          break;
        }
      }
    });
  });

  console.log('[Socket] Servidor socket.io inicializado (con validación JWT)');
  return io;
}

// Emite un evento de nuevo mensaje al destinatario si está conectado
export function emitirNuevoMensaje(
  destinatario_id: string,
  payload: {
    mensaje_id: string;
    conversacion_id: string;
    remitente_id: string;
    remitente_nombre: string;
    contenido: string;
    enviado_en: Date;
  }
): void {
  if (!io) {
    console.warn('[Socket] io no está inicializado');
    return;
  }

  // Emitir solo a la sala del destinatario
  io.to(`usuario:${destinatario_id}`).emit('nuevo_mensaje', payload);
  console.log(
    `[Socket] Evento 'nuevo_mensaje' emitido a usuario ${destinatario_id}`
  );
}

// Verifica si un usuario está conectado
export function estaConectado(userId: string): boolean {
  return usuariosConectados.has(userId) && usuariosConectados.get(userId)!.size > 0;
}

export { io };
