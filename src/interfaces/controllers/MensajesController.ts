// Controlador de Mensajes
// Recibe peticiones HTTP, extrae parámetros, invoca casos de uso,
// y retorna respuestas HTTP con formato consistente.
// El user_id NUNCA se recibe como parámetro — se extrae del JWT validado.

import { Request, Response, NextFunction } from 'express';
import { EnviarMensaje } from '../../application/use-cases/EnviarMensaje';
import { ObtenerHistorico } from '../../application/use-cases/ObtenerHistorico';
import { ListarConversaciones } from '../../application/use-cases/ListarConversaciones';
import { MarcarLeidos } from '../../application/use-cases/MarcarLeidos';
import { emitirNuevoMensaje } from '../../infrastructure/websocket/socketSetup';

export class MensajesController {
  constructor(
    private readonly enviarMensajeUC: EnviarMensaje,
    private readonly obtenerHistoricoUC: ObtenerHistorico,
    private readonly listarConversacionesUC: ListarConversaciones,
    private readonly marcarLeidosUC: MarcarLeidos
  ) {}

  // POST /api/mensajes
  // Body: { destinatario_id, propiedad_id, contenido, arrendador_id, arrendatario_id }
  // El remitente_id se obtiene del JWT
  async enviar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const remitente_id = req.userId!;
      const remitente_nombre = req.userName || remitente_id;
      const {
        destinatario_id,
        propiedad_id,
        contenido,
        arrendador_id,
        arrendatario_id,
      } = req.body;

      // Validaciones básicas — se verifica tipo string para prevenir inyección NoSQL
      const camposString = { destinatario_id, propiedad_id, contenido, arrendador_id, arrendatario_id };
      for (const [campo, valor] of Object.entries(camposString)) {
        if (!valor || typeof valor !== 'string') {
          res.status(400).json({ error: `Campo requerido y debe ser string: ${campo}` });
          return;
        }
      }

      if (contenido.trim().length === 0) {
        res.status(400).json({ error: 'El contenido del mensaje no puede estar vacío' });
        return;
      }

      if (contenido.length > 5000) {
        res.status(400).json({ error: 'El mensaje no puede exceder 5000 caracteres' });
        return;
      }

      // Validar que el remitente sea parte de la conversación
      if (remitente_id !== arrendador_id && remitente_id !== arrendatario_id) {
        res.status(403).json({
          error: 'No puedes enviar mensajes en una conversación donde no participas',
        });
        return;
      }

      // Validar que no se envíe mensaje a sí mismo
      if (remitente_id === destinatario_id) {
        res.status(400).json({ error: 'No puedes enviarte un mensaje a ti mismo' });
        return;
      }

      // Ejecutar caso de uso
      const resultado = await this.enviarMensajeUC.ejecutar({
        remitente_id,
        remitente_nombre,
        destinatario_id,
        propiedad_id,
        contenido: contenido.trim(),
        arrendador_id,
        arrendatario_id,
      });

      // Emitir evento en tiempo real via WebSocket al destinatario.
      // Se usa resultado.destinatario_id (derivado por el use case desde la conversación
      // persistida) — nunca el destinatario_id del body, que podría ser falsificado.
      emitirNuevoMensaje(resultado.destinatario_id, {
        mensaje_id: resultado.mensaje_id,
        conversacion_id: resultado.conversacion_id,
        remitente_id: resultado.remitente_id,
        remitente_nombre: resultado.remitente_nombre,
        contenido: resultado.contenido,
        enviado_en: resultado.enviado_en,
      });

      res.status(201).json({
        mensaje: 'Mensaje enviado exitosamente',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/mensajes/:conversacion_id?pagina=1&limite=50
  // Obtiene el historial de mensajes de una conversación
  async obtenerHistorial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversacion_id } = req.params;
      const usuario_id = req.userId!;
      const pagina = parseInt(req.query.pagina as string) || 1;
      const limite = Math.min(parseInt(req.query.limite as string) || 50, 100);

      const resultado = await this.obtenerHistoricoUC.ejecutar(
        conversacion_id,
        usuario_id,
        pagina,
        limite
      );

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/mensajes/conversaciones?pagina=1&limite=20
  // Lista las conversaciones del usuario autenticado
  async listarConversaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuario_id = req.userId!;
      const pagina = parseInt(req.query.pagina as string) || 1;
      const limite = Math.min(parseInt(req.query.limite as string) || 20, 50);

      const resultado = await this.listarConversacionesUC.ejecutar(
        usuario_id,
        pagina,
        limite
      );

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/mensajes/:conversacion_id/leido
  // Marca como leídos los mensajes de una conversación
  async marcarLeidos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversacion_id } = req.params;
      const usuario_id = req.userId!;

      const resultado = await this.marcarLeidosUC.ejecutar(
        conversacion_id,
        usuario_id
      );

      res.json({
        mensaje: 'Mensajes marcados como leídos',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  // Health check
  async health(_req: Request, res: Response): Promise<void> {
    res.json({
      servicio: 'microservicio-mensajes',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }
}
