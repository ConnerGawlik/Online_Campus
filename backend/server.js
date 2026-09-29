const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());

// Minimale CORS-Freigabe für lokale Frontend-Entwicklung.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Statisches Frontend (Design-Mockup) ausliefern: Projektwurzel enthält
// "Uni Verwaltungstool.dc.html" und support.js.
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));
app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'Uni Verwaltungstool.dc.html'));
});

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function studentPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    vorname: row.vorname,
    nachname: row.nachname,
    name: `${row.vorname} ${row.nachname}`,
    matrikelnummer: row.matrikelnummer,
    email: row.email,
    semester: row.semester,
    studiengang: row.studiengang_name,
  };
}

function getStudentOr404(req, res) {
  const student = db
    .prepare(`
      SELECT s.*, sg.name AS studiengang_name
      FROM studenten s JOIN studiengaenge sg ON sg.id = s.studiengang_id
      WHERE s.id = ?
    `)
    .get(Number(req.params.id));
  if (!student) {
    res.status(404).json({ error: 'Studierende:r nicht gefunden' });
    return null;
  }
  return student;
}

// -- Auth ---------------------------------------------------------------

app.post('/api/login', (req, res) => {
  const { matrikelnummer, password } = req.body ?? {};
  if (!matrikelnummer || !password) {
    return res.status(400).json({ error: 'matrikelnummer und password sind erforderlich' });
  }
  const row = db
    .prepare(`
      SELECT s.*, sg.name AS studiengang_name
      FROM studenten s JOIN studiengaenge sg ON sg.id = s.studiengang_id
      WHERE s.matrikelnummer = ?
    `)
    .get(matrikelnummer);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Matrikelnummer oder Passwort ist falsch' });
  }
  res.json(studentPublic(row));
});

app.get('/api/personas', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT s.*, sg.name AS studiengang_name
      FROM studenten s JOIN studiengaenge sg ON sg.id = s.studiengang_id
      ORDER BY s.id
    `)
    .all();
  res.json(rows.map(studentPublic));
});

// -- Student profile ------------------------------------------------------

app.get('/api/studenten/:id', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;
  res.json(studentPublic(student));
});

// -- Dashboard --------------------------------------------------------------

app.get('/api/studenten/:id/dashboard', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;
  const studentId = student.id;

  const heute = WOCHENTAGE[new Date().getDay()];
  const vorlesungenHeute = db
    .prepare(`
      SELECT v.start_zeit, v.end_zeit, m.name AS modul, v.raum, d.name AS dozent, v.typ
      FROM vorlesungstermine v
      JOIN module m ON m.id = v.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      LEFT JOIN dozenten d ON d.id = v.dozent_id
      WHERE v.wochentag = ?
      ORDER BY v.start_zeit
    `)
    .all(studentId, heute);

  const naechsteAbgaben = db
    .prepare(`
      SELECT a.id, a.titel, m.name AS modul, a.faelligkeit
      FROM aufgaben a
      JOIN module m ON m.id = a.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      LEFT JOIN abgaben ab ON ab.aufgabe_id = a.id AND ab.student_id = ?
      WHERE ab.id IS NULL
      ORDER BY a.faelligkeit
      LIMIT 3
    `)
    .all(studentId, studentId);

  const naechsteKlausuren = db
    .prepare(`
      SELECT m.name AS modul, k.datum, k.uhrzeit, k.raum
      FROM klausuren k
      JOIN module m ON m.id = k.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      WHERE k.datum >= date('now')
      ORDER BY k.datum
      LIMIT 2
    `)
    .all(studentId);

  const offeneAbgabenCount = db
    .prepare(`
      SELECT COUNT(*) AS n
      FROM aufgaben a
      JOIN module m ON m.id = a.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      LEFT JOIN abgaben ab ON ab.aufgabe_id = a.id AND ab.student_id = ?
      WHERE ab.id IS NULL
    `)
    .get(studentId, studentId).n;

  const noten = db.prepare(`SELECT note FROM einschreibungen WHERE student_id = ? AND note IS NOT NULL`).all(studentId);
  const avgGrade = noten.length ? noten.reduce((sum, n) => sum + n.note, 0) / noten.length : null;

  const unreadCount = db
    .prepare(`SELECT COUNT(*) AS n FROM nachrichten WHERE student_id = ? AND gelesen = 0`)
    .get(studentId).n;

  const inboxPreview = db
    .prepare(`SELECT id, absender, betreff, datum, gelesen FROM nachrichten WHERE student_id = ? ORDER BY datum DESC LIMIT 3`)
    .all(studentId);

  const news = db.prepare(`SELECT quelle, text, datum FROM news ORDER BY datum DESC`).all();

  res.json({
    openCount: offeneAbgabenCount,
    nextExamDate: naechsteKlausuren[0]?.datum ?? null,
    avgGrade,
    unreadCount,
    heute: vorlesungenHeute,
    abgaben: naechsteAbgaben,
    klausuren: naechsteKlausuren,
    inboxPreview,
    news,
  });
});

// -- Stundenplan --------------------------------------------------------------

app.get('/api/studenten/:id/stundenplan', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const rows = db
    .prepare(`
      SELECT v.wochentag, v.start_zeit, v.end_zeit, m.name AS modul, v.raum, v.typ, d.name AS dozent
      FROM vorlesungstermine v
      JOIN module m ON m.id = v.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      LEFT JOIN dozenten d ON d.id = v.dozent_id
      ORDER BY v.start_zeit
    `)
    .all(student.id);

  const ordnung = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const grouped = new Map(ordnung.map((tag) => [tag, []]));
  for (const row of rows) {
    grouped.get(row.wochentag).push({
      time: `${row.start_zeit}–${row.end_zeit}`,
      course: row.typ === 'Vorlesung' ? row.modul : `${row.modul} (${row.typ})`,
      room: row.raum,
      dozent: row.dozent,
    });
  }

  const result = ordnung
    .map((tag) => ({ day: tag, items: grouped.get(tag) }))
    .filter((tag) => tag.items.length > 0);

  res.json(result);
});

// -- Noten --------------------------------------------------------------

app.get('/api/studenten/:id/noten', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const rows = db
    .prepare(`
      SELECT m.name AS modul, e.note, m.ects, e.status
      FROM einschreibungen e
      JOIN module m ON m.id = e.modul_id
      WHERE e.student_id = ?
      ORDER BY m.name
    `)
    .all(student.id);

  res.json(rows);
});

// -- Abgaben --------------------------------------------------------------

app.get('/api/studenten/:id/abgaben', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;

  const rows = db
    .prepare(`
      SELECT a.id, a.titel, m.name AS modul, a.faelligkeit, ab.dateiname, ab.eingereicht_am
      FROM aufgaben a
      JOIN module m ON m.id = a.modul_id
      JOIN einschreibungen e ON e.modul_id = m.id AND e.student_id = ?
      LEFT JOIN abgaben ab ON ab.aufgabe_id = a.id AND ab.student_id = ?
      ORDER BY a.faelligkeit
    `)
    .all(student.id, student.id);

  res.json(
    rows.map((r) => ({
      id: r.id,
      titel: r.titel,
      modul: r.modul,
      faelligkeit: r.faelligkeit,
      eingereicht: r.dateiname != null,
      dateiname: r.dateiname,
      eingereichtAm: r.eingereicht_am,
    }))
  );
});

app.post('/api/studenten/:id/abgaben/:aufgabeId', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;
  const { dateiname } = req.body ?? {};
  if (!dateiname) return res.status(400).json({ error: 'dateiname ist erforderlich' });

  const aufgabe = db.prepare(`SELECT id FROM aufgaben WHERE id = ?`).get(Number(req.params.aufgabeId));
  if (!aufgabe) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

  db.prepare(`
    INSERT INTO abgaben (aufgabe_id, student_id, dateiname, eingereicht_am)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(aufgabe_id, student_id) DO UPDATE SET dateiname = excluded.dateiname, eingereicht_am = excluded.eingereicht_am
  `).run(aufgabe.id, student.id, dateiname);

  res.status(201).json({ ok: true });
});

app.delete('/api/studenten/:id/abgaben/:aufgabeId', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;
  db.prepare(`DELETE FROM abgaben WHERE aufgabe_id = ? AND student_id = ?`).run(
    Number(req.params.aufgabeId),
    student.id
  );
  res.json({ ok: true });
});

// -- Nachrichten --------------------------------------------------------------

app.get('/api/studenten/:id/nachrichten', (req, res) => {
  const student = getStudentOr404(req, res);
  if (!student) return;
  const rows = db
    .prepare(`SELECT id, absender, betreff, vorschau, datum, gelesen FROM nachrichten WHERE student_id = ? ORDER BY datum DESC`)
    .all(student.id);
  res.json(rows.map((r) => ({ ...r, gelesen: !!r.gelesen })));
});

app.patch('/api/nachrichten/:id/gelesen', (req, res) => {
  const result = db.prepare(`UPDATE nachrichten SET gelesen = 1 WHERE id = ?`).run(Number(req.params.id));
  if (result.changes === 0) return res.status(404).json({ error: 'Nachricht nicht gefunden' });
  res.json({ ok: true });
});

// -- News --------------------------------------------------------------

app.get('/api/news', (_req, res) => {
  res.json(db.prepare(`SELECT quelle, text, datum FROM news ORDER BY datum DESC`).all());
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Falkenau Campus API läuft auf http://${HOST}:${PORT}`);
});
