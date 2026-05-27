// Caso de uso: Obtener Histórico de Mensajes
// Recupera los mensajes de una conversación de forma paginada.
// Valida que el usuario solicitante participe en la conversación.

import { IConversacionRepository } from '../../domain/interfaces/IConversacionRepository';
import { IMensajeRepository } from '../../domain/interfaces/IMensajeRepository';

export class ObtenerHistorico {
  constructor(
    private readonly conversacionRepo: IConversacionRepository,
    private readonly mensajeRepo: IMensajeRepository
  ) {}

  async ejecutar(
    conversacion_id: string,
    usuario_id: string,
    pagina: number = 1,
    limite: number = 50
  ) {
    // 1. Verificar que la conversación existe y el usuario participa
    const conversacion = await this.conversacionRepo.obtenerPorId(conversacion_id);

    if (!conversacion) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversacion.participa(usuario_id)) {
      throw new Error('Acceso denegado: el usuario no pertenece a esta conversación');
    }

    // 2. Obtener mensajes paginados
    const resultado = await this.mensajeRepo.obtenerPorConversacion(
      conversacion_id,
      pagina,
      limite
    );

    return {
      conversacion_id,
      propiedad_id: conversacion.propiedad_id,
      pagina,
      limite,
      total: resultado.total,
      mensajes: resultado.mensajes.map((m) => ({
        id: m._id,
        remitente_id: m.remitente_id,
        contenido: m.contenido,
        leido: m.leido,
        enviado_en: m.enviado_en,
      })),
    };
  }
}
