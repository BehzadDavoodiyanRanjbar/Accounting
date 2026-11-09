'use strict';
/* لایه‌ی ذخیره‌سازی: PostgreSQL (پیش‌فرض) یا SQL Server (DB_TYPE=mssql)
   هر دو فقط دو جدول دارند: rows(sheet, uid, data) و props(k, v) ؛ بقیه‌ی برنامه چیزی از نوع دیتابیس نمی‌داند. */

class PgAdapter {
  constructor(db) { this.db = db; this.kind = 'pg'; }
  async init() {
    const q = s => this.db.query(s);
    await q('CREATE TABLE IF NOT EXISTS rows (sheet text NOT NULL, uid bigint PRIMARY KEY, data jsonb NOT NULL)');
    await q('CREATE INDEX IF NOT EXISTS rows_sheet ON rows(sheet, uid)');
    await q('CREATE TABLE IF NOT EXISTS props (k text PRIMARY KEY, v text NOT NULL)');
  }
  async loadAll() {
    const r = await this.db.query('SELECT sheet, uid, data FROM rows ORDER BY sheet, uid');
    const p = await this.db.query('SELECT k, v FROM props');
    return {
      rows: r.rows.map(x => ({ sheet: x.sheet, uid: Number(x.uid), data: typeof x.data === 'string' ? JSON.parse(x.data) : x.data })),
      props: p.rows.map(x => [x.k, x.v])
    };
  }
  /* ch = { del:[uid], upd:[[uid,row]], ins:[[sheet,uid,row]], props:[[k, value|undefined]] } */
  async apply(ch) {
    const db = this.db;
    await db.query('BEGIN');
    try {
      for (let i = 0; i < ch.del.length; i += 20000) await db.query('DELETE FROM rows WHERE uid = ANY($1::bigint[])', [ch.del.slice(i, i + 20000)]);
      for (let i = 0; i < ch.upd.length; i += 3000) {
        const c = ch.upd.slice(i, i + 3000);
        await db.query('UPDATE rows SET data = v.d::jsonb FROM unnest($1::bigint[], $2::text[]) AS v(uid, d) WHERE rows.uid = v.uid', [c.map(x => x[0]), c.map(x => JSON.stringify(x[1]))]);
      }
      for (let i = 0; i < ch.ins.length; i += 3000) {
        const c = ch.ins.slice(i, i + 3000);
        await db.query('INSERT INTO rows(sheet, uid, data) SELECT v.s, v.uid, v.d::jsonb FROM unnest($1::text[], $2::bigint[], $3::text[]) AS v(s, uid, d)', [c.map(x => x[0]), c.map(x => x[1]), c.map(x => JSON.stringify(x[2]))]);
      }
      for (const [k, v] of ch.props) {
        if (v === undefined) await db.query('DELETE FROM props WHERE k=$1', [k]);
        else await db.query('INSERT INTO props(k,v) VALUES($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v', [k, v]);
      }
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
  }
  async close() { if (this.db.end) await this.db.end(); }
}

/* SQL Server 2016 به بعد (به OPENJSON نیاز دارد). داده‌ی هر ردیف به‌صورت متن JSON در NVARCHAR(MAX) ذخیره می‌شود. */
class MssqlAdapter {
  constructor(cfg, sqlLib) {
    this.kind = 'mssql'; this.cfg = cfg; this.sql = sqlLib || require('mssql'); this.pool = null;
  }
  static fromEnv(env, sqlLib) {
    env = env || process.env;
    const need = k => { if (!env[k]) throw new Error('تنظیم ' + k + ' برای SQL Server ناقص است.'); return env[k]; };
    const yes = (v, d) => v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v));
    const cfg = {
      server: need('MSSQL_SERVER'), port: Number(env.MSSQL_PORT || 1433), database: need('MSSQL_DATABASE'),
      user: need('MSSQL_USER'), password: need('MSSQL_PASSWORD'),
      options: { encrypt: yes(env.MSSQL_ENCRYPT, true), trustServerCertificate: yes(env.MSSQL_TRUST_CERT, false), enableArithAbort: true },
      pool: { max: 4, min: 0, idleTimeoutMillis: 30000 }, requestTimeout: 300000, connectionTimeout: 20000
    };
    return new MssqlAdapter(cfg, sqlLib);
  }
  async connect_() {
    if (this.pool && this.pool.connected) return this.pool;
    const p = new this.sql.ConnectionPool(this.cfg);
    p.on('error', e => console.error('mssql', e.message));
    this.pool = await p.connect(); return this.pool;
  }
  req_(target) { return new this.sql.Request(target || this.pool); }
  async run_(target, text, params) {
    const r = this.req_(target);
    for (const k of Object.keys(params || {})) r.input(k, this.sql.NVarChar(this.sql.MAX), params[k]);
    return r.query(text);
  }
  async init() {
    await this.connect_();
    const lv = await this.run_(null, 'SELECT compatibility_level AS lv FROM sys.databases WHERE name = DB_NAME()');
    const lvl = lv.recordset && lv.recordset[0] ? Number(lv.recordset[0].lv) : 0;
    if (lvl < 130) throw new Error('سطح سازگاری دیتابیس SQL Server (' + lvl + ') باید حداقل ۱۳۰ باشد (SQL Server 2016 به بعد). دستور: ALTER DATABASE [نام] SET COMPATIBILITY_LEVEL = 150;');
    await this.run_(null, "IF OBJECT_ID(N'dbo.rows', N'U') IS NULL CREATE TABLE dbo.rows (sheet NVARCHAR(100) NOT NULL, uid BIGINT NOT NULL PRIMARY KEY, data NVARCHAR(MAX) NOT NULL)");
    await this.run_(null, "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'rows_sheet' AND object_id = OBJECT_ID(N'dbo.rows')) CREATE INDEX rows_sheet ON dbo.rows(sheet, uid)");
    await this.run_(null, "IF OBJECT_ID(N'dbo.props', N'U') IS NULL CREATE TABLE dbo.props (k NVARCHAR(200) NOT NULL PRIMARY KEY, v NVARCHAR(MAX) NOT NULL)");
  }
  async loadAll() {
    const r = await this.run_(null, 'SELECT sheet, uid, data FROM dbo.rows ORDER BY sheet COLLATE Latin1_General_BIN2, uid');
    const p = await this.run_(null, 'SELECT k, v FROM dbo.props');
    return {
      rows: r.recordset.map(x => ({ sheet: x.sheet, uid: Number(x.uid), data: JSON.parse(x.data) })),
      props: p.recordset.map(x => [x.k, x.v])
    };
  }
  async apply(ch) {
    await this.connect_();
    const tx = new this.sql.Transaction(this.pool);
    await tx.begin();
    try {
      for (let i = 0; i < ch.del.length; i += 20000)
        await this.run_(tx, 'DELETE r FROM dbo.rows r WHERE r.uid IN (SELECT j.id FROM OPENJSON(@p) WITH (id BIGINT \'$\') j)', { p: JSON.stringify(ch.del.slice(i, i + 20000)) });
      for (let i = 0; i < ch.upd.length; i += 2000) {
        const c = ch.upd.slice(i, i + 2000).map(x => ({ u: x[0], d: JSON.stringify(x[1]) }));
        await this.run_(tx, 'UPDATE r SET r.data = j.d FROM dbo.rows r JOIN OPENJSON(@p) WITH (u BIGINT \'$.u\', d NVARCHAR(MAX) \'$.d\') j ON r.uid = j.u', { p: JSON.stringify(c) });
      }
      for (let i = 0; i < ch.ins.length; i += 2000) {
        const c = ch.ins.slice(i, i + 2000).map(x => ({ s: x[0], u: x[1], d: JSON.stringify(x[2]) }));
        await this.run_(tx, 'INSERT INTO dbo.rows(sheet, uid, data) SELECT j.s, j.u, j.d FROM OPENJSON(@p) WITH (s NVARCHAR(100) \'$.s\', u BIGINT \'$.u\', d NVARCHAR(MAX) \'$.d\') j', { p: JSON.stringify(c) });
      }
      for (const [k, v] of ch.props) {
        if (v === undefined) await this.run_(tx, 'DELETE FROM dbo.props WHERE k = @k', { k });
        else await this.run_(tx, 'UPDATE dbo.props SET v = @v WHERE k = @k; IF @@ROWCOUNT = 0 INSERT INTO dbo.props(k, v) VALUES(@k, @v);', { k, v: String(v) });
      }
      await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (x) { } throw e; }
  }
  async close() { if (this.pool) { await this.pool.close(); this.pool = null; } }
}

function fromEnv(env) {
  env = env || process.env;
  if (String(env.DB_TYPE || '').toLowerCase() === 'mssql') return MssqlAdapter.fromEnv(env);
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 4 }); pool.on('error', e => console.error('pg', e.message));
  return new PgAdapter(pool);
}
module.exports = { PgAdapter, MssqlAdapter, fromEnv };
