// Caso de uso: Listar Conversaciones de un Usuario
// Devuelve todas las conversaciones del usuario con el último mensaje y conteo de no leídos.

import { IConversacionRepository } from '../../domain/interfaces/IConversacionRepository';

export class ListarConversaciones {
  constructor(
    private readonly conversacionRepo: IConversacionRepository
  ) {}

  async ejecutar(
    usuario_id: string,
    pagina: number = 1,
    limite: number = 20
  ) {
    const resultado = await this.conversacionRepo.listarPorUsuario(
      usuario_id,
      pagina,
      limite
    );

    return {
      pagina,
      limite,
      total: resultado.total,
      conversaciones: resultado.conversaciones.map((c) => ({
        conversacion_id: c.conversacion._id,
        propiedad_id: c.conversacion.propiedad_id,
        arrendador_id: c.conversacion.arrendador_id,
        arrendatario_id: c.conversacion.arrendatario_id,
        ultimo_mensaje: c.ultimo_mensaje,
        ultimo_enviado_en: c.ultimo_enviado_en,
        no_leidos: c.no_leidos,
        creado_en: c.conversacion.creado_en,
      })),
    };
  }
}
