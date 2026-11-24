# ADR-003: Catàleg acadèmic/demostratiu, emmagatzematge d'imatges i seed idempotent

## Context

- Backend: Node.js/Express 5 + Mongoose 9 + MongoDB (ADR-001). Models `Category` (ObjectId `_id`) i `Producte` (String `_id` UUID v4). Cap camp d'imatge, cap directori estàtic, cap seed i cap migració (Mongoose sincronitza l'esquema).
- Storefront: `DESIGN.md`, `design/storefront.html` i `frontend/frontend-react/src/services/storefrontFixtures.js`. El catàleg demo acordat és de 2 categories i 3 productes:
  - `Peluches` (`peluches`) / `Accesorios` (`accesorios`).
  - `Pikachu clàsic` (24,90 € / `PCH-CLSC-001`), `Eevee felp` (27,90 € / `EVE-FELP-002`), `Llavero Poké Ball` (9,90 € / `PKB-ACC-003`).
- Estratègia d'imatges acordada però no implementada: imatges en volum del servidor + rutes emmagatzemades en MongoDB.

## Decision

1. **Seed del catàleg demo**: upsert idempotent per natural key — categorïa per `slug`, producte per `sku`. No fa deletes destructius.
2. **Camp d'imatge**: `imagen` (String, opcional) al model `Producte`, amb la ruta emmagatzemada (p. ex. `/api/media/pikachu-clasico.png`).
3. **Emmagatzematge**: volum del servidor (filesystem) dins del backend.
4. **Servei**: `app.use('/api/media', express.static(<directori>))` a Express, abans del middleware 404.
5. **Docker**: volum `media_data` -> `/app/media` al backend + variable d'entorn `UPLOADS_DIR`.
6. **Catàleg demo**: noms, SKUs, preus i descripcions conservats de les fixtures per coerència amb el storefront.

## Conseqüències

- Canvi d'esquema additiu (camp opcional) -> sense migració de dades; Mongoose sincronitza el camp.
- Compatibilitat API: el camp és opcional i additiu; responses existents sense imatge segueixen vàlides.
- El frontend (`MediaSlot`, `storefrontApi`) encara no consumeix `imagen` -> passa primer backend o frontend; fins que no, fallback honest al placeholder.
- Preus: es conserva la conveni actual (`precio` Number, EUR, <=2 decimals) fins que es decideixi migrar a integer minor units.

## Alternatives rejected

- GridFS / base64: binari BSON o payload pesat; descartats per catàleg demo i coerència amb la estratègia acordada.
- Montat a `/uploads` a nivell d'arrel: el proxy de Vite només cobreix `/api`.
- Seed amb delete+insert: no idempotència segura i perjudica dades existents.
- Renombrar/reescriure una migració aplicada: n/a (no hi ha migracions; Mongoose).

## Open questions

- Quantitat final de productes/categorïes del demo.
- Format/nom d'imatges (extensió, naming, mida).
- Nom del camp i forma de la ruta (`/api/media/<fitxer>`, relativa o absoluta).
- Galeria d'imatges per producte.
- Usuari demo/sessió per llegir del API.
- Auth de la ruta estàtica.
