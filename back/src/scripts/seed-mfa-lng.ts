import { MongoClient } from "mongodb";
import { Guid } from "guid-typescript";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// La connection string puo' arrivare da .env oppure da env esterno / --uri=
const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante (richiedeva da .env o --uri=...)");
  process.exit(1);
}
const dryRun = args.includes("--dry-run");

const LANGS = ["it", "en", "fr", "de", "es", "jp"] as const;
type Translation = Record<(typeof LANGS)[number], string>;

/**
 * Chiavi di traduzione della verifica in due passaggi, delle passkey
 * (login, checkout, pagina account), delle carte salvate, dell'eliminazione
 * account, dell'avviso di aggiornamento PWA, dell'andata e ritorno e dei rimborsi,
 * in tutte le lingue supportate, nella collection 'lng'.
 *
 * - Chiave assente: viene inserita con un `id` (la pagina admin "Traduzioni"
 *   modifica ed elimina per id) e tutte le lingue.
 * - Chiave presente: vengono riempite SOLO le lingue vuote e aggiunto l'`id` se
 *   manca; le traduzioni gia' modificate dalla pagina admin non vengono toccate.
 * Uso: ts-node src/scripts/seed-mfa-lng.ts [--dry-run] [--uri=<conn>]
 */
const KEYS: Record<string, Translation> = {
  str_mfa_title: {
    it: "Verifica in due passaggi",
    en: "Two-step verification",
    fr: "Validation en deux étapes",
    de: "Bestätigung in zwei Schritten",
    es: "Verificación en dos pasos",
    jp: "2段階認証",
  },
  str_mfa_app: {
    it: "App di autenticazione",
    en: "Authenticator app",
    fr: "Application d'authentification",
    de: "Authentifizierungs-App",
    es: "App de autenticación",
    jp: "認証アプリ",
  },
  str_mfa_email: { it: "Email", en: "Email", fr: "E-mail", de: "E-Mail", es: "Correo electrónico", jp: "メール" },
  str_mfa_app_hint: {
    it: "Inserisci il codice a 6 cifre generato dalla tua app di autenticazione.",
    en: "Enter the 6-digit code from your authenticator app.",
    fr: "Saisissez le code à 6 chiffres généré par votre application d'authentification.",
    de: "Gib den 6-stelligen Code aus deiner Authentifizierungs-App ein.",
    es: "Introduce el código de 6 dígitos generado por tu app de autenticación.",
    jp: "認証アプリに表示された6桁のコードを入力してください。",
  },
  str_mfa_email_hint: {
    it: "Abbiamo inviato un codice a 6 cifre alla tua email.",
    en: "We sent a 6-digit code to your email.",
    fr: "Nous avons envoyé un code à 6 chiffres à votre adresse e-mail.",
    de: "Wir haben einen 6-stelligen Code an deine E-Mail-Adresse gesendet.",
    es: "Hemos enviado un código de 6 dígitos a tu correo electrónico.",
    jp: "6桁のコードをメールでお送りしました。",
  },
  str_mfa_code: {
    it: "Codice di verifica",
    en: "Verification code",
    fr: "Code de vérification",
    de: "Bestätigungscode",
    es: "Código de verificación",
    jp: "確認コード",
  },
  str_mfa_verify: { it: "Verifica", en: "Verify", fr: "Vérifier", de: "Bestätigen", es: "Verificar", jp: "確認" },
  str_mfa_resend: {
    it: "Invia di nuovo il codice",
    en: "Resend code",
    fr: "Renvoyer le code",
    de: "Code erneut senden",
    es: "Reenviar el código",
    jp: "コードを再送信",
  },
  str_mfa_code_sent: { it: "Codice inviato", en: "Code sent", fr: "Code envoyé", de: "Code gesendet", es: "Código enviado", jp: "コードを送信しました" },
  str_mfa_invalid_code: {
    it: "Codice non valido",
    en: "Invalid code",
    fr: "Code non valide",
    de: "Ungültiger Code",
    es: "Código no válido",
    jp: "コードが正しくありません",
  },
  str_mfa_expired: {
    it: "Verifica scaduta: effettua di nuovo l'accesso.",
    en: "Verification expired: please sign in again.",
    fr: "Vérification expirée : veuillez vous reconnecter.",
    de: "Bestätigung abgelaufen: Bitte melde dich erneut an.",
    es: "La verificación ha caducado: vuelve a iniciar sesión.",
    jp: "確認の有効期限が切れました。もう一度ログインしてください。",
  },
  str_mfa_too_many: {
    it: "Troppi tentativi. Riprova più tardi.",
    en: "Too many attempts. Try again later.",
    fr: "Trop de tentatives. Réessayez plus tard.",
    de: "Zu viele Versuche. Bitte versuche es später erneut.",
    es: "Demasiados intentos. Inténtalo de nuevo más tarde.",
    jp: "試行回数が多すぎます。しばらくしてからもう一度お試しください。",
  },
  str_mfa_on: { it: "Attiva", en: "On", fr: "Activée", de: "Aktiv", es: "Activada", jp: "有効" },
  str_mfa_off: { it: "Non attiva", en: "Off", fr: "Désactivée", de: "Nicht aktiv", es: "Desactivada", jp: "無効" },
  str_mfa_enable: { it: "Attiva", en: "Enable", fr: "Activer", de: "Aktivieren", es: "Activar", jp: "有効にする" },
  str_mfa_disable: { it: "Disattiva", en: "Disable", fr: "Désactiver", de: "Deaktivieren", es: "Desactivar", jp: "無効にする" },
  str_mfa_enabled_ok: {
    it: "Verifica in due passaggi attivata",
    en: "Two-step verification enabled",
    fr: "Validation en deux étapes activée",
    de: "Bestätigung in zwei Schritten aktiviert",
    es: "Verificación en dos pasos activada",
    jp: "2段階認証を有効にしました",
  },
  str_mfa_disabled_ok: {
    it: "Verifica in due passaggi disattivata",
    en: "Two-step verification disabled",
    fr: "Validation en deux étapes désactivée",
    de: "Bestätigung in zwei Schritten deaktiviert",
    es: "Verificación en dos pasos desactivada",
    jp: "2段階認証を無効にしました",
  },
  str_mfa_app_desc: {
    it: "Codici generati da un'app come Google Authenticator, Microsoft Authenticator o 1Password.",
    en: "Codes generated by an app such as Google Authenticator, Microsoft Authenticator or 1Password.",
    fr: "Codes générés par une application comme Google Authenticator, Microsoft Authenticator ou 1Password.",
    de: "Codes, die von einer App wie Google Authenticator, Microsoft Authenticator oder 1Password erzeugt werden.",
    es: "Códigos generados por una app como Google Authenticator, Microsoft Authenticator o 1Password.",
    jp: "Google Authenticator、Microsoft Authenticator、1Password などのアプリで生成されるコードです。",
  },
  str_mfa_email_desc: {
    it: "A ogni accesso ricevi un codice all'indirizzo email dell'account.",
    en: "Each time you sign in you receive a code at your account email address.",
    fr: "À chaque connexion, vous recevez un code à l'adresse e-mail de votre compte.",
    de: "Bei jeder Anmeldung erhältst du einen Code an die E-Mail-Adresse deines Kontos.",
    es: "Cada vez que inicias sesión recibes un código en el correo electrónico de tu cuenta.",
    jp: "ログインのたびに、アカウントのメールアドレスにコードが届きます。",
  },
  str_mfa_scan_qr: {
    it: "Scansiona il QR code con l'app di autenticazione, poi inserisci il codice a 6 cifre che mostra.",
    en: "Scan the QR code with your authenticator app, then enter the 6-digit code it shows.",
    fr: "Scannez le QR code avec votre application d'authentification, puis saisissez le code à 6 chiffres affiché.",
    de: "Scanne den QR-Code mit deiner Authentifizierungs-App und gib dann den angezeigten 6-stelligen Code ein.",
    es: "Escanea el código QR con tu app de autenticación y luego introduce el código de 6 dígitos que muestra.",
    jp: "認証アプリでQRコードを読み取り、表示された6桁のコードを入力してください。",
  },
  str_mfa_manual_key: {
    it: "Oppure inserisci manualmente la chiave:",
    en: "Or enter the key manually:",
    fr: "Ou saisissez la clé manuellement :",
    de: "Oder gib den Schlüssel manuell ein:",
    es: "O introduce la clave manualmente:",
    jp: "またはキーを手動で入力してください:",
  },
  str_mfa_confirm_app: {
    it: "Inserisci un codice dell'app per confermare.",
    en: "Enter a code from the app to confirm.",
    fr: "Saisissez un code de l'application pour confirmer.",
    de: "Gib zur Bestätigung einen Code aus der App ein.",
    es: "Introduce un código de la app para confirmar.",
    jp: "確認のため、アプリのコードを入力してください。",
  },
  str_mfa_confirm_email: {
    it: "Inserisci il codice che ti abbiamo inviato via email.",
    en: "Enter the code we sent to your email.",
    fr: "Saisissez le code que nous vous avons envoyé par e-mail.",
    de: "Gib den Code ein, den wir dir per E-Mail gesendet haben.",
    es: "Introduce el código que te hemos enviado por correo electrónico.",
    jp: "メールでお送りしたコードを入力してください。",
  },
  str_mfa_recovery_hint: {
    it: "Inserisci uno dei codici di recupero che hai salvato. Ogni codice vale una sola volta.",
    en: "Enter one of the recovery codes you saved. Each code works only once.",
    fr: "Saisissez l'un des codes de récupération que vous avez enregistrés. Chaque code n'est valable qu'une seule fois.",
    de: "Gib einen deiner gespeicherten Wiederherstellungscodes ein. Jeder Code gilt nur einmal.",
    es: "Introduce uno de los códigos de recuperación que guardaste. Cada código solo sirve una vez.",
    jp: "保存したリカバリーコードのいずれかを入力してください。各コードは1回のみ使用できます。",
  },
  str_mfa_use_code: {
    it: "Usa il codice di verifica",
    en: "Use the verification code",
    fr: "Utiliser le code de vérification",
    de: "Bestätigungscode verwenden",
    es: "Usar el código de verificación",
    jp: "確認コードを使用",
  },
  str_mfa_use_recovery: {
    it: "Usa un codice di recupero",
    en: "Use a recovery code",
    fr: "Utiliser un code de récupération",
    de: "Wiederherstellungscode verwenden",
    es: "Usar un código de recuperación",
    jp: "リカバリーコードを使用",
  },
  str_recovery_codes: {
    it: "Codici di recupero",
    en: "Recovery codes",
    fr: "Codes de récupération",
    de: "Wiederherstellungscodes",
    es: "Códigos de recuperación",
    jp: "リカバリーコード",
  },
  str_recovery_left: { it: "rimasti", en: "left", fr: "restants", de: "übrig", es: "restantes", jp: "残り" },
  str_recovery_desc: {
    it: "Da usare al posto del codice se perdi l'accesso all'app o all'email.",
    en: "Use them instead of the code if you lose access to the app or your email.",
    fr: "À utiliser à la place du code si vous perdez l'accès à l'application ou à votre e-mail.",
    de: "Verwende sie anstelle des Codes, wenn du keinen Zugriff mehr auf die App oder deine E-Mail hast.",
    es: "Úsalos en lugar del código si pierdes el acceso a la app o a tu correo electrónico.",
    jp: "アプリやメールにアクセスできなくなった場合に、コードの代わりに使用します。",
  },
  str_recovery_regenerate: { it: "Genera nuovi", en: "Generate new", fr: "En générer de nouveaux", de: "Neue erzeugen", es: "Generar nuevos", jp: "新しく生成" },
  str_recovery_regenerated: {
    it: "Nuovi codici di recupero generati: i precedenti non sono più validi.",
    en: "New recovery codes generated: the previous ones no longer work.",
    fr: "Nouveaux codes de récupération générés : les précédents ne sont plus valables.",
    de: "Neue Wiederherstellungscodes erzeugt: Die bisherigen sind nicht mehr gültig.",
    es: "Se han generado nuevos códigos de recuperación: los anteriores ya no son válidos.",
    jp: "新しいリカバリーコードを生成しました。以前のコードは使用できなくなりました。",
  },
  str_recovery_save_title: {
    it: "Salva i codici di recupero",
    en: "Save your recovery codes",
    fr: "Enregistrez vos codes de récupération",
    de: "Speichere deine Wiederherstellungscodes",
    es: "Guarda tus códigos de recuperación",
    jp: "リカバリーコードを保存してください",
  },
  str_recovery_save_desc: {
    it: "Se perdi l'accesso all'app o all'email puoi entrare con uno di questi codici. Ognuno vale una sola volta e non verranno più mostrati.",
    en: "If you lose access to the app or your email you can sign in with one of these codes. Each works once and they won't be shown again.",
    fr: "Si vous perdez l'accès à l'application ou à votre e-mail, vous pourrez vous connecter avec l'un de ces codes. Chacun n'est valable qu'une fois et ils ne seront plus affichés.",
    de: "Wenn du keinen Zugriff mehr auf die App oder deine E-Mail hast, kannst du dich mit einem dieser Codes anmelden. Jeder gilt nur einmal und sie werden nicht erneut angezeigt.",
    es: "Si pierdes el acceso a la app o a tu correo electrónico, podrás entrar con uno de estos códigos. Cada uno sirve una sola vez y no se volverán a mostrar.",
    jp: "アプリやメールにアクセスできなくなった場合、これらのコードでログインできます。各コードは1回のみ有効で、再表示されません。",
  },
  str_recovery_saved: { it: "Li ho salvati", en: "I've saved them", fr: "Je les ai enregistrés", de: "Ich habe sie gespeichert", es: "Ya los he guardado", jp: "保存しました" },
  str_copy: { it: "Copia", en: "Copy", fr: "Copier", de: "Kopieren", es: "Copiar", jp: "コピー" },
  str_copied: { it: "Copiati", en: "Copied", fr: "Copiés", de: "Kopiert", es: "Copiados", jp: "コピーしました" },
  // PWA: avviso di nuova versione disponibile
  str_pwa_update_title: {
    it: "Nuova versione disponibile",
    en: "New version available",
    fr: "Nouvelle version disponible",
    de: "Neue Version verfügbar",
    es: "Nueva versión disponible",
    jp: "新しいバージョンがあります",
  },
  str_pwa_update_text: {
    it: "Ricarica per usare l'ultima versione dell'app.",
    en: "Reload to use the latest version of the app.",
    fr: "Rechargez pour utiliser la dernière version de l'application.",
    de: "Lade neu, um die neueste Version der App zu verwenden.",
    es: "Recarga para usar la última versión de la app.",
    jp: "再読み込みすると最新バージョンのアプリを利用できます。",
  },
  str_pwa_update_reload: { it: "Ricarica", en: "Reload", fr: "Recharger", de: "Neu laden", es: "Recargar", jp: "再読み込み" },
  str_pwa_update_later: { it: "Più tardi", en: "Later", fr: "Plus tard", de: "Später", es: "Más tarde", jp: "後で" },
  str_security: {
    it: "Sicurezza dell'account",
    en: "Account security",
    fr: "Sécurité du compte",
    de: "Kontosicherheit",
    es: "Seguridad de la cuenta",
    jp: "アカウントのセキュリティ",
  },
  str_security_desc: {
    it: "Proteggi l'accesso con la verifica in due passaggi o accedi senza password con una passkey.",
    en: "Protect sign-in with two-step verification or sign in without a password using a passkey.",
    fr: "Protégez la connexion avec la validation en deux étapes ou connectez-vous sans mot de passe avec une passkey.",
    de: "Schütze die Anmeldung mit der Bestätigung in zwei Schritten oder melde dich ohne Passwort mit einem Passkey an.",
    es: "Protege el acceso con la verificación en dos pasos o entra sin contraseña con una passkey.",
    jp: "2段階認証でログインを保護するか、パスキーでパスワードなしでログインできます。",
  },
  str_security_load_error: {
    it: "Impossibile caricare le impostazioni di sicurezza.",
    en: "Unable to load security settings.",
    fr: "Impossible de charger les paramètres de sécurité.",
    de: "Die Sicherheitseinstellungen konnten nicht geladen werden.",
    es: "No se pueden cargar los ajustes de seguridad.",
    jp: "セキュリティ設定を読み込めませんでした。",
  },
  str_generic_error: {
    it: "Si è verificato un errore. Riprova.",
    en: "Something went wrong. Please try again.",
    fr: "Une erreur s'est produite. Veuillez réessayer.",
    de: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut.",
    es: "Se ha producido un error. Inténtalo de nuevo.",
    jp: "エラーが発生しました。もう一度お試しください。",
  },
  str_passkeys: { it: "Passkey", en: "Passkeys", fr: "Passkeys", de: "Passkeys", es: "Passkeys", jp: "パスキー" },
  str_passkeys_desc: {
    it: "Accedi senza password con impronta, volto o PIN del dispositivo.",
    en: "Sign in without a password using your fingerprint, face or device PIN.",
    fr: "Connectez-vous sans mot de passe avec votre empreinte, votre visage ou le code PIN de l'appareil.",
    de: "Melde dich ohne Passwort mit Fingerabdruck, Gesicht oder Geräte-PIN an.",
    es: "Entra sin contraseña con tu huella, tu cara o el PIN del dispositivo.",
    jp: "指紋、顔認証、またはデバイスのPINでパスワードなしでログインできます。",
  },
  str_passkey_login: {
    it: "Accedi con passkey",
    en: "Sign in with a passkey",
    fr: "Se connecter avec une passkey",
    de: "Mit Passkey anmelden",
    es: "Entrar con passkey",
    jp: "パスキーでログイン",
  },
  str_passkey_error: {
    it: "Accesso con passkey non riuscito",
    en: "Passkey sign-in failed",
    fr: "Échec de la connexion avec la passkey",
    de: "Anmeldung mit Passkey fehlgeschlagen",
    es: "No se ha podido entrar con la passkey",
    jp: "パスキーでのログインに失敗しました",
  },
  str_passkey_add: { it: "Aggiungi passkey", en: "Add passkey", fr: "Ajouter une passkey", de: "Passkey hinzufügen", es: "Añadir passkey", jp: "パスキーを追加" },
  str_passkey_added: { it: "Passkey aggiunta", en: "Passkey added", fr: "Passkey ajoutée", de: "Passkey hinzugefügt", es: "Passkey añadida", jp: "パスキーを追加しました" },
  str_passkey_removed: { it: "Passkey rimossa", en: "Passkey removed", fr: "Passkey supprimée", de: "Passkey entfernt", es: "Passkey eliminada", jp: "パスキーを削除しました" },
  str_passkey_remove: { it: "Rimuovi", en: "Remove", fr: "Supprimer", de: "Entfernen", es: "Eliminar", jp: "削除" },
  str_passkey_exists: {
    it: "Questa passkey è già registrata.",
    en: "This passkey is already registered.",
    fr: "Cette passkey est déjà enregistrée.",
    de: "Dieser Passkey ist bereits registriert.",
    es: "Esta passkey ya está registrada.",
    jp: "このパスキーはすでに登録されています。",
  },
  str_passkey_none: {
    it: "Nessuna passkey registrata.",
    en: "No passkeys registered.",
    fr: "Aucune passkey enregistrée.",
    de: "Keine Passkeys registriert.",
    es: "No hay passkeys registradas.",
    jp: "登録されたパスキーはありません。",
  },
  str_passkey_name: { it: "Nome passkey", en: "Passkey name", fr: "Nom de la passkey", de: "Name des Passkeys", es: "Nombre de la passkey", jp: "パスキー名" },
  str_passkey_name_placeholder: {
    it: "Nome (es. iPhone di lavoro)",
    en: "Name (e.g. work iPhone)",
    fr: "Nom (ex. iPhone pro)",
    de: "Name (z. B. Arbeits-iPhone)",
    es: "Nombre (p. ej. iPhone del trabajo)",
    jp: "名前(例: 仕事用iPhone)",
  },
  str_passkey_created: { it: "Aggiunta il", en: "Added on", fr: "Ajoutée le", de: "Hinzugefügt am", es: "Añadida el", jp: "追加日" },
  str_passkey_last_used: { it: "Ultimo uso", en: "Last used", fr: "Dernière utilisation", de: "Zuletzt verwendet", es: "Último uso", jp: "最終使用" },
  str_passkey_unsupported: {
    it: "Questo browser non supporta le passkey.",
    en: "This browser does not support passkeys.",
    fr: "Ce navigateur ne prend pas en charge les passkeys.",
    de: "Dieser Browser unterstützt keine Passkeys.",
    es: "Este navegador no admite passkeys.",
    jp: "このブラウザはパスキーに対応していません。",
  },
  str_saved_cards: { it: "Carte salvate", en: "Saved cards", fr: "Cartes enregistrées", de: "Gespeicherte Karten", es: "Tarjetas guardadas", jp: "保存済みカード" },
  str_saved_cards_desc: {
    it: 'Al pagamento spunta "Salva" per non reinserire la carta la volta successiva. Potrai sempre pagare con una carta diversa.',
    en: 'At checkout tick "Save" so you don\'t have to enter your card next time. You can always pay with a different card.',
    fr: "Lors du paiement, cochez « Enregistrer » pour ne pas ressaisir votre carte la prochaine fois. Vous pourrez toujours payer avec une autre carte.",
    de: "Hake beim Bezahlen „Speichern“ an, damit du deine Karte beim nächsten Mal nicht erneut eingeben musst. Du kannst jederzeit mit einer anderen Karte bezahlen.",
    es: "Al pagar, marca «Guardar» para no tener que volver a introducir la tarjeta la próxima vez. Siempre podrás pagar con otra tarjeta.",
    jp: "お支払い時に「保存」にチェックを入れると、次回からカード情報の入力が不要になります。別のカードでのお支払いもいつでも可能です。",
  },
  str_cards_none: {
    it: "Nessuna carta salvata.",
    en: "No saved cards.",
    fr: "Aucune carte enregistrée.",
    de: "Keine gespeicherten Karten.",
    es: "No hay tarjetas guardadas.",
    jp: "保存済みのカードはありません。",
  },
  str_cards_load_error: {
    it: "Impossibile caricare le carte salvate.",
    en: "Unable to load saved cards.",
    fr: "Impossible de charger les cartes enregistrées.",
    de: "Die gespeicherten Karten konnten nicht geladen werden.",
    es: "No se pueden cargar las tarjetas guardadas.",
    jp: "保存済みカードを読み込めませんでした。",
  },
  str_card: { it: "Carta", en: "Card", fr: "Carte", de: "Karte", es: "Tarjeta", jp: "カード" },
  str_card_expires: { it: "Scadenza", en: "Expires", fr: "Expiration", de: "Gültig bis", es: "Caducidad", jp: "有効期限" },
  str_card_expired: { it: "Scaduta", en: "Expired", fr: "Expirée", de: "Abgelaufen", es: "Caducada", jp: "期限切れ" },
  str_card_remove: { it: "Rimuovi carta", en: "Remove card", fr: "Supprimer la carte", de: "Karte entfernen", es: "Eliminar tarjeta", jp: "カードを削除" },
  str_card_removed: { it: "Carta rimossa", en: "Card removed", fr: "Carte supprimée", de: "Karte entfernt", es: "Tarjeta eliminada", jp: "カードを削除しました" },
  str_account_delete: {
    it: "Elimina account",
    en: "Delete account",
    fr: "Supprimer le compte",
    de: "Konto löschen",
    es: "Eliminar cuenta",
    jp: "アカウントを削除",
  },
  str_account_delete_desc: {
    it: "Elimina definitivamente l'account, i dati personali e le carte salvate. Le prenotazioni passate restano in forma anonima per obblighi contabili.",
    en: "Permanently delete your account, personal data and saved cards. Past bookings are kept in anonymous form for accounting purposes.",
    fr: "Supprime définitivement votre compte, vos données personnelles et vos cartes enregistrées. Les réservations passées sont conservées sous forme anonyme pour des raisons comptables.",
    de: "Löscht dein Konto, deine persönlichen Daten und gespeicherten Karten endgültig. Frühere Buchungen bleiben aus buchhalterischen Gründen anonymisiert erhalten.",
    es: "Elimina definitivamente tu cuenta, tus datos personales y las tarjetas guardadas. Las reservas anteriores se conservan de forma anónima por obligaciones contables.",
    jp: "アカウント、個人データ、保存済みカードを完全に削除します。過去の予約は会計上の義務により匿名の形で保管されます。",
  },
  str_account_delete_understood: {
    it: "Ho capito che l'eliminazione è immediata e non può essere annullata.",
    en: "I understand that deletion is immediate and cannot be undone.",
    fr: "Je comprends que la suppression est immédiate et irréversible.",
    de: "Mir ist bewusst, dass die Löschung sofort erfolgt und nicht rückgängig gemacht werden kann.",
    es: "Entiendo que la eliminación es inmediata y no se puede deshacer.",
    jp: "削除はすぐに実行され、取り消せないことを理解しました。",
  },
  str_account_delete_totp_hint: {
    it: "Inserisci il codice dell'app di autenticazione o un codice di recupero.",
    en: "Enter the code from your authenticator app or a recovery code.",
    fr: "Saisissez le code de votre application d'authentification ou un code de récupération.",
    de: "Gib den Code aus deiner Authentifizierungs-App oder einen Wiederherstellungscode ein.",
    es: "Introduce el código de tu app de autenticación o un código de recuperación.",
    jp: "認証アプリのコードまたはリカバリーコードを入力してください。",
  },
  str_account_delete_email_hint: {
    it: "Inserisci il codice che ti abbiamo inviato via email.",
    en: "Enter the code we sent you by email.",
    fr: "Saisissez le code que nous vous avons envoyé par e-mail.",
    de: "Gib den Code ein, den wir dir per E-Mail gesendet haben.",
    es: "Introduce el código que te hemos enviado por correo electrónico.",
    jp: "メールでお送りしたコードを入力してください。",
  },
  str_account_delete_confirm: {
    it: "Elimina definitivamente",
    en: "Delete permanently",
    fr: "Supprimer définitivement",
    de: "Endgültig löschen",
    es: "Eliminar definitivamente",
    jp: "完全に削除",
  },
  str_account_delete_active_tickets: {
    it: "Hai biglietti confermati per oggi o per i prossimi giorni: annullali o attendi il viaggio prima di eliminare l'account.",
    en: "You have confirmed tickets for today or upcoming days: cancel them or wait until after your trip before deleting your account.",
    fr: "Vous avez des billets confirmés pour aujourd'hui ou les prochains jours : annulez-les ou attendez la fin de votre voyage avant de supprimer votre compte.",
    de: "Du hast bestätigte Tickets für heute oder die nächsten Tage: Storniere sie oder warte deine Fahrt ab, bevor du dein Konto löschst.",
    es: "Tienes billetes confirmados para hoy o los próximos días: cancélalos o espera a después del viaje antes de eliminar la cuenta.",
    jp: "本日または今後の日付の確定済みチケットがあります。アカウントを削除する前に、キャンセルするか乗車後までお待ちください。",
  },
  str_account_delete_staff: {
    it: "Gli account dello staff possono essere eliminati solo da un amministratore.",
    en: "Staff accounts can only be deleted by an administrator.",
    fr: "Les comptes du personnel ne peuvent être supprimés que par un administrateur.",
    de: "Mitarbeiterkonten können nur von einem Administrator gelöscht werden.",
    es: "Las cuentas del personal solo puede eliminarlas un administrador.",
    jp: "スタッフのアカウントは管理者のみが削除できます。",
  },
  str_continue: { it: "Continua", en: "Continue", fr: "Continuer", de: "Weiter", es: "Continuar", jp: "続ける" },
  // Andata e ritorno
  str_solo_andata: { it: "Solo andata", en: "One way", fr: "Aller simple", de: "Nur Hinfahrt", es: "Solo ida", jp: "片道" },
  str_andata_ritorno: { it: "Andata e ritorno", en: "Round trip", fr: "Aller-retour", de: "Hin- und Rückfahrt", es: "Ida y vuelta", jp: "往復" },
  str_andata: { it: "Andata", en: "Outbound", fr: "Aller", de: "Hinfahrt", es: "Ida", jp: "往路" },
  str_ritorno: { it: "Ritorno", en: "Return", fr: "Retour", de: "Rückfahrt", es: "Vuelta", jp: "復路" },
  str_data_andata: { it: "Data andata", en: "Departure date", fr: "Date aller", de: "Hinfahrtdatum", es: "Fecha de ida", jp: "往路の日付" },
  str_data_ritorno: { it: "Data ritorno", en: "Return date", fr: "Date retour", de: "Rückfahrtdatum", es: "Fecha de vuelta", jp: "復路の日付" },
  str_err_data_ritorno: {
    it: "Scegli una data di ritorno uguale o successiva all'andata",
    en: "Choose a return date on or after the departure date",
    fr: "Choisissez une date de retour identique ou postérieure à la date aller",
    de: "Wähle ein Rückfahrtdatum am oder nach dem Hinfahrtdatum",
    es: "Elige una fecha de vuelta igual o posterior a la de ida",
    jp: "復路の日付は往路と同じ日かそれ以降を選択してください",
  },
  str_seleziona: { it: "Seleziona", en: "Select", fr: "Sélectionner", de: "Auswählen", es: "Seleccionar", jp: "選択" },
  str_selezionata: { it: "Selezionata", en: "Selected", fr: "Sélectionné", de: "Ausgewählt", es: "Seleccionado", jp: "選択済み" },
  str_totale_andata_ritorno: {
    it: "Totale andata e ritorno",
    en: "Round trip total",
    fr: "Total aller-retour",
    de: "Gesamt Hin- und Rückfahrt",
    es: "Total ida y vuelta",
    jp: "往復の合計",
  },
  // Rimborsi
  str_rimborsi_effettuati: { it: "Rimborsato", en: "Refunded", fr: "Remboursé", de: "Erstattet", es: "Reembolsado", jp: "返金済み" },
};

async function run() {
  const client = new MongoClient(connectionString!);
  await client.connect();
  const col = client.db().collection("lng");
  const prefix = dryRun ? "[dry-run] " : "";

  let inserted = 0;
  let completed = 0;
  for (const [txt, values] of Object.entries(KEYS)) {
    const existing = await col.findOne({ txt });

    if (!existing) {
      console.log(`${prefix}+ ${txt}`);
      if (!dryRun) {
        await col.insertOne({  txt, ...values });
      }
      inserted++;
      continue;
    }

    // Solo cio' che manca: lingue vuote e id (chiavi inserite dalle versioni precedenti dello script)
    const set: Record<string, string> = {}; 
    console.log(`${prefix}~ ${txt} (${Object.keys(set).join(", ")})`);
    if (!dryRun) {
      await col.updateOne({ txt:txt }, { $set: values });
    }
    completed++;
  }

  const total = Object.keys(KEYS).length;
  console.log(`${dryRun ? "Da inserire" : "Inserite"}: ${inserted} · ${dryRun ? "da completare" : "completate"}: ${completed} · invariate: ${total - inserted - completed} / ${total} chiavi`);
  await client.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
