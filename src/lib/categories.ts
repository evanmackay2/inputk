// Category taxonomy shared by the ingest classifier and the UI.
//
// Classification is keyword-based on title + description across the catalog's
// languages. Deliberately imperfect-but-cheap: it needs no transcripts, no API
// calls, and runs during ingest. Videos matching nothing get 'general'.

export type Category = {
  id: string;
  label: string;
  emoji: string;
  keywords: string[]; // lowercase, matched as substrings against title+description
};

export const CATEGORIES: Category[] = [
  {
    id: "stories",
    label: "Stories",
    emoji: "📖",
    keywords: [
      "story", "stories", "tale", "cuento", "historia de", "leyenda", "fábula",
      "história", "conto", "storia", "racconto", "fiaba", "histoire", "conte",
      "geschichte", "märchen", "物語", "昔話", "ストーリー",
    ],
  },
  {
    id: "daily-life",
    label: "Daily Life",
    emoji: "☕",
    keywords: [
      "daily", "routine", "vlog", "my day", "rutina", "día a día", "vida diaria",
      "cotidiano", "rotina", "meu dia", "quotidiano", "giornata", "quotidien",
      "ma journée", "alltag", "日常", "ルーティン", "vlog",
    ],
  },
  {
    id: "culture",
    label: "Culture",
    emoji: "🎭",
    keywords: [
      "culture", "tradition", "festival", "cultura", "tradición", "costumbres",
      "tradição", "tradizione", "coutume", "kultur", "tradition", "文化", "伝統",
      "祭り", "holiday", "navidad", "natal", "natale", "noël", "weihnachten",
    ],
  },
  {
    id: "travel",
    label: "Travel",
    emoji: "🌍",
    keywords: [
      "travel", "trip", "viaje", "viajar", "viagem", "viaggio", "voyage",
      "reise", "旅行", "旅", "tour", "walking tour", "city", "ciudad", "cidade",
      "città", "ville", "stadt", "pueblo", "barrio",
    ],
  },
  {
    id: "food",
    label: "Food",
    emoji: "🍜",
    keywords: [
      "food", "cook", "recipe", "comida", "cocina", "receta", "culinária",
      "receita", "cozinha", "cibo", "cucina", "ricetta", "cuisine", "recette",
      "essen", "kochen", "rezept", "料理", "食べ", "レシピ", "restaurant",
    ],
  },
  {
    id: "history",
    label: "History",
    emoji: "🏛️",
    keywords: [
      "history", "historia de", "história do", "storia di", "histoire de",
      "geschichte", "歴史", "ancient", "antigua", "antiga", "antica", "empire",
      "imperio", "império", "impero", "guerra", "war", "revolución", "revolution",
    ],
  },
  {
    id: "science-tech",
    label: "Science & Tech",
    emoji: "🔬",
    keywords: [
      "science", "ciencia", "ciência", "scienza", "wissenschaft", "科学",
      "technology", "tecnología", "tecnologia", "technologie", "技術",
      "space", "espacio", "espaço", "spazio", "espace", "宇宙", "biology",
      "física", "physik", "ai", "inteligencia artificial",
    ],
  },
  {
    id: "news",
    label: "News",
    emoji: "📰",
    keywords: [
      "news", "noticias", "notícias", "notizie", "actualité", "nachrichten",
      "ニュース", "this week", "esta semana", "questa settimana", "cette semaine",
      "aktuell", "current events",
    ],
  },
  {
    id: "sports",
    label: "Sports",
    emoji: "⚽",
    keywords: [
      "sport", "deporte", "esporte", "fútbol", "futebol", "calcio", "football",
      "fußball", "サッカー", "スポーツ", "basketball", "tennis", "olympi",
      "béisbol", "boxeo", "workout", "gym", "entrenamiento",
    ],
  },
  {
    id: "music-arts",
    label: "Music & Arts",
    emoji: "🎨",
    keywords: [
      "music", "música", "musica", "musique", "musik", "音楽", "song", "canción",
      "canção", "canzone", "chanson", "lied", "歌", "art", "arte", "kunst",
      "芸術", "painting", "pintura", "cinema", "cine", "película", "filme", "film",
    ],
  },
  {
    id: "games",
    label: "Games",
    emoji: "🎮",
    keywords: [
      "game", "gaming", "videojuego", "video game", "jogo", "videogioco",
      "jeu vidéo", "videospiel", "ゲーム", "minecraft", "pokemon", "pokémon",
      "nintendo", "playstation", "juego de mesa", "board game",
    ],
  },
  {
    id: "language",
    label: "About the Language",
    emoji: "🗣️",
    keywords: [
      "grammar", "gramática", "grammatica", "grammaire", "grammatik", "文法",
      "vocabulary", "vocabulario", "vocabulário", "vocabolario", "vocabulaire",
      "wortschatz", "単語", "pronunciation", "pronunciación", "pronúncia",
      "pronuncia", "prononciation", "aussprache", "発音", "verbos", "conjuga",
      "subjuntivo", "phrases", "expresiones", "expressões", "slang", "jerga",
    ],
  },
];

export const GENERAL_CATEGORY = { id: "general", label: "General", emoji: "📺" };

export const ALL_CATEGORIES = [...CATEGORIES, GENERAL_CATEGORY];

export function categoryById(id: string) {
  return ALL_CATEGORIES.find((c) => c.id === id) ?? GENERAL_CATEGORY;
}

// Classify a video by title + description. Returns up to 3 category ids,
// ordered by keyword hit count; ['general'] when nothing matches.
export function classify(title: string, description: string): string[] {
  const text = `${title}\n${(description ?? "").slice(0, 600)}`.toLowerCase();
  const scored: { id: string; hits: number }[] = [];
  for (const cat of CATEGORIES) {
    let hits = 0;
    for (const kw of cat.keywords) {
      if (text.includes(kw)) hits++;
    }
    if (hits > 0) scored.push({ id: cat.id, hits });
  }
  if (!scored.length) return ["general"];
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, 3).map((s) => s.id);
}
