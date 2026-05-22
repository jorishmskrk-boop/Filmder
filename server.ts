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

const generateCacheKey = (body: any): string => {
  const providersPart = Array.isArray(body.providers) ? [...body.providers].sort().join(",") : "";
  return `movies_${body.country || "NL"}_${providersPart}_${body.vibe || ""}_${body.minRuntime || ""}_${body.maxRuntime || ""}_${body.minRating || ""}_${body.maxRating || ""}_${body.minYear || ""}_${body.maxYear || ""}_${body.releaseDecade || ""}_${body.ageRating || ""}`;
};

// Helper function to fetch IMDb rating from OMDb API with automatic limits fallback to TMDB
async function getOmdbRating(imdbId: string | undefined): Promise<{ rating: number; source: string } | undefined> {
  const omdbKey = process.env.OMDB_API_KEY;
  if (!imdbId || !omdbKey || !omdbKey.trim()) return undefined;

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
          return { rating: parsedRating, source: "IMDb" };
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
    const cacheKey = generateCacheKey(body);
    const cachedResponse = movieCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[CACHE HIT] Returning cached movie stack for key: ${cacheKey}`);
      return res.json(cachedResponse);
    }

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

    // Choose a random curation strategy to yield highly dynamic lists (9 plans)
    const curationPlan = Math.floor(Math.random() * 9);
    let page1 = Math.floor(Math.random() * 10) + 1;
    let page2 = page1 + 1;
    let customParams = "";
    let sortParam = "popularity.desc";

    // Set curation strategy sort codes
    switch (curationPlan) {
      case 0:
        sortParam = "popularity.desc";
        page1 = Math.floor(Math.random() * 5) + 1;
        page2 = page1 + 1;
        break;
      case 1:
        sortParam = "vote_average.desc";
        customParams = "&vote_count.gte=250";
        page1 = Math.floor(Math.random() * 8) + 1;
        page2 = page1 + 1;
        break;
      case 2:
        sortParam = "popularity.desc";
        const currentYear = new Date().getFullYear();
        customParams = `&primary_release_date.gte=2015-01-01&primary_release_date.lte=${currentYear}-12-31`;
        page1 = Math.floor(Math.random() * 12) + 1;
        page2 = page1 + 1;
        break;
      case 3:
        sortParam = "popularity.desc";
        customParams = "&primary_release_date.gte=1980-01-01&primary_release_date.lte=2012-12-31&vote_average.gte=6.5";
        page1 = Math.floor(Math.random() * 10) + 1;
        page2 = page1 + 1;
        break;
      case 4:
        sortParam = "popularity.desc";
        customParams = "&vote_count.gte=100&vote_count.lte=3000&vote_average.gte=7.1";
        page1 = Math.floor(Math.random() * 8) + 1;
        page2 = page1 + 1;
        break;
      case 5:
        sortParam = "popularity.desc";
        customParams = "&primary_release_date.gte=2000-01-01&vote_average.gte=6.3";
        page1 = Math.floor(Math.random() * 6) + 1;
        page2 = page1 + 1;
        break;
      case 6:
        sortParam = "popularity.desc";
        customParams = "&with_genres=878,53,9648&vote_average.gte=6.8";
        page1 = Math.floor(Math.random() * 5) + 1;
        page2 = page1 + 1;
        break;
      case 7:
        sortParam = "popularity.desc";
        customParams = "&with_genres=35,10749,16,12&vote_average.gte=6.5";
        page1 = Math.floor(Math.random() * 6) + 1;
        page2 = page1 + 1;
        break;
      case 8:
        sortParam = "vote_average.desc";
        customParams = "&primary_release_date.gte=1950-01-01&primary_release_date.lte=1989-12-31&vote_count.gte=150&vote_average.gte=7.4";
        page1 = Math.floor(Math.random() * 4) + 1;
        page2 = page1 + 1;
        break;
    }

    // Function to append active range and year filters to customParams safely
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
      if (ageRating) {
        resStr += `&certification_country=NL&certification.lte=9`;
      }
      return resStr;
    };

    // Apply modular background filters specified in req.body
    customParams = appendUserFilters(customParams);

    const genresString = selectedVibe.trim() ? selectedVibe.trim().replace(/,/g, "|") : "";

    let rawResults: TMDBItem[] = [];
    let fallbackLevel = 0;
    let activeFallbackLevel = 0;

    // Use a multi-tier fallback system to avoid zero-results crashes if filters are too restrictive or randomized page is out of range
    while (rawResults.length < 5 && fallbackLevel <= 4) {
      let activePage1 = page1;
      let activePage2 = page2;
      let activeCustomParams = customParams;
      let activeSortParam = sortParam;
      let activeGenresString = genresString;
      let activeProviderIdString = providerIdString;

      if (fallbackLevel === 1) {
        // Fallback Tier 1: Reset randomized page range back to page 1 & 2 (solving page-overflow issues)
        activePage1 = 1;
        activePage2 = 2;
      } else if (fallbackLevel === 2) {
        // Fallback Tier 2: Completely neutralize restrictive curation plan filters, keeping user filters only
        activePage1 = 1;
        activePage2 = 2;
        activeSortParam = "popularity.desc";
        activeCustomParams = appendUserFilters(""); // Wipe random curation limits but keep user filters
      } else if (fallbackLevel === 3) {
        // Fallback Tier 3: Neutralize advanced custom ratings, runtime ceilings, release decade boundaries, and genres limit
        activePage1 = 1;
        activePage2 = 2;
        activeSortParam = "popularity.desc";
        activeCustomParams = "";
        activeGenresString = "";
      } else if (fallbackLevel === 4) {
        // Fallback Tier 4: Universal backup, ignore watch providers restriction completely to guarantee we fetch something
        activePage1 = 1;
        activePage2 = 2;
        activeSortParam = "popularity.desc";
        activeCustomParams = "";
        activeGenresString = "";
        activeProviderIdString = "";
      }

      let discoverUrlPage1 = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${activeSortParam}&page=${activePage1}${activeCustomParams}`;
      let discoverUrlPage2 = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${activeSortParam}&page=${activePage2}${activeCustomParams}`;

      if (activeProviderIdString) {
        discoverUrlPage1 += `&with_watch_providers=${activeProviderIdString}`;
        discoverUrlPage2 += `&with_watch_providers=${activeProviderIdString}`;
      }
      if (activeGenresString) {
        discoverUrlPage1 += `&with_genres=${activeGenresString}`;
        discoverUrlPage2 += `&with_genres=${activeGenresString}`;
      }

      try {
        const [response1, response2] = await Promise.all([
          fetch(discoverUrlPage1).catch(() => null),
          fetch(discoverUrlPage2).catch(() => null)
        ]);

        let levelResults: TMDBItem[] = [];
        if (response1?.ok) {
          const data1 = await response1.json() as TMDBResponse;
          levelResults = levelResults.concat(data1.results || []);
        }
        if (response2?.ok) {
          const data2 = await response2.json() as TMDBResponse;
          levelResults = levelResults.concat(data2.results || []);
        }

        if (levelResults.length > 0) {
          // De-duplicate items by TMDB ID
          const seenIds = new Set<number>();
          rawResults = levelResults.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
          if (rawResults.length >= 5) {
            activeFallbackLevel = fallbackLevel;
          }
        }
      } catch (err) {
        console.error(`Error in movie fetching retry fallback level ${fallbackLevel}:`, err);
      }

      fallbackLevel++;
    }

    // Fisher-Yates shuffle the consolidated array to randomize the deck every single session
    for (let i = rawResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawResults[i], rawResults[j]] = [rawResults[j], rawResults[i]];
    }

    // Use a slightly larger pool of candidates so we can satisfy strict IMDb rating filters and still build a 20-movie deck
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

      try {
        // Fetch details in a single query with watch/providers, videos, and external_ids appended
        const detailsRes = await fetch(
          `https://api.themoviedb.org/3/movie/${item.id}?api_key=${tmdbKey}&append_to_response=watch/providers,videos,external_ids`
        );
        if (detailsRes.ok) {
          const details = await detailsRes.json() as {
            external_ids?: { imdb_id?: string };
            videos?: { results?: { site?: string; type?: string; key?: string }[] };
            "watch/providers"?: { results?: Record<string, { flatrate?: { provider_id: number }[]; rent?: { provider_id: number }[]; buy?: { provider_id: number }[]; free?: { provider_id: number }[]; ads?: { provider_id: number }[] }> };
          };

          // 1. Resolve IMDb ID
          imdbId = details.external_ids?.imdb_id || undefined;

          // 2. Resolve YouTube Trailer URL
          const videos = details.videos?.results || [];
          const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") || 
                          videos.find(v => v.site === "YouTube" && v.type === "Teaser") ||
                          videos.find(v => v.site === "YouTube");
          if (trailer?.key) {
            fetchedTrailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
          }

          // 3. Resolve watch providers
          const providerResults = details["watch/providers"]?.results || {};
          const regionData = providerResults[selectedCountry] || providerResults["NL"] || providerResults["US"] || {};
          
          const flatrate = regionData.flatrate || [];
          const rent = regionData.rent || [];
          const buy = regionData.buy || [];
          const free = regionData.free || [];
          const ads = regionData.ads || [];
          
          const allProviders = [...flatrate, ...rent, ...buy, ...free, ...ads];
          const offeredProviderIds = allProviders.map(p => p.provider_id);
          
          const matchedProviders = selectedProviders.filter(p => {
            if (p === "pirate") return true;
            const matchId = PROVIDER_MAP[p];
            return offeredProviderIds.includes(matchId);
          });
          
          if (matchedProviders.length > 0) {
            actualProviders = matchedProviders;
          }
        }
      } catch (err) {
        console.error(`Error with append_to_response details query for movie ${item.id}:`, err);
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

    const formattedMovies = await Promise.all(promises);

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
    movieCache.set(cacheKey, responsePayload);

    return res.json(responsePayload);
  } catch (error: any) {
    console.error("Movie curation error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while curating movies." });
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
