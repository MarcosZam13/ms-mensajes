// Middleware de manejo centralizado de errores
// Captura errores no manejados y responde con formato consistente.

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message, config.esProduccion ? '' : err.stack);

  // Errores conocidos (lanzados por casos de uso)
  if (
    err.message.includes('no encontrada') ||
    err.message.includes('no encontrado')
  ) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (
    err.message.includes('Acceso denegado') ||
    err.message.includes('no pertenece')
  ) {
    res.status(403).json({ error: err.message });
    return;
  }

  if (err.message.includes('propio')) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    res.status(400).json({ error: 'Datos inválidos', detalles: err.message });
    return;
  }

  // Error de duplicado (índice único)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((err as any).code === 11000) {
    res.status(409).json({ error: 'El recurso ya existe' });
    return;
  }

  // Error desconocido — en producción no exponemos el mensaje real
  res.status(500).json({
    error: config.esProduccion
      ? 'Error interno del servidor'
      : err.message,
  });
}
