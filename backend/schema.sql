-- Falkenau Campus -- Datenbankschema (SQLite)
-- Bildet die Domäne des Studierendenportals ab: Studiengänge, Studierende,
-- Module, Einschreibungen/Noten, Vorlesungstermine, Klausuren, Abgaben und Nachrichten.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS studiengaenge (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS dozenten (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  kuerzel TEXT
);

CREATE TABLE IF NOT EXISTS studenten (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vorname         TEXT NOT NULL,
  nachname        TEXT NOT NULL,
  matrikelnummer  TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  studiengang_id  INTEGER NOT NULL REFERENCES studiengaenge(id) ON DELETE RESTRICT,
  semester        INTEGER NOT NULL DEFAULT 1,
  erstellt_am     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  ects            INTEGER NOT NULL DEFAULT 5,
  studiengang_id  INTEGER NOT NULL REFERENCES studiengaenge(id) ON DELETE CASCADE,
  UNIQUE(name, studiengang_id)
);

-- Einschreibung eines Studierenden in ein Modul; trägt zugleich die Note/den Status.
CREATE TABLE IF NOT EXISTS einschreibungen (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES studenten(id) ON DELETE CASCADE,
  modul_id    INTEGER NOT NULL REFERENCES module(id) ON DELETE CASCADE,
  note        REAL,
  status      TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bestanden', 'nicht bestanden')),
  UNIQUE(student_id, modul_id)
);

-- Wiederkehrende wöchentliche Termine (Stundenplan) je Modul.
CREATE TABLE IF NOT EXISTS vorlesungstermine (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  modul_id    INTEGER NOT NULL REFERENCES module(id) ON DELETE CASCADE,
  dozent_id   INTEGER REFERENCES dozenten(id) ON DELETE SET NULL,
  typ         TEXT NOT NULL DEFAULT 'Vorlesung' CHECK (typ IN ('Vorlesung', 'Übung', 'Seminar', 'Praxisreflexion')),
  wochentag   TEXT NOT NULL CHECK (wochentag IN ('Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag')),
  start_zeit  TEXT NOT NULL,
  end_zeit    TEXT NOT NULL,
  raum        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS klausuren (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  modul_id  INTEGER NOT NULL REFERENCES module(id) ON DELETE CASCADE,
  datum     TEXT NOT NULL,
  uhrzeit   TEXT NOT NULL,
  raum      TEXT NOT NULL
);

-- Aufgabenstellung (Abgabe-Definition) je Modul.
CREATE TABLE IF NOT EXISTS aufgaben (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  modul_id     INTEGER NOT NULL REFERENCES module(id) ON DELETE CASCADE,
  titel        TEXT NOT NULL,
  faelligkeit  TEXT NOT NULL
);

-- Tatsächliche Einreichung eines Studierenden zu einer Aufgabe (fehlender Eintrag = offen).
CREATE TABLE IF NOT EXISTS abgaben (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  aufgabe_id      INTEGER NOT NULL REFERENCES aufgaben(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES studenten(id) ON DELETE CASCADE,
  dateiname       TEXT NOT NULL,
  eingereicht_am  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(aufgabe_id, student_id)
);

CREATE TABLE IF NOT EXISTS nachrichten (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES studenten(id) ON DELETE CASCADE,
  absender  TEXT NOT NULL,
  betreff   TEXT NOT NULL,
  vorschau  TEXT NOT NULL,
  datum     TEXT NOT NULL,
  gelesen   INTEGER NOT NULL DEFAULT 0 CHECK (gelesen IN (0, 1))
);

-- Campusweite Neuigkeiten, unabhängig vom einzelnen Studierenden.
CREATE TABLE IF NOT EXISTS news (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  quelle  TEXT NOT NULL,
  text    TEXT NOT NULL,
  datum   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studenten_studiengang       ON studenten(studiengang_id);
CREATE INDEX IF NOT EXISTS idx_module_studiengang          ON module(studiengang_id);
CREATE INDEX IF NOT EXISTS idx_einschreibungen_student     ON einschreibungen(student_id);
CREATE INDEX IF NOT EXISTS idx_einschreibungen_modul       ON einschreibungen(modul_id);
CREATE INDEX IF NOT EXISTS idx_vorlesungstermine_modul     ON vorlesungstermine(modul_id);
CREATE INDEX IF NOT EXISTS idx_vorlesungstermine_wochentag ON vorlesungstermine(wochentag);
CREATE INDEX IF NOT EXISTS idx_klausuren_modul             ON klausuren(modul_id);
CREATE INDEX IF NOT EXISTS idx_aufgaben_modul               ON aufgaben(modul_id);
CREATE INDEX IF NOT EXISTS idx_abgaben_student              ON abgaben(student_id);
CREATE INDEX IF NOT EXISTS idx_nachrichten_student          ON nachrichten(student_id);
