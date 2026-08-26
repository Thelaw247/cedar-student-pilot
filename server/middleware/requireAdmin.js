import { pool } from '../lib/db.js';

/**
 * Keep application roles in the database, never in user-editable auth
 * metadata. The factory makes the authorization boundary independently
 * testable without connecting the unit suite to staging Postgres.
 */
export function buildRequireAdmin(query = (text, params) => pool.query(text, params)) {
  return async function requireAdmin(req, res, next) {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { rows } = await query('select role from profiles where id = $1', [req.user.id]);
      if (rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      return next();
    } catch (error) {
      console.error('[auth] admin authorization failed:', error.message);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

export const requireAdmin = buildRequireAdmin();
