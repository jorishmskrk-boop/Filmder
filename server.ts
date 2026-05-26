import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

const PORT = 3000;

interface TMDBItem {
  id: number;
  title: string;
  backdrop_path: string | null;
  overview: string | null;
  vote_average: number;
  release_date?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface TMDBResponse {
  results: TMDBItem[];
  total_pages?: number;
}

// Map of providers to TMDB IDs
const PROVIDER_MAP: Record<string, number> = {
  netflix: 8,
  disney: 337,
  prime: 119,
  max: 1899,
  apple: 350,
  hulu: 15,
  paramount: 531,
  videoland: 153,
  npostart: 326,
  viaplay: 563,
  skyshowtime: 1796,
};

// Map of ISO 639-1 language codes to human-readable Dutch names
const LANGUAGE_MAP: Record<string, string> = {
  en: "Engels",
  nl: "Nederlands",
  es: "Spaans",
  fr: "Frans",
  de: "Duits",
  it: "Italiaans",
  ja: "Japans",
  ko: "Koreaans",
  zh: "Chinees",
  pt: "Portugees",
  ru: "Russisch",
  sv: "Zweeds",
  no: "Noors",
  da: "Deens",
  fi: "Fins",
  tr: "Turks",
  hi: "Hindi",
};

// Rate limiter for movie api route
const movieLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Te veel verzoeken. Probeer het over een minuut opnieuw." },
  validate: { trustProxy: false, xForwardedForHeader: false }
});

const movieCache = new NodeCache({ stdTTL: 86450, checkperiod: 600 }); // ~24h TTL

interface CachedMovieDetails {
  imdbId?: string;
  fetchedTrailerUrl?: string;
  offeredProviderIds: number[];
}

// Helper function to fetch IMDb rating from OMDb API with automatic limits fallback to TMDB
async function getOmdbRating(imdbId: string | undefined): Promise<{ rating: number; source: string } | undefined> {
  const omdbKey = process.env.OMDB_API_KEY;
  if (!imdbId || !omdbKey || !omdbKey.trim()) return undefined;

  const cacheKey = `omdb_rating_${imdbId}`;
  const cached = movieCache.get<{ rating: number; source: string }>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout to give network operations a fair chance
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey.trim()}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json() as { Response?: string; imdbRating?: string; Error?: string };
      if (data.Response === "True" && data.imdbRating && data.imdbRating !== "N/A") {
        const parsedRating = parseFloat(data.imdbRating);
        if (!isNaN(parsedRating) && parsedRating > 0) {
          const result = { rating: parsedRating, source: "IMDb" };
          movieCache.set(cacheKey, result);
          return result;
        }
      } else if (data.Response === "False") {
        console.warn(`OMDb lookup failed or limit hit (1000/day reached) for ${imdbId}: ${data.Error}`);
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.name === "TimeoutError" || err?.code === "ABORT_ERR") {
      // Aborted or timed out operations are expected fallback paths; silent exit
      return undefined;
    }
    console.error(`Error querying OMDb rating for ${imdbId}:`, err);
  }
  return undefined;
}

// API Endpoint to fetch movies (using TMDB proxy exclusively)
app.post("/api/movies", movieLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    const { country, providers, vibe, ageRating } = body as {
      country?: string;
      providers?: string[];
      vibe?: string;
      ageRating?: boolean;
    };

    const minRuntime = typeof body.minRuntime === "number" ? body.minRuntime : undefined;
    const maxRuntime = typeof body.maxRuntime === "number" ? body.maxRuntime : typeof body.maxRuntime === "string" ? parseInt(body.maxRuntime) : undefined;
    const minRating = typeof body.minRating === "number" ? body.minRating : typeof body.minRating === "string" ? parseFloat(body.minRating) : undefined;
    const maxRating = typeof body.maxRating === "number" ? body.maxRating : typeof body.maxRating === "string" ? parseFloat(body.maxRating) : undefined;
    const minYear = typeof body.minYear === "number" ? body.minYear : typeof body.minYear === "string" ? parseInt(body.minYear) : undefined;
    const maxYear = typeof body.maxYear === "number" ? body.maxYear : typeof body.maxYear === "string" ? parseInt(body.maxYear) : undefined;
    const releaseDecade = body.releaseDecade;
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds.map((id: any) => String(id)) : [];

    const selectedProviders: string[] = providers || ["netflix"];
    const selectedCountry = country || "NL";
    const selectedVibe = vibe || ""; // Holds a comma-separated list of conventional genre IDs

    // Use background server-side TMDB_API_KEY exclusively for security and AI elimination
    const serverTmdbKey = process.env.TMDB_API_KEY;
    if (!serverTmdbKey || serverTmdbKey.trim().length === 0) {
      return res.status(500).json({ error: "TMDB API Key is niet geconfigureerd op de server." });
    }
    const tmdbKey = serverTmdbKey.trim();

    // Get official provider IDs. If "pirate" is selected as an active provider, we make providerIdString empty
    // so that the search bypasses watch provider restrictions entirely, returning all movies from everywhere!
    const includesPirate = selectedProviders.includes("pirate");
    const providerIds = includesPirate ? [] : selectedProviders
      .map(p => PROVIDER_MAP[p])
      .filter((id): id is number => id !== undefined);
    const providerIdString = providerIds.join("|");

    const hasUserYearFilter = (minYear !== undefined && minYear > 0) || (maxYear !== undefined && maxYear > 0) || (releaseDecade && releaseDecade !== "all");
    const hasUserGenreFilter = selectedVibe.trim().length > 0;

    // Safe helper function to append active runtime and rating range bounds safely
    const appendUserFilters = (paramsStr: string) => {
      let resStr = paramsStr;
      if (minRuntime !== undefined && minRuntime > 0) {
        resStr += `&with_runtime.gte=${minRuntime}`;
      }
      if (maxRuntime !== undefined && maxRuntime > 0) {
        resStr += `&with_runtime.lte=${maxRuntime}`;
      }
      if (minRating !== undefined && minRating > 0) {
        // Query TMDB with a slightly lower threshold (widen search area) to fetch candidates that could have high IMDb scores
        const wideMin = Math.max(1, minRating - 1.2);
        resStr += `&vote_average.gte=${wideMin}`;
      }
      if (maxRating !== undefined && maxRating > 0) {
        // Query TMDB with a slightly higher threshold
        const wideMax = Math.min(10, maxRating + 1.2);
        resStr += `&vote_average.lte=${wideMax}`;
      }

      if (hasUserYearFilter) {
        if (minYear !== undefined && minYear > 0) {
          resStr += `&primary_release_date.gte=${minYear}-01-01`;
        }
        if (maxYear !== undefined && maxYear > 0) {
          resStr += `&primary_release_date.lte=${maxYear}-12-31`;
        } else if (releaseDecade && releaseDecade !== "all") {
          const decadeNum = parseInt(releaseDecade);
          if (!isNaN(decadeNum)) {
            resStr += `&primary_release_date.gte=${decadeNum}-01-01&primary_release_date.lte=${decadeNum + 9}-12-31`;
          }
        }
      }

      if (ageRating) {
        resStr += `&certification_country=NL&certification.lte=9`;
      }
      return resStr;
    };

    const genresString = selectedVibe.trim() ? selectedVibe.trim().replace(/,/g, "|") : "";

    // Calculate a dynamic upper bound for pagination
    let safeMaxPage = 20;
    if (hasUserYearFilter || hasUserGenreFilter) {
      safeMaxPage = 3;
    } else if (providerIdString.length > 0) {
      safeMaxPage = 10;
    }

    // Build the query URLs
    const baseQuery = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}`;
    const providerFilter = providerIdString ? `&with_watch_providers=${providerIdString}` : "";
    const genreFilter = genresString ? `&with_genres=${genresString}` : "";

    // Query 1 (Random Year Era)
    const randomYear = Math.floor(Math.random() * (2023 - 1985 + 1)) + 1985;
    const page1 = Math.floor(Math.random() * 3) + 1;
    const q1Custom = appendUserFilters(`&primary_release_year=${randomYear}&sort_by=popularity.desc&vote_count.gte=300`);
    const url1 = `${baseQuery}&page=${page1}${q1Custom}${providerFilter}${genreFilter}`;

    // Query 2 (Random Sort Method)
    const sorts = ["revenue.desc", "vote_count.desc", "popularity.desc"];
    const selectedSort = sorts[Math.floor(Math.random() * sorts.length)];
    const page2 = Math.floor(Math.random() * safeMaxPage) + 1;
    const q2Custom = appendUserFilters(`&sort_by=${selectedSort}&vote_count.gte=400`);
    const url2 = `${baseQuery}&page=${page2}${q2Custom}${providerFilter}${genreFilter}`;

    // Query 3 (Blind Genre Injection / Cult Classics)
    const page3 = Math.floor(Math.random() * safeMaxPage) + 1;
    const q3Custom = appendUserFilters("&sort_by=vote_average.desc&vote_average.gte=6.5&vote_count.gte=200&vote_count.lte=3000");
    let url3 = "";
    if (!hasUserGenreFilter) {
      // Expanded list of TMDB genre IDs to force dynamic genre variations
      const secondaryGenres = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];
      // Shuffle the genres and take a random number of them (between 1 and 3)
      const shuffledGenres = [...secondaryGenres].sort(() => 0.5 - Math.random());
      const numGenres = Math.floor(Math.random() * 3) + 1; // Pick 1, 2 or 3 random genres
      const selectedCombo = shuffledGenres.slice(0, numGenres).join("|");
      url3 = `${baseQuery}&page=${page3}${q3Custom}${providerFilter}&with_genres=${selectedCombo}`;
    } else {
      url3 = `${baseQuery}&page=${page3}${q3Custom}${providerFilter}${genreFilter}`;
    }

    // Helper to fetch and return tmdb items safely
    const fetchQuery = async (url: string): Promise<TMDBItem[]> => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json() as TMDBResponse;
          const results = data.results || [];
          if (results.length > 0) {
            return results;
          }
        }
      } catch (err) {
        console.error(`Error fetching movie query url (${url}):`, err);
      }

      // If page is greater than 1, and we got 0 results (or failed), attempt page 1 fallback for this EXACT query
      if (url.includes("&page=") && !url.includes("&page=1")) {
        const fallbackUrl = url.replace(/&page=\d+/, "&page=1");
        try {
          const res = await fetch(fallbackUrl);
          if (res.ok) {
            const data = await res.json() as TMDBResponse;
            return data.results || [];
          }
        } catch (err) {
          console.error(`Error fetching fallback page 1 for (${fallbackUrl}):`, err);
        }
      }
      return [];
    };

    // Parallel execution
    const resultsArrays = await Promise.all([
      fetchQuery(url1),
      fetchQuery(url2),
      fetchQuery(url3)
    ]);

    // Data Processing & Deduplication
    const seenIds = new Set<number>();
    let rawResults: TMDBItem[] = [];

    for (const arr of resultsArrays) {
      for (const item of arr) {
        if (item && item.id) {
          const idStr = String(item.id);
          if (!seenIds.has(item.id) && !excludeIds.includes(idStr)) {
            seenIds.add(item.id);
            rawResults.push(item);
          }
        }
      }
    }

    // Fail-Safe Fallback
    let activeFallbackLevel = 0;
    if (rawResults.length < 5) {
      activeFallbackLevel = 1;
      const fallbackUrl = `${baseQuery}&sort_by=popularity.desc&page=1&vote_count.gte=50${providerFilter}`;
      try {
        const fbRes = await fetch(fallbackUrl);
        if (fbRes.ok) {
          const fbData = await fbRes.json() as TMDBResponse;
          const fbResults = fbData.results || [];
          for (const item of fbResults) {
            if (item && item.id) {
              const idStr = String(item.id);
              if (!seenIds.has(item.id) && !excludeIds.includes(idStr)) {
                seenIds.add(item.id);
                rawResults.push(item);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching fallback query:", err);
      }
    }

    // Final Randomization (Fisher-Yates shuffle)
    for (let i = rawResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawResults[i], rawResults[j]] = [rawResults[j], rawResults[i]];
    }

    // Pool to max 35 items
    const items = rawResults.slice(0, 35);

    // Map TMDB genres to Dutch
    const genreNamesMap: Record<number, string> = {
      28: "Actie", 12: "Avontuur", 16: "Animatie", 35: "Komedie", 80: "Misdaad",
      99: "Documentaire", 18: "Drama", 10751: "Familie", 14: "Fantasie", 36: "Geschiedenis",
      27: "Horror", 10402: "Muziek", 9648: "Mysterie", 10749: "Romantiek", 878: "Sci-Fi",
      10770: "TV-Film", 53: "Thriller", 10752: "Oorlog", 37: "Western"
    };

    // Build formatted items and fetch details via append_to_response in parallel (resolving N+1 pattern)
    const promises = items.map(async (item) => {
      const itemGenres = (item.genre_ids || [])
        .map(id => genreNamesMap[id])
        .filter((g): g is string => g !== undefined);

      const backdropUrl = item.backdrop_path 
        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=60";

      const synopsis = item.overview || "Geen beschrijving beschikbaar.";
      const releaseYear = item.release_date ? item.release_date.split("-")[0] : "2026";
      const originalLang = item.original_language || "en";
      const languageName = LANGUAGE_MAP[originalLang] || originalLang.toUpperCase();

      let actualProviders: string[] = selectedProviders;
      let fetchedTrailerUrl: string | undefined = undefined;
      let imdbId: string | undefined = undefined;

      const detailsCacheKey = `tmdb_details_${item.id}`;
      const cachedDetails = movieCache.get<CachedMovieDetails>(detailsCacheKey);

      if (cachedDetails) {
        imdbId = cachedDetails.imdbId;
        fetchedTrailerUrl = cachedDetails.fetchedTrailerUrl;
        const matchedProviders = selectedProviders.filter(p => {
          if (p === "pirate") return true;
          const matchId = PROVIDER_MAP[p];
          return cachedDetails.offeredProviderIds.includes(matchId);
        });
        if (matchedProviders.length > 0) {
          actualProviders = matchedProviders;
        } else if (!includesPirate) {
          actualProviders = [];
        }
      } else {
        try {
          // Fetch details in a single query with watch/providers, videos, and external_ids appended
          const detailsRes = await fetch(
            `https://api.themoviedb.org/3/movie/${item.id}?api_key=${tmdbKey}&append_to_response=watch/providers,videos,external_ids`
          );
          if (detailsRes.ok) {
            const details = await detailsRes.json() as {
              imdb_id?: string;
              external_ids?: { imdb_id?: string };
              videos?: { results?: { site?: string; type?: string; key?: string }[] };
              "watch/providers"?: { results?: Record<string, { flatrate?: { provider_id: number }[]; rent?: { provider_id: number }[]; buy?: { provider_id: number }[]; free?: { provider_id: number }[]; ads?: { provider_id: number }[] }> };
            };

            // 1. Resolve IMDb ID (checking both top-level and external_ids for maximum resilience)
            imdbId = details.imdb_id || details.external_ids?.imdb_id || undefined;

            // 2. Resolve YouTube Trailer URL
            const videos = details.videos?.results || [];
            const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") || 
                            videos.find(v => v.site === "YouTube" && v.type === "Teaser") ||
                            videos.find(v => v.site === "YouTube");
            if (trailer?.key) {
              fetchedTrailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
            }

            // 3. Resolve watch providers across Dutch, US and current country to find matching offeredProviderIds
            const providerResults = details["watch/providers"]?.results || {};
            const offeredProviderIds: number[] = [];
            
            const targetRegions = [selectedCountry, "NL", "US"];
            for (const region of targetRegions) {
              const regionData = providerResults[region] || {};
              const flatrate = regionData.flatrate || [];
              const rent = regionData.rent || [];
              const buy = regionData.buy || [];
              const free = regionData.free || [];
              const ads = regionData.ads || [];
              const combined = [...flatrate, ...rent, ...buy, ...free, ...ads];
              for (const p of combined) {
                if (p.provider_id && !offeredProviderIds.includes(p.provider_id)) {
                  offeredProviderIds.push(p.provider_id);
                }
              }
            }

            // Save to details cache
            movieCache.set(detailsCacheKey, {
              imdbId,
              fetchedTrailerUrl,
              offeredProviderIds
            });

            const matchedProviders = selectedProviders.filter(p => {
              if (p === "pirate") return true;
              const matchId = PROVIDER_MAP[p];
              return offeredProviderIds.includes(matchId);
            });
            
            if (matchedProviders.length > 0) {
              actualProviders = matchedProviders;
            } else if (!includesPirate) {
              actualProviders = [];
            }
          }
        } catch (err) {
          console.error(`Error with append_to_response details query for movie ${item.id}:`, err);
        }
      }

      const fallbackTrailer = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + " " + releaseYear + " trailer NL")}`;
      const trailerUrl = fetchedTrailerUrl || fallbackTrailer;

      // Fetch IMDb rating if available and fallback to TMDB automatically if limit 1000/day is reached
      let finalRating = Number((item.vote_average || 0).toFixed(1));
      let ratingSource = "TMDB";

      if (imdbId) {
        const omdbResult = await getOmdbRating(imdbId);
        if (omdbResult) {
          finalRating = omdbResult.rating;
          ratingSource = omdbResult.source;
        }
      }

      return {
        id: String(item.id),
        title: item.title,
        year: releaseYear,
        rating: finalRating,
        genres: itemGenres.length > 0 ? itemGenres : ["Film"],
        synopsis: synopsis,
        providers: actualProviders,
        backdrop: backdropUrl,
        trailerUrl,
        language: languageName,
        ratingSource,
      };
    });

    const allFormattedMovies = await Promise.all(promises);
    const formattedMovies = includesPirate ? allFormattedMovies : allFormattedMovies.filter(m => m.providers.length > 0);

    // Apply strict final-rating (IMDb or TMDB fallback score) selection
    let filteredMovies = formattedMovies;
    if (minRating !== undefined && minRating > 0) {
      filteredMovies = filteredMovies.filter(m => m.rating >= minRating);
    }
    if (maxRating !== undefined && maxRating > 0) {
      filteredMovies = filteredMovies.filter(m => m.rating <= maxRating);
    }

    // Keep up to 20 final movies for the curated swipe deck
    const finalMovies = filteredMovies.slice(0, 20);

    // Fall back to original formatted movies if strict filters left too few elements
    const moviesToReturn = finalMovies.length >= 5 ? finalMovies : formattedMovies.slice(0, 20);

    const responsePayload = { source: "TMDB", movies: moviesToReturn, fallbackLevel: activeFallbackLevel };

    return res.json(responsePayload);
  } catch (error: any) {
    console.error("Movie curation error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while curating movies." });
  }
});

// API Endpoint to fetch recommendations based on swiped matches
app.post("/api/recommendations", movieLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { movieIds, seedMovies, country, providers, ageRating } = body as {
      movieIds?: string[];
      seedMovies?: Array<{ id: string; title: string }>;
      country?: string;
      providers?: string[];
      ageRating?: boolean;
    };

    if (!Array.isArray(movieIds) || movieIds.length === 0) {
      return res.status(400).json({ error: "Geen gematchte of bewaarde films opgegeven om aanbevelingen op te baseren." });
    }

    const seedMovieTitlesMap: Record<string, string> = {};
    if (Array.isArray(seedMovies)) {
      seedMovies.forEach(m => {
        if (m && m.id) {
          seedMovieTitlesMap[String(m.id)] = m.title;
        }
      });
    }

    const minRuntime = typeof body.minRuntime === "number" ? body.minRuntime : undefined;
    const maxRuntime = typeof body.maxRuntime === "number" ? body.maxRuntime : typeof body.maxRuntime === "string" ? parseInt(body.maxRuntime) : undefined;
    const minRating = typeof body.minRating === "number" ? body.minRating : typeof body.minRating === "string" ? parseFloat(body.minRating) : undefined;
    const maxRating = typeof body.maxRating === "number" ? body.maxRating : typeof body.maxRating === "string" ? parseFloat(body.maxRating) : undefined;
    const minYear = typeof body.minYear === "number" ? body.minYear : typeof body.minYear === "string" ? parseInt(body.minYear) : undefined;
    const maxYear = typeof body.maxYear === "number" ? body.maxYear : typeof body.maxYear === "string" ? parseInt(body.maxYear) : undefined;
    const releaseDecade = body.releaseDecade;
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds.map((id: any) => String(id)) : [];
    
    const sourceMovieIdsSet = new Set(movieIds.map(id => String(id)));

    const selectedProviders: string[] = providers || ["netflix"];
    const includesPirate = selectedProviders.includes("pirate");
    const selectedCountry = country || "NL";

    const serverTmdbKey = process.env.TMDB_API_KEY;
    if (!serverTmdbKey || serverTmdbKey.trim().length === 0) {
      return res.status(500).json({ error: "TMDB API Key is niet geconfigureerd op de server." });
    }
    const tmdbKey = serverTmdbKey.trim();

    // Limit to last 5 matched movies to focus recommendations on recent tastes
    const targetMovieIds = movieIds.map(String).slice(-5);

    // Fetch recommendations for each reference movie in parallel
    const fetchRecommendationsForMovie = async (id: string): Promise<TMDBItem[]> => {
      try {
        const url = `https://api.themoviedb.org/3/movie/${id}/recommendations?api_key=${tmdbKey}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json() as TMDBResponse;
          if (data.results && data.results.length > 0) {
            return data.results;
          }
        }
      } catch (err) {
        console.error(`Error querying recommendations for TMDB movie ${id}:`, err);
      }
      
      // Fallback to similar
      try {
        const url = `https://api.themoviedb.org/3/movie/${id}/similar?api_key=${tmdbKey}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json() as TMDBResponse;
          return data.results || [];
        }
      } catch (err) {
        console.error(`Error querying similar for TMDB movie ${id}:`, err);
      }
      return [];
    };

    const resultsArrays = await Promise.all(targetMovieIds.map(fetchRecommendationsForMovie));

    // Simple but clever co-occurrence matching with tracking of which seed movie triggered it
    const coCounts: Record<number, number> = {};
    const itemsMap: Record<number, TMDBItem> = {};
    const recommendSourcesMap: Record<number, Set<string>> = {};

    for (let idx = 0; idx < resultsArrays.length; idx++) {
      const seedId = targetMovieIds[idx];
      const arr = resultsArrays[idx];
      if (!arr) continue;

      for (const item of arr) {
        if (item && item.id) {
          const idStr = String(item.id);
          // Strictly exclude the seed movies and movies already swiped
          if (!sourceMovieIdsSet.has(idStr) && !excludeIds.includes(idStr)) {
            coCounts[item.id] = (coCounts[item.id] || 0) + 1;
            itemsMap[item.id] = item;

            if (!recommendSourcesMap[item.id]) {
              recommendSourcesMap[item.id] = new Set<string>();
            }
            recommendSourcesMap[item.id].add(seedId);
          }
        }
      }
    }

    const candidateIds = Object.keys(coCounts).map(Number);
    if (candidateIds.length === 0) {
      return res.json({ source: "TMDB_RECOMMENDATIONS", movies: [] });
    }

    // Sort by co-recommendation count, and then popularity on TMDB
    candidateIds.sort((a, b) => {
      const countDiff = coCounts[b] - coCounts[a];
      if (countDiff !== 0) return countDiff;
      return (itemsMap[b].vote_average || 0) - (itemsMap[a].vote_average || 0);
    });

    // Take the top 45 highly correlated recommendation candidates
    const topCandidates = candidateIds.slice(0, 45).map(id => itemsMap[id]);

    // Perform a Fisher-Yates shuffle to randomize the movie deck order and choice selection
    for (let i = topCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]];
    }

    // Capture the top 30 elements to fetch details for and display
    const items = topCandidates.slice(0, 30);

    const genreNamesMap: Record<number, string> = {
      28: "Actie", 12: "Avontuur", 16: "Animatie", 35: "Komedie", 80: "Misdaad",
      99: "Documentaire", 18: "Drama", 10751: "Familie", 14: "Fantasie", 36: "Geschiedenis",
      27: "Horror", 10402: "Muziek", 9648: "Mysterie", 10749: "Romantiek", 878: "Sci-Fi",
      10770: "TV-Film", 53: "Thriller", 10752: "Oorlog", 37: "Western"
    };

    // Parallel extraction of detailed metadata (provider filtering, trailer links, IMDb integration)
    const promises = items.map(async (item) => {
      const itemGenres = (item.genre_ids || [])
        .map(id => genreNamesMap[id])
        .filter((g): g is string => g !== undefined);

      const backdropUrl = item.backdrop_path 
        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=60";

      const synopsis = item.overview || "Geen beschrijving beschikbaar.";
      const releaseYear = item.release_date ? item.release_date.split("-")[0] : "2026";
      const originalLang = item.original_language || "en";
      const languageName = LANGUAGE_MAP[originalLang] || originalLang.toUpperCase();

      let actualProviders: string[] = selectedProviders;
      let fetchedTrailerUrl: string | undefined = undefined;
      let imdbId: string | undefined = undefined;

      const detailsCacheKey = `tmdb_details_${item.id}`;
      const cachedDetails = movieCache.get<CachedMovieDetails>(detailsCacheKey);

      if (cachedDetails) {
        imdbId = cachedDetails.imdbId;
        fetchedTrailerUrl = cachedDetails.fetchedTrailerUrl;
        const matchedProviders = selectedProviders.filter(p => {
          if (p === "pirate") return true;
          const matchId = PROVIDER_MAP[p];
          return cachedDetails.offeredProviderIds.includes(matchId);
        });
        if (matchedProviders.length > 0) {
          actualProviders = matchedProviders;
        } else if (!includesPirate) {
          actualProviders = [];
        }
      } else {
        try {
          const detailsRes = await fetch(
            `https://api.themoviedb.org/3/movie/${item.id}?api_key=${tmdbKey}&append_to_response=watch/providers,videos,external_ids`
          );
          if (detailsRes.ok) {
            const details = await detailsRes.json() as any;
            imdbId = details.imdb_id || details.external_ids?.imdb_id || undefined;

            const videos = details.videos?.results || [];
            const trailer = videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || 
                            videos.find((v: any) => v.site === "YouTube" && v.type === "Teaser") ||
                            videos.find((v: any) => v.site === "YouTube");
            if (trailer?.key) {
              fetchedTrailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
            }

            const providerResults = details["watch/providers"]?.results || {};
            const offeredProviderIds: number[] = [];
            const targetRegions = [selectedCountry, "NL", "US"];
            for (const region of targetRegions) {
              const regionData = providerResults[region] || {};
              const flatrate = regionData.flatrate || [];
              const rent = regionData.rent || [];
              const buy = regionData.buy || [];
              const free = regionData.free || [];
              const ads = regionData.ads || [];
              const combined = [...flatrate, ...rent, ...buy, ...free, ...ads];
              for (const p of combined) {
                if (p.provider_id && !offeredProviderIds.includes(p.provider_id)) {
                  offeredProviderIds.push(p.provider_id);
                }
              }
            }

            movieCache.set(detailsCacheKey, {
              imdbId,
              fetchedTrailerUrl,
              offeredProviderIds
            });

            const matchedProviders = selectedProviders.filter(p => {
              if (p === "pirate") return true;
              const matchId = PROVIDER_MAP[p];
              return offeredProviderIds.includes(matchId);
            });
            if (matchedProviders.length > 0) {
              actualProviders = matchedProviders;
            } else if (!includesPirate) {
              actualProviders = [];
            }
          }
        } catch (err) {
          console.error(`Error querying detail extensions for recommended movie ${item.id}:`, err);
        }
      }

      const fallbackTrailer = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + " " + releaseYear + " trailer NL")}`;
      const trailerUrl = fetchedTrailerUrl || fallbackTrailer;

      const finalRating = Number((item.vote_average || 0).toFixed(1));
      const ratingSource = "TMDB";

      const seedIdsForThisItem = Array.from(recommendSourcesMap[item.id] || []);
      const recommendedFromTitles = seedIdsForThisItem
        .map(sid => seedMovieTitlesMap[sid] || "")
        .filter(title => title.length > 0);

      return {
        id: String(item.id),
        title: item.title,
        year: releaseYear,
        rating: finalRating,
        genres: itemGenres.length > 0 ? itemGenres : ["Film"],
        synopsis: synopsis,
        providers: actualProviders,
        backdrop: backdropUrl,
        trailerUrl,
        language: languageName,
        ratingSource,
        recommendedFrom: recommendedFromTitles,
        imdbId,
      };
    });

    const allFormattedMovies = await Promise.all(promises);
    const formattedMovies = includesPirate ? allFormattedMovies : allFormattedMovies.filter(m => m.providers.length > 0);

    // Filter by year & decade first on all candidate movies
    let filteredMovies = formattedMovies;
    if (minYear !== undefined && minYear > 0) {
      filteredMovies = filteredMovies.filter(m => {
        const yr = parseInt(m.year);
        return isNaN(yr) || yr >= minYear;
      });
    }
    if (maxYear !== undefined && maxYear > 0) {
      filteredMovies = filteredMovies.filter(m => {
        const yr = parseInt(m.year);
        return isNaN(yr) || yr <= maxYear;
      });
    } else if (releaseDecade && releaseDecade !== "all") {
      const decadeNum = parseInt(releaseDecade);
      if (!isNaN(decadeNum)) {
        filteredMovies = filteredMovies.filter(m => {
          const yr = parseInt(m.year);
          return isNaN(yr) || (yr >= decadeNum && yr <= decadeNum + 9);
        });
      }
    }

    // Select the final movies (at most 20) before fetching OMDb ratings.
    // If filtering left us with less than 3 movies, fallback to unfiltered formattedMovies list.
    const chosenMoviesSource = filteredMovies.length >= 3 ? filteredMovies : formattedMovies;
    const finalSelectionCandidates = chosenMoviesSource.slice(0, 20);

    // ONLY fetch OMDb ratings for these selected final movies (at most 20)
    const enrichedMovies = await Promise.all(finalSelectionCandidates.map(async (m) => {
      if (m.imdbId) {
        const omdbResult = await getOmdbRating(m.imdbId);
        if (omdbResult) {
          return {
            ...m,
            rating: omdbResult.rating,
            ratingSource: omdbResult.source
          };
        }
      }
      return m;
    }));

    // Clean up temporary internal field so we don't return it
    const cleanedMovies = enrichedMovies.map(({ imdbId, ...rest }) => rest);

    // Now apply rating filters if set, as ratings are now properly fetched from OMDb
    let finalMovies = cleanedMovies;
    if (minRating !== undefined && minRating > 0) {
      finalMovies = finalMovies.filter(m => m.rating >= minRating);
    }
    if (maxRating !== undefined && maxRating > 0) {
      finalMovies = finalMovies.filter(m => m.rating <= maxRating);
    }

    const moviesToReturn = finalMovies.length >= 3 ? finalMovies : cleanedMovies;

    return res.json({ source: "TMDB_RECOMMENDATIONS", movies: moviesToReturn });
  } catch (error: any) {
    console.error("Movie recommendations curation error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while curating recommended movies." });
  }
});

// Serve frontend with Vite middleware
const bootstrap = async () => {
  const tmdbKeyExists = !!process.env.TMDB_API_KEY;
  const omdbKeyExists = !!process.env.OMDB_API_KEY;
  console.log(`[CONFIG DIAGNOSTICS] TMDB_API_KEY provided: ${tmdbKeyExists ? "YES" : "NO"} (${tmdbKeyExists ? process.env.TMDB_API_KEY!.substring(0, 3) + "..." : "none"})`);
  console.log(`[CONFIG DIAGNOSTICS] OMDB_API_KEY provided: ${omdbKeyExists ? "YES" : "NO"} (${omdbKeyExists ? process.env.OMDB_API_KEY!.substring(0, 3) + "..." : "none"})`);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://0.0.0.0:${PORT}`);
  });
};

bootstrap();
