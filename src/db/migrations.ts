export type Migration = {
  version: number;
  statements: { sql: string; args?: (string | number | null)[] }[];
};

export const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS institutions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS containers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          institution_id INTEGER,
          FOREIGN KEY (institution_id) REFERENCES institutions(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS invest_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expense_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS income_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          container_id INTEGER,
          recurrence_frequency TEXT,
          recurrence_interval INTEGER,
          FOREIGN KEY (container_id) REFERENCES containers(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expense_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          container_id INTEGER,
          expense_category_id INTEGER,
          recurrence_frequency TEXT,
          recurrence_interval INTEGER,
          FOREIGN KEY (container_id) REFERENCES containers(id),
          FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS snapshot_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id INTEGER NOT NULL,
          container_id INTEGER NOT NULL,
          invest_category_id INTEGER,
          amount REAL NOT NULL,
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
          FOREIGN KEY (container_id) REFERENCES containers(id),
          FOREIGN KEY (invest_category_id) REFERENCES invest_categories(id)
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_income_date ON income_entries(date)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_expense_date ON expense_entries(date)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_snapshot_date ON snapshots(date)" },
    ],
  },
  {
    version: 2,
    statements: [
      { sql: "DROP TABLE IF EXISTS snapshot_lines" },
      { sql: "DROP TABLE IF EXISTS snapshots" },
      { sql: "DROP TABLE IF EXISTS expense_entries" },
      { sql: "DROP TABLE IF EXISTS income_entries" },
      { sql: "DROP TABLE IF EXISTS expense_categories" },
      { sql: "DROP TABLE IF EXISTS invest_categories" },
      { sql: "DROP TABLE IF EXISTS containers" },
      { sql: "DROP TABLE IF EXISTS institutions" },
      { sql: "DROP TABLE IF EXISTS wallets" },
      { sql: "DROP TABLE IF EXISTS investment_categories" },
      { sql: "DROP TABLE IF EXISTS preferences" },
      {
        sql: `CREATE TABLE IF NOT EXISTS wallets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          currency TEXT NOT NULL,
          tag TEXT,
          active INTEGER NOT NULL DEFAULT 1
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS investment_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expense_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS snapshot_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id INTEGER NOT NULL,
          wallet_id INTEGER NOT NULL,
          investment_category_id INTEGER,
          amount REAL NOT NULL,
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
          FOREIGN KEY (wallet_id) REFERENCES wallets(id),
          FOREIGN KEY (investment_category_id) REFERENCES investment_categories(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS income_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          start_date TEXT NOT NULL,
          recurrence_frequency TEXT,
          recurrence_interval INTEGER,
          one_shot INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          wallet_id INTEGER,
          FOREIGN KEY (wallet_id) REFERENCES wallets(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS expense_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          start_date TEXT NOT NULL,
          recurrence_frequency TEXT,
          recurrence_interval INTEGER,
          one_shot INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          wallet_id INTEGER,
          expense_category_id INTEGER NOT NULL,
          FOREIGN KEY (wallet_id) REFERENCES wallets(id),
          FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id)
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_income_start_date ON income_entries(start_date)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_expense_start_date ON expense_entries(start_date)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_snapshot_date ON snapshots(date)" },
    ],
  },
  {
    version: 3,
    statements: [
      { sql: "DROP TABLE IF EXISTS snapshot_lines" },
      { sql: "DROP TABLE IF EXISTS investment_categories" },
      {
        sql: `CREATE TABLE IF NOT EXISTS snapshot_lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id INTEGER NOT NULL,
          wallet_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id),
          FOREIGN KEY (wallet_id) REFERENCES wallets(id)
        )`,
      },
    ],
  },
  {
    version: 4,
    statements: [
      { sql: "ALTER TABLE expense_categories ADD COLUMN active INTEGER NOT NULL DEFAULT 1" },
    ],
  },
  {
    version: 5,
    statements: [
      { sql: "UPDATE expense_categories SET active = 1 WHERE active IS NULL" },
    ],
  },
  {
    version: 6,
    statements: [
      { sql: "ALTER TABLE expense_categories ADD COLUMN color TEXT DEFAULT '#9B7BFF'" },
      { sql: "UPDATE expense_categories SET color = '#9B7BFF' WHERE color IS NULL OR color = ''" },
    ],
  },
  {
    version: 7,
    statements: [
      { sql: "ALTER TABLE wallets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0" },
      {
        sql: `UPDATE wallets
          SET sort_order = (
            SELECT COUNT(*)
            FROM wallets AS other
            WHERE other.type = wallets.type
              AND other.id <= wallets.id
          ) - 1`,
      },
    ],
  },
  {
    version: 8,
    statements: [
      { sql: "ALTER TABLE wallets ADD COLUMN color TEXT NOT NULL DEFAULT '#9B7BFF'" },
    ],
  },
];
