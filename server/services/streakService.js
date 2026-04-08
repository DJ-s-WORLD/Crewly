/** @param {Date} d */
function startOfUtcDay(d) {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/** Reset streak if user missed a full calendar day (UTC) of activity */
export function applyStreakOnLogin(user) {
  const now = new Date();
  const today = startOfUtcDay(now);
  if (!user.lastActiveDate) return user;

  const last = startOfUtcDay(user.lastActiveDate);
  const dayMs = 86400000;
  const yesterday = today - dayMs;

  if (last < yesterday) {
    user.streak = 0;
  }
  return user;
}

/**
 * Call when a task is marked completed (transition to true).
 * Updates streak and lastActiveDate.
 */
export function applyStreakOnTaskComplete(user) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const last = user.lastActiveDate ? startOfUtcDay(user.lastActiveDate) : null;
  const dayMs = 86400000;
  const yesterday = today - dayMs;

  if (last === null) {
    user.streak = 1;
  } else if (last === today) {
    // already active today — streak unchanged
  } else if (last === yesterday) {
    user.streak = (user.streak || 0) + 1;
  } else {
    user.streak = 1;
  }

  user.lastActiveDate = now;
  return user;
}
