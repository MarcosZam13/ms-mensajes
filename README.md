# Microservicio de Mensajes (`ms-mensajes`)

Servicio de mensajería en tiempo real para la plataforma de arrendamientos de bienes raíces en Costa Rica. Gestiona conversaciones entre arrendadores y arrendatarios, persiste mensajes en Azure Cosmos DB (API MongoDB) y distribuye eventos al microservicio de notificaciones vía Azure Service Bus.

**Desplegado en:** `https://ms-mensajes.azurewebsites.net`  
**Repositorio:** `https://github.com/MarcosZam13/ms-mensajes`  
**Runtime:** Node.js 22 · TypeScript · Express · Socket.io 4

---

## Tabla de contenidos

1. [Arquitectura interna](#1-arquitectura-interna)
2. [Endpoints REST](#2-endpoints-rest)
3. [WebSocket (Socket.io)](#3-websocket-socketio)
4. [Modelos de datos](#4-modelos-de-datos)
5. [Flujo completo de un mensaje](#5-flujo-completo-de-un-mensaje)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Ejecutar localmente](#7-ejecutar-localmente)
8. [CI/CD — GitHub Actions](#8-cicd--github-actions)
9. [Seguridad](#9-seguridad)
10. [Estructura del proyecto](#10-estructura-del-proyecto)

---

## 1. Arquitectura interna

El microservicio sigue **arquitectura hexagonal** (puertos y adaptadores):

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACES (HTTP / WS)                │
│  MensajesController  ←→  mensajesRoutes                  │
│  middlewareJWT            socketSetup (Socket.io)        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   APPLICATION (casos de uso)             │
│  EnviarMensaje  ObtenerHistorico                         │
│  ListarConversaciones  MarcarLeidos                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                     DOMAIN (entidades)                   │
│  Conversacion  Mensaje                                   │
│  IConversacionRepository  IMensajeRepository             │
│  IServiceBusPublisher                                    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               INFRASTRUCTURE (adaptadores)               │
│  MongoConversacionRepository  MongoMensajeRepository     │
│  ServiceBusPublisher  socketSetup  errorHandler          │
└─────────────────────────────────────────────────────────┘
```

**Dependencias externas:**
- **Azure Cosmos DB (API MongoDB)** — persistencia de conversaciones y mensajes
- **Azure Service Bus** — publica eventos `nuevo_mensaje` para ms-notificaciones
- **Socket.io 4** — canal WebSocket para mensajes en tiempo real al destinatario

---

## 2. Endpoints REST

Todas las rutas (excepto `/health`) requieren el header:
```
Authorization: Bearer <JWT>
```

El JWT es validado con HS256 + `JWT_SECRET`. El `user_id` se extrae del claim `sub` del token; **nunca** se acepta del body o query params.

---

### `POST /api/mensajes`

Envía un mensaje en una conversación. Crea la conversación automáticamente si no existe (idempotente: una sola conversación por propiedad + par de usuarios).

**Body:**
```json
{
  "destinatario_id": "string",
  "propiedad_id":    "string",
  "contenido":       "string (1–5000 chars)",
  "arrendador_id":   "string",
  "arrendatario_id": "string"
}
```

**Validaciones:**
- Todos los campos deben ser `string` no vacío (protección contra inyección NoSQL)
- `contenido` entre 1 y 5000 caracteres (trimmed)
- El remitente (del JWT) debe ser igual a `arrendador_id` **o** `arrendatario_id`
- El remitente no puede coincidir con `destinatario_id` (no mensajes a sí mismo)

**Respuesta 201:**
```json
{
  "mensaje": "Mensaje enviado exitosamente",
  "datos": {
    "mensaje_id":       "string",
    "conversacion_id":  "string",
    "destinatario_id":  "string",
    "remitente_id":     "string",
    "remitente_nombre": "string",
    "contenido":        "string",
    "enviado_en":       "ISO 8601"
  }
}
```

**Efectos secundarios (asíncronos, no bloquean la respuesta):**
1. Emite evento `nuevo_mensaje` por Socket.io al destinatario (si está conectado)
2. Publica evento en Azure Service Bus → ms-notificaciones lo consume

---

### `GET /api/mensajes/conversaciones`

Lista las conversaciones del usuario autenticado con el último mensaje y conteo de no leídos.

**Query params:**

| Param    | Default | Máximo |
|----------|---------|--------|
| `pagina` | `1`     | —      |
| `limite` | `20`    | `50`   |

**Respuesta 200:**
```json
{
  "pagina": 1,
  "limite": 20,
  "total": 3,
  "conversaciones": [
    {
      "conversacion_id":   "string",
      "propiedad_id":      "string",
      "arrendador_id":     "string",
      "arrendatario_id":   "string",
      "ultimo_mensaje":    "Hola, ¿sigue disponible?",
      "ultimo_enviado_en": "2026-05-27T14:30:00.000Z",
      "no_leidos":         2,
      "creado_en":         "2026-05-20T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/mensajes/conversaciones/:conversacion_id/mensajes`

Historial paginado de mensajes de una conversación. Verifica que el usuario autenticado sea participante antes de devolver datos.

**Query params:**

| Param    | Default | Máximo |
|----------|---------|--------|
| `pagina` | `1`     | —      |
| `limite` | `50`    | `100`  |

**Respuesta 200:**
```json
{
  "conversacion_id": "string",
  "propiedad_id":    "string",
  "pagina":          1,
  "limite":          50,
  "total":           42,
  "mensajes": [
    {
      "id":           "string",
      "remitente_id": "string",
      "contenido":    "string",
      "leido":        false,
      "enviado_en":   "ISO 8601"
    }
  ]
}
```

---

### `PATCH /api/mensajes/conversaciones/:conversacion_id/leido`

Marca como leídos todos los mensajes **del otro participante** en la conversación (los que aún no ha leído el usuario autenticado).

**Respuesta 200:**
```json
{
  "mensaje": "Mensajes marcados como leídos",
  "datos": {
    "conversacion_id":       "string",
    "mensajes_actualizados": 3
  }
}
```

---

### `GET /health`

Health check sin autenticación. Útil para Azure App Service health probes y APIM.

```json
{
  "servicio":  "microservicio-mensajes",
  "version":   "1.0.0",
  "status":    "healthy",
  "timestamp": "ISO 8601"
}
```

---

### Códigos de error comunes

| Código | Causa                                                    |
|--------|----------------------------------------------------------|
| `400`  | Campo inválido, no-string, vacío o excede longitud       |
| `401`  | Token JWT ausente, expirado o inválido                   |
| `403`  | El usuario no participa en la conversación               |
| `404`  | Conversación no encontrada                               |
| `500`  | Error interno (ver logs de Azure App Service)            |

---

## 3. WebSocket (Socket.io)

El servidor Socket.io corre en la misma URL HTTP del servicio (mismo puerto).

### Conexión y autenticación

El JWT se pasa en el **handshake** de Socket.io (`auth.token`). El servidor lo valida en un middleware `io.use()` **antes** de que la conexión sea aceptada.

```javascript
// Ejemplo de conexión (frontend)
import { io } from 'socket.io-client';

const socket = io('https://ms-mensajes.azurewebsites.net', {
  transports: ['websocket'],
  auth: { token: jwtToken },  // JWT validado por io.use() en el servidor
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});
```

Si el token es inválido, la conexión es rechazada con código de error `TOKEN_INVALIDO` antes de que se dispare ningún evento.

---

### Eventos cliente → servidor

| Evento       | Payload          | Descripción                                                                             |
|--------------|------------------|-----------------------------------------------------------------------------------------|
| `autenticar` | `userId: string` | Solicita unirse a la sala privada. El servidor **ignora** el userId del evento y usa el del JWT. |

---

### Eventos servidor → cliente

| Evento          | Payload                                                                                       | Descripción                        |
|-----------------|-----------------------------------------------------------------------------------------------|------------------------------------|
| `autenticado`   | `{ mensaje: string }`                                                                         | Confirmación: sala unida           |
| `nuevo_mensaje` | `{ mensaje_id, conversacion_id, remitente_id, remitente_nombre, contenido, enviado_en }`      | Mensaje entrante en tiempo real    |
| `error`         | `{ mensaje: string }`                                                                         | Error del servidor                 |

---

### Flujo de conexión

```
Cliente                                   Servidor
  │                                           │
  │── io(URL, { auth: { token } }) ──────────►│
  │                                           │
  │                              [io.use middleware]
  │                                           │── jwt.verify(token, secret)
  │                                           │   OK → socket.data.userId = sub
  │                                           │   FAIL → next(Error('TOKEN_INVALIDO'))
  │                                           │
  │◄── socket.id asignado ───────────────────│ (conexión aceptada)
  │                                           │
  │── emit('autenticar', userId) ────────────►│
  │                              [ignorar userId del evento]
  │                                           │── socket.join(`usuario:${socket.data.userId}`)
  │◄── emit('autenticado') ──────────────────│
  │                                           │
  │                   [otro usuario envía mensaje]
  │◄── emit('nuevo_mensaje', payload) ───────│ io.to(`usuario:${destinatario_id}`)
```

---

### Multi-dispositivo

Un usuario puede tener múltiples conexiones activas (distintos dispositivos/pestañas). El servidor usa un `Map<userId, Set<socketId>>` para rastrearlas. Cuando se desconecta un socket, se elimina del set; si el set queda vacío, se elimina la entrada del mapa.

---

## 4. Modelos de datos

### Colección `conversaciones`

| Campo             | Tipo     | Descripción                                      |
|-------------------|----------|--------------------------------------------------|
| `_id`             | ObjectId | Generado por Cosmos DB                           |
| `propiedad_id`    | string   | ID de la propiedad asociada                      |
| `arrendador_id`   | string   | ID del usuario arrendador                        |
| `arrendatario_id` | string   | ID del usuario arrendatario                      |
| `creado_en`       | Date     | Fecha de creación                                |

**Índices:**
- `{ propiedad_id, arrendador_id, arrendatario_id }` — **único compuesto** (máximo una conversación por propiedad + par de usuarios)
- `{ arrendador_id, creado_en: -1 }` — listado de conversaciones del arrendador
- `{ arrendatario_id, creado_en: -1 }` — listado de conversaciones del arrendatario

---

### Colección `mensajes`

| Campo             | Tipo     | Descripción                            |
|-------------------|----------|----------------------------------------|
| `_id`             | ObjectId | Generado por Cosmos DB                 |
| `conversacion_id` | string   | FK → `conversaciones._id`             |
| `remitente_id`    | string   | ID del usuario que envió el mensaje    |
| `contenido`       | string   | Texto del mensaje (máx. 5000 chars)    |
| `leido`           | boolean  | `false` hasta que el destinatario lo marque como leído |
| `enviado_en`      | Date     | Timestamp de envío                     |

**Índices:**
- `{ conversacion_id, enviado_en: -1 }` — historial paginado ordenado descendentemente
- `{ conversacion_id, remitente_id, leido }` — marcar mensajes no leídos eficientemente

---

## 5. Flujo completo de un mensaje

```
Frontend (remitente)
  │
  │  POST /api/mensajes
  │  Body: { destinatario_id, propiedad_id, contenido, arrendador_id, arrendatario_id }
  │  Authorization: Bearer <JWT>
  ▼
middlewareJWT
  │── Valida firma + expiración del JWT (HS256)
  │── Extrae remitente_id = claims.sub
  ▼
MensajesController.enviar()
  │── Valida tipos (todos string, sin objetos MongoDB)
  │── Valida que remitente ∈ { arrendador_id, arrendatario_id }
  │── Valida que remitente ≠ destinatario
  ▼
EnviarMensaje.ejecutar()
  │── conversacionRepo.encontrarOCrear(propiedad_id, arrendador_id, arrendatario_id)
  │   → Upsert con índice único → idempotente
  │── mensajeRepo.guardar({ conversacion_id, remitente_id, contenido })
  │── destinatario_id = conversacion.otroParticipante(remitente_id)
  │   → Derivado del servidor, no del body del cliente
  │
  │── serviceBusPublisher.publicarEvento({       ← FIRE & FORGET (no bloquea respuesta)
  │     tipo: 'nuevo_mensaje',
  │     destinatario_id,
  │     remitente_nombre,
  │     propiedad_id,
  │     preview,
  │     conversacion_id
  │   })
  ▼
MensajesController (continúa)
  │── emitirNuevoMensaje(resultado.destinatario_id, payload)  ← WebSocket inmediato
  │   io.to(`usuario:${destinatario_id}`).emit('nuevo_mensaje', ...)
  │── res.status(201).json(resultado)
  ▼
Frontend (destinatario, si conectado por WebSocket)
  │◄── evento 'nuevo_mensaje' llega en tiempo real
  ▼
Azure Service Bus (topic: mensajes-eventos)
  │── MS Notificaciones consume el evento
  │── Persiste notificación en Cosmos DB
  │── Emite notificación por WebSocket nativo (/ws/{userId})
  │── Envía push notification FCM (si hay token registrado)
```

---

## 6. Variables de entorno

Crear `.env` en la raíz del proyecto (no commitear, ya está en `.gitignore`):

```env
# ── Servidor ─────────────────────────────────────────────
PORT=3002
NODE_ENV=development

# ── Base de datos ─────────────────────────────────────────
MONGODB_URI=mongodb+srv://<usuario>:<clave>@<cuenta>.mongo.cosmos.azure.com/?ssl=true&retrywrites=false

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=cambiar-por-clave-segura-min-32-caracteres
# JWT_AUDIENCE=           # opcional
# JWT_ISSUER=             # opcional

# ── Azure Service Bus ─────────────────────────────────────
SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=...;SharedAccessKey=...
SERVICE_BUS_TOPIC_NAME=mensajes-eventos

# ── CORS ──────────────────────────────────────────────────
CORS_ORIGIN=https://agreeable-ground-0b1436910.6.azurestaticapps.net
```

| Variable                         | Requerida | Default               | Descripción                                   |
|----------------------------------|-----------|-----------------------|-----------------------------------------------|
| `MONGODB_URI`                    | ✅        | —                     | Cadena de conexión Cosmos DB (API MongoDB)     |
| `JWT_SECRET`                     | ✅        | —                     | Secreto HS256 compartido con MS Usuarios       |
| `SERVICE_BUS_CONNECTION_STRING`  | ⬜        | —                     | Si falta, los eventos a notificaciones se omiten silenciosamente |
| `SERVICE_BUS_TOPIC_NAME`         | ⬜        | `mensajes-eventos`    | Topic de Azure Service Bus                    |
| `CORS_ORIGIN`                    | ⬜        | `http://localhost:5173` | Origen permitido por CORS                   |
| `PORT`                           | ⬜        | `3002`                | Puerto del servidor HTTP                      |
| `JWT_AUDIENCE`                   | ⬜        | —                     | Validar claim `aud` del JWT                   |
| `JWT_ISSUER`                     | ⬜        | —                     | Validar claim `iss` del JWT                   |

---

## 7. Ejecutar localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correctos

# 3. Desarrollo con hot-reload
npm run dev

# 4. Compilar y ejecutar build de producción
npm run build
npm start
```

**Endpoints disponibles localmente:**
- API REST: `http://localhost:3002/api/mensajes`
- Swagger UI: `http://localhost:3002/docs`
- Health check: `http://localhost:3002/health`
- WebSocket: `ws://localhost:3002`

---

## 8. CI/CD — GitHub Actions

El workflow `.github/workflows/deploy.yml` se activa automáticamente en cada `git push` a la rama `main`.

**Pasos del workflow:**

```
1. Checkout           actions/checkout@v4
2. Setup Node.js 22   actions/setup-node@v4 (con caché npm)
3. npm ci             instala dependencias exactas del lockfile
4. npm run build      compila TypeScript → dist/
5. zip deploy.zip     empaqueta dist/ + package.json + package-lock.json
6. curl Kudu API      POST /api/zipdeploy → Azure App Service
```

**Secrets requeridos en GitHub (Settings → Secrets → Actions):**

| Secret                    | Valor                        |
|---------------------------|------------------------------|
| `KUDU_USER_MS_MENSAJES`   | `$ms-mensajes` (literal con `$`) |
| `KUDU_PASS_MS_MENSAJES`   | Contraseña del perfil de publicación de Azure |

> **¿Por qué dos secrets?** El usuario de Azure siempre empieza con `$`. Al almacenarlo como un único secret `$usuario:contraseña` y usarlo en bash (`-u "$CRED"`), bash lo expande silenciosamente a `:contraseña` → HTTP 401. Al separarlos, bash expande `${KUDU_USER}` como variable de entorno, no como expansión de `$` en el valor.

---

## 9. Seguridad

### Autenticación JWT (endpoints HTTP)
- Middleware `jwtMiddleware` valida firma + expiración en cada request protegido.
- `userId` extraído exclusivamente del claim `sub` del JWT verificado.
- Soporta claims alternativos: `oid`, `user_id`, `id` (compatibilidad con distintos emisores).

### Autenticación JWT (WebSocket)
- Middleware `io.use()` valida el JWT en el **handshake** (antes de aceptar la conexión).
- Conexiones sin token → rechazadas con `TOKEN_REQUERIDO`.
- Conexiones con token inválido/expirado → rechazadas con `TOKEN_INVALIDO`.
- El evento `autenticar` del cliente es ignorado en su campo de userId; siempre se usa `socket.data.userId` (del token).

### Protección contra inyección NoSQL
- Todos los campos de `req.body` son validados como `typeof valor === 'string'` antes de llegar a los repositorios.
- Impide ataques como `{ "$gt": "" }` en campos esperados como string.

### Autorización por conversación
- `ObtenerHistorico` y `MarcarLeidos` verifican `conversacion.participa(userId)` antes de retornar datos.
- Si el usuario no participa, devuelven `403` sin revelar si la conversación existe.

### Emisión WebSocket sin IDOR
- `emitirNuevoMensaje` recibe `resultado.destinatario_id` (derivado por el servidor de la conversación persistida), **no** el `destinatario_id` del body del cliente. Un cliente malicioso no puede dirigir eventos a otro usuario.

### Tamaño de payload
- `express.json({ limit: '10kb' })` rechaza bodies superiores a 10 KB.

---

## 10. Estructura del proyecto

```
ms-mensajes/
├── src/
│   ├── config/
│   │   └── index.ts                       # Variables de entorno + validación al inicio
│   ├── domain/                            # Núcleo del negocio — sin dependencias externas
│   │   ├── entities/
│   │   │   ├── Conversacion.ts            # participa(), otroParticipante()
│   │   │   └── Mensaje.ts                 # marcarLeido()
│   │   └── interfaces/
│   │       ├── IConversacionRepository.ts # Puerto: encontrarOCrear, obtenerPorId, listarPorUsuario
│   │       ├── IMensajeRepository.ts      # Puerto: guardar, obtenerPorConversacion, marcarLeidos
│   │       └── IServiceBusPublisher.ts    # Puerto: publicarEvento
│   ├── application/                       # Casos de uso — orquestan dominio e infraestructura
│   │   └── use-cases/
│   │       ├── EnviarMensaje.ts           # Conversa + mensaje + Service Bus + WS
│   │       ├── ObtenerHistorico.ts        # Historial paginado con autorización
│   │       ├── ListarConversaciones.ts    # Lista conversaciones del usuario
│   │       └── MarcarLeidos.ts            # Marca mensajes del otro participante como leídos
│   ├── infrastructure/                    # Adaptadores — implementan los puertos del dominio
│   │   ├── database/
│   │   │   ├── connection.ts              # Mongoose → Cosmos DB
│   │   │   ├── models/
│   │   │   │   ├── ConversacionModel.ts   # Schema Mongoose + índices únicos
│   │   │   │   └── MensajeModel.ts        # Schema Mongoose + índices de historial
│   │   │   └── repositories/
│   │   │       ├── MongoConversacionRepository.ts  # Implementa IConversacionRepository
│   │   │       └── MongoMensajeRepository.ts       # Implementa IMensajeRepository
│   │   ├── messaging/
│   │   │   └── ServiceBusPublisher.ts     # Implementa IServiceBusPublisher — Azure SDK
│   │   ├── middleware/
│   │   │   ├── jwtMiddleware.ts           # Valida JWT HS256 en requests HTTP
│   │   │   └── errorHandler.ts            # Manejo centralizado + formato consistente de errores
│   │   ├── swagger/
│   │   │   └── swaggerSpec.ts             # Especificación OpenAPI 3.0
│   │   └── websocket/
│   │       └── socketSetup.ts             # Socket.io: middleware JWT + salas + emisión
│   ├── interfaces/                        # Adaptadores de entrada — HTTP y WebSocket
│   │   ├── controllers/
│   │   │   └── MensajesController.ts      # Extrae params, invoca UC, formatea respuesta
│   │   └── routes/
│   │       └── mensajesRoutes.ts          # Router Express con middlewares
│   ├── types/
│   │   └── express.d.ts                   # Augmentación: req.userId, req.userName
│   └── index.ts                           # Bootstrap: wiring DI manual + servidor HTTP
├── .github/
│   └── workflows/
│       └── deploy.yml                     # CI/CD: build TypeScript + Kudu ZIP deploy
├── .env.example                           # Plantilla de variables de entorno
├── package.json
├── tsconfig.json
└── README.md
```
