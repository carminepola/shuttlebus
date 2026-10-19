/**
 * N-09 (cookie SameSite): policy centralizzata dei cookie di autenticazione.
 *
 * - DEV: SPA e API girano su origini/porta diverse durante lo sviluppo -> cookie
 *   cross-site, serve SameSite=None (su localhost Chrome lo accetta anche senza
 *   Secure). Il campo `secure` resta false per funzionare su http://localhost.
 * - PROD/TEST: SPA e API sono same-site (stesso dominio, API sotto /api via nginx)
 *   -> SameSite=Lax, piu' prudente: blocca i cookie nelle richieste cross-site
 *   non top-level (form POST terzi, iframe, subresource) pur funzionando sui
 *   redirect OAuth (navigazione top-level GET).
 */
export function cookieSameSite(): "lax" | "none" {
  return String(process.env.NODE_ENV || "").toUpperCase() === "DEV" ? "none" : "lax";
}

export function cookieSecure(): boolean {
  return String(process.env.NODE_ENV || "").toUpperCase() !== "DEV";
}
