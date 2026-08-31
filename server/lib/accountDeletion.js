/**
 * Deleting the account itself, not just its contents.
 *
 * The delete flow used to stop at the data: it wiped every user-scoped table,
 * reset the credit balance and blanked the profile, then deliberately left the
 * auth.users row in place. The UI meanwhile said "Permanently delete your
 * account". Those two things could not both be true, and the one that mattered
 * legally was the UI's.
 *
 * App Store Review Guideline 5.1.1(v) requires an app that offers account
 * creation to offer account DELETION. Wiping the contents and keeping the login
 * does not satisfy it, and it is the kind of thing review checks by hand.
 *
 * Every foreign key pointing at auth.users is ON DELETE CASCADE — all eight
 * auth-schema tables and all twenty application tables — so removing that one
 * row removes the account and everything hanging off it. Verified against the
 * live schema rather than assumed.
 *
 * Only the `postgres` role holds DELETE on auth.users. If the API's connection
 * is not that role the delete fails, so canDeleteAuthUsers() exists to answer
 * that at boot instead of at a user's one and only deletion attempt.
 */

export async function canDeleteAuthUsers(db) {
  try {
    const { rows } = await db.query("select has_table_privilege('auth.users', 'delete') as ok");
    return { ok: rows[0]?.ok === true, message: rows[0]?.ok === true
      ? 'account deletion: the API can delete auth users'
      : 'account deletion: the API CANNOT delete auth users — DELETE on auth.users is missing, so "delete my account" would only clear data' };
  } catch (error) {
    return { ok: false, message: `account deletion: could not check the auth.users privilege — ${error.message}` };
  }
}

/**
 * Deletes the auth user. Call INSIDE the same transaction as the data deletes:
 * if this fails, everything rolls back and the account is untouched, which is
 * far better than a signed-out shell with no data that the user cannot remove.
 *
 * Returns the row count so the caller can tell "deleted" from "was not there".
 */
export async function deleteAuthUser(db, userId) {
  if (!userId) throw new Error('deleteAuthUser requires a user id');
  const result = await db.query('delete from auth.users where id = $1', [userId]);
  return result.rowCount;
}
