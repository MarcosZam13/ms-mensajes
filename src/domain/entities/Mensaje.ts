// Entidad: Mensaje
// Representa un mensaje individual dentro de una conversación.

export interface IMensaje {
  _id: string;
  conversacion_id: string;
  remitente_id: string;
  contenido: string;
  leido: boolean;
  enviado_en: Date;
}

export class Mensaje {
  public readonly _id: string;
  public readonly conversacion_id: string;
  public readonly remitente_id: string;
  public readonly contenido: string;
  public leido: boolean;
  public readonly enviado_en: Date;

  constructor(datos: IMensaje) {
    this._id = datos._id;
    this.conversacion_id = datos.conversacion_id;
    this.remitente_id = datos.remitente_id;
    this.contenido = datos.contenido;
    this.leido = datos.leido;
    this.enviado_en = datos.enviado_en;
  }

  // Marca el mensaje como leído
  marcarLeido(): void {
    this.leido = true;
  }
}
