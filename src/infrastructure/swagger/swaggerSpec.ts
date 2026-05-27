import { OpenAPIV3 } from 'openapi-types';

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Microservicio de Mensajes — Arrendamientos CR',
    version: '1.0.0',
    description:
      'API REST para la gestión de mensajes en tiempo real entre arrendadores y arrendatarios. ' +
      'Incluye WebSocket (Socket.io) para entrega instantánea y publicación de eventos a Azure Service Bus.',
    contact: { name: 'Equipo de desarrollo', email: 'ma.zamora@estudiantec.cr' },
  },
  servers: [
    { url: 'https://ms-mensajes.azurewebsites.net', description: 'Producción (Azure App Service)' },
    { url: 'http://localhost:3002', description: 'Local' },
  ],
  tags: [
    { name: 'Mensajes', description: 'Envío de mensajes entre usuarios' },
    { name: 'Conversaciones', description: 'Gestión del historial de conversaciones' },
    { name: 'Sistema', description: 'Estado del servicio' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT emitido por el Microservicio de Usuarios (HS256).',
      },
    },
    schemas: {
      MensajeEnviado: {
        type: 'object',
        properties: {
          mensaje: { type: 'string', example: 'Mensaje enviado exitosamente' },
          datos: { $ref: '#/components/schemas/MensajeDatos' },
        },
      },
      MensajeDatos: {
        type: 'object',
        properties: {
          mensaje_id: { type: 'string', example: '66a1f3c2e4b09d2e1a3f9001' },
          conversacion_id: { type: 'string', example: '66a1f3c2e4b09d2e1a3f8fff' },
          remitente_id: { type: 'string', example: 'usr-001' },
          remitente_nombre: { type: 'string', example: 'Ana Arrendadora' },
          destinatario_id: { type: 'string', example: 'usr-002' },
          contenido: { type: 'string', example: 'Hola, ¿está disponible el apartamento?' },
          enviado_en: { type: 'string', format: 'date-time' },
        },
      },
      ConversacionResumen: {
        type: 'object',
        properties: {
          conversacion_id: { type: 'string' },
          propiedad_id: { type: 'string' },
          arrendador_id: { type: 'string' },
          arrendatario_id: { type: 'string' },
          ultimo_mensaje: { type: 'string' },
          ultima_actividad: { type: 'string', format: 'date-time' },
          mensajes_no_leidos: { type: 'integer', example: 3 },
        },
      },
      HistorialMensajes: {
        type: 'object',
        properties: {
          conversacion_id: { type: 'string' },
          mensajes: {
            type: 'array',
            items: { $ref: '#/components/schemas/MensajeDatos' },
          },
          pagina: { type: 'integer', example: 1 },
          limite: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 127 },
        },
      },
      ErrorRespuesta: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Campos requeridos: destinatario_id, propiedad_id, contenido' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Health check del servicio',
        security: [],
        responses: {
          200: {
            description: 'Servicio activo',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    servicio: { type: 'string', example: 'microservicio-mensajes' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/mensajes': {
      post: {
        tags: ['Mensajes'],
        summary: 'Enviar un nuevo mensaje',
        description:
          'Crea un nuevo mensaje en una conversación. Si la conversación no existe, se crea automáticamente. ' +
          'El mensaje se entrega en tiempo real vía WebSocket y se publica en Azure Service Bus.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['destinatario_id', 'propiedad_id', 'contenido', 'arrendador_id', 'arrendatario_id'],
                properties: {
                  destinatario_id: {
                    type: 'string',
                    description: 'ID del usuario que recibirá el mensaje',
                    example: 'usr-002',
                  },
                  propiedad_id: {
                    type: 'string',
                    description: 'ID de la propiedad sobre la que se conversa',
                    example: 'prop-abc123',
                  },
                  contenido: {
                    type: 'string',
                    description: 'Texto del mensaje (máx. 5000 caracteres)',
                    maxLength: 5000,
                    example: 'Hola, ¿está disponible el apartamento este mes?',
                  },
                  arrendador_id: {
                    type: 'string',
                    description: 'ID del arrendador en esta conversación',
                    example: 'usr-001',
                  },
                  arrendatario_id: {
                    type: 'string',
                    description: 'ID del arrendatario en esta conversación',
                    example: 'usr-002',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Mensaje enviado exitosamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MensajeEnviado' },
              },
            },
          },
          400: {
            description: 'Datos inválidos o faltantes',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
          401: {
            description: 'Token JWT inválido o ausente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
          403: {
            description: 'El remitente no participa en la conversación',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
        },
      },
    },
    '/api/mensajes/conversaciones': {
      get: {
        tags: ['Conversaciones'],
        summary: 'Listar conversaciones del usuario autenticado',
        description: 'Devuelve todas las conversaciones en las que participa el usuario identificado por el JWT, ordenadas por última actividad.',
        parameters: [
          {
            name: 'pagina',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
            description: 'Número de página',
          },
          {
            name: 'limite',
            in: 'query',
            schema: { type: 'integer', default: 20, maximum: 50 },
            description: 'Resultados por página (máx. 50)',
          },
        ],
        responses: {
          200: {
            description: 'Lista de conversaciones',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    conversaciones: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ConversacionResumen' },
                    },
                    pagina: { type: 'integer' },
                    limite: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: {
            description: 'No autorizado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
        },
      },
    },
    '/api/mensajes/conversaciones/{conversacion_id}/mensajes': {
      get: {
        tags: ['Conversaciones'],
        summary: 'Obtener historial de mensajes de una conversación',
        description: 'Devuelve los mensajes paginados de una conversación. Solo accesible para participantes de la conversación.',
        parameters: [
          {
            name: 'conversacion_id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID de la conversación',
            example: '66a1f3c2e4b09d2e1a3f8fff',
          },
          {
            name: 'pagina',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'limite',
            in: 'query',
            schema: { type: 'integer', default: 50, maximum: 100 },
            description: 'Máximo 100 mensajes por página',
          },
        ],
        responses: {
          200: {
            description: 'Historial de mensajes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HistorialMensajes' },
              },
            },
          },
          401: {
            description: 'No autorizado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
          403: {
            description: 'No eres participante de esta conversación',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
          404: {
            description: 'Conversación no encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
        },
      },
    },
    '/api/mensajes/conversaciones/{conversacion_id}/leido': {
      patch: {
        tags: ['Conversaciones'],
        summary: 'Marcar mensajes de una conversación como leídos',
        description: 'Actualiza el estado de todos los mensajes no leídos de la conversación para el usuario autenticado.',
        parameters: [
          {
            name: 'conversacion_id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'ID de la conversación',
          },
        ],
        responses: {
          200: {
            description: 'Mensajes marcados como leídos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mensaje: { type: 'string', example: 'Mensajes marcados como leídos' },
                    datos: {
                      type: 'object',
                      properties: {
                        mensajes_actualizados: { type: 'integer', example: 5 },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'No autorizado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorRespuesta' } } },
          },
        },
      },
    },
  },
};
