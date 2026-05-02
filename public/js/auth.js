/**
 * auth.js — Client-side auth guard.
 * Checks /api/me; if unauthorized, redirects to login.
 */
export async function checkAuth() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) throw new Error("unauthorized");
    return true;
  } catch {
    window.location.href = "/login.html";
    return false;
  }
}
