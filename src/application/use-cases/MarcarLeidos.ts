// Caso de uso: Marcar Mensajes como Leídos
// Marca como leídos todos los mensajes de una conversación que fueron
// enviados por el otro participante.

import { IConversacionRepository } from '../../domain/interfaces/IConversacionRepository';
import { IMensajeRepository } from '../../domain/interfaces/IMensajeRepository';

export class MarcarLeidos {
  constructor(
    private readonly conversacionRepo: IConversacionRepository,
    private readonly mensajeRepo: IMensajeRepository
  ) {}

  async ejecutar(conversacion_id: string, usuario_id: string) {
    // Verificar que la conversación existe y el usuario participa
    const conversacion = await this.conversacionRepo.obtenerPorId(conversacion_id);

    if (!conversacion) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversacion.participa(usuario_id)) {
      throw new Error('Acceso denegado: el usuario no pertenece a esta conversación');
    }

    // Marcar como leídos los mensajes del otro participante
    const actualizados = await this.mensajeRepo.marcarLeidos(
      conversacion_id,
      usuario_id
    );

    return {
      conversacion_id,
      mensajes_actualizados: actualizados,
    };
  }
}
