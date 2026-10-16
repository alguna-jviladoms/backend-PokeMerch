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
│       │   └── productController.js
│       ├── routes/              # Definició de rutes de l'API
│       │   └── productRoutes.js
│       └── services/            # Lògica de negoci / accés a dades
│           └── productService.js
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
```

### 3. Arrencar l'API

```bash
cd api
npm install
npm run dev
```

L'API quedarà disponible a `http://localhost:3000`.

## Endpoints de l'API

| Mètode | Ruta                | Descripció                      |
| ------ | ------------------- | ------------------------------- |
| GET    | `/`                 | Comprovació que l'API funciona  |
| GET    | `/api/products`     | Llista tots els productes       |
| GET    | `/api/products/:id` | Obté un producte pel seu id     |
| POST   | `/api/products`     | Crea un producte nou            |
| PUT    | `/api/products/:id` | Actualitza un producte existent |
| DELETE | `/api/products/:id` | Elimina un producte             |

Les respostes segueixen el format:

```json
{ "status": "success", "data": { ... } }
```

o, en cas d'error:

```json
{ "status": "error", "message": "Descripció de l'error" }
```

Codis d'estat emprats: `200` (OK), `201` (creat), `400` (error de validació), `404` (recurs no trobat).

## Models de dades

Tots els models utilitzen `_id` com a UUID (string) generat automàticament i tenen `versionKey: false`. Els camps de referència (`ref`) permeten fer `populate` entre col·leccions.

| Model       | Descripció                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `Usuari`    | Usuaris amb rol (`cliente`, `admin`, `repartidor`), validació d'email i contrasenya forta |
| `Producte`  | Productes de la botiga amb categoria, preu, SKU i estat actiu/inactiu      |
| `Categoria` | Categories amb jerarquia (subcategories via `categoria_padre_id`)          |
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
