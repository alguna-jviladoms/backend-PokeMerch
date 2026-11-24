# Guía de estudio: autenticación con tokens

Este documento explica los ejercicios de autenticación añadidos al backend PokeMerch. Los nombres de duración y las respuestas descritos aquí corresponden a la implementación actual. Los pasos 1 a 4 describen el canal JSON; el paso 5 añade el canal del navegador con cookies `HttpOnly` y un ciclo de vida distinto.

## Paso 1: emitir access token y refresh token

### Para qué sirven

- **Access token:** credencial de corta duración que se envía al acceder a rutas protegidas. Por defecto dura 15 minutos.
- **Refresh token:** credencial de mayor duración que servirá para pedir un access token nuevo sin volver a escribir las credenciales. Por defecto dura 7 días.

Separar las credenciales limita el tiempo de uso de un access token robado y permite mantener la sesión sin iniciar sesión repetidamente.

### Archivos y responsabilidades

- `api/src/routes/authRoutes.js` enlaza `POST /api/auth/login` y `POST /api/auth/register` con el controlador.
- `api/src/controllers/authController.js` entrega el body al servicio y responde con JSON y el estado HTTP.
- `api/src/services/authService.js` comprueba credenciales y coordina usuario y tokens.
- `api/src/services/token/tokenService.js` firma, persiste, rota y revoca los tokens.
- `api/src/services/userService.js` valida y crea usuarios; BCrypt guarda solo el hash de la contraseña.
- `api/src/models/Usuari.js` define los datos del usuario persistido.
- `api/src/models/Tokens.js` conserva una sesión por inicio de sesión y guarda solo el hash del refresh token vigente.

### Recorrido del login

1. Postman manda email y contraseña a `POST /api/auth/login`.
2. La ruta llama a `authController.login`.
3. El controlador delega en `authService.login`.
4. El servicio busca el email en MongoDB y compara la contraseña con el hash BCrypt.
5. Si la cuenta está activa y la contraseña coincide, `authService` pide a `tokenService.issueTokens` que cree los dos JWT y registre la sesión en MongoDB.
6. El controlador devuelve el usuario público y ambos tokens en `data`.

El registro usa la misma respuesta de autenticación: después de crear la cuenta, el usuario queda con la sesión iniciada.

### Claims y firma

Los dos JWT identifican al usuario mediante `sub`. El access token contiene también su rol y `tokenUse: "access"`; el refresh token contiene `tokenUse: "refresh"`, el identificador de sesión `sid` y el identificador único `jti`. No se incluyen contraseña, hash, email ni otros datos personales. Las claves de firma son distintas: `JWT_SECRET` para access y `JWT_REFRESH_SECRET` para refresh. Ambos usan HS256.

Un JWT firmado no está cifrado. Cualquiera que obtenga el token puede leer sus claims, por eso el payload debe ser pequeño y no contener secretos.

### Configuración local

En `api/.env` hay que configurar dos valores aleatorios distintos de al menos 32 bytes:

```dotenv
JWT_SECRET=secreto_aleatorio_para_access
JWT_REFRESH_SECRET=otro_secreto_aleatorio_para_refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Para generar cada secreto en Node.js, ejecuta dos veces:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

El archivo `.env` es local e ignorado por Git. No copies los valores reales a capturas, documentación compartida o commits.

### Probar con Postman

Usa `POST http://localhost:3000/api/auth/login`, el header `Content-Type: application/json` y **Body → raw → JSON**:

```json
{
  "email": "registro@example.com",
  "password": "UnaClaveLocal-2026!"
}
```

La respuesta correcta es HTTP `200` y tiene esta estructura (los valores se muestran abreviados):

```json
{
  "success": true,
  "data": {
    "user": { "_id": "…", "name": "Usuario de prueba", "email": "registro@example.com", "role": "client", "active": true },
    "accessToken": "<JWT de corta duración>",
    "refreshToken": "<JWT de larga duración>",
    "tokenType": "Bearer",
    "accessTokenExpiresIn": "15m",
    "refreshTokenExpiresIn": "7d"
  }
}
```

El registro es `POST /api/auth/register`, acepta `name`, `email` y `password` y responde HTTP `201` con la misma estructura de sesión. Ninguna respuesta incluye `passwordHash`.

## Paso 2: mantener la sesión con rotación de refresh tokens

### Idea de la rotación

Cada refresh token solo puede renovar una vez. El cliente manda el token vigente a `/api/auth/refresh`; el servidor verifica firma y expiración, comprueba que corresponde al token actual guardado para esa sesión, lo sustituye por un hash del siguiente refresh token y devuelve un nuevo par. El cliente debe reemplazar los dos tokens antiguos por los nuevos.

### Archivos implicados

- `api/src/routes/authRoutes.js` declara `POST /refresh`.
- `api/src/controllers/authController.js` recibe la petición y devuelve HTTP `200`.
- `api/src/services/authService.js` valida el body y delega la rotación en `tokenService`.
- `api/src/services/token/tokenService.js` verifica el JWT, prepara el siguiente par y actualiza la sesión.
- `api/src/models/Tokens.js` guarda `userId`, `currentJti`, el hash del token, expiración y estado de revocación.

### Qué protege el almacenamiento

La base de datos no conserva el refresh token original: almacena su huella SHA-256. El `jti` identifica cuál es el token vigente, y el `sid` vincula los tokens de una familia con una sesión concreta. Cada nuevo login crea una sesión independiente, por ejemplo una en el portátil y otra en el móvil.

MongoDB actualiza el hash y el `jti` con una sola operación condicional. Si dos peticiones intentan consumir el mismo token a la vez, solo una puede actualizar el registro. La otra detecta que el token presentado ya no es el vigente, marca la sesión como revocada y responde `401 REFRESH_TOKEN_REUSED`. El usuario debe volver a iniciar sesión para crear una sesión nueva. El paso 4 vincula también el access token a esta sesión para cortar su uso después de la revocación.

Un índice TTL elimina de MongoDB las sesiones después de su fecha de expiración. MongoDB puede ejecutar esa limpieza con cierto retraso; por eso el servicio también comprueba `expiresAt` y la expiración propia del JWT antes de rotar.

### Probar la rotación en Postman

Usa `POST http://localhost:3000/api/auth/refresh`, el header `Content-Type: application/json` y el body:

```json
{
  "refreshToken": "<refresh token vigente>"
}
```

La respuesta `200` contiene el usuario público y un nuevo `accessToken` y `refreshToken`. Copia el refresh token antiguo antes de la primera rotación: si lo mandas de nuevo después de una rotación correcta, deberías obtener `401 REFRESH_TOKEN_REUSED` y la sesión quedará revocada. Después de esa prueba, inicia sesión otra vez para obtener una sesión nueva.

### Qué queda para los próximos pasos

El paso 3 añade el middleware que valida el access token. En la primera versión, los access tokens seguían válidos hasta caducar; el paso 4 los vincula a una sesión revocable para poder invalidarlos antes.

## Paso 3: proteger rutas con middleware JWT

### Qué hace el middleware

`api/src/middleware/authenticateToken.js` se ejecuta antes de los controladores de productos, categorías y usuarios. Lee `Authorization`, exige el formato `Bearer <token>` y verifica el JWT con la clave de access y el algoritmo HS256. `jsonwebtoken` también comprueba la firma y el vencimiento (`exp`). El middleware exige `tokenUse: "access"` para impedir que un refresh token se use como credencial de una ruta.

Cuando el token es correcto, deja una identidad verificada en `req.auth`:

```js
req.auth = { userId: claims.sub, sessionId: claims.sid, role: claims.role };
```

Los controladores pueden usar `req.auth` para saber quién hizo la petición. Si falta el encabezado responde `401 AUTHENTICATION_REQUIRED`; si el token no vale, caducó o es de tipo refresh responde `401 INVALID_ACCESS_TOKEN`.

### Dónde se aplica

- `api/src/routes/productRoutes.js` llama `router.use(authenticateToken)` antes de todas las rutas de productos.
- `api/src/routes/categoryRoutes.js` hace lo mismo para todas las rutas de categorías.
- `api/src/routes/userRoutes.js` exige access token y además conserva la comprobación de desarrollo local.
- `/api/auth/register`, `/api/auth/login` y `/api/auth/refresh` no usan este middleware. Registro/login son necesarios antes de tener access token; refresh verifica su propio token dentro del servicio. `/api/auth/logout` sí exige un access token.
- `GET /` continúa público para comprobar que la API está activa.

### Probar con Postman

1. Haz login y copia `data.accessToken` de la respuesta.
2. Prueba, por ejemplo, `GET http://localhost:3000/api/categories` sin header: debe responder `401 AUTHENTICATION_REQUIRED`.
3. Añade el header `Authorization` con valor `Bearer <accessToken>` y repite la petición: el middleware permitirá llegar al controlador.
4. Prueba como token un refresh token o una cadena inventada: debe responder `401 INVALID_ACCESS_TOKEN`.
5. Después de 15 minutos, el access token caduca. Usa `/api/auth/refresh` con el refresh token actual para recibir un nuevo par y reemplaza los valores anteriores.

Si quieres que Postman guarde los tokens automáticamente, en **Scripts → Post-response** de la petición de login puedes poner:

```js
const body = pm.response.json();
pm.environment.set("accessToken", body.data.accessToken);
pm.environment.set("refreshToken", body.data.refreshToken);
```

En la petición de categorías el header puede ser `Authorization: Bearer {{accessToken}}`. En la petición de refresh, envía `{{refreshToken}}` en el JSON y guarda ambos tokens de la nueva respuesta para sustituir los anteriores.

### Límite de este paso

El middleware autentica, pero todavía no aplica permisos por rol. Por tanto, un token de `client` también supera la autenticación de las rutas; el CRUD de usuarios continúa además encerrado en desarrollo local. El middleware consulta si la sesión sigue activa, pero no consulta el campo `active` del usuario. Si una cuenta se desactiva por el CRUD local sin revocar sus sesiones, un access token de esa sesión sigue aceptándose hasta su expiración, como máximo 15 minutos.

## Paso 4: responder al robo o reutilización de tokens

### Ejercicio 4.2: esquema `models/Tokens.js`

El esquema está en `api/src/models/Tokens.js` y se registra como modelo Mongoose `Tokens`. Cada documento representa una sesión de un usuario y el refresh token actualmente válido para ella.

Campos principales:

- `_id`: UUID que también se usa como `sid` dentro de los tokens.
- `userId`: UUID del usuario; usa `ref: "Usuari"`.
- `tokenHash`: huella SHA-256 del refresh token. `select: false` hace que Mongoose la omita en consultas normales.
- `currentJti`: identificador único del refresh token vigente; cambia al rotar.
- `expiresAt`: fecha de caducidad. Un índice TTL permite a MongoDB borrar sesiones caducadas automáticamente.
- `revokedAt` y `revokeReason`: indican si se cerró o revocó la sesión por logout, reutilización o intervención manual.
- `createdAt` y `updatedAt`: los añade la opción `timestamps` de Mongoose.

El ejercicio pide almacenar refresh tokens; el proyecto guarda únicamente su hash, nunca el token original. Así el servicio puede comparar la credencial recibida sin dejar una credencial reutilizable expuesta en la base de datos. El nombre de la colección se fija explícitamente como `refreshsessions` para conservar los documentos creados antes de renombrar el archivo de modelo.

`connectDB` inicializa los índices de los modelos cargados al arrancar la API. `tokenService.js` usa el modelo para iniciar sesión, rotar tokens, detectar reuso y revocar sesiones; `authenticateToken.js` pregunta al servicio si el access token pertenece a una sesión activa.

### Ejercicio 4.4: servicio `services/token/tokenService.js`

El servicio concentra la lógica específica de tokens que antes estaba repartida en `authService.js` y el middleware:

- `issueTokens(user)` firma el access y el refresh token, calcula su expiración y guarda en `Tokens` el hash del refresh token actual.
- `rotateRefreshToken(refreshToken)` valida firma, caducidad, usuario y sesión; compara el hash; después sustituye el `jti`, el hash y la expiración en una sola actualización atómica.
- Si el token ya se había sustituido, marca la sesión como reutilizada y lanza un error `401`.
- `isSessionActive({ userId, sessionId })` consulta si la sesión aún permite usar access tokens.
- `logout({ userId, sessionId })` revoca una sesión concreta.
- `assertTokenConfiguration()` valida que ambas claves existan, tengan longitud mínima y sean distintas.

`authService.js` conserva las reglas del caso de uso: validar el body del login/refresh, comparar la contraseña con BCrypt, crear el usuario al registrar y preparar la vista pública. Luego delega la emisión o rotación en `tokenService`.

### Ejercicio 4.5: controlador de autenticación

`api/src/controllers/authController.js` maneja la conexión HTTP, sin consultar MongoDB ni firmar JWT directamente:

- `login(req, res)` envía `req.body` a `authService.login` y responde `200` con `{ success: true, data }`.
- `refresh(req, res)` pasa el body con `refreshToken` al servicio y responde `200` con el nuevo par.
- `logout(req, res)` toma la identidad ya verificada desde `req.auth`, delega al servicio y responde `200`.
- `register(req, res)` también delega y responde `201`.

Recorrido de renovación: `authRoutes` → `authController.refresh` → `authService.refresh` (valida la petición) → `tokenService.rotateRefreshToken` (valida y actualiza el modelo `Tokens`) → respuesta JSON. Si un servicio lanza un `ApiError`, el controlador no lo captura: el middleware global de errores construye la respuesta de error.

### Ejercicio 4.7: rutas de autenticación y rutas protegidas

Las rutas de autenticación están en `api/src/routes/authRoutes.js` y se montan con el prefijo `/api/auth` desde `api/src/index.js`. Por eso, el path local `/login` del router se convierte en `POST /api/auth/login`.

| Ruta del router | Endpoint completo | Protección |
| --- | --- | --- |
| `POST /register` | `POST /api/auth/register` | Pública |
| `POST /login` | `POST /api/auth/login` | Pública |
| `POST /refresh` | `POST /api/auth/refresh` | El servicio valida el refresh token del body |
| `POST /logout` | `POST /api/auth/logout` | Middleware `authenticateToken` verifica el access token |

También están protegidas todas las rutas de `productRoutes.js` (`/api/products`), `categoryRoutes.js` (`/api/categories`) y `userRoutes.js` (`/api/users`). En esos routers, `router.use(authenticateToken)` se declara antes de las rutas individuales, así que el middleware las protege todas.

El enunciado llama al archivo `usuariRoutes.js`; este proyecto separa responsabilidades por propósito: `authRoutes.js` contiene login/refresh/logout y `userRoutes.js` contiene el CRUD de usuarios. No se duplica el login dentro del router de gestión de usuarios.

### Orden de ejecución de una petición protegida

1. Express combina el prefijo montado en `index.js` con la ruta declarada en el router.
2. `authenticateToken` lee `Authorization: Bearer <accessToken>` y valida firma, expiración y sesión activa.
3. Si el token es válido, el middleware deja `userId`, `sessionId` y `role` verificados en `req.auth`, y llama a `next()`.
4. Express ejecuta el controlador de la ruta.
5. Sin token o con token inválido, el middleware envía el error al manejador global y el controlador no se ejecuta.

Prueba en Postman: login no lleva header; en `/api/auth/refresh` manda `{ "refreshToken": "..." }`; para `/api/auth/logout` y, por ejemplo, `GET /api/categories`, usa `Authorization: Bearer <accessToken>`. Sin access token, las rutas protegidas responden `401`.

### Qué sucede al detectar reutilización

Cuando un refresh JWT firmado vuelve a presentarse después de una rotación, el `jti` ya no coincide con el actual que guarda MongoDB. `tokenService.rotateRefreshToken` marca la sesión completa como revocada con `revokeReason: "refresh_token_reuse"` y devuelve `401 REFRESH_TOKEN_REUSED`. Esto invalida también el refresh token nuevo de esa familia.

El access token incluye ahora `sid`, el identificador de su sesión. `authenticateToken` comprueba firma, expiración, tipo `access` y que exista una sesión activa en MongoDB. Por eso, cuando la familia se revoca, los access tokens de esa sesión también quedan rechazados inmediatamente.

### Cerrar sesión

`POST /api/auth/logout` requiere el access token en `Authorization: Bearer <accessToken>`. El middleware coloca `userId` y `sessionId` verificados en `req.auth`; `authController.logout` delega en `authService.logout`, que llama a `tokenService.logout` para establecer `revokedAt` y `revokeReason: "logout"`. La API responde `200` con `{ "success": true, "data": { "message": "Sesión cerrada" } }`.

### Revocar sesiones desde MongoDB

Para una respuesta manual ante actividad sospechosa, conecta Compass a la base de datos y abre la colección `refreshsessions`. Comprueba `userId`, fechas y `revokedAt`; `tokenHash` está oculto en consultas Mongoose, aunque el campo almacenado puede verse en Compass. No copies hashes ni tokens a capturas.

Desde la pestaña **Mongosh** de Compass puedes revocar todas las sesiones activas de un usuario. Sustituye el UUID por el `_id` del usuario:

```js
db.refreshsessions.updateMany(
  { userId: "UUID_DEL_USUARIO", revokedAt: null },
  { $set: { revokedAt: new Date(), revokeReason: "manual" } }
)
```

La respuesta del middleware cambia inmediatamente a `401 INVALID_ACCESS_TOKEN` para esas sesiones y el refresh endpoint ya no puede renovarlas. El usuario tendrá que iniciar sesión de nuevo.

### Ejercicio 4.8: pruebas automáticas en Postman

1. Con MongoDB y la API en marcha, importa [PokeMerch Tokens.postman_collection.json](../../postman/PokeMerch%20Tokens.postman_collection.json).
2. Selecciona el entorno **Ecommerce Local**. Ajusta `baseUrl` al puerto del backend y añade `authTestEmail` y `authTestPassword` con los datos de un usuario ficticio ya registrado.
3. Abre **Run collection** y ejecuta las 13 peticiones en orden. Los scripts comprueban los códigos HTTP y guardan los tokens en [variables locales del Runner](https://learning.postman.com/docs/use/send-requests/variables/variables/), disponibles durante la ejecución.

El primer login abre la sesión para probar la rotación. Al reenviar su refresh anterior, se comprueba que se rechacen tanto el access como el refresh vigentes de esa sesión. El segundo login abre otra sesión para comprobar que `/api/auth/logout` también invalida ambas credenciales. Las dos sesiones son independientes de las que hayas abierto antes en Postman.

### Pruebas manuales en Postman

1. Inicia sesión y conserva el refresh token original y el access token.
2. Rota el refresh token en `/api/auth/refresh`; guarda el refresh nuevo y el access nuevo.
3. Reenvía el refresh token original: debe responder `401 REFRESH_TOKEN_REUSED` y revocar la sesión.
4. Envía también el access token nuevo a `GET /api/categories`: debe responder `401 INVALID_ACCESS_TOKEN` porque su sesión se revocó.
5. Inicia sesión otra vez y llama `POST /api/auth/logout` con su access token. Las siguientes peticiones protegidas de esa sesión deben responder `401`.

La detección de reutilización invalida la familia identificada por `sid`; no bloquea la cuenta completa ni las otras sesiones del usuario. Así, una sesión legítima en otro dispositivo permanece activa.

## Paso 5: canal del navegador con cookies HttpOnly

El canal JSON devuelve los tokens en el body, algo que un frontend tendría que guardar en algún almacenamiento accesible desde JavaScript. Para el navegador se añadió un contrato separado que mantiene los tokens en cookies `HttpOnly`. Los clientes JSON existentes no se modifican.

### Rutas y montaje

| Archivo | Responsabilidad |
| --- | --- |
| `api/src/routes/browserAuthRoutes.js` | Router montado en `/api/auth/browser` |
| `api/src/controllers/browserAuthController.js` | Fija o borra cookies y responde con el nombre público |
| `api/src/security/browserAuthCookies.js` | Nombres, atributos y lectura de cookies |
| `api/src/security/browserAuthOrigin.js` | Origin guard antes del controlador |
| `api/src/services/token/tokenService.js` | `refreshBrowserSession`, `logoutBrowserSession` y marcador de canal |

`api/src/index.js` monta el router antes de `express.json()`. Registro y login declaran su propio parser; refresh y logout no leen body.

| Método | Endpoint | Body | Respuesta correcta |
| --- | --- | --- | --- |
| POST | `/api/auth/browser/register` | `{ name, email, password }` | `201` con `{ user: { name } }` |
| POST | `/api/auth/browser/login` | `{ email, password }` | `200` con `{ user: { name } }` |
| POST | `/api/auth/browser/refresh` | Sin body | `200` con `{ user: { name } }`; fija solo `pm_access` |
| POST | `/api/auth/browser/logout` | Sin body | `200` con `{ user: null }`; borra ambas cookies |

Ninguna respuesta incluye `accessToken` ni `refreshToken`. Todas llevan `Cache-Control: no-store`.

### Cookies y origen

- `pm_access` y `pm_refresh`.
- `HttpOnly`, `SameSite=Lax`, `Path=/api/auth/browser`, sin `Domain`.
- `Secure` salvo que `NODE_ENV` sea exactamente `development`.
- `Max-Age` derivado del campo `exp` del JWT.
- El `Path` impide que las cookies se envíen a las rutas generales de la API.
- En el código actual, refresh y logout leen `pm_refresh`; `pm_access` se emite, pero no se consume en `authenticateToken`.

El origin guard:

- Exige una cabecera `Origin` exacta; rechaza ausencia, `null` y orígenes cruzados.
- Si hay `Referer`, su origen debe coincidir.
- Si hay `Sec-Fetch-Site`, debe ser `same-origin`.
- En desarrollo solo acepta `localhost`, `127.0.0.1` o `[::1]` en el puerto `5173`.
- En producción exige orígenes HTTPS exactos en `AUTH_ALLOWED_ORIGINS`, separados por comas. Sin lista válida responde `503 BROWSER_AUTH_UNAVAILABLE`.
- Un origen no permitido responde `403 AUTH_ORIGIN_DENIED`.
- No se habilita CORS; el diseño espera un proxy inverso same-origin.

### Ciclo de vida del refresh del navegador

1. Registro y login crean una sesión en `Tokens` y emiten el refresh JWT con `tokenChannel: "browser"`; el access token no lleva ese marcador.
2. El refresh dura siempre 7 días (`BROWSER_REFRESH_TOKEN_EXPIRES_IN`), independientemente de `JWT_REFRESH_EXPIRES_IN`.
3. `refreshBrowserSession` verifica firma, tipo, canal, `sid`, `jti`, hash y usuario activo.
4. No rota el refresh: solo lee la sesión y emite un access token nuevo.
5. La caducidad del access nuevo queda limitada por la expiración restante de la sesión.
6. La sesión no es deslizante: a los 7 días hay que iniciar sesión de nuevo.
7. Logout revoca la sesión actual y limpia las cookies.
8. `authenticateToken` consulta si la sesión sigue activa, así que una revocación corta también los access tokens.

### Contraste entre canales

| Aspecto | JSON (`/api/auth`) | Navegador (`/api/auth/browser`) |
| --- | --- | --- |
| Transporte | Tokens en el body | Cookies `HttpOnly` |
| Duración del refresh | `JWT_REFRESH_EXPIRES_IN` | 7 días fijos |
| Rotación | Sí, atómica | No |
| Reutilización | `401 REFRESH_TOKEN_REUSED` | No aplica |
| Logout | Bearer | Cookie de refresh + limpieza |
| Marcador del refresh | Sin `tokenChannel` | `tokenChannel: "browser"` |

El refresh JSON rechaza un token con `tokenChannel` antes de tocar la base de datos. El refresh del navegador rechaza un token sin el marcador. Los dos canales comparten `authService` y `tokenService`, pero no son intercambiables.

### Límites que siguen existiendo

- Las cookies no autorizan escrituras de productos ni categorías: esas rutas exigen `Authorization: Bearer`.
- Al no rotar el refresh, el canal del navegador no detecta reutilización; un refresh robado podría usarse hasta su caducidad de 7 días.
- No hay RBAC; cualquier access token válido, incluido uno de rol `client`, supera la autenticación.
- `/api/users` sigue exigiendo Bearer, desarrollo local y loopback.
- No se ha encontrado limitación de intentos ni protección anti-fuerza bruta; tampoco se ha confirmado CSP ni `helmet`.
- No se ha probado con MongoDB real ni con un proxy inverso de producción.
- No se ha desplegado el proyecto.

### Pruebas

Desde `backend/`:

```bash
node --test api/test/browserAuth.test.js api/test/tokenService.test.js
```

La auditoría reportó 19 pruebas superadas y 2 omitidas. Las omitidas son los casos Playwright que requieren `PM_BROWSER_TEST_PLAYWRIGHT`; sin esa variable no se ejecutan. Los tests usan modelos y respuestas sintéticas, no MongoDB.

Para el recorrido completo de la actividad, consulta [GUIA_ACTIVIDAD_GALLERY_CARD_AUTH_NAVEGADOR.md](../../../Guias_por_actividades/GUIA_ACTIVIDAD_GALLERY_CARD_AUTH_NAVEGADOR.md).
