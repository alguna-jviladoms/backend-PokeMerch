# PokeMerch Backend

API i servei de dades del projecte E-commerce PokeMerch, una botiga en línia de productes de merxandising.

## Tecnologies

- Node.js / Express
- MongoDB (gestionada via Docker)
- Docker / Docker Compose

## Estructura del projecte

```
backend/
├── Docker/
│   └── docker-compose.yml   # Orquestra la base de dades MongoDB
├── docs/
│   ├── adrs/                # Registre de decisions d'arquitectura (ADR)
│   │   ├── ADR-001.md       # Elecció de base de dades (MongoDB)
│   │   └── ADR-002.md       # Estructura del projecte (repos separats)
│   └── diagrams/
│       └── DB-PokeMerch.png # Diagrama de la base de dades
└── README.md
```

## Requisits previs

- Docker amb Docker Compose instal·lat.

## Com executar el projecte

1. Llança la base de dades MongoDB des de l'arrel del backend:

   ```bash
   docker compose -f Docker/docker-compose.yml up -d
   ```

   O des del directori Docker

   ```bash
   docker compose up -d
   ```

2. La base de dades quedarà disponible amb la següent configuració (definida al `docker-compose.yml`):
   - Contenidor: `mongodb_test`
   - Imatge: `mongo:latest`
   - Port exposat: `27000:27017` (MongoDB al port local `27000`)
   - Base de dades inicial: `mongodb_docker_test`
   - Usuari / contrasenya: `admin` / `1234` (configuració de test, NO apta per a producció)

3. Les dades persisteixen al volum `mongo_data`, que es munta a `/data/db` del contenidor.

## Repositori

- Origin: `https://github.com/alguna-jviladoms/backend-PokeMerch.git`

## Autor

Alex Gutierrez Navau