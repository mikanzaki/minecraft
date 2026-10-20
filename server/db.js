import mysql from 'mysql2/promise';
import { createHash, randomBytes } from 'node:crypto';
import { newLinkCode } from './link-code.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

export const pool = mysql.createPool(databaseUrl);

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS minecraft_discord_links (
      minecraft_uuid CHAR(36) NOT NULL PRIMARY KEY,
      discord_user_id VARCHAR(24) NOT NULL UNIQUE,
      discord_username VARCHAR(100) NOT NULL,
      linked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pending_minecraft_links (
      minecraft_uuid CHAR(36) NOT NULL PRIMARY KEY,
      minecraft_username VARCHAR(16) NOT NULL,
      code_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX pending_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS discord_oauth_states (
      state_hash CHAR(64) NOT NULL PRIMARY KEY,
      minecraft_uuid CHAR(36) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX oauth_state_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export function hashOpaque(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function newOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export async function getLinkedAccount(minecraftUuid) {
  const [rows] = await pool.execute(
    'SELECT discord_user_id, discord_username FROM minecraft_discord_links WHERE minecraft_uuid = ?',
    [minecraftUuid],
  );
  return rows[0] ?? null;
}

export async function createPendingLink(minecraftUuid, minecraftUsername) {
  const code = newLinkCode();
  const codeHash = hashOpaque(code);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM pending_minecraft_links WHERE minecraft_uuid = ?', [minecraftUuid]);
    await connection.execute(
      'INSERT INTO pending_minecraft_links (minecraft_uuid, minecraft_username, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE))',
      [minecraftUuid, minecraftUsername, codeHash],
    );
    await connection.execute('DELETE FROM discord_oauth_states WHERE expires_at < UTC_TIMESTAMP(3)');
    await connection.execute('DELETE FROM pending_minecraft_links WHERE expires_at < UTC_TIMESTAMP(3)');
    await connection.commit();
    return { code, codeHash };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPendingLinkByCodeHash(codeHash) {
  const [rows] = await pool.execute(
    'SELECT minecraft_uuid, code_hash FROM pending_minecraft_links WHERE code_hash = ? AND expires_at > UTC_TIMESTAMP(3)',
    [codeHash],
  );
  return rows[0] ?? null;
}

export async function createOAuthState(state, pending) {
  const stateHash = hashOpaque(state);
  await pool.execute(
    'INSERT INTO discord_oauth_states (state_hash, minecraft_uuid, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 10 MINUTE))',
    [stateHash, pending.minecraft_uuid, pending.code_hash],
  );
}

export async function consumeOAuthState(state) {
  const stateHash = hashOpaque(state);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT minecraft_uuid, code_hash FROM discord_oauth_states WHERE state_hash = ? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE',
      [stateHash],
    );
    if (!rows[0]) {
      await connection.execute('DELETE FROM discord_oauth_states WHERE state_hash = ?', [stateHash]);
      await connection.commit();
      return null;
    }
    await connection.execute('DELETE FROM discord_oauth_states WHERE state_hash = ?', [stateHash]);
    await connection.commit();
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveLinkedAccount(minecraftUuid, codeHash, discordUserId, discordUsername) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [pendingRows] = await connection.execute(
      'SELECT minecraft_uuid FROM pending_minecraft_links WHERE minecraft_uuid = ? AND code_hash = ? AND expires_at > UTC_TIMESTAMP(3) FOR UPDATE',
      [minecraftUuid, codeHash],
    );
    if (!pendingRows[0]) {
      await connection.rollback();
      return 'expired';
    }

    const [existingRows] = await connection.execute(
      'SELECT minecraft_uuid FROM minecraft_discord_links WHERE discord_user_id = ? FOR UPDATE',
      [discordUserId],
    );
    if (existingRows[0] && existingRows[0].minecraft_uuid !== minecraftUuid) {
      await connection.rollback();
      return 'already_linked';
    }

    await connection.execute(
      `INSERT INTO minecraft_discord_links (minecraft_uuid, discord_user_id, discord_username, linked_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE discord_user_id = VALUES(discord_user_id), discord_username = VALUES(discord_username), linked_at = UTC_TIMESTAMP(3)`,
      [minecraftUuid, discordUserId, discordUsername],
    );
    await connection.execute('DELETE FROM pending_minecraft_links WHERE minecraft_uuid = ?', [minecraftUuid]);
    await connection.commit();
    return 'linked';
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
