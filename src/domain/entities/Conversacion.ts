// Entidad: Conversacion
// Representa una conversación entre un arrendador y un arrendatario
// asociada a una propiedad específica.

export interface IConversacion {
  _id: string;
  propiedad_id: string;
  arrendador_id: string;
  arrendatario_id: string;
  creado_en: Date;
}

export class Conversacion {
  public readonly _id: string;
  public readonly propiedad_id: string;
  public readonly arrendador_id: string;
  public readonly arrendatario_id: string;
  public readonly creado_en: Date;

  constructor(datos: IConversacion) {
    this._id = datos._id;
    this.propiedad_id = datos.propiedad_id;
    this.arrendador_id = datos.arrendador_id;
    this.arrendatario_id = datos.arrendatario_id;
    this.creado_en = datos.creado_en;
  }

  // Determina si un usuario dado participa en esta conversación
  participa(userId: string): boolean {
    return this.arrendador_id === userId || this.arrendatario_id === userId;
  }

  // Devuelve el ID del otro participante (útil para WebSocket y notificaciones)
  otroParticipante(userId: string): string {
    if (this.arrendador_id === userId) return this.arrendatario_id;
    if (this.arrendatario_id === userId) return this.arrendador_id;
    throw new Error('El usuario no participa en esta conversación');
  }
}
