// Tiny module that caches the signed-in user's id so the SDK client wrapper in
// src/api/base44Client.js can stamp `user_id` on every create synchronously,
// without each component having to thread the user through. AuthContext is the
// only writer — it sets the id once auth resolves and clears it on logout.
let _userId = null;

export const setCachedUserId = (id) => {
  _userId = id;
};

export const getCachedUserId = () => _userId;