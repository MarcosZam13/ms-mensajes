// Extensión de tipos de Express Request
// Agrega userId y userName al request después de la validación JWT

declare namespace Express {
  interface Request {
    userId?: string;
    userName?: string;
  }
}
