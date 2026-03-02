const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');

function toSafeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    org_id: row.org_id,
    parent_id: row.parent_id,
    role_id: row.role_id,
    email: row.email,
    name: row.name,
    last_name: row.last_name,
    first_name: row.first_name,
    postal_code: row.postal_code,
    address: row.address,
    gender: row.gender,
    birthday: row.birthday,
    note: row.note,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function findByEmail(email) {
  const rows = await query(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

async function findById(userId) {
  const rows = await query(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

async function verifyPassword(userRow, plainPassword) {
  if (!userRow) return false;
  return bcrypt.compare(String(plainPassword || ''), String(userRow.password || ''));
}

async function updateLastLoginAt(userId) {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);
}

async function hashPassword(plainPassword) {
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
  return bcrypt.hash(String(plainPassword || ''), saltRounds);
}

async function updateProfile(userId, { email, lastName, firstName }) {
  const nextEmail = String(email || '').trim().toLowerCase();
  const nextLast = String(lastName || '').trim();
  const nextFirst = String(firstName || '').trim();

  if (!userId) throw new Error('ユーザーが見つかりません');
  if (!nextEmail || !nextLast || !nextFirst) throw new Error('メールアドレス・姓・名を入力してください');

  // Email uniqueness (ignore self)
  const existing = await findByEmail(nextEmail);
  if (existing && Number(existing.id) !== Number(userId)) {
    throw new Error('そのメールアドレスは既に使用されています');
  }

  await query(
    'UPDATE users SET email = ?, last_name = ?, first_name = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [nextEmail, nextLast, nextFirst, userId]
  );

  const updated = await findById(userId);
  return updated;
}

async function updatePassword(userId, plainPassword) {
  const pw = String(plainPassword || '');
  if (!userId) throw new Error('ユーザーが見つかりません');
  if (!pw) throw new Error('パスワードを入力してください');
  if (pw.length < 8) throw new Error('パスワードは8文字以上にしてください');

  const hashed = await hashPassword(pw);
  await query(
    'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [hashed, userId]
  );
}

module.exports = {
  toSafeUser,
  findById,
  findByEmail,
  verifyPassword,
  updateLastLoginAt,
  hashPassword,
  updateProfile,
  updatePassword
};
