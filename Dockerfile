# Dockerfile para Azure App Services
# Imagen multi-stage: build en stage 1, runtime en stage 2 (imagen más ligera)

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias primero (aprovecha caché de capas)
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript a JavaScript
RUN npm run build

# Eliminar devDependencies para la imagen final
RUN npm prune --production

# --- Stage 2: Runtime ---
FROM node:20-alpine

WORKDIR /app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3002

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copiar solo lo necesario desde el stage de build
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Exponer el puerto de la aplicación
EXPOSE 3002

# Usar usuario no-root
USER nodejs

# Health check para Azure App Services
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando de inicio
CMD ["node", "dist/index.js"]
