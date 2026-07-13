const VALUE_TRANSLATIONS: Record<string, string> = {
  active: "Actif",
  acknowledged: "Acquitte",
  alarm: "Alarme",
  alarms: "Alarmes",
  alert: "Alerte",
  alerts: "Alertes",
  allow: "Autorise",
  allowed: "Autorise",
  allow_inside: "Autorise a l'interieur",
  allow_outside: "Autorise a l'exterieur",
  bad_request: "Demande invalide",
  battery: "Batterie",
  back_cover_opened: "Capot d’arrière ouvert",
  bluetooth: "Bluetooth",
  charging: "En charge",
  connected: "Connecte",
  critical: "Critique",
  disconnected: "Deconnecte",
  dynamic_password: "Mot de passe dynamique",
  error: "Erreur",
  failed: "Echec",
  false: "Non",
  geofence: "Geofence",
  geofence_entry: "Entree de geofence",
  geofence_exit: "Sortie de geofence",
  high: "Elevee",
  idle: "A l'arret",
  inactive: "Inactif",
  info: "Information",
  investigating: "En investigation",
  lock: "Verrou",
  locked: "Verrouille",
  lock_rope_pull_out: "Corde du verrou retiree",
  low: "Faible",
  low_battery: "Batterie faible",
  medium: "Moyenne",
  motion: "Mouvement",
  moving: "En mouvement",
  network: "Reseau",
  offline: "Hors ligne",
  online: "En ligne",
  opened: "Ouvert",
  other: "Autre",
  pending: "En attente",
  processing: "En cours",
  read: "Lue",
  ready: "Pret",
  rejected: "Refuse",
  resolved: "Resolu",
  rfid: "RFID",
  static_password: "Mot de passe statique",
  stopped: "A l'arret",
  success: "Succes",
  synced: "Synchronise",
  tamper: "Sabotage",
  automatically_locked: "Verrouillage automatique",
  swipe_illegal_rfid_card: "Badge RFID non autorise",
  illegal_rfid_card: "Badge RFID non autorise",
  swipe_rfid_card: "Passage du badge RFID",
  door_locked: "Verrouillage du PadLock",
  door_unlocked: "Deverrouillage du PadLock",
  unlock_failed: "Echec du deverrouillage",
  password_error: "Mot de passe incorrect",
  true: "Oui",
  unauthorized: "Non autorise",
  unknown: "Inconnu",
  unlock_rejected: "Deverrouillage refuse",
  unlocked: "Deverrouille",
  unread: "Non lue",
  vibration: "Vibration",
  vibration_alarm: "Alarme de vibration",
  warning: "Avertissement",
};

const FIELD_TRANSLATIONS: Record<string, string> = {
  address: "Adresse",
  area: "Zone",
  assetName: "Nom",
  battery: "Batterie",
  back_cover_opened: "Capot d’arrière ouvert",
  batteryLevel: "Batterie",
  batteryPercent: "Batterie",
  charge: "Charge",
  chargerConnected: "Chargeur connecte",
  charging: "Charge",
  chargingState: "Etat de charge",
  city: "Ville",
  connected: "Connexion",
  connectionStatus: "Etat de connexion",
  createdAt: "Date de creation",
  device: "Equipement",
  deviceName: "Equipement",
  formattedAddress: "Adresse",
  id: "Identifiant",
  imei: "IMEI",
  isCharging: "Charge",
  isLocked: "Verrouillage",
  isOnline: "Connexion",
  label: "Libelle",
  lat: "Latitude",
  latitude: "Latitude",
  lieu: "Lieu",
  lng: "Longitude",
  lock: "PadLock",
  locked: "Verrouillage",
  lockId: "PadLock",
  lockState: "Verrouillage",
  location: "Localisation",
  locationName: "Lieu",
  lon: "Longitude",
  longitude: "Longitude",
  movementStatus: "Mouvement",
  name: "Nom",
  online: "Connexion",
  place: "Lieu",
  placeName: "Lieu",
  power: "Batterie",
  region: "Region",
  signal: "Signal",
  speed: "Vitesse",
  speedKph: "Vitesse",
  state: "Etat",
  status: "Statut",
  statusLock: "Verrouillage",
  terminalId: "PadLock",
  terminalID: "PadLock",
  timestamp: "Horodatage",
  updatedAt: "Derniere mise a jour",
  velocity: "Vitesse",
  zone: "Zone",
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function translateBackendValue(value: unknown, fallback = "Inconnu") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Oui" : "Non";

  const text = String(value).trim();
  if (!text) return fallback;

  const normalized = normalizeKey(text);
  return VALUE_TRANSLATIONS[normalized] ?? VALUE_TRANSLATIONS[text.toLowerCase()] ?? text;
}

export function translateFieldLabel(label: string) {
  const direct = FIELD_TRANSLATIONS[label];
  if (direct) return direct;

  const normalized = normalizeKey(label);
  if (FIELD_TRANSLATIONS[normalized]) return FIELD_TRANSLATIONS[normalized];

  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

export function translateSentence(value: unknown, fallback = "Une erreur est survenue. Reessayez dans quelques instants.") {
  if (!value) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;

  const translated = translateBackendValue(text, "");
  if (translated) return translated;

  return text
    .replace(/\bUnknown device\b/gi, "Equipement inconnu")
    .replace(/\bNew alert\b/gi, "Nouvelle alerte")
    .replace(/\bAlert\b/gi, "Alerte")
    .replace(/\bLock Rope Pull Out\b/gi, "Corde du verrou retiree")
    .replace(/\breceived from\b/gi, "recue depuis")
    .replace(/\bLogin failed\. Please check your email and password\.\b/gi, "Connexion refusee. Verifiez votre email et votre mot de passe.")
    .replace(/\bRequest failed\b/gi, "La demande a echoue")
    .replace(/\bFailed to fetch\b/gi, "Connexion au serveur impossible")
    .replace(/\bnot found\b/gi, "introuvable")
    .replace(/\bserver\b/gi, "serveur");
}
