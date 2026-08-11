import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'task_platform.db');
const sqlFilePath = path.join(__dirname, '..', '..', 'database.sql');

let db;

try {
  const { default: Database } = await import('better-sqlite3');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.warn('⚡ better-sqlite3 native binding unavailable, falling back to built-in node:sqlite.');
  const { DatabaseSync } = await import('node:sqlite');
  const nativeDb = new DatabaseSync(dbPath);

  nativeDb.exec('PRAGMA journal_mode = WAL;');
  nativeDb.exec('PRAGMA foreign_keys = ON;');

  db = {
    pragma(pragmaStr) {
      return nativeDb.exec(`PRAGMA ${pragmaStr}`);
    },
    exec(sql) {
      return nativeDb.exec(sql);
    },
    prepare(sql) {
      const stmt = nativeDb.prepare(sql);
      return {
        run(...args) {
          if (args.length === 1 && Array.isArray(args[0])) {
            return stmt.run(...args[0]);
          }
          return stmt.run(...args);
        },
        get(...args) {
          if (args.length === 1 && Array.isArray(args[0])) {
            return stmt.get(...args[0]);
          }
          return stmt.get(...args);
        },
        all(...args) {
          if (args.length === 1 && Array.isArray(args[0])) {
            return stmt.all(...args[0]);
          }
          return stmt.all(...args);
        }
      };
    },
    transaction(fn) {
      return (...args) => {
        nativeDb.exec('BEGIN IMMEDIATE');
        try {
          const result = fn(...args);
          nativeDb.exec('COMMIT');
          return result;
        } catch (error) {
          nativeDb.exec('ROLLBACK');
          throw error;
        }
      };
    }
  };
}

// Initialize schema from database.sql
export function initDB() {
  try {
    if (fs.existsSync(sqlFilePath)) {
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Execute schema statements
      db.exec(sqlContent);
      console.log(' Successfully initialized SQLite database using schema from database.sql');
    } else {
      console.warn(' WARNING: database.sql not found at expected path:', sqlFilePath);
    }
  } catch (err) {
    console.error(' Error initializing DB schema:', err.message);
  }
}

export function logSystemEvent(component, logLevel, message, metadata = {}) {
  try {
    const id = 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const stmt = db.prepare(`
      INSERT INTO execution_logs (id, component, log_level, message, metadata_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, component, logLevel, message, JSON.stringify(metadata));
  } catch (err) {
    console.error('Failed to insert log:', err);
  }
}

export default db;
