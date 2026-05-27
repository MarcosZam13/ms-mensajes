// Implementación del repositorio de mensajes con Mongoose
// Implementa IMensajeRepository usando Azure Cosmos DB (MongoDB API).

import { IMensajeRepository } from '../../../domain/interfaces/IMensajeRepository';
import { Mensaje } from '../../../domain/entities/Mensaje';
import { MensajeModel } from '../models/MensajeModel';

export class MongoMensajeRepository implements IMensajeRepository {
  async guardar(datos: {
    conversacion_id: string;
    remitente_id: string;
    contenido: string;
    leido: boolean;
  }): Promise<Mensaje> {
    const doc = await MensajeModel.create({
      conversacion_id: datos.conversacion_id,
      remitente_id: datos.remitente_id,
      contenido: datos.contenido,
      leido: datos.leido,
      enviado_en: new Date(),
    });

    return new Mensaje({
      _id: doc._id.toString(),
      conversacion_id: doc.conversacion_id,
      remitente_id: doc.remitente_id,
      contenido: doc.contenido,
      leido: doc.leido,
      enviado_en: doc.enviado_en,
    });
  }

  async obtenerPorConversacion(
    conversacion_id: string,
    pagina: number,
    limite: number
  ): Promise<{ mensajes: Mensaje[]; total: number }> {
    const filtro = { conversacion_id };
    const total = await MensajeModel.countDocuments(filtro);
    const skip = (pagina - 1) * limite;

    const docs = await MensajeModel.find(filtro)
      .sort({ enviado_en: -1 }) // Más recientes primero
      .skip(skip)
      .limit(limite)
      .lean();

    // Invertimos el orden para que los más antiguos aparezcan primero
    // (experiencia de chat natural)
    const mensajes = docs.reverse().map(
      (doc) =>
        new Mensaje({
          _id: doc._id.toString(),
          conversacion_id: doc.conversacion_id,
          remitente_id: doc.remitente_id,
          contenido: doc.contenido,
          leido: doc.leido,
          enviado_en: doc.enviado_en,
        })
    );

    return { mensajes, total };
  }

  async marcarLeidos(
    conversacion_id: string,
    usuario_id: string
  ): Promise<number> {
    // Marca como leídos todos los mensajes donde el remitente NO es el usuario
    // (es decir, los mensajes enviados por el otro participante)
    const resultado = await MensajeModel.updateMany(
      {
        conversacion_id,
        remitente_id: { $ne: usuario_id },
        leido: false,
      },
      {
        $set: { leido: true },
      }
    );

    return resultado.modifiedCount;
  }
}
