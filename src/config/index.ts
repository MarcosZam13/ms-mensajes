// Configuración centralizada de variables de entorno
// Todas las variables requeridas se cargan desde .env

import dotenv from 'dotenv';
dotenv.config();

function requerirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Variable de entorno requerida no definida: ${nombre}`);
  }
  return valor;
}

export const config = {
  puerto: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  esProduccion: process.env.NODE_ENV === 'production',

  mongodb: {
    uri: requerirEnv('MONGODB_URI'),
  },

  serviceBus: {
    connectionString: process.env.SERVICE_BUS_CONNECTION_STRING || '',
    topicName: process.env.SERVICE_BUS_TOPIC_NAME || 'mensajes-eventos',
  },

  jwt: {
    secret: requerirEnv('JWT_SECRET'),
    audience: process.env.JWT_AUDIENCE || '',
    issuer:   process.env.JWT_ISSUER   || '',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
