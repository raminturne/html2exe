const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

class Database {
  constructor(filePath) {
    this.filePath = filePath;
    this.sql = null;
    this.dirty = false;
  }

  async init() {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    if (fs.existsSync(this.filePath)) {
      const fileBuffer = fs.readFileSync(this.filePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.SQL = SQL;
  }

  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    this.dirty = true;
    this.persist();
    const lastId = this.query('SELECT last_insert_rowid() AS id')[0]?.id ?? null;
    return { changes: this.db.getRowsModified(), lastInsertRowid: lastId };
  }

  persist() {
    const data = this.db.export();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, Buffer.from(data));
    this.dirty = false;
  }

  close() {
    if (this.dirty) this.persist();
    this.db.close();
  }
}

module.exports = Database;
