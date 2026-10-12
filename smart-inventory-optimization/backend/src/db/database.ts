import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../inventory.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

export default db;
