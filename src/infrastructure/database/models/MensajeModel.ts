// Modelo Mongoose: Mensaje
// Colección: mensajes
// Índices: conversacion_id + enviado_en (para historial ordenado),
//          conversacion_id + remitente_id + leido (para marcar leídos)

import mongoose, { Schema, Document } from 'mongoose';

export interface IMensajeDocument extends Document {
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  leido: boolean;
  enviado_en: Date;
}

const MensajeSchema = new Schema<IMensajeDocument>(
  {
    conversacion_id: {
      type: String,
      required: [true, 'El ID de la conversación es requerido'],
      index: true,
    },
    remitente_id: {
      type: String,
      required: [true, 'El ID del remitente es requerido'],
    },
    contenido: {
      type: String,
      required: [true, 'El contenido del mensaje es requerido'],
      maxlength: [5000, 'El mensaje no puede exceder 5000 caracteres'],
    },
    leido: {
      type: Boolean,
      default: false,
    },
    enviado_en: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'mensajes',
    timestamps: false,
  }
);

// Índice compuesto para obtener historial paginado ordenado por fecha
MensajeSchema.index({ conversacion_id: 1, enviado_en: -1 });

// Índice para marcar leídos eficientemente
MensajeSchema.index({ conversacion_id: 1, remitente_id: 1, leido: 1 });

export const MensajeModel = mongoose.model<IMensajeDocument>(
  'Mensaje',
  MensajeSchema
);
