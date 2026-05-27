import { ServiceBusClient } from '@azure/service-bus';
import {
  IServiceBusPublisher,
  EventoNuevoMensaje,
} from '../../domain/interfaces/IServiceBusPublisher';
import { config } from '../../config';

export class ServiceBusPublisher implements IServiceBusPublisher {
  private cliente: ServiceBusClient | null = null;
  private sender: ReturnType<ServiceBusClient['createSender']> | null = null;
  private readonly habilitado: boolean;

  constructor() {
    this.habilitado = !!config.serviceBus.connectionString;

    if (this.habilitado) {
      this.cliente = new ServiceBusClient(config.serviceBus.connectionString);
      this.sender = this.cliente.createSender(config.serviceBus.topicName);
      console.log(`[ServiceBus] Tópico: ${config.serviceBus.topicName}`);
    } else {
      console.warn('[ServiceBus] SERVICE_BUS_CONNECTION_STRING no configurada — eventos deshabilitados');
    }
  }

  async publicarEvento(evento: EventoNuevoMensaje): Promise<void> {
    if (!this.habilitado || !this.sender) {
      console.warn('[ServiceBus] Evento ignorado (Service Bus no configurado):', evento.tipo);
      return;
    }

    const mensaje = {
      body: evento,
      contentType: 'application/json',
      messageId: `${evento.conversacion_id}-${Date.now()}`,
      applicationProperties: {
        tipo: evento.tipo,
        destinatario_id: evento.destinatario_id,
      },
    };

    try {
      await this.sender.sendMessages(mensaje);
      console.log(`[ServiceBus] Evento publicado: ${evento.tipo} -> ${evento.destinatario_id}`);
    } catch (error) {
      console.error('[ServiceBus] Error al publicar evento:', error);
      throw error;
    }
  }

  async cerrar(): Promise<void> {
    if (this.sender) await this.sender.close();
    if (this.cliente) await this.cliente.close();
  }
}
