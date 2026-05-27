// Caso de uso: Enviar Mensaje
// Coordina el envío de un mensaje: persistencia, publicación de evento en Service Bus,
// y retorna los datos necesarios para que el controller emita por WebSocket.

import { IConversacionRepository } from '../../domain/interfaces/IConversacionRepository';
import { IMensajeRepository } from '../../domain/interfaces/IMensajeRepository';
import { IServiceBusPublisher } from '../../domain/interfaces/IServiceBusPublisher';

export interface EnviarMensajeInput {
  remitente_id: string;
  remitente_nombre: string;
  destinatario_id: string;
  propiedad_id: string;
  contenido: string;
  arrendador_id: string; // ID del arrendador de la propiedad
  arrendatario_id: string; // ID del arrendatario de la propiedad
}

export interface EnviarMensajeOutput {
  mensaje_id: string;
  conversacion_id: string;
  destinatario_id: string;
  contenido: string;
  remitente_id: string;
  remitente_nombre: string;
  enviado_en: Date;
}

export class EnviarMensaje {
  constructor(
    private readonly conversacionRepo: IConversacionRepository,
    private readonly mensajeRepo: IMensajeRepository,
    private readonly serviceBusPublisher: IServiceBusPublisher
  ) {}

  async ejecutar(input: EnviarMensajeInput): Promise<EnviarMensajeOutput> {
    // 1. Encontrar o crear la conversación
    const conversacion = await this.conversacionRepo.encontrarOCrear(
      input.propiedad_id,
      input.arrendador_id,
      input.arrendatario_id
    );

    // 2. Guardar el mensaje
    const mensaje = await this.mensajeRepo.guardar({
      conversacion_id: conversacion._id,
      remitente_id: input.remitente_id,
      contenido: input.contenido,
      leido: false,
    });

    // 3. Determinar el destinatario (el otro participante de la conversación)
    const destinatario_id = conversacion.otroParticipante(input.remitente_id);

    // 4. Publicar evento en Azure Service Bus para el microservicio de notificaciones
    // (no bloqueamos la respuesta — se publica en background)
    const preview =
      input.contenido.length > 100
        ? input.contenido.substring(0, 97) + '...'
        : input.contenido;

    // No esperamos la publicación para no retardar la respuesta HTTP
    this.serviceBusPublisher
      .publicarEvento({
        tipo: 'nuevo_mensaje',
        destinatario_id,
        remitente_nombre: input.remitente_nombre,
        propiedad_id: input.propiedad_id,
        preview,
        conversacion_id: conversacion._id,
      })
      .catch((err) => {
        // Logueamos el error pero no fallamos la operación principal
        console.error('[EnviarMensaje] Error al publicar evento en Service Bus:', err);
      });

    return {
      mensaje_id: mensaje._id,
      conversacion_id: conversacion._id,
      destinatario_id,
      contenido: mensaje.contenido,
      remitente_id: input.remitente_id,
      remitente_nombre: input.remitente_nombre,
      enviado_en: mensaje.enviado_en,
    };
  }
}
