# Microservicio de Mensajes

Microservicio de mensajería en tiempo real para plataforma de arrendamientos de bienes raíces en Costa Rica. Permite la comunicación entre arrendadores y arrendatarios, publica eventos en Azure Service Bus y entrega actualizaciones en tiempo real vía WebSocket (Socket.io).

**Desplegado en:** `https://ms-mensajes.azurewebsites.net`
**Swagger UI:** `https://ms-mensajes.azurewebsites.net/docs/`

---

## Stack Tecnológico

| Componente       | Tecnología                          |
| ---------------- | ----------------------------------- |
| Runtime          | Node.js 22 LTS + TypeScript 5.5     |
| Framework HTTP   | Express 4                           |
| Base de datos    | Azure Cosmos DB (API MongoDB)       |
| ODM              | Mongoose 8                          |
| Mensajería       | Azure Service Bus (Topics)          |
| Tiempo real      | Socket.io 4 (WebSocket)             |
| Autenticación    | JWT HS256 (shared secret)           |
| Documentación    | Swagger UI (swagger-ui-express)     |
| Despliegue       | Azure App Service — ZIP deploy      |
| CI/CD            | GitHub Actions                      |

---

## Arquitectura

El proyecto sigue una arquitectura limpia en capas (domain → application → infrastructure → interfaces):

```
src/
├── domain/              # Entidades e interfaces (puertos)
│   ├── entities/        # Conversacion, Mensaje
│   └── interfaces/      # IConversacionRepository, IMensajeRepository, IServiceBusPublisher
├── application/         # Casos de uso (lógica de negocio)
│   └── use-cases/       # EnviarMensaje, ObtenerHistorico, ListarConversaciones, MarcarLeidos
├── infrastructure/      # Implementaciones concretas (adaptadores)
│   ├── database/        # Modelos Mongoose, repositorios, conexión Cosmos DB
│   ├── messaging/       # ServiceBusPublisher (opcional — no-op si no hay connection string)
│   ├── swagger/         # swaggerSpec.ts — especificación OpenAPI 3.0
│   ├── websocket/       # Socket.io setup (salas por usuario)
│   └── middleware/      # jwtMiddleware (HS256), errorHandler
├── interfaces/          # Adaptadores de entrada HTTP
│   ├── controllers/     # MensajesController
│   └── routes/          # mensajesRoutes — definición de endpoints
├── config/              # Configuración centralizada de variables de entorno
└── index.ts             # Punto de entrada — DI manual, inicialización
```

---

## Variables de entorno

Copia `.env.example` a `.env` y configura los valores:

```bash
cp .env.example .env
```

| Variable                        | Requerida | Descripción                                                          |
| ------------------------------- | --------- | -------------------------------------------------------------------- |
| `PORT`                          | No        | Puerto HTTP (default: `3002`)                                        |
| `NODE_ENV`                      | No        | `development` o `production` (default: `development`)                |
| `MONGODB_URI`                   | **Sí**    | Connection string a Azure Cosmos DB (API MongoDB)                    |
| `JWT_SECRET`                    | **Sí**    | Secret compartido con MS Usuarios para validar tokens HS256          |
| `SERVICE_BUS_CONNECTION_STRING` | No        | Connection string de `arrendamientos-sb1`. Si está vacía, los eventos se omiten silenciosamente. |
| `SERVICE_BUS_TOPIC_NAME`        | No        | Nombre del topic (default: `mensajes-eventos`)                       |
| `JWT_AUDIENCE`                  | No        | Audiencia esperada en el JWT (opcional)                              |
| `JWT_ISSUER`                    | No        | Emisor esperado en el JWT (opcional)                                 |
| `CORS_ORIGIN`                   | No        | Origen CORS permitido (default: `http://localhost:5173`)             |
| `LOG_LEVEL`                     | No        | Nivel de log: `debug`, `info`, `warn`, `error` (default: `info`)    |

---

## Instalación y ejecución local

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (hot reload)
npm run dev

# Verificar tipos TypeScript
npm run typecheck

# Compilar TypeScript → dist/
npm run build

# Ejecutar build compilado
npm start
```

El servicio estará disponible en:
- API: http://localhost:3002
- Health check: http://localhost:3002/health
- Swagger UI: http://localhost:3002/docs/
- Spec JSON: http://localhost:3002/docs.json

---

## Endpoints API

Todas las rutas bajo `/api/mensajes` (excepto `/health`) requieren JWT en el header `Authorization: Bearer <token>`.

| Método  | Ruta                                                  | Auth | Descripción                         |
| ------- | ----------------------------------------------------- | ---- | ----------------------------------- |
| `GET`   | `/health`                                             | No   | Health check del servicio           |
| `GET`   | `/docs/`                                              | No   | Swagger UI interactivo              |
| `GET`   | `/docs.json`                                          | No   | Especificación OpenAPI 3.0 (JSON)   |
| `POST`  | `/api/mensajes`                                       | Sí   | Enviar un nuevo mensaje             |
| `GET`   | `/api/mensajes/conversaciones`                        | Sí   | Listar conversaciones del usuario   |
| `GET`   | `/api/mensajes/conversaciones/:id/mensajes`           | Sí   | Obtener historial de conversación   |
| `PATCH` | `/api/mensajes/conversaciones/:id/leido`              | Sí   | Marcar mensajes como leídos         |

### Ejemplo: Enviar mensaje

```http
POST /api/mensajes
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "destinatario_id": "user-456",
  "propiedad_id": "prop-789",
  "contenido": "Hola, me interesa esta propiedad. ¿Sigue disponible?",
  "arrendador_id": "user-123",
  "arrendatario_id": "user-456"
}
```

**Respuesta (201):**
```json
{
  "mensaje": "Mensaje enviado exitosamente",
  "datos": {
    "mensaje_id": "66a1f3c2e4b09d2e1a3f9001",
    "conversacion_id": "66a1f3c2e4b09d2e1a3f8fff",
    "destinatario_id": "user-456",
    "contenido": "Hola, me interesa esta propiedad. ¿Sigue disponible?",
    "remitente_id": "user-123",
    "remitente_nombre": "Carlos Pérez",
    "enviado_en": "2026-05-20T22:00:00.000Z"
  }
}
```

---

## Autenticación (JWT HS256)

El token JWT es emitido por el **MS Usuarios** con algoritmo **HS256** y un secret compartido. El MS Mensajes lo valida y extrae el `user_id` del claim `sub`.

El `user_id` **nunca** se recibe del body de la petición — siempre se extrae del token firmado. Esto impide que un usuario suplante a otro.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## WebSocket (Socket.io)

El servidor expone WebSocket en la misma URL base. El cliente se suscribe a eventos en tiempo real:

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://ms-mensajes.azurewebsites.net', {
  transports: ['websocket'],
});

// Registrar el user_id para recibir mensajes en tiempo real
socket.emit('autenticar', 'user-456');

// Escuchar nuevos mensajes
socket.on('nuevo_mensaje', (data) => {
  console.log('Mensaje recibido:', data);
  // data = { mensaje_id, conversacion_id, remitente_id, remitente_nombre, contenido, enviado_en }
});
```

El servidor agrupa conexiones en salas `usuario:{user_id}` — cada usuario solo recibe sus propios mensajes.

---

## Eventos de Azure Service Bus

Al enviar un mensaje exitosamente, el MS Mensajes publica un evento en el topic configurado. Este evento es consumido por el MS Notificaciones para generar la notificación correspondiente.

```json
{
  "tipo": "nuevo_mensaje",
  "destinatario_id": "user-456",
  "remitente_nombre": "Carlos Pérez",
  "propiedad_id": "prop-789",
  "preview": "Hola, me interesa esta propiedad...",
  "conversacion_id": "66a1f3c2e4b09d2e1a3f8fff"
}
```

El Service Bus `arrendamientos-sb1` está activo en producción. Si `SERVICE_BUS_CONNECTION_STRING` no está configurada en entornos locales, la publicación se omite silenciosamente (el mensaje se guarda igualmente en Cosmos DB y se entrega por WebSocket).

---

## Despliegue en Azure App Service

El servicio está desplegado como **ZIP deploy** en `ms-mensajes.azurewebsites.net`.

### Despliegue manual (ZIP)

```bash
# 1. Instalar dependencias y compilar TypeScript
npm install
npm run build

# 2. Eliminar devDependencies
npm prune --production

# 3. Crear ZIP (dist/ + node_modules/ + package.json)
python3 -c "
import zipfile, os
with zipfile.ZipFile('deploy.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for folder in ['dist', 'node_modules']:
        for root, dirs, files in os.walk(folder):
            for file in files:
                full = os.path.join(root, file)
                zf.write(full, os.path.relpath(full))
    zf.write('package.json', 'package.json')
"

# 4. Desplegar
az webapp deploy \
  --resource-group JosephResourceGroup \
  --name ms-mensajes \
  --src-path deploy.zip \
  --type zip
```

El startup command configurado en Azure es: `node dist/index.js`

### Variables de entorno en Azure

Configuradas en Azure Portal → `ms-mensajes` → Configuration → Application settings:

| Variable | Valor en producción |
|---|---|
| `MONGODB_URI` | Connection string de `mongoclusterjoseph` |
| `MONGODB_DB_NAME` | `mensajes_db` |
| `JWT_SECRET` | `secret_seguro_aqui_123456789` |
| `SERVICE_BUS_TOPIC_NAME` | `mensajes-eventos` |
| `CORS_ORIGIN` | URL del frontend estático |
| `WEBSITES_PORT` | `3002` |
| `SERVICE_BUS_CONNECTION_STRING` | `Endpoint=sb://arrendamientos-sb1.servicebus.windows.net/;...` ✅ Configurada |

---

## GitHub Actions CI/CD

El workflow en `.github/workflows/deploy.yml` se activa al hacer push a `main`.

**Pasos del pipeline:**
1. `npm ci` — instala dependencias exactas del lock file
2. `tsc --noEmit` — verifica tipos sin generar archivos
3. `eslint` — verifica estilo de código
4. `npm run build` — compila TypeScript → `dist/`
5. ZIP deploy a Azure App Service

### Secrets requeridos en GitHub

| Secret | Descripción |
| ------ | ----------- |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | Publish profile del App Service `ms-mensajes` (descargar desde Azure Portal → ms-mensajes → Get publish profile) |

> **Pendiente:** actualizar el workflow de Docker/ACR a ZIP deploy. Ver ROADMAP.md para el YAML actualizado.
