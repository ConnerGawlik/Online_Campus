# Falkenau Campus — Backend

Backend für das im Design-Mockup (`Uni Verwaltungstool.dc.html`) gezeigte
Studierendenportal. Node.js/Express-API auf einer kleinen SQLite-Datenbank
(über das eingebaute `node:sqlite`, kein natives Kompilieren nötig).

## Setup

```bash
npm install
npm run seed   # legt data/campus.db neu an und befüllt sie mit Mock-Daten
npm start      # startet die API auf http://localhost:3001
```

Demo-Login (für alle drei Studierenden): Passwort `campus2026`.

| Matrikelnummer | Name             | Studiengang                     |
|-----------------|------------------|----------------------------------|
| MIM-24118       | Lina Cortez      | Medien- und IT-Management        |
| BWL-22056       | Jonas Weber      | Betriebswirtschaftslehre         |
| GS-25091        | Amelie Hoffmann  | Gesundheit und Soziales          |

## Schema

Siehe [`schema.sql`](schema.sql) — die vollständige, versionierte Definition
aller Tabellen, Constraints und Indizes. `seed.js` führt dieses Schema aus und
befüllt die Datenbank anschließend transaktional mit Mock-Daten.

## Endpunkte

- `POST /api/login` `{ matrikelnummer, password }`
- `GET  /api/personas`
- `GET  /api/studenten/:id`
- `GET  /api/studenten/:id/dashboard`
- `GET  /api/studenten/:id/stundenplan`
- `GET  /api/studenten/:id/noten`
- `GET  /api/studenten/:id/abgaben`
- `POST /api/studenten/:id/abgaben/:aufgabeId` `{ dateiname }`
- `DELETE /api/studenten/:id/abgaben/:aufgabeId`
- `GET  /api/studenten/:id/nachrichten`
- `PATCH /api/nachrichten/:id/gelesen`
- `GET  /api/news`
