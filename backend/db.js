const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data', 'campus.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
