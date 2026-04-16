// Suggestions de prestations par métier
// Titre + description uniquement – le prix est TOUJOURS saisi par l'artisan

export interface TradeSuggestion {
  title: string;
  description: string;
  unit: string;
}

export const TRADE_SUGGESTIONS: Record<string, TradeSuggestion[]> = {
  electricien: [
    { title: "Pose de prise électrique",       description: "Fourniture et pose d'une prise 2P+T encastrée",           unit: "u" },
    { title: "Pose d'interrupteur",             description: "Fourniture et pose d'un interrupteur simple allumage",      unit: "u" },
    { title: "Tableau électrique",              description: "Remplacement / installation tableau électrique",             unit: "forfait" },
    { title: "Mise à la terre",                 description: "Mise à la terre de l'installation électrique",              unit: "forfait" },
    { title: "Diagnostic électrique",           description: "Vérification et diagnostic complet de l'installation",       unit: "forfait" },
    { title: "Câblage réseau / informatique",   description: "Pose de câble RJ45 catégorie 6 + connecteur",              unit: "m" },
    { title: "Installation luminaire",          description: "Fourniture et pose d'un point lumineux",                    unit: "u" },
    { title: "Raccordement borne de recharge",  description: "Installation d'une borne de recharge véhicule électrique",  unit: "forfait" },
    { title: "Dépannage électrique",            description: "Intervention de dépannage électrique",                      unit: "h" },
  ],

  plombier: [
    { title: "Remplacement robinet",            description: "Dépose et pose d'un robinet mélangeur",                    unit: "u" },
    { title: "Débouchage canalisation",         description: "Débouchage par furet ou haute pression",                   unit: "forfait" },
    { title: "Pose siphon / bonde",             description: "Fourniture et pose de siphon / bonde évacuation",          unit: "u" },
    { title: "Remplacement joint",              description: "Remplacement de joints défectueux",                        unit: "forfait" },
    { title: "Installation lavabo",             description: "Fourniture et pose d'un lavabo avec robinetterie",         unit: "u" },
    { title: "Pose WC",                         description: "Fourniture et pose d'un WC suspendu / à poser",           unit: "u" },
    { title: "Installation douche",             description: "Pose et raccordement d'une douche + robinetterie",         unit: "forfait" },
    { title: "Réparation fuite",                description: "Recherche et réparation de fuite",                         unit: "forfait" },
    { title: "Pose adoucisseur",                description: "Installation adoucisseur d'eau",                            unit: "forfait" },
  ],

  chauffagiste: [
    { title: "Entretien chaudière",             description: "Entretien annuel chaudière gaz / fioul",                  unit: "forfait" },
    { title: "Remplacement chaudière",          description: "Dépose ancienne chaudière + pose nouvelle chaudière",      unit: "forfait" },
    { title: "Pose radiateur",                  description: "Fourniture et pose d'un radiateur à eau",                 unit: "u" },
    { title: "Équilibrage circuit chauffage",   description: "Réglage et équilibrage du circuit de chauffage",          unit: "forfait" },
    { title: "Robinet thermostatique",          description: "Pose de robinets thermostatiques sur radiateurs",         unit: "u" },
    { title: "Installation pompe à chaleur",    description: "Fourniture et pose d'une PAC air/air ou air/eau",        unit: "forfait" },
    { title: "Dépannage chauffage",             description: "Intervention de dépannage chauffage",                      unit: "h" },
    { title: "Purge radiateurs",               description: "Purge complète de l'installation de chauffage",            unit: "forfait" },
    { title: "Installation climatisation",      description: "Fourniture et pose d'un split system",                    unit: "forfait" },
  ],

  paysagiste: [
    { title: "Tonte pelouse",                   description: "Tonte et ramassage de l'herbe",                           unit: "m²" },
    { title: "Taille haie",                     description: "Taille et débroussaillage de haie",                       unit: "m" },
    { title: "Plantation arbuste",              description: "Fourniture et plantation d'arbuste",                       unit: "u" },
    { title: "Pose gazon en rouleau",           description: "Fourniture et pose de gazon naturel",                     unit: "m²" },
    { title: "Aménagement massif",              description: "Création et aménagement de massif fleuri",                unit: "m²" },
    { title: "Arrosage automatique",            description: "Installation système d'arrosage automatique",              unit: "forfait" },
    { title: "Abattage arbre",                  description: "Abattage et évacuation d'un arbre",                       unit: "u" },
    { title: "Désherbage",                      description: "Désherbage manuel ou traitement",                          unit: "m²" },
  ],

  macon: [
    { title: "Ragréage sol",                    description: "Ragréage et nivellement de sol",                           unit: "m²" },
    { title: "Réfection enduit façade",         description: "Reprise et réfection d'enduit de façade",                 unit: "m²" },
    { title: "Pose carrelage",                  description: "Fourniture et pose de carrelage",                          unit: "m²" },
    { title: "Construction muret",              description: "Construction muret en parpaings / pierre",                 unit: "m" },
    { title: "Traitement fissures",             description: "Reprise et traitement de fissures",                        unit: "forfait" },
    { title: "Chape béton",                     description: "Coulage chape béton armé",                                 unit: "m²" },
    { title: "Pose dalles terrasse",            description: "Fourniture et pose de dalles de terrasse",                 unit: "m²" },
    { title: "Création dalle béton",            description: "Terrassement + coffrage + coulage dalle",                 unit: "m²" },
  ],

  peintre: [
    { title: "Peinture murale",                 description: "Préparation + 2 couches peinture murs",                  unit: "m²" },
    { title: "Peinture plafond",                description: "Préparation + 2 couches peinture plafond",               unit: "m²" },
    { title: "Peinture menuiseries",            description: "Ponçage + peinture menuiseries bois",                     unit: "u" },
    { title: "Pose papier peint",               description: "Fourniture et pose de papier peint",                      unit: "m²" },
    { title: "Traitement humidité",             description: "Traitement anti-humidité + enduit",                       unit: "m²" },
    { title: "Ravalement façade",               description: "Nettoyage + peinture ravalement façade",                  unit: "m²" },
    { title: "Préparation supports",            description: "Enduit, lissage et préparation avant peinture",           unit: "m²" },
  ],
};

// Cherche les suggestions les plus pertinentes pour un métier
export function getSuggestionsForActivity(activity: string | null | undefined): TradeSuggestion[] {
  if (!activity) return [];
  const key = activity.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire accents
    .replace(/[^a-z]/g, "");

  // Correspondance directe
  if (TRADE_SUGGESTIONS[key]) return TRADE_SUGGESTIONS[key];

  // Correspondance partielle
  for (const [trade, suggestions] of Object.entries(TRADE_SUGGESTIONS)) {
    if (key.includes(trade) || trade.includes(key)) return suggestions;
  }

  // Aucune correspondance → suggestions génériques
  return [
    { title: "Prestation de service",     description: "Description de la prestation réalisée",   unit: "forfait" },
    { title: "Main d'œuvre",              description: "Temps de travail et intervention",           unit: "h" },
    { title: "Fournitures et matériaux",  description: "Matériaux et fournitures utilisés",          unit: "forfait" },
    { title: "Déplacement",              description: "Frais de déplacement",                        unit: "forfait" },
  ];
}
