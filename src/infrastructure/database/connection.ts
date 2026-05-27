// Conexión a Azure Cosmos DB (API de MongoDB) usando Mongoose
// Configuración optimizada para Cosmos DB: SSL, retryWrites=false, réplica globaldb.

import mongoose from 'mongoose';
import { config } from '../../config';

export async function conectarBaseDeDatos(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
      // Cosmos DB requiere SSL y configuraciones específicas
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log('[DB] Conectado a Azure Cosmos DB (MongoDB API)');

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Error de conexión:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] Desconectado de Cosmos DB');
    });
  } catch (error) {
    console.error('[DB] Error al conectar a Cosmos DB:', error);
    process.exit(1);
  }
}
