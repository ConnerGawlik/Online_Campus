// Legt backend/data/campus.db neu an und befüllt sie mit Mock-Daten,
// die den drei Demo-Personas aus "Uni Verwaltungstool.dc.html" entsprechen.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data', 'campus.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DEMO_PASSWORD = 'campus2026';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.rmSync(DB_PATH, { force: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const insert = (sql) => db.prepare(sql);

const insertStudiengang = insert(`INSERT INTO studiengaenge (name) VALUES (?)`);
const insertDozent = insert(`INSERT INTO dozenten (name, kuerzel) VALUES (?, ?)`);
const insertStudent = insert(`
  INSERT INTO studenten (vorname, nachname, matrikelnummer, email, password_hash, studiengang_id, semester)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertModul = insert(`INSERT INTO module (name, ects, studiengang_id) VALUES (?, ?, ?)`);
const insertEinschreibung = insert(`
  INSERT INTO einschreibungen (student_id, modul_id, note, status) VALUES (?, ?, ?, ?)
`);
const insertTermin = insert(`
  INSERT INTO vorlesungstermine (modul_id, dozent_id, typ, wochentag, start_zeit, end_zeit, raum)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertKlausur = insert(`INSERT INTO klausuren (modul_id, datum, uhrzeit, raum) VALUES (?, ?, ?, ?)`);
const insertAufgabe = insert(`INSERT INTO aufgaben (modul_id, titel, faelligkeit) VALUES (?, ?, ?)`);
const insertNachricht = insert(`
  INSERT INTO nachrichten (student_id, absender, betreff, vorschau, datum, gelesen) VALUES (?, ?, ?, ?, ?, ?)
`);
const insertNews = insert(`INSERT INTO news (quelle, text, datum) VALUES (?, ?, ?)`);

const run = (stmt, ...params) => Number(stmt.run(...params).lastInsertRowid);

db.exec('BEGIN');

try {
  // -- Studiengänge --------------------------------------------------------
  const studiengangId = {
    mim: run(insertStudiengang, 'Medien- und IT-Management'),
    bwl: run(insertStudiengang, 'Betriebswirtschaftslehre'),
    gs: run(insertStudiengang, 'Gesundheit und Soziales'),
  };

  // -- Dozenten --------------------------------------------------------
  const dozentId = {};
  for (const [kuerzel, name] of Object.entries({
    berger: 'Prof. Berger', nkemelu: 'Prof. Nkemelu', adler: 'Prof. Adler',
    reinke: 'Prof. Reinke', falke: 'Prof. Falke', holt: 'Prof. Holt',
    sander: 'Prof. Sander', wille: 'Prof. Wille', lenz: 'Prof. Lenz',
  })) {
    dozentId[kuerzel] = run(insertDozent, name, kuerzel);
  }

  // -- Module je Studiengang -------------------------------------------
  const modul = {};
  const defineModule = (key, name, studiengang, ects = 5) => {
    modul[key] = run(insertModul, name, ects, studiengangId[studiengang]);
  };

  defineModule('mediendesign', 'Mediendesign Grundlagen', 'mim');
  defineModule('datenbanksysteme', 'Datenbanksysteme', 'mim');
  defineModule('medienrecht', 'Medienrecht', 'mim');
  defineModule('marketing_digital', 'Digitales Marketing', 'mim');
  defineModule('statistik', 'Statistik', 'mim');
  defineModule('mediengestaltung1', 'Mediengestaltung I', 'mim');
  defineModule('bwl_grundlagen', 'BWL Grundlagen', 'mim');
  defineModule('projektwerkstatt', 'Projektwerkstatt', 'mim');

  defineModule('controlling', 'Controlling', 'bwl');
  defineModule('unternehmensrecht', 'Unternehmensrecht', 'bwl');
  defineModule('personalmanagement', 'Personalmanagement', 'bwl');
  defineModule('investition_finanzierung', 'Investition & Finanzierung', 'bwl');
  defineModule('marketing', 'Marketing', 'bwl');
  defineModule('kostenrechnung', 'Kostenrechnung', 'bwl');
  defineModule('wirtschaftsenglisch', 'Wirtschaftsenglisch', 'bwl');

  defineModule('pflegewissenschaft', 'Pflegewissenschaft', 'gs');
  defineModule('sozialrecht', 'Sozialrecht', 'gs');
  defineModule('kommunikation_gesundheit', 'Kommunikation im Gesundheitswesen', 'gs');
  defineModule('anatomie', 'Anatomie & Physiologie', 'gs');
  defineModule('ethik', 'Ethik im Gesundheitswesen', 'gs');

  // -- Studierende (Personas) -------------------------------------------
  const studentId = {
    lina: run(insertStudent, 'Lina', 'Cortez', 'MIM-24118', 'lina.cortez@stud.falkenau-campus.de',
      hashPassword(DEMO_PASSWORD), studiengangId.mim, 3),
    jonas: run(insertStudent, 'Jonas', 'Weber', 'BWL-22056', 'jonas.weber@stud.falkenau-campus.de',
      hashPassword(DEMO_PASSWORD), studiengangId.bwl, 5),
    amelie: run(insertStudent, 'Amelie', 'Hoffmann', 'GS-25091', 'amelie.hoffmann@stud.falkenau-campus.de',
      hashPassword(DEMO_PASSWORD), studiengangId.gs, 2),
  };

  // -- Einschreibungen / Noten -------------------------------------------
  const enroll = (student, modulKey, note, status) =>
    run(insertEinschreibung, studentId[student], modul[modulKey], note, status);

  enroll('lina', 'mediengestaltung1', 1.7, 'bestanden');
  enroll('lina', 'bwl_grundlagen', 2.3, 'bestanden');
  enroll('lina', 'statistik', 3.0, 'bestanden');
  enroll('lina', 'medienrecht', null, 'offen');
  enroll('lina', 'datenbanksysteme', null, 'offen');
  enroll('lina', 'mediendesign', null, 'offen');
  enroll('lina', 'marketing_digital', null, 'offen');
  enroll('lina', 'projektwerkstatt', null, 'offen');

  enroll('jonas', 'marketing', 2.0, 'bestanden');
  enroll('jonas', 'kostenrechnung', 2.7, 'bestanden');
  enroll('jonas', 'wirtschaftsenglisch', 1.3, 'bestanden');
  enroll('jonas', 'controlling', null, 'offen');
  enroll('jonas', 'investition_finanzierung', null, 'offen');
  enroll('jonas', 'unternehmensrecht', null, 'offen');
  enroll('jonas', 'personalmanagement', null, 'offen');

  enroll('amelie', 'anatomie', 1.7, 'bestanden');
  enroll('amelie', 'ethik', 2.0, 'bestanden');
  enroll('amelie', 'sozialrecht', null, 'offen');
  enroll('amelie', 'pflegewissenschaft', null, 'offen');
  enroll('amelie', 'kommunikation_gesundheit', null, 'offen');

  // -- Stundenplan (vorlesungstermine) -----------------------------------
  const termin = (modulKey, dozentKey, typ, tag, start, ende, raum) =>
    run(insertTermin, modul[modulKey], dozentKey ? dozentId[dozentKey] : null, typ, tag, start, ende, raum);

  // Lina — Medien- und IT-Management
  termin('mediendesign', 'berger', 'Vorlesung', 'Montag', '09:00', '10:30', 'M.204');
  termin('datenbanksysteme', 'nkemelu', 'Vorlesung', 'Montag', '11:00', '12:30', 'IT.110');
  termin('medienrecht', 'adler', 'Vorlesung', 'Montag', '14:00', '15:30', 'M.107');
  termin('marketing_digital', null, 'Vorlesung', 'Dienstag', '10:00', '11:30', 'M.112');
  termin('statistik', null, 'Vorlesung', 'Mittwoch', '09:00', '10:30', 'B.205');
  termin('mediendesign', null, 'Übung', 'Mittwoch', '13:00', '14:30', 'M.204');
  termin('datenbanksysteme', null, 'Übung', 'Donnerstag', '11:00', '12:30', 'IT.110');
  termin('medienrecht', null, 'Vorlesung', 'Freitag', '09:00', '10:30', 'M.107');
  termin('projektwerkstatt', null, 'Seminar', 'Freitag', '11:00', '12:30', 'M.118');

  // Jonas — Betriebswirtschaftslehre
  termin('controlling', 'reinke', 'Vorlesung', 'Montag', '08:30', '10:00', 'B.301');
  termin('unternehmensrecht', 'falke', 'Vorlesung', 'Montag', '10:15', '11:45', 'B.212');
  termin('personalmanagement', 'holt', 'Seminar', 'Montag', '13:00', '14:30', 'B.108');
  termin('investition_finanzierung', null, 'Vorlesung', 'Dienstag', '09:00', '10:30', 'B.114');
  termin('marketing', null, 'Vorlesung', 'Mittwoch', '11:00', '12:30', 'B.220');
  termin('kostenrechnung', null, 'Vorlesung', 'Mittwoch', '14:00', '15:30', 'B.115');
  termin('controlling', null, 'Übung', 'Donnerstag', '08:30', '10:00', 'B.301');
  termin('wirtschaftsenglisch', null, 'Vorlesung', 'Freitag', '10:00', '11:30', 'B.109');

  // Amelie — Gesundheit und Soziales
  termin('pflegewissenschaft', 'sander', 'Vorlesung', 'Montag', '09:00', '10:30', 'G.101');
  termin('sozialrecht', 'wille', 'Vorlesung', 'Montag', '10:45', '12:15', 'G.204');
  termin('kommunikation_gesundheit', 'lenz', 'Vorlesung', 'Montag', '13:30', '15:00', 'G.108');
  termin('anatomie', null, 'Vorlesung', 'Dienstag', '09:00', '10:30', 'G.115');
  termin('ethik', null, 'Vorlesung', 'Mittwoch', '11:00', '12:30', 'G.109');
  termin('sozialrecht', null, 'Übung', 'Donnerstag', '09:00', '10:30', 'G.204');
  termin('pflegewissenschaft', null, 'Praxisreflexion', 'Donnerstag', '13:00', '14:30', 'G.108');
  termin('pflegewissenschaft', null, 'Übung', 'Freitag', '10:00', '11:30', 'G.101');

  // -- Klausuren -----------------------------------------------------------
  run(insertKlausur, modul.medienrecht, '2026-09-30', '09:00', 'M.107');
  run(insertKlausur, modul.datenbanksysteme, '2026-10-07', '11:00', 'IT.110');

  run(insertKlausur, modul.controlling, '2026-09-28', '10:00', 'B.301');
  run(insertKlausur, modul.investition_finanzierung, '2026-10-05', '09:00', 'B.114');

  run(insertKlausur, modul.sozialrecht, '2026-10-01', '09:00', 'G.204');
  run(insertKlausur, modul.pflegewissenschaft, '2026-10-08', '11:00', 'G.101');

  // -- Aufgaben (Abgaben-Definitionen) -------------------------------------
  const aufgabe = {};
  aufgabe.mimUx = run(insertAufgabe, modul.mediendesign, 'Projektbericht "UX Case Study"', '2026-09-18');
  aufgabe.mimMarketing = run(insertAufgabe, modul.marketing_digital, 'Konzeptpapier Social-Media-Kampagne', '2026-09-22');
  aufgabe.mimDb = run(insertAufgabe, modul.datenbanksysteme, 'Datenbank-Entwurf (ER-Modell)', '2026-09-29');

  aufgabe.bwlControlling = run(insertAufgabe, modul.controlling, 'Fallstudie Controlling', '2026-09-17');
  aufgabe.bwlPersonal = run(insertAufgabe, modul.personalmanagement, 'Hausarbeit Personalmanagement', '2026-09-25');
  aufgabe.bwlRecht = run(insertAufgabe, modul.unternehmensrecht, 'Gruppenpräsentation', '2026-10-01');

  aufgabe.gsPraxis = run(insertAufgabe, modul.pflegewissenschaft, 'Reflexionsbericht Praxisphase', '2026-09-19');
  aufgabe.gsEssay = run(insertAufgabe, modul.sozialrecht, 'Essay', '2026-09-23');
  aufgabe.gsGruppe = run(insertAufgabe, modul.kommunikation_gesundheit, 'Gruppenarbeit Kommunikationsmodelle', '2026-09-30');
  // Alle Abgaben starten unbeantwortet (kein Eintrag in `abgaben`), analog zum Frontend-Default.

  // -- Nachrichten -----------------------------------------------------------
  const nachricht = (student, absender, betreff, vorschau, datum, gelesen) =>
    run(insertNachricht, studentId[student], absender, betreff, vorschau, datum, gelesen ? 1 : 0);

  nachricht('lina', 'Prof. Berger', 'Feedback zu eurem Moodboard',
    'Ich habe die Moodboards durchgesehen — insgesamt guter Stand, zwei Anmerkungen zur Typografie im Anhang.', '2026-09-12', false);
  nachricht('lina', 'Studierendensekretariat', 'Rückmeldung Wintersemester erforderlich',
    'Bitte melden Sie sich bis zum 30.09. für das Wintersemester 2026/27 zurück.', '2026-09-10', false);
  nachricht('lina', 'IT-Support', 'Wartungsarbeiten im WLAN am 16.09.',
    'Von 06:00 bis 08:00 Uhr steht das Campus-WLAN für Wartungsarbeiten nicht zur Verfügung.', '2026-09-09', true);

  nachricht('jonas', 'Prof. Reinke', 'Fallstudie: zusätzliche Daten',
    'Im Anhang findet ihr die ergänzenden Kennzahlen für die Fallstudie Controlling.', '2026-09-13', false);
  nachricht('jonas', 'Prüfungsamt', 'Klausurplan Wintersemester veröffentlicht',
    'Der Klausurplan für das Wintersemester 2026/27 ist ab sofort im Portal einsehbar.', '2026-09-11', false);
  nachricht('jonas', 'AStA', 'Einladung Erstsemesterfahrt',
    'Auch höhere Semester sind herzlich eingeladen, die Erstsemesterfahrt mitzugestalten.', '2026-09-08', true);

  nachricht('amelie', 'Prof. Sander', 'Praxisphase: Unterlagen einreichen',
    'Bitte reicht den Praxisphasen-Nachweis bis zum 20.09. im Sekretariat ein.', '2026-09-12', false);
  nachricht('amelie', 'Praktikumsbüro', 'Praktikumsplätze Frühjahr 2027',
    'Neue Praktikumsplätze in Kliniken und sozialen Einrichtungen sind online.', '2026-09-10', false);
  nachricht('amelie', 'Studierendensekretariat', 'Rückmeldung Wintersemester erforderlich',
    'Bitte melden Sie sich bis zum 30.09. für das Wintersemester 2026/27 zurück.', '2026-09-10', true);

  // -- Campusweite News -----------------------------------------------------
  run(insertNews, 'Prüfungsamt', 'Rückmeldefrist Wintersemester 2026/27 endet am 30.09.', '2026-09-10');
  run(insertNews, 'Bibliothek', 'Neue Öffnungszeiten ab 1. Oktober — täglich bis 22 Uhr.', '2026-09-08');
  run(insertNews, 'Career Center', 'Career Day am 14. Oktober im Audimax.', '2026-09-05');

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

db.close();

console.log(`Datenbank angelegt: ${DB_PATH}`);
console.log(`Demo-Login-Passwort für alle Studierenden: ${DEMO_PASSWORD}`);
