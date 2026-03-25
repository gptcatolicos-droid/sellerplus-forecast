/**
 * REGLAS DEL CATÁLOGO IA — La Tienda de Comics
 * Fuente única de verdad para qué puede buscar y vender la IA.
 */

export const ALLOWED_FRANCHISES = [
  // DC
  'Batman','Superman','Wonder Woman','Flash','Green Lantern','Aquaman',
  'Justice League','Joker','Harley Quinn','Nightwing','Robin','Catwoman',
  'Black Adam','Shazam','Cyborg','Supergirl','Blue Beetle','Zatanna',
  'Constantine','Sandman','Watchmen','V for Vendetta','Hellblazer',
  'Green Arrow','Martian Manhunter','Hawkman',
  // Marvel
  'Spider-Man','Spider-Verse','X-Men','Avengers','Iron Man','Captain America',
  'Thor','Hulk','Black Widow','Hawkeye','Wolverine','Deadpool','Venom',
  'Black Panther','Doctor Strange','Daredevil','Punisher','Ghost Rider',
  'Silver Surfer','Guardians of the Galaxy','Fantastic Four','Ant-Man',
  'Captain Marvel','Moon Knight','Blade','Storm','Cyclops','Magneto',
  'Scarlet Witch','Vision','War Machine','Falcon','Winter Soldier',
  'Loki','Thanos','Gambit','Rogue',
  // Manga
  'Naruto','Dragon Ball','One Piece','Attack on Titan','Demon Slayer',
  'Bleach','My Hero Academia','Death Note','Fullmetal Alchemist',
  'Jujutsu Kaisen','Chainsaw Man','Tokyo Ghoul','Hunter x Hunter',
  'One Punch Man','Boruto','Dragon Ball Super','Vinland Saga',
  'Berserk','JoJo','Spy x Family',
  // Star Wars
  'Darth Vader','Luke Skywalker','Mandalorian','Yoda','Boba Fett',
  'Star Wars','Obi-Wan','Rey','Kylo Ren',
] as const;

export const ALLOWED_PUBLISHERS = [
  'DC Comics','DC','Vertigo','DC Black Label',
  'Marvel','Marvel Comics',
  'Image Comics',
  'Viz Media','Kodansha','Shonen Jump','Seven Seas','Yen Press','Dark Horse Manga',
  'Panini Comics','Panini Colombia',
  'Iron Studios','McFarlane Toys','Hot Toys','Funko','Hasbro','Lucasfilm',
] as const;

export const BLOCKED_KEYWORDS = [
  'cocina','receta','zapatilla','ropa','moda','laptop','celular','videojuego',
  'consola','xbox','playstation','nintendo','comida','bebida','medicina',
  'automóvil','carro','herramienta','jardín','mascota','deporte',
] as const;

export const MAX_PRICE_USD = 500;

export const SUPPLIER_CONFIG = {
  midtown: {
    name: 'Midtown Comics',
    margin: 0.25,
    shippingIncluded: 10,
    deliveryDays: '6–10',
    carrier: 'USPS',
    model: 'dropshipping' as const,
    color: '#2563eb',
  },
  ironstudios: {
    name: 'Iron Studios',
    margin: 0.25,
    shippingIncluded: 10,
    deliveryDays: '5–8',
    carrier: 'DHL/UPS',
    model: 'dropshipping' as const,
    color: '#7c3aed',
  },
  panini: {
    name: 'Panini Colombia',
    margin: 0.25,
    shippingIncluded: 0,
    deliveryDays: '3–5',
    carrier: 'Local',
    model: 'dropshipping' as const,
    color: '#CC0000',
  },
  amazon: {
    name: 'Amazon',
    margin: 0.04,
    shippingIncluded: 0,
    deliveryDays: '8–15',
    carrier: 'Amazon',
    model: 'affiliate' as const,
    color: '#f97316',
  },
} as const;

export type Supplier = keyof typeof SUPPLIER_CONFIG;

export function isAllowedQuery(query: string): boolean {
  const q = query.toLowerCase();
  const blocked = BLOCKED_KEYWORDS.some(kw => q.includes(kw));
  if (blocked) return false;
  const allowed = ALLOWED_FRANCHISES.some(f => q.toLowerCase().includes(f.toLowerCase()))
    || ALLOWED_PUBLISHERS.some(p => q.toLowerCase().includes(p.toLowerCase()))
    || ['comic','manga','figura','funko','iron studios','mcfarlane','dc','marvel','star wars'].some(k => q.includes(k));
  return allowed;
}

export function applyMargin(priceUsd: number, supplier: Supplier): number {
  const cfg = SUPPLIER_CONFIG[supplier];
  return Math.round((priceUsd * (1 + cfg.margin) + cfg.shippingIncluded) * 100) / 100;
}
