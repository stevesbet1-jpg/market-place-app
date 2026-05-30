export interface Review {
  id: string;
  author: string;
  initials: string;
  /** Author's home city/country */
  location: string;
  rating: number;
  date: string;
  text: string;
}

// Pool of 28 realistic luxury-traveler reviews.
// getReviewsForJourney() picks 4 deterministically per journey.
const REVIEW_POOL: readonly Review[] = [
  {
    id: 'rv01', author: 'Alexandra M.', initials: 'AM', location: 'London, UK', rating: 5,
    date: 'Apr 2026',
    text: 'Absolutely transformed how I travel. Every recommendation was spot-on — from the hidden restaurant to the timing of the sunrise hike. My whole circle has this saved now.',
  },
  {
    id: 'rv02', author: 'James T.', initials: 'JT', location: 'New York, USA', rating: 5,
    date: 'Mar 2026',
    text: "The day-by-day breakdown is the best I've used. Saved me hours of planning and the budget breakdowns were impressively accurate. 10 out of 10.",
  },
  {
    id: 'rv03', author: 'Priya S.', initials: 'PS', location: 'Singapore', rating: 5,
    date: 'Mar 2026',
    text: "I've done 30+ countries and this was still the most useful guide I've followed. The creator clearly lived every moment they describe — it shows.",
  },
  {
    id: 'rv04', author: 'Lena K.', initials: 'LK', location: 'Berlin, Germany', rating: 5,
    date: 'Feb 2026',
    text: "Luxury without the pretension. The itinerary hit exactly the right balance between cultural immersion and relaxation. Already planning a return trip.",
  },
  {
    id: 'rv05', author: 'Marcus O.', initials: 'MO', location: 'Sydney, Australia', rating: 4,
    date: 'Apr 2026',
    text: "Beautiful curation. The restaurant picks were exceptional — every single one was worth the reservation. Dropped one star only because two experiences sold out in my window.",
  },
  {
    id: 'rv06', author: 'Camille B.', initials: 'CB', location: 'Paris, France', rating: 5,
    date: 'Feb 2026',
    text: "I travel professionally and I still found hidden gems in this guide I hadn't discovered in six previous visits. Remarkable depth of local knowledge.",
  },
  {
    id: 'rv07', author: 'Ravi N.', initials: 'RN', location: 'Mumbai, India', rating: 5,
    date: 'Jan 2026',
    text: "The photography advice alone is worth membership. Caught shots I would never have found otherwise. The timing suggestions are golden — literally.",
  },
  {
    id: 'rv08', author: 'Sofia W.', initials: 'SW', location: 'Stockholm, Sweden', rating: 5,
    date: 'Mar 2026',
    text: "Travelled with my partner for our anniversary. Every moment felt curated and intentional. This guide made it feel like a private tour, not a generic trip.",
  },
  {
    id: 'rv09', author: 'David L.', initials: 'DL', location: 'Toronto, Canada', rating: 4,
    date: 'Jan 2026',
    text: "Solid itinerary with genuinely local insights. A couple of the mid-range budget estimates were slightly off for peak season but the experiences themselves were flawless.",
  },
  {
    id: 'rv10', author: 'Isabelle V.', initials: 'IV', location: 'Brussels, Belgium', rating: 5,
    date: 'Apr 2026',
    text: "Shared this with my travel group and they all booked within a week. The creator's voice is engaging and the production of the guide is stunning. Absolute favourite.",
  },
  {
    id: 'rv11', author: 'Kofi A.', initials: 'KA', location: 'Accra, Ghana', rating: 5,
    date: 'Mar 2026',
    text: "A revelatory experience. The creator helped me see the destination through a completely different lens. Highly recommend to anyone who wants depth beyond tourist highlights.",
  },
  {
    id: 'rv12', author: 'Emily R.', initials: 'ER', location: 'Melbourne, Australia', rating: 5,
    date: 'Feb 2026',
    text: "The best-structured travel guide I've ever used. Logical flow, generous detail, and honest notes about where to skip the hype. Trustworthy and elegant.",
  },
  {
    id: 'rv13', author: 'Antoine D.', initials: 'AD', location: 'Lyon, France', rating: 4,
    date: 'Jan 2026',
    text: "Rich in cultural context that most guides miss entirely. My only minor note: some listings need seasonal opening hours updated. Everything else was flawless.",
  },
  {
    id: 'rv14', author: 'Nora H.', initials: 'NH', location: 'Dubai, UAE', rating: 5,
    date: 'Apr 2026',
    text: "I've been recommending this creator to everyone. The writing is beautiful, the advice is practical, and the destination photography made me want to book immediately.",
  },
  {
    id: 'rv15', author: 'Tariq F.', initials: 'TF', location: 'Riyadh, Saudi Arabia', rating: 5,
    date: 'Feb 2026',
    text: "Outstanding attention to detail. The local experience recommendations are things I genuinely would never have found otherwise. Worth every premium credit.",
  },
  {
    id: 'rv16', author: 'Hannah J.', initials: 'HJ', location: 'Cape Town, SA', rating: 5,
    date: 'Mar 2026',
    text: "Followed this guide for a solo trip and felt completely confident the entire time. The creator clearly understands modern luxury travel — purposeful, not ostentatious.",
  },
  {
    id: 'rv17', author: 'Ethan C.', initials: 'EC', location: 'Chicago, USA', rating: 5,
    date: 'Jan 2026',
    text: "The itinerary pacing was perfect — never rushed, never bored. I came back feeling genuinely rested and culturally enriched. That combination is rare to achieve.",
  },
  {
    id: 'rv18', author: 'Yuki T.', initials: 'YT', location: 'Osaka, Japan', rating: 5,
    date: 'Feb 2026',
    text: "As a local, I was sceptical. But the creator managed to surface experiences that even residents overlook. The photography spots were especially inspired.",
  },
  {
    id: 'rv19', author: 'Amelia S.', initials: 'AS', location: 'Edinburgh, UK', rating: 4,
    date: 'Apr 2026',
    text: "Wonderful journey with a well-thought-out flow. Removed one star because one featured restaurant had closed since publication, but the alternatives suggested were equally good.",
  },
  {
    id: 'rv20', author: 'Lucas G.', initials: 'LG', location: 'São Paulo, Brazil', rating: 5,
    date: 'Mar 2026',
    text: "This platform and this creator changed my approach to travel entirely. I used to spend weeks planning. Now I trust the guide completely and just experience.",
  },
  {
    id: 'rv21', author: 'Mei L.', initials: 'ML', location: 'Hong Kong', rating: 5,
    date: 'Jan 2026',
    text: "The creator's insider knowledge is unparalleled. Every single restaurant was exceptional, and the cultural context woven throughout added a whole extra layer of appreciation.",
  },
  {
    id: 'rv22', author: 'François P.', initials: 'FP', location: 'Nice, France', rating: 5,
    date: 'Feb 2026',
    text: "Returned for the third time to this destination using an updated version of this guide. Still found new things. The creator keeps it genuinely fresh.",
  },
  {
    id: 'rv23', author: 'Zara K.', initials: 'ZK', location: 'Nairobi, Kenya', rating: 5,
    date: 'Mar 2026',
    text: "The level of research that has gone into this guide is extraordinary. You can feel that the creator genuinely cares about the traveller's experience, not just the click.",
  },
  {
    id: 'rv24', author: 'Oliver M.', initials: 'OM', location: 'Amsterdam, NL', rating: 5,
    date: 'Apr 2026',
    text: "First time using a creator journey guide and I'm completely converted. The experience felt bespoke. No generic tourist traps, only real local discoveries.",
  },
  {
    id: 'rv25', author: 'Valentina C.', initials: 'VC', location: 'Milan, Italy', rating: 4,
    date: 'Jan 2026',
    text: "Beautifully written with a real editorial sensibility. The visual mood of the guide set the right expectations from the first page. Minor quibble: needs more vegetarian dining options.",
  },
  {
    id: 'rv26', author: 'Noah A.', initials: 'NA', location: 'Lagos, Nigeria', rating: 5,
    date: 'Feb 2026',
    text: "Followed every recommendation to the letter and had zero regrets. This is what premium travel content should be — specific, confident, and deeply human.",
  },
  {
    id: 'rv27', author: 'Claire F.', initials: 'CF', location: 'Geneva, Switzerland', rating: 5,
    date: 'Mar 2026',
    text: "The creator's voice is intelligent and warm. I found myself trusting every opinion without question, which is rare. Already downloaded three more of their journeys.",
  },
  {
    id: 'rv28', author: 'Ben H.', initials: 'BH', location: 'Wellington, NZ', rating: 5,
    date: 'Apr 2026',
    text: "The budget accuracy is remarkable. Planned our honeymoon around this guide and came in under the estimated daily spend while still feeling every inch of luxury.",
  },
];

/** Returns 4 reviews deterministically for a given journey ID */
export function getReviewsForJourney(journeyId: string): Review[] {
  // Simple djb2-style hash to pick a reproducible starting index
  let hash = 5381;
  for (let i = 0; i < journeyId.length; i++) {
    hash = (hash * 33) ^ journeyId.charCodeAt(i);
    hash = hash & 0x7fffffff; // keep positive 31-bit
  }
  const start = hash % REVIEW_POOL.length;
  const result: Review[] = [];
  for (let i = 0; i < 4; i++) {
    result.push(REVIEW_POOL[(start + i * 7) % REVIEW_POOL.length]);
  }
  return result;
}

/** Average of ratings for a journey's reviews */
export function getAverageRating(journeyId: string): number {
  const reviews = getReviewsForJourney(journeyId);
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
