# PokeMerch Backend

API i servei de dades del projecte E-commerce PokeMerch, una botiga en línia de productes de merxandising.

## Tecnologies

- Node.js + Express 5
- MongoDB + Mongoose (gestionada via Docker)
- Docker / Docker Compose
- dotenv (variables d'entorn)
- nodemon (desenvolupament)

## Estructura del projecte

```
backend/
├── Docker/
│   └── docker-compose.yml       # Orquestra la base de dades MongoDB
├── api/
│   ├── .env                     # Variables d'entorn (no es puja al repo)
│   ├── package.json             # Dependències i scripts de l'API
│   ├── src/
│       ├── index.js             # Punt d'entrada: configura Express i escolta el port
│       ├── config/
│       │   └── db.js            # Connexió a MongoDB amb Mongoose
│       ├── models/              # Esquemes de Mongoose (12 models)
│       │   ├── Categoria.js
│       │   ├── Comanda.js
│       │   ├── Cupo.js
│       │   ├── Devolucio.js
│       │   ├── Direccio.js
│       │   ├── Enviament.js
│       │   ├── Inventari.js
│       │   ├── Pagament.js
│       │   ├── Producte.js
│       │   ├── Ressenya.js
│       │   ├── Tokens.js
│       │   └── Usuari.js
│       ├── controllers/         # Lògica de les peticions HTTP
│       │   ├── authController.js
│       │   ├── browserAuthController.js
│       │   ├── categoryController.js
│       │   ├── productController.js
│       │   └── userController.js
│       ├── middleware/          # Autenticació i errors
│       │   ├── authenticateToken.js
│       │   └── errorHandler.js
│       ├── security/            # Cookies i origen del canal navegador
│       │   ├── browserAuthCookies.js
│       │   └── browserAuthOrigin.js
│       ├── routes/              # Definició de rutes de l'API
│       │   ├── authRoutes.js
│       │   ├── browserAuthRoutes.js
│       │   ├── categoryRoutes.js
│       │   ├── productRoutes.js
│       │   └── userRoutes.js
│       └── services/            # Lògica de negoci / accés a dades
│           ├── authService.js
│           ├── categoryService.js
│           ├── productService.js
│           ├── userService.js
│           └── token/
│               └── tokenService.js
│   └── test/                    # Proves de node:test (auth JSON i navegador)
├── postman/
│   ├── Ecommerce API.postman_collection.json   # Peticions CRUD i comprovacions
│   └── Ecommerce API.postman_environment.json  # Entorn local amb baseUrl
├── docs/
│   ├── adrs/                    # Registre de decisions d'arquitectura (ADR)
│   │   ├── ADR-001.md           # Elecció de base de dades (MongoDB)
│   │   └── ADR-002.md           # Estructura del projecte (repos separats)
│   └── diagrams/
│       └── DB-PokeMerch.png     # Diagrama de la base de dades
└── README.md
```

## Requisits previs

- Node.js (v18 o superior recomanat) i npm.
- Docker amb Docker Compose instal·lat.

## Com executar el projecte

### 1. Aixecar la base de dades MongoDB

Des de l'arrel del backend:

```bash
docker compose -f Docker/docker-compose.yml up -d
```

O des del directori `Docker`:

```bash
docker compose up -d
```

La base de dades quedarà disponible amb la següent configuració (definida al `docker-compose.yml`):

| Paràmetre            | Valor                                                  |
| -------------------- | ------------------------------------------------------ |
| Contenidor           | `mongodb_test`                                         |
| Imatge               | `mongo:latest`                                         |
| Port exposat         | `27000:27017` (MongoDB al port local `27000`)          |
| Base de dades inicial| `mongodb_docker_test`                                  |
| Usuari / contrasenya | `admin` / `1234` (configuració de test, NO producció)  |
| Volum                | `mongo_data` muntat a `/data/db` (persistència)        |

El mateix `docker-compose.yml` arrenca MongoDB i l'API. El servei `frontend` està comentat al fitxer actual:

| Servei    | Contenidor           | URL                     |
|-----------|----------------------|-------------------------|
| MongoDB   | `mongodb_test`        | `localhost:27000`       |
| Backend   | `pokemerch_backend`   | `http://localhost:3000` |

Para levantar los servicios definidos desde `backend/Docker`:

```bash
docker compose up -d --build
```

El backend espera a que MongoDB esté saludable. Para comprobar el estado:

```bash
docker compose ps
```

Para detenerlos:

```bash
docker compose down
```

### Imágenes de producto

Las imágenes se guardan en `api/media` y se sirven públicamente desde
`/api/media/<archivo>`. El compose monta esa carpeta dentro del contenedor en
`/app/media`, así que puedes añadir o sustituir archivos `.webp` desde el
Explorador de Windows sin reconstruir la imagen.

La ruta guardada en MongoDB debe ser relativa, por ejemplo:

```text
/api/media/pikachu-clasico.webp
```

### 2. Configurar les variables d'entorn

Crea el fitxer `api/.env` (no es puja al repositori, ja està al `.gitignore`) amb:

```dotenv
PORT=3000
MONGO_URI=mongodb://admin:1234@localhost:27000/?authSource=admin
NODE_ENV=development
JWT_SECRET=PEGA_AQUI_UN_SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
JWT_REFRESH_SECRET=PEGA_AQUI_OTRO_SECRETO_ALEATORIO_DE_AL_MENOS_32_BYTES
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AUTH_ALLOWED_ORIGINS=https://store.example
```

`AUTH_ALLOWED_ORIGINS` solo se usa fuera de desarrollo. Es una lista separada por comas de orígenes exactos HTTPS, sin ruta ni barra final; por ejemplo, `https://store.example`. En desarrollo, el canal del navegador acepta únicamente `http://localhost:5173`, `http://127.0.0.1:5173` y `http://[::1]:5173`. Si en producción la lista está vacía, las rutas `/api/auth/browser/*` responden `503 BROWSER_AUTH_UNAVAILABLE`. No se habilita CORS: el diseño espera un proxy inverso same-origin.

Genera dos secretos aleatorios distintos con Node y copia cada resultado a su variable correspondiente en `api/.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Ejecuta el comando dos veces: un valor para `JWT_SECRET` y otro para `JWT_REFRESH_SECRET`. No compartas ni publiques estos secretos. Las duraciones son opcionales; por defecto el access token dura `15m` y el refresh token JSON `7d`. `NODE_ENV=development` habilita temporalmente el CRUD administrativo de `/api/users` solo para conexiones locales y hace que las cookies del navegador no se marquen `Secure`; no utilices este valor para publicar ese CRUD.

### 3. Arrencar l'API

Des de l'arrel del projecte, entra a `api` i instal·la les dependències. La instal·lació només cal fer-la la primera vegada o quan canviïn les dependències:

```bash
cd api
npm install
npm run dev
```

`npm run dev` arrenca el servidor amb nodemon. L'API quedarà disponible a `http://localhost:3000`; pots comprovar-ho obrint `http://localhost:3000/` o enviant un GET a aquesta URL. Espera el missatge que confirma la connexió amb MongoDB abans de provar endpoints.

Per aturar l'API i MongoDB, prem `Ctrl+C` al terminal de l'API i executa des de l'arrel:

```bash
docker compose -f Docker/docker-compose.yml down
```

### 4. Importar la col·lecció i l'entorn de Postman

Els fitxers es troben a `postman/`:

- `Ecommerce API.postman_collection.json`: col·lecció **Ecommerce API**, organitzada en les carpetes **Products**, **Categories** i **Users**. Inclou les peticions CRUD i scripts de comprovació.
- `Ecommerce API.postman_environment.json`: entorn **Ecommerce Local**, amb `baseUrl` configurat com `http://localhost:3000`.

Importa'ls com a fitxers separats:

1. Obre l'extensió de Postman a VS Code i prem **Import** (o obre la paleta de comandes i tria **Postman: Import**).
2. Selecciona **File** i importa `postman/Ecommerce API.postman_collection.json`.
3. Torna a **Import → File** i importa `postman/Ecommerce API.postman_environment.json`.
4. Selecciona **Ecommerce Local** al selector d'entorns de Postman. Les peticions fan servir `{{baseUrl}}`.
5. Comprova que l'API i MongoDB continuen en marxa i executa les peticions.

Si la importació des de VS Code mostra un error genèric, importa primer només el fitxer de la col·lecció i després l'entorn, sense seleccionar-los com una única col·lecció. També pots provar la importació des de Postman web o l'aplicació d'escriptori.

La col·lecció desa automàticament `categoryId`, `productId` i `userId` després de crear cada recurs. Com que la carpeta Products apareix abans de Categories, crea primer una categoria amb **Categories → POST Create category**; després ja pots provar **Products → POST Create product**, que necessita aquest ID. El slug, el SKU i l'email de les peticions de creació es generen de nou a cada execució. Les peticions d'error esperen `422` per categoria sense nom, `409` per slug duplicat i `409` per email duplicat.

Les lectures de categories i productes són públiques. Per executar `POST`, `PUT` o `DELETE`, fes primer login a `/api/auth/login` i afegeix `Authorization: Bearer <accessToken>`. La col·lecció principal no inclou una carpeta Auth; per provar login, rotació i logout pots importar `postman/PokeMerch Tokens.postman_collection.json`. `/api/users` exigeix a més desenvolupament local.

El CRUD administratiu de `/api/users` exigeix un Bearer vàlid i continua limitat a `NODE_ENV=development` i connexions locals; utilitza dades fictícies i no el publiquis mentre no tingui autorització RBAC. El canal JSON de `/api/auth` emet o rota el parell de JWT; el navegador fa servir `/api/auth/browser` amb cookies `HttpOnly` i no rep tokens al body.

## Endpoints de l'API

La URL base és `http://localhost:3000`. En Postman, selecciona **Body → raw → JSON** per a les peticions amb cos i envia la capçalera `Content-Type: application/json`.
Als exemples, `{{categoryId}}` i `{{productId}}` són variables d'entorn de Postman; també pots substituir-les directament pels `_id` retornats per l'API.

| Mètode | Endpoint | Descripció | Autenticació |
| --- | --- | --- | --- |
| GET | `/` | Comprovar que l'API està en marxa | Pública |
| GET | `/api/categories` | Llistar categories | Pública |
| GET | `/api/categories/:id` | Consultar una categoria | Pública |
| POST | `/api/categories` | Crear una categoria | Bearer |
| PUT | `/api/categories/:id` | Modificar una categoria | Bearer |
| DELETE | `/api/categories/:id` | Eliminar una categoria | Bearer |
| GET | `/api/products` | Llistar productes | Pública |
| GET | `/api/products/:id` | Consultar un producte | Pública |
| POST | `/api/products` | Crear un producte | Bearer |
| PUT | `/api/products/:id` | Modificar un producte | Bearer |
| DELETE | `/api/products/:id` | Eliminar un producte | Bearer |
| POST | `/api/users` | Crear un usuari local | Bearer + desenvolupament local |
| GET | `/api/users` | Llistar usuaris locals | Bearer + desenvolupament local |
| GET | `/api/users/:id` | Consultar un usuari local | Bearer + desenvolupament local |
| PUT | `/api/users/:id` | Modificar camps permesos | Bearer + desenvolupament local |
| DELETE | `/api/users/:id` | Desactivar l'usuari (`active=false`) | Bearer + desenvolupament local |
| POST | `/api/auth/register` | Registrar un client i tornar JWT al body | Pública |
| POST | `/api/auth/login` | Comprovar credencials i tornar JWT al body | Pública |
| POST | `/api/auth/refresh` | Rotar el refresh token i emetre un parell nou | Refresh al body |
| POST | `/api/auth/logout` | Revocar la sessió de l'access token actual | Bearer |
| POST | `/api/auth/browser/register` | Registrar des del navegador i fixar cookies | Pública + origin guard |
| POST | `/api/auth/browser/login` | Iniciar sessió des del navegador i fixar cookies | Pública + origin guard |
| POST | `/api/auth/browser/refresh` | Renovar l'access token des de la cookie | Cookie `pm_refresh` + origin guard |
| POST | `/api/auth/browser/logout` | Revocar la sessió i esborrar les cookies | Cookie `pm_refresh` + origin guard |

### Autenticació JSON

Aquest canal manté el contracte anterior: els tokens viatgen al cos de la resposta. És el que fan servir Postman o qualsevol client que no sigui un navegador.

**Registrar** — `POST /api/auth/register`

```json
{
  "name": "Usuario de prueba",
  "email": "registro@example.com",
  "password": "UnaClaveLocal-2026!"
}
```

La contrasenya ha de tenir almenys 12 caràcters i no més de 72 bytes (límit de BCrypt). Es desa només com a hash BCrypt. El servidor assigna `role: "client"` i rebutja `role`, `passwordHash` i altres camps extra. Una resposta correcta (`201`) conté l'usuari sense hash, `accessToken`, `refreshToken`, `tokenType: "Bearer"` i les durades.

**Iniciar sessió** — `POST /api/auth/login`

```json
{
  "email": "registro@example.com",
  "password": "UnaClaveLocal-2026!"
}
```

El login normalitza l'email, llegeix el hash només per comparar-lo amb BCrypt i no retorna mai `passwordHash`. Email o contrasenya incorrectes, i comptes desactivats, responen `401 INVALID_CREDENTIALS` amb un missatge comú. Els emails duplicats durant el registre responen `409 DUPLICATE_EMAIL`.

L'access token es firma amb `JWT_SECRET` i dura 15 minuts per defecte. El refresh token es firma amb `JWT_REFRESH_SECRET` i dura 7 dies per defecte. Cada token porta el seu ús (`access` o `refresh`) i s'ha de signar amb HS256. Un JWT signat no està xifrat: el seu payload es pot llegir, així que no hi incloguis contrasenyes ni secrets.

**Renovar la sessió** — `POST /api/auth/refresh`

Envia el refresh token vigent al cos:

```json
{
  "refreshToken": "<refresh token vigent>"
}
```

Si és vàlid, respon `200` amb un access token i un refresh token nous; el refresh anterior queda substituït. El model `Tokens` desa el hash SHA-256 del refresh vigent, el seu identificador i la caducitat, mai el token en text pla. Si es torna a presentar un token anterior ja rotat, la sessió es revoca i respon `401 REFRESH_TOKEN_REUSED`. Cada login crea una sessió separada.

La rotació és atòmica a MongoDB: si el mateix refresh s'envia en dues renovacions simultànies, només una pot substituir-lo. L'altra es tracta com a reutilització i revoca la sessió. El middleware consulta aquest estat, de manera que també rebutja immediatament els access tokens vinculats a una sessió revocada. Un índex TTL neteja les sessions caducades.

**Tancar sessió** — `POST /api/auth/logout` amb `Authorization: Bearer <accessToken>`. Revoca la sessió actual i els seus tokens deixen de ser acceptats.

Si sospites que un compte està compromès, pots revocar totes les seves sessions des de Compass/Mongosh amb l'UUID de l'usuari:

```js
db.refreshsessions.updateMany(
  { userId: "UUID_DEL_USUARIO", revokedAt: null },
  { $set: { revokedAt: new Date(), revokeReason: "manual" } }
)
```

L'emissió, validació i rotació viuen a `api/src/services/token/tokenService.js`. `authService.js` valida les dades i delega; `authController.js` construeix la resposta HTTP.

### Autenticació del navegador amb cookies

El navegador no crida `/api/auth/login`. Utilitza `/api/auth/browser/*`, muntat a `api/src/index.js` abans del parser JSON general. Aquestes rutes retornen només el nom públic de l'usuari i fixen cookies `HttpOnly`; no retornen cap JWT al body.

| Mètode | Ruta | Cos | Resposta correcta |
| --- | --- | --- | --- |
| POST | `/api/auth/browser/register` | `{ name, email, password }` | `201` i `{ success: true, data: { user: { name } } }` |
| POST | `/api/auth/browser/login` | `{ email, password }` | `200` i `{ user: { name } }` |
| POST | `/api/auth/browser/refresh` | Sense cos | `200` i `{ user: { name } }`; només renova `pm_access` |
| POST | `/api/auth/browser/logout` | Sense cos | `200` i `{ user: null }`; esborra les cookies |

Cookies:

- `pm_access`: access token.
- `pm_refresh`: refresh token.
- Totes dues són `HttpOnly`, `SameSite=Lax`, `Path=/api/auth/browser` i no fixen `Domain`.
- `Secure` s'activa llevat que `NODE_ENV` sigui exactament `development`.
- `Max-Age` es deriva del camp `exp` del JWT.
- Com que el `Path` és `/api/auth/browser`, aquestes cookies no s'envien a `/api/products`, `/api/categories` ni `/api/users`.

El refresh del navegador té una durada fixa de 7 dies, independent de `JWT_REFRESH_EXPIRES_IN`. És de només lectura: no rota el refresh, no reescriu la sessió i no n'allarga la caducitat. Només emet un access token nou, limitat per la caducitat restant de la sessió. La sessió no és deslizant: després de 7 dies cal tornar a iniciar sessió. El refresh JSON no pot rotar una sessió marcada com a navegador i el refresh del navegador rebutja tokens sense el marcador de canal.

Logout revoca la sessió i esborra les cookies. Si no hi ha cookie de refresh o el token ja no és verificable, respon `200` i neteja igualment; una capçalera `Cookie` ambigua o mal formada pot respondre un error no-2xx.

Totes les respostes del router porten `Cache-Control: no-store`. Els errors conserven el format `{ success: false, error: { code, message, details? } }`.

### Origin guard del navegador

`api/src/security/browserAuthOrigin.js` s'executa abans del controlador:

- Exigeix una capçalera `Origin` exacta; rebutja absència, `null` i orígens creuats.
- Si hi ha `Referer`, el seu origen ha de coincidir amb `Origin`.
- Si hi ha `Sec-Fetch-Site`, ha de ser `same-origin`.
- En desenvolupament només accepta el port `5173` a `localhost`, `127.0.0.1` i `[::1]`.
- En producció exigeix orígens exactes HTTPS a `AUTH_ALLOWED_ORIGINS`, separats per comes. Si la llista és buida, respon `503 BROWSER_AUTH_UNAVAILABLE`.
- Un origen no permès respon `403 AUTH_ORIGIN_DENIED`.
- No hi ha CORS; el disseny espera un proxy invers same-origin.

Si Vite arranca a `5174` perquè `5173` està ocupat, o si s'accedeix per la IP de la LAN, l'autenticació del navegador falla amb `403`. El projecte no fixa `strictPort`.

### Protecció de rutes i límits

- `GET /api/products`, `GET /api/products/:id`, `GET /api/categories` i `GET /api/categories/:id` són públics.
- Les escriptures de productes i categories exigeixen `Authorization: Bearer <accessToken>`.
- `/api/users` exigeix Bearer i, a més, `NODE_ENV=development` i connexió loopback.
- `authenticateToken` verifica firma HS256, expiració, `tokenUse: "access"`, rol i que la sessió segueixi activa. Deixa la identitat a `req.auth`.
- Si falta el header respon `401 AUTHENTICATION_REQUIRED`; si el token no val, ha expirat o és un refresh, respon `401 INVALID_ACCESS_TOKEN`.
- Les rutes generals no accepten cookies: una cookie de navegador no autoritza una escriptura.
- Com que el refresh del navegador no rota, aquest canal no detecta la reutilització d'un refresh; un token robat podria usar-se fins a la seva caducitat de 7 dies.
- No hi ha RBAC: qualsevol access token vàlid, inclòs un de rol `client`, supera l'autenticació. La gestió d'usuaris continua limitada a desenvolupament local.
- El middleware comprova la sessió, però no el camp `active` de l'usuari. Si es desactiva un compte sense revocar les seves sessions, un access token pot funcionar fins a expirar (com a màxim 15 minuts).
- No s'ha trobat limitació d'intents ni protecció anti-força bruta; tampoc no s'ha confirmat CSP ni `helmet`.
- Abans de publicar a Internet caldria configurar orígens HTTPS exactes, limitar intents, revisar CSP/helmet i provar TLS amb proxy invers i MongoDB real. Aquest treball no s'ha desplegat.

### Proves de categories

**Crear categoria** — `POST /api/categories`

```json
{
  "name": "Electrònica",
  "slug": "electronica",
  "description": "Dispositius i accessoris",
  "active": true
}
```

`name` és obligatori i ha de tenir almenys 3 caràcters. `slug` és obligatori i únic. `description` és opcional i té un màxim de 500 caràcters. Si s'omet `active`, el seu valor és `true`. La resposta `201` inclou la categoria creada amb `_id`, `createdAt` i `updatedAt`; guarda el `_id` perquè serà necessari en les proves següents.

**Llistar totes** — `GET /api/categories`

La llista accepta filtres, ordenació i paginació. `active` acepta `true`/`false`; `name` busca coincidència parcial sense distingir majúscules; `sort` admet `name`, `slug`, `active`, `createdAt` o `updatedAt` (prefix `-` per ordre descendent). `page` comença en 1, `limit` per defecte és 10 i el màxim és 100. Exemple: `GET /api/categories?active=true&name=info&sort=name&page=1&limit=10`.

La resposta de llistat afegeix la informació de paginació al costat de `data`:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

**Consultar una** — `GET /api/categories/{{categoryId}}`

**Modificar** — `PUT /api/categories/{{categoryId}}`. Es pot enviar només els camps que es volen canviar:

```json
{
  "description": "Accessoris, consoles i dispositius electrònics"
}
```

**Eliminar** — `DELETE /api/categories/{{categoryId}}`. Si la operación funciona, devuelve `204` sin cuerpo.

Per comprovar que el slug no es pot repetir, envia dues peticions `POST /api/categories` amb el mateix `slug`. La segona ha de respondre amb `409` i el missatge `Ya existe una categoría con ese slug`.

### Proves de productes i relació amb la categoria

El producte rep l'identificador de categoria al camp `category`. Aquest valor és l'`_id` ObjectId retornat en crear la categoria. Canvia `PEGAR_AQUI_EL_ID_DE_CATEGORIA` pel valor real i crea almenys dos productes:

**Crear producte** — `POST /api/products`

```json
{
  "category": "PEGAR_AQUI_EL_ID_DE_CATEGORIA",
  "nombre": "Auriculares inalámbricos",
  "descripcion": "Auriculares Bluetooth",
  "precio": 29.99,
  "sku": "AURICULARES-001",
  "activo": true
}
```

Per al segon producte, fes una altra petició amb el mateix `category` i un `sku` diferent, per exemple `AURICULARES-002`.

**Llistar productes** — `GET /api/products`

**Consultar un producte** — `GET /api/products/{{productId}}`

**Modificar** — `PUT /api/products/{{productId}}`. Per canviar-ne la categoria, envia l'`_id` d'una altra categoria existent:

```json
{
  "category": "PEGAR_AQUI_EL_ID_DE_CATEGORIA",
  "precio": 34.99
}
```

**Eliminar** — `DELETE /api/products/{{productId}}`.

Les respostes dels productes inclouen `category` com a document complet gràcies a Mongoose `populate('category')`, amb camps com `name` i `slug` en lloc de mostrar només l'identificador. A MongoDB, comprova que el document del producte desa un ObjectId a `category` i que aquest coincideix amb `_id` del document de la col·lecció `categories`.

### Proves locals d'usuaris

**Atenció:** `/api/users` continua sent un CRUD administratiu limitat a `NODE_ENV=development` i connexions locals; encara no té autorització RBAC i no s'ha de desplegar públicament. El registre, login, renovació i logout JSON estan disponibles a `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh` i `/api/auth/logout`; el navegador usa `/api/auth/browser/*`. Les lectures de Products i Categories són públiques; les seves escriptures i tot `/api/users` exigeixen un access token Bearer.

**Crear usuari** — `POST /api/users`

```json
{
  "name": "Usuario de prueba",
  "email": "prueba@example.com",
  "password": "UnaClaveLocal-2026!"
}
```

La contrasenya ha de tenir almenys 12 caràcters. El servidor la transforma amb BCrypt abans de desar-la, assigna `role: "client"` i `active: true`, i mai retorna `password` ni `passwordHash`. No enviïs `role` o `passwordHash`: aquests camps es rebutgen.

**Llistar** — `GET /api/users`; **consultar** — `GET /api/users/{{userId}}`.

El llistat local també accepta `active`, `name`, `sort`, `page` i `limit`, amb els mateixos valors per defecte i límit màxim que categories. Els camps d'ordenació permesos són `name`, `email`, `role`, `active`, `createdAt` i `updatedAt`. Exemples: `GET /api/users?name=anna`, `GET /api/users?sort=-createdAt` i `GET /api/users?page=2&limit=5`. La resposta inclou `pagination` amb `page`, `limit`, `total` i `totalPages`.

**Modificar** — `PUT /api/users/{{userId}}`. Només es permeten `name`, `email` i `password`; un password nou també es valida i s'emmagatzema com a hash:

```json
{
  "name": "Usuario de prueba actualizado",
  "password": "OtraClaveLocal-2026!"
}
```

**Desactivar** — `DELETE /api/users/{{userId}}`. No elimina el document: canvia `active` a `false` i respon `204` sense cos. Fes després `GET /api/users/{{userId}}` per comprovar que està inactiu. Els emails duplicats responen amb `409`.

### Proves d'errors amb Postman

Les respostes d'error comparteixen aquest format. `details` només apareix quan cal indicar quins camps s'han de corregir:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les dades no són vàlides",
    "details": [
      { "field": "email", "message": "Format incorrecte" }
    ]
  }
}
```

Prova aquests casos i comprova tant el codi HTTP com `error.code`. Els `POST`, `PUT` i `DELETE` necessiten el Bearer indicat a l'apartat anterior; les proves d'usuari, a més, desenvolupament local:

1. **Categoria sense nom** — `POST /api/categories` amb `{ "slug": "sense-nom" }`. Esperat: `422 VALIDATION_ERROR`, detall del camp `name`.
2. **Slug duplicat** — crea una categoria i torna a enviar el mateix `slug`. Esperat: `409 DUPLICATE_SLUG`.
3. **ID invàlid** — `GET /api/categories/no-es-un-objectid`. Esperat: `400 INVALID_ID`.
4. **Usuari inexistent** — `GET /api/users/00000000-0000-4000-8000-000000000000` des de localhost amb `NODE_ENV=development` i Bearer. És un UUID vàlid però no existent. Esperat: `404 USER_NOT_FOUND`.
5. **Email duplicat** — crea un usuari i intenta crear-ne un altre amb el mateix email. Esperat: `409 DUPLICATE_EMAIL`.
6. **Camp no permès** — `PUT /api/users/{{userId}}` amb `{ "role": "admin" }`. Esperat: `400 FIELD_NOT_ALLOWED`, detall del camp `role`.
7. **Paràmetres de llista incorrectes** — prova `GET /api/categories?page=0`, `GET /api/users?limit=101` o `GET /api/users?sort=passwordHash`. Esperat: `400 INVALID_QUERY`.

Per demostrar els llistats, crea almenys 12 categories amb noms variats i 12 usuaris ficticis. Desactiva una categoria i un usuari i compara les respostes de `GET /api/categories?active=true`, `GET /api/categories?name=info`, `GET /api/categories?sort=name&page=2&limit=5`, `GET /api/users?name=anna`, `GET /api/users?active=false` i `GET /api/users?sort=-createdAt&page=2&limit=5`.

Els errors inesperats responen amb `500 INTERNAL_SERVER_ERROR` i el missatge genèric `Error interno del servidor`; la resposta no inclou traces, consultes, contrasenyes ni altres dades internes.

Les respostes segueixen el format:

```json
{ "success": true, "data": { ... } }
```

o, en cas d'error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Les dades no són vàlides",
    "details": [{ "field": "email", "message": "Format incorrecte" }]
  }
}
```

Codis d'estat: `200` (consulta o modificació correcta), `201` (recurs creat), `204` (eliminació sense cos), `400` (petició o ID incorrecte), `401` (credencials o token no vàlids), `403` (origen no permès o CRUD d'usuaris fora de desenvolupament local), `404` (recurs inexistent), `409` (email o slug duplicat), `422` (validació semàntica), `500` (error inesperat) i `503` (canal de navegador sense configuració d'orígens).

## Models de dades

Els models utilitzen `_id` com a UUID (string), excepte `Categoria`, que fa servir l'ObjectId de MongoDB perquè `Producte.category` hi apunti. El model d'usuari conserva el nom `Usuari` per mantenir les referències existents, i utilitza `bcrypt` per guardar hashes de contrasenya. Els camps de referència (`ref`) permeten fer `populate` entre col·leccions.

| Model       | Descripció                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `Usuari`    | Usuaris amb rol (`client`, `admin`), email únic i contrasenya protegida amb BCrypt       |
| `Tokens`    | Sessions de refresh; desa el hash SHA-256, `jti`, caducitat i revocació a `refreshsessions` |
| `Producte`  | Productes de la botiga amb categoria, preu, SKU i estat actiu/inactiu      |
| `Categoria` | Categories amb slug únic, estat actiu, timestamps i jerarquia opcional      |
| `Inventari` | Estoc per producte (relació 1:1) amb almacén i data d'actualització        |
| `Comanda`   | Comandes amb estat (`pendiente` → `pagado` → `enviado` → `entregado`/`cancelado`) |
| `Direccio`  | Adreces d'enviament i facturació dels usuaris                              |
| `Pagament`  | Pagaments associats a comandes (targeta, PayPal, transferència, contra reemborsament) |
| `Enviament` | Enviaments amb transportista, número de seguiment i estat                  |
| `Devolucio` | Sol·licituds de devolució amb motiu, estat i import del reemborsament      |
| `Cupo`      | Cupons de descompte (percentatge o import fix) amb vigència i límit d'usos |
| `Ressenya`  | Ressenyes de productes (1-5 estrelles); un usuari només pot ressenyar un cop cada producte |

El diagrama complet de la base de dades es troba a `docs/diagrams/DB-PokeMerch.png`.

## Scripts disponibles

Des del directori `api`:

| Comanda       | Descripció                              |
| ------------- | --------------------------------------- |
| `npm run dev` | Arrenca l'API amb nodemon (auto-reload) |
| `npm test`    | Marcador antic; no executa la suite     |
| `node --test test/browserAuth.test.js test/tokenService.test.js` | Executa les proves d'autenticació amb `node:test` |

Les proves d'autenticació utilitzen models i respostes sintètiques; no necessiten MongoDB. Els dos casos Playwright es marquen com a `skipped` si no es defineix `PM_BROWSER_TEST_PLAYWRIGHT`. La darrera execució reportada per a aquest conjunt va donar 19 proves superades i 2 omeses.

## Documentació addicional

- `docs/adrs/ADR-001.md` — Elecció de MongoDB com a base de dades.
- `docs/adrs/ADR-002.md` — Repositoris separats per a backend i frontend.
- [`../Guias_por_actividades/GUIA_ACTIVIDAD_GALLERY_CARD_AUTH_NAVEGADOR.md`](../Guias_por_actividades/GUIA_ACTIVIDAD_GALLERY_CARD_AUTH_NAVEGADOR.md) — Galeria de productes i autenticació del navegador.
- `docs/Guias_por_actividades/GUIA_ESTUDIO_AUTENTICACION.md` — Estudio del canal JSON y del canal de navegador.

## Repositori

- Origin: `https://github.com/alguna-jviladoms/backend-PokeMerch.git`

## Autor

Alex Gutierrez Navau
