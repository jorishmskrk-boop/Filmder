export interface Movie {
  id: string;          // TMDB ID string or AI-generated unique ID
  title: string;       // Original movie title
  year: string;        // Release year (4 digits)
  rating: number;      // TMDB user rating scale (e.g., 7.8) or IMDb rating
  genres: string[];    // Array of genre strings
  synopsis: string;    // Highly engaging hook sentence summarizing the plot
  providers: string[]; // Lowercase array of active streaming services
  backdrop: string;    // High-quality movie poster backdrop landscape URL
  trailerUrl?: string; // Optional YouTube trailer URL or link
  language?: string;   // Human-readable language of the movie, e.g. "Engels", "Nederlands", "Frans"
  ratingSource?: string; // e.g. "IMDb" or "TMDB"
  recommendedFrom?: string[]; // Titles of the seed movies that recommended this film
}

export interface Room {
  id: string;          // 4-digit room code
  createdAt: number;
  country: string;
  providers: string[];
  vibe: string;
  movies: Movie[];
  users: Record<string, string>; // Maps uid -> username
  swipes: Record<string, Record<string, boolean>>; // Maps uid -> movie_id -> boolean (liked)
  matches: Movie[];
  reactions: Record<string, { emoji: string; timestamp: number }>; // Maps uid -> reaction details
  superLikes?: Record<string, Record<string, boolean>>; // Maps uid -> movie_id -> boolean (super liked)
  maxRuntime?: number;
  minRuntime?: number;
  minRating?: number;
  maxRating?: number;
  releaseDecade?: string;
  minYear?: number;
  maxYear?: number;
  ageRating?: boolean;
  fallbackLevel?: number;
  expiresAt?: any;
  movieReactions?: Record<string, Record<string, string>>; // Maps movieId -> userId -> emoji
}

export interface Preferences {
  name: string;
  country: string;
  providers: string[];
  vibe: string;
  maxRuntime?: number;
  minRuntime?: number;
  minRating?: number;
  maxRating?: number;
  releaseDecade?: string;
  minYear?: number;
  maxYear?: number;
  ageRating?: boolean;
}
