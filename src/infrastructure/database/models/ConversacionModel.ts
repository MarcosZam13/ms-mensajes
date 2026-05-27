// Modelo Mongoose: Conversacion
// Colección: conversaciones
// Índices: propiedad_id + arrendador_id + arrendatario_id (único compuesto),
//          arrendador_id, arrendatario_id (para búsquedas por usuario)

import mongoose, { Schema, Document } from 'mongoose';

export interface IConversacionDocument extends Document {
  propiedad_id: string;
  arrendador_id: string;
  arrendatario_id: string;
  creado_en: Date;
}

const ConversacionSchema = new Schema<IConversacionDocument>(
  {
    propiedad_id: {
      type: String,
      required: [true, 'El ID de la propiedad es requerido'],
      index: true,
    },
    arrendador_id: {
      type: String,
      required: [true, 'El ID del arrendador es requerido'],
      index: true,
    },
    arrendatario_id: {
      type: String,
      required: [true, 'El ID del arrendatario es requerido'],
      index: true,
    },
    creado_en: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'conversaciones',
    timestamps: false,
  }
);

// Índice compuesto único: una sola conversación por propiedad + par de usuarios
ConversacionSchema.index(
  { propiedad_id: 1, arrendador_id: 1, arrendatario_id: 1 },
  { unique: true }
);

// Índice para buscar conversaciones por participante
ConversacionSchema.index({ arrendador_id: 1, creado_en: -1 });
ConversacionSchema.index({ arrendatario_id: 1, creado_en: -1 });

export const ConversacionModel = mongoose.model<IConversacionDocument>(
  'Conversacion',
  ConversacionSchema
);
