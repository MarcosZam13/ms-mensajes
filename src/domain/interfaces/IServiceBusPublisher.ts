// Puerto: Publicador de eventos en Azure Service Bus
// Abstrae la publicación de eventos para desacoplar el dominio de Azure.

export interface EventoNuevoMensaje {
  tipo: 'nuevo_mensaje';
  destinatario_id: string;
  remitente_nombre: string;
  propiedad_id: string;
  preview: string;
  conversacion_id: string;
}

export interface IServiceBusPublisher {
  // Publica un evento en el tópico de Azure Service Bus
  publicarEvento(evento: EventoNuevoMensaje): Promise<void>;
}
