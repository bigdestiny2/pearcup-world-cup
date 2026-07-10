-- PearCup portable identity. This database intentionally contains no wallet
-- seed, private key, real-money balance, payment authorization, or relay data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  team TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_account ON passkey_credentials(account_id);

CREATE TABLE IF NOT EXISTS webauthn_ceremonies (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('registration', 'authentication')),
  challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webauthn_ceremonies_expiry ON webauthn_ceremonies(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS device_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_device_keys_account ON device_keys(account_id);

CREATE TABLE IF NOT EXISTS device_sessions (
  token_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES device_keys(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expiry ON device_sessions(expires_at);

CREATE TABLE IF NOT EXISTS pairings (
  code_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_public_key TEXT NOT NULL UNIQUE,
  device_label TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  approved_at INTEGER,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pairings_expiry ON pairings(expires_at);

CREATE TABLE IF NOT EXISTS demo_wallets (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 500 CHECK(balance >= 0 AND balance <= 10000),
  currency TEXT NOT NULL DEFAULT 'USDT',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_wallet_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('welcome', 'fund', 'entry', 'refund', 'prize')),
  memo TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_demo_wallet_events_account ON demo_wallet_events(account_id, created_at DESC);
