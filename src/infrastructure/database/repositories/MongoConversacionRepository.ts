// Implementación del repositorio de conversaciones con Mongoose
// Implementa IConversacionRepository usando Azure Cosmos DB (MongoDB API).

import { IConversacionRepository } from '../../../domain/interfaces/IConversacionRepository';
import { Conversacion } from '../../../domain/entities/Conversacion';
import { ConversacionModel } from '../models/ConversacionModel';
import { MensajeModel } from '../models/MensajeModel';

export class MongoConversacionRepository implements IConversacionRepository {
  async encontrarOCrear(
    propiedad_id: string,
    arrendador_id: string,
    arrendatario_id: string
  ): Promise<Conversacion> {
    // findOneAndUpdate con upsert: atómico y seguro en concurrencia
    const doc = await ConversacionModel.findOneAndUpdate(
      {
        propiedad_id,
        arrendador_id,
        arrendatario_id,
      },
      {
        // Solo establece estos campos si el documento es nuevo (upsert)
        $setOnInsert: {
          propiedad_id,
          arrendador_id,
          arrendatario_id,
          creado_en: new Date(),
        },
      },
      {
        new: true,        // Retorna el documento después de la operación
        upsert: true,     // Crea si no existe
        setDefaultsOnInsert: true,
      }
    );

    return new Conversacion({
      _id: doc._id.toString(),
      propiedad_id: doc.propiedad_id,
      arrendador_id: doc.arrendador_id,
      arrendatario_id: doc.arrendatario_id,
      creado_en: doc.creado_en,
    });
  }

  async obtenerPorId(id: string): Promise<Conversacion | null> {
    const doc = await ConversacionModel.findById(id);

    if (!doc) return null;

    return new Conversacion({
      _id: doc._id.toString(),
      propiedad_id: doc.propiedad_id,
      arrendador_id: doc.arrendador_id,
      arrendatario_id: doc.arrendatario_id,
      creado_en: doc.creado_en,
    });
  }

  async listarPorUsuario(
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
  }> {
    // Query para encontrar todas las conversaciones donde el usuario participa
    const filtro = {
      $or: [
        { arrendador_id: usuario_id },
        { arrendatario_id: usuario_id },
      ],
    };

    const total = await ConversacionModel.countDocuments(filtro);
    const skip = (pagina - 1) * limite;

    const conversaciones = await ConversacionModel.find(filtro)
      .sort({ creado_en: -1 })
      .skip(skip)
      .limit(limite)
      .lean();

    // Para cada conversación, obtenemos el último mensaje y el conteo de no leídos
    const resultado = await Promise.all(
      conversaciones.map(async (conv) => {
        // Último mensaje de la conversación
        const ultimoMsg = await MensajeModel.findOne({
          conversacion_id: conv._id.toString(),
        })
          .sort({ enviado_en: -1 })
          .select('contenido enviado_en')
          .lean();

        // Conteo de mensajes no leídos enviados por el otro participante
        const otroParticipante =
          conv.arrendador_id === usuario_id
            ? conv.arrendatario_id
            : conv.arrendador_id;

        const no_leidos = await MensajeModel.countDocuments({
          conversacion_id: conv._id.toString(),
          remitente_id: otroParticipante,
          leido: false,
        });

        return {
          conversacion: new Conversacion({
            _id: conv._id.toString(),
            propiedad_id: conv.propiedad_id,
            arrendador_id: conv.arrendador_id,
            arrendatario_id: conv.arrendatario_id,
            creado_en: conv.creado_en,
          }),
          ultimo_mensaje: ultimoMsg?.contenido ?? null,
          ultimo_enviado_en: ultimoMsg?.enviado_en ?? null,
          no_leidos,
        };
      })
    );

    return { conversaciones: resultado, total };
  }
}
