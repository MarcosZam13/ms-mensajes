// Puerto: Repositorio de Conversaciones
// Define las operaciones de persistencia para conversaciones.

import { Conversacion } from '../entities/Conversacion';

export interface IConversacionRepository {
  // Busca una conversación existente entre dos usuarios para una propiedad,
  // o la crea si no existe (patrón find-or-create).
  encontrarOCrear(
    propiedad_id: string,
    arrendador_id: string,
    arrendatario_id: string
  ): Promise<Conversacion>;

  // Obtiene una conversación por su ID
  obtenerPorId(id: string): Promise<Conversacion | null>;

  // Lista todas las conversaciones de un usuario, con el último mensaje
  // y la cantidad de mensajes no leídos.
  listarPorUsuario(
    usuario_id: string,
    pagina: number,
    limite: number
  ): Promise<{
    conversaciones: Array<{
      conversacion: Conversacion;
      ultimo_mensaje: string | null;
      ultimo_enviado_en: Date | null;
      no_leidos: number;
    }>;
    total: number;
  }>;
}
