-- MySQL sessions table for express-mysql-session
-- This app uses ONLY this table in MySQL.

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) NOT NULL PRIMARY KEY,
  expires BIGINT UNSIGNED NOT NULL,
  data MEDIUMTEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX sessions_expires_idx ON sessions(expires);
