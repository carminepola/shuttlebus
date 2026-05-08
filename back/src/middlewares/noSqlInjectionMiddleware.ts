import mongoSanitize from "express-mongo-sanitize";

/**
 * Middleware di protezione contro NoSQL Injection per MongoDB.
 *
 * Utilizza express-mongo-sanitize, la libreria più diffusa per questo scopo,
 * che rimuove ricorsivamente tutte le chiavi che iniziano con "$" da
 * req.body, req.query e req.params.
 *
 * Opzione `replaceWith: '_'`: sostituisce il carattere "$" con "_"
 * invece di rimuovere completamente la chiave, evitando di rompere
 * validazioni che si aspettano la presenza del campo.
 */
export default mongoSanitize({
  replaceWith: "_",
});
