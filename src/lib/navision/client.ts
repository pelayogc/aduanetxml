import mssql, { type ConnectionPool } from "mssql";

let poolPromise: Promise<ConnectionPool> | null = null;
const columnCache = new Map<string, Promise<Set<string>>>();

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function isNavisionConfigured() {
  return missingNavisionConfigFields().length === 0;
}

export function missingNavisionConfigFields() {
  return [
    "NAV_SQLSERVER_HOST",
    "NAV_SQLSERVER_DATABASE",
    "NAV_SQLSERVER_USER",
    "NAV_SQLSERVER_PASSWORD",
    "NAV_SQLSERVER_COMPANY",
  ].filter((name) => !process.env[name]);
}

export function navCompanyName() {
  const company = process.env.NAV_SQLSERVER_COMPANY || "";
  if (!/^[A-Za-z0-9_]+$/.test(company)) throw new Error("NAV_SQLSERVER_COMPANY contiene caracteres no soportados.");
  return company;
}

export function navTableName(name: string) {
  return `${navCompanyName()}$${name}`;
}

export function navTable(name: string) {
  const table = navTableName(name).replaceAll("]", "]]");
  return `[dbo].[${table}]`;
}

export async function getNavPool() {
  const missing = missingNavisionConfigFields();
  if (missing.length) throw new Error(`Navision SQL Server no esta configurado. Faltan: ${missing.join(", ")}.`);
  if (!poolPromise) {
    poolPromise = new mssql.ConnectionPool({
      server: process.env.NAV_SQLSERVER_HOST!,
      port: Number(process.env.NAV_SQLSERVER_PORT || 1433),
      database: process.env.NAV_SQLSERVER_DATABASE!,
      user: process.env.NAV_SQLSERVER_USER!,
      password: process.env.NAV_SQLSERVER_PASSWORD!,
      options: {
        encrypt: process.env.NAV_SQLSERVER_ENCRYPT === "true",
        trustServerCertificate: process.env.NAV_SQLSERVER_TRUST_CERTIFICATE !== "false",
      },
      pool: { max: 3, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: numberFromEnv("NAV_SQLSERVER_CONNECTION_TIMEOUT_MS", 6000),
      requestTimeout: numberFromEnv("NAV_SQLSERVER_REQUEST_TIMEOUT_MS", 12000),
    }).connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function getNavTableColumns(table: string) {
  const tableName = navTableName(table);
  if (!columnCache.has(tableName)) {
    columnCache.set(tableName, getNavPool().then(async (pool) => {
      const result = await pool.request()
        .input("tableName", mssql.NVarChar, tableName)
        .query(`
          SELECT c.[name] AS column_name
          FROM sys.tables t
          JOIN sys.columns c ON c.object_id = t.object_id
          WHERE t.[name] = @tableName
        `);
      return new Set(result.recordset.map((row) => String(row.column_name)));
    }));
  }
  return columnCache.get(tableName)!;
}

function bracketColumn(column: string) {
  return `[${column.replaceAll("]", "]]")}]`;
}

export function optionalColumnExpression(alias: string, columns: Set<string>, candidates: string[], sqlAlias: string, sqlType = "nvarchar(255)") {
  const column = candidates.find((candidate) => columns.has(candidate));
  return column ? `${alias}.${bracketColumn(column)} AS ${sqlAlias}` : `CAST(NULL AS ${sqlType}) AS ${sqlAlias}`;
}
