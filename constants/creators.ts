export interface Creator {
  id: string;
  name: string;
  /** Two-letter initials displayed inside the avatar circle */
  initials: string;
  bio: string;
  instagram?: string;
  youtube?: string;
  website?: string;
  rating: number;
  /** Total platform followers */
  followers: number;
  /** Number of published journeys */
  totalJourneys: number;
}

export const CREATORS: readonly Creator[] = [
  {
    id: 'sophia-chen',
    name: 'Sophia Chen',
    initials: 'SC',
    bio: 'Tokyo-based travel writer and photographer specialising in Asia\'s hidden cultural gems, ancient temple circuits and hyper-modern city escapes.',
    instagram: '@sophiatravels',
    youtube: 'SophiaChenTravel',
    website: 'sophiachen.travel',
    rating: 4.9,
    followers: 84200,
    totalJourneys: 3,
  },
  {
    id: 'marco-vitale',
    name: 'Marco Vitale',
    initials: 'MV',
    bio: 'Italian explorer and lifestyle journalist. Six years documenting the Riviera, Aegean islands and Tuscan countryside for the world\'s top luxury travel titles.',
    instagram: '@marcovitale',
    youtube: 'MarcoVitaleMed',
    website: 'marcovitale.com',
    rating: 4.8,
    followers: 121400,
    totalJourneys: 6,
  },
  {
    id: 'james-hartley',
    name: 'James Hartley',
    initials: 'JH',
    bio: 'Underwater photographer and ocean conservationist. Specialises in remote island sanctuaries, overwater living and rare marine encounters.',
    instagram: '@hartleyocean',
    website: 'jameshart.co',
    rating: 4.9,
    followers: 63800,
    totalJourneys: 2,
  },
  {
    id: 'elena-kovacs',
    name: 'Elena Kovacs',
    initials: 'EK',
    bio: 'Adventure travel guide with a passion for remote wilderness. From Patagonian glaciers to Icelandic highlands, she finds luxury in the extremes.',
    instagram: '@elenabeyondborders',
    youtube: 'ElenaKovacsAdventure',
    website: 'elenabeyond.com',
    rating: 4.7,
    followers: 49600,
    totalJourneys: 3,
  },
  {
    id: 'nadia-al-rashid',
    name: 'Nadia Al-Rashid',
    initials: 'NA',
    bio: 'Dubai-born cultural storyteller blending desert heritage with contemporary luxury. Known for her intimate guides to Morocco, Cappadocia and the Gulf.',
    instagram: '@nadiaalrashid',
    website: 'nadiatravel.me',
    rating: 4.8,
    followers: 72100,
    totalJourneys: 3,
  },
  {
    id: 'amara-osei',
    name: 'Amara Osei',
    initials: 'AO',
    bio: 'Tropical island specialist born in Accra. Her acclaimed guides to Zanzibar, Seychelles and Bali have reshaped how travellers experience island culture.',
    instagram: '@amaraosei',
    youtube: 'AmaraIslandLife',
    website: 'amaraosei.com',
    rating: 4.9,
    followers: 95300,
    totalJourneys: 3,
  },
];

/** Lookup helper — returns undefined if not found */
export function getCreatorById(id: string): Creator | undefined {
  return CREATORS.find((c) => c.id === id);
}

/** Format follower count: 84200 → "84.2K" */
export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format save count: 1840 → "1.8K" */
export function formatSaves(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
