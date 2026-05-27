// Middleware de autenticación JWT (HS256)
// Valida el token JWT que llega en el header Authorization: Bearer <token>.
// El token es emitido por el microservicio de usuarios con HS256 + shared secret.
// Extrae el user_id del token y lo adjunta al request para uso posterior.

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

export function middlewareJWT(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Token de autorización requerido' });
    return;
  }

  const partes = authHeader.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    res.status(401).json({ error: 'Formato de token inválido. Use: Bearer <token>' });
    return;
  }

  const token = partes[1];

  const options: jwt.VerifyOptions = {
    algorithms: ['HS256'],
  };

  if (config.jwt.audience) options.audience = config.jwt.audience;
  if (config.jwt.issuer)   options.issuer  = config.jwt.issuer;

  jwt.verify(token, config.jwt.secret, options, (err, decoded) => {
    if (err) {
      console.error('[JWT] Error de verificación:', err.message);

      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expirado' });
        return;
      }
      if (err.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Token inválido' });
        return;
      }
      if (err.name === 'NotBeforeError') {
        res.status(401).json({ error: 'Token aún no es válido' });
        return;
      }

      res.status(401).json({ error: 'Error de autenticación' });
      return;
    }

    const payload = decoded as jwt.JwtPayload;

    const userId = payload.sub || payload.oid || payload.user_id || payload.id;

    if (!userId) {
      res.status(401).json({ error: 'Token no contiene identificación de usuario' });
      return;
    }

    req.userId = String(userId);
    req.userName = payload.name || payload.given_name || String(userId);

    next();
  });
}
