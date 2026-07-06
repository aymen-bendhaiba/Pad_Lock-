import { translateSentence } from "./translations";

type BackendLikeError = { message?: unknown; error?: unknown; statusCode?: unknown; status?: unknown };

function textFromUnknown(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join(" ");
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    const record = value as BackendLikeError;
    return textFromUnknown(record.message) || textFromUnknown(record.error) || textFromUnknown(record.statusCode) || textFromUnknown(record.status);
  }
  return String(value);
}

function cleanTechnicalDetails(message: string) {
  return message
    .replace(/\([^)]*\/api[^)]*\)/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bGET\s+\S+|\bPOST\s+\S+|\bPATCH\s+\S+|\bDELETE\s+\S+/gi, "")
    .replace(/Request failed for\s+\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function userFriendlyError(error: unknown, fallback = "Une erreur est survenue. Reessayez dans quelques instants.") {
  const original = textFromUnknown(error);
  if (/cannot\s+(get|post|patch|delete)\s+/i.test(original)) {
    return "Cette action n'est pas disponible sur le serveur actuel. Actualisez les donnees ou contactez l'administrateur technique.";
  }

  const raw = cleanTechnicalDetails(original);
  const lower = raw.toLowerCase();

  if (!raw) return fallback;
  if (lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out") || lower.includes("trop de temps")) {
    return "La demande a pris trop de temps. Reessayez ou reduisez la periode selectionnee.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("econn") || lower.includes("fetch failed")) {
    return "Connexion au serveur impossible. Verifiez le reseau puis reessayez.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("token")) {
    return "Votre session a expire. Reconnectez-vous pour continuer.";
  }
  if (lower.includes("403") || lower.includes("forbidden") || lower.includes("permission")) {
    return "Vous n'avez pas les droits necessaires pour effectuer cette action.";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "Element introuvable. Actualisez la page puis reessayez.";
  }
  if (lower.includes("409") || lower.includes("conflict") || lower.includes("duplicate") || lower.includes("already exists")) {
    return "Cet element existe deja ou entre en conflit avec une donnee existante.";
  }
  if (lower.includes("rejected") || lower.includes("refused")) {
    return "La demande a ete refusee par le PadLock. Verifiez les parametres puis reessayez.";
  }
  if (lower.includes("lock did not answer") || lower.includes("command") || lower.includes("device")) {
    return "Le PadLock n'a pas confirme la commande. Verifiez sa connexion puis reessayez.";
  }
  if (lower.includes("400") || lower.includes("bad request") || lower.includes("must be") || lower.includes("should not exist") || lower.includes("property") || lower.includes("valid iso") || lower.includes("greater than") || lower.includes("validation")) {
    return "Certaines informations sont invalides. Verifiez les champs puis reessayez.";
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("request failed") || lower.includes("backend") || lower.includes("api")) {
    return "Le service est momentanement indisponible. Reessayez dans quelques instants.";
  }

  if (/^[A-Za-z0-9_ ./:?=&-]+$/.test(raw) && /\b(must|property|request|failed|backend|api|endpoint|undefined|null)\b/i.test(raw)) {
    return fallback;
  }

  return raw.length > 180 ? fallback : translateSentence(raw, fallback);
}
