// Puerto: Repositorio de Mensajes
// Define las operaciones de persistencia para mensajes.

import { Mensaje } from '../entities/Mensaje';

export interface IMensajeRepository {
  // Inserta un nuevo mensaje en la base de datos
  guardar(mensaje: {
    conversacion_id: string;
    remitente_id: string;
    contenido: string;
    leido: boolean;
  }): Promise<Mensaje>;

  // Obtiene el historial paginado de mensajes de una conversación
  // (orden cronológico: los más antiguos primero).
  obtenerPorConversacion(
    conversacion_id: string,
    pagina: number,
    limite: number
  ): Promise<{ mensajes: Mensaje[]; total: number }>;

  // Marca como leídos todos los mensajes de una conversación
  // cuyo remitente NO sea el usuario indicado.
  marcarLeidos(
    conversacion_id: string,
    usuario_id: string
  ): Promise<number>; // Retorna la cantidad de mensajes actualizados
}
