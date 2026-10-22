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
│   └── src/
│       ├── index.js             # Punt d'entrada: configura Express i escolta el port
│       ├── config/
│       │   └── db.js            # Connexió a MongoDB amb Mongoose
│       ├── models/              # Esquemes de Mongoose (11 models)
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
│       │   └── Usuari.js
│       ├── controllers/         # Lògica de les peticions HTTP
│       │   ├── categoryController.js
│       │   ├── userController.js
│       │   └── productController.js
│       ├── routes/              # Definició de rutes de l'API
│       │   ├── categoryRoutes.js
│       │   ├── userRoutes.js
│       │   └── productRoutes.js
│       └── services/            # Lògica de negoci / accés a dades
│           ├── categoryService.js
│           ├── userService.js
│           └── productService.js
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

### 2. Configurar les variables d'entorn

Crea el fitxer `api/.env` (no es puja al repositori, ja està al `.gitignore`) amb:

```dotenv
PORT=3000
MONGO_URI=mongodb://admin:1234@localhost:27000/?authSource=admin
NODE_ENV=development
```

`NODE_ENV=development` habilita temporalment el CRUD d'usuaris només per a connexions locals. No utilitzis aquest valor en un desplegament públic.

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

Els endpoints d'usuaris només funcionen amb `NODE_ENV=development` i connexió local. Utilitza dades fictícies; no despleguis aquesta API d'usuaris públicament mentre no tingui autenticació i permisos.

## Endpoints de l'API

La URL base és `http://localhost:3000`. En Postman, selecciona **Body → raw → JSON** per a les peticions amb cos i envia la capçalera `Content-Type: application/json`.
Als exemples, `{{categoryId}}` i `{{productId}}` són variables d'entorn de Postman; també pots substituir-les directament pels `_id` retornats per l'API.

| Mètode | Endpoint | Descripció |
| --- | --- | --- |
| GET | `/` | Comprovar que l'API està en marxa |
| POST | `/api/categories` | Crear una categoria |
| GET | `/api/categories` | Llistar categories |
| GET | `/api/categories/:id` | Consultar una categoria |
| PUT | `/api/categories/:id` | Modificar una categoria |
| DELETE | `/api/categories/:id` | Eliminar una categoria |
| POST | `/api/products` | Crear un producte |
| GET | `/api/products` | Llistar productes |
| GET | `/api/products/:id` | Consultar un producte |
| PUT | `/api/products/:id` | Modificar un producte |
| DELETE | `/api/products/:id` | Eliminar un producte |
| POST | `/api/users` | Crear un usuari local |
| GET | `/api/users` | Llistar usuaris locals |
| GET | `/api/users/:id` | Consultar un usuari local |
| PUT | `/api/users/:id` | Modificar camps permesos |
| DELETE | `/api/users/:id` | Desactivar l'usuari (`active=false`) |

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

**Atenció:** encara no hi ha JWT ni permisos RBAC. `/api/users` només respon quan `NODE_ENV=development` i la connexió ve de `localhost` o `127.0.0.1`. Utilitza dades fictícies i no despleguis aquests endpoints públicament. El registre públic s'afegirà més endavant a `/api/auth/register`.

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

Prova aquests casos i comprova tant el codi HTTP com `error.code`:

1. **Categoria sense nom** — `POST /api/categories` amb `{ "slug": "sense-nom" }`. Esperat: `422 VALIDATION_ERROR`, detall del camp `name`.
2. **Slug duplicat** — crea una categoria i torna a enviar el mateix `slug`. Esperat: `409 DUPLICATE_SLUG`.
3. **ID invàlid** — `GET /api/categories/no-es-un-objectid`. Esperat: `400 INVALID_ID`.
4. **Usuari inexistent** — `GET /api/users/00000000-0000-4000-8000-000000000000` des de localhost amb `NODE_ENV=development`. És un UUID vàlid però no existent. Esperat: `404 USER_NOT_FOUND`.
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

Codis d'estat: `200` (consulta o modificació correcta), `201` (recurs creat), `204` (eliminació sense cos), `400` (petició o ID incorrecte), `404` (recurs inexistent), `409` (email o slug duplicat), `422` (validació semàntica) i `500` (error inesperat).

## Models de dades

Els models utilitzen `_id` com a UUID (string), excepte `Categoria`, que fa servir l'ObjectId de MongoDB perquè `Producte.category` hi apunti. El model d'usuari conserva el nom `Usuari` per mantenir les referències existents, i utilitza `bcrypt` per guardar hashes de contrasenya. Els camps de referència (`ref`) permeten fer `populate` entre col·leccions.

| Model       | Descripció                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `Usuari`    | Usuaris amb rol (`client`, `admin`), email únic i contrasenya protegida amb BCrypt       |
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
| `npm test`    | Encara no hi ha tests definits          |

## Documentació addicional

- `docs/adrs/ADR-001.md` — Elecció de MongoDB com a base de dades.
- `docs/adrs/ADR-002.md` — Repositoris separats per a backend i frontend.

## Repositori

- Origin: `https://github.com/alguna-jviladoms/backend-PokeMerch.git`

## Autor

Alex Gutierrez Navau
