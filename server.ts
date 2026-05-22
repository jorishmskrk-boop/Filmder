import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

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

// Helper function to fetch the actual streaming providers where a movie is currently available in a region
async function getActualProvidersForMovie(
  movieId: string,
  tmdbKey: string,
  country: string,
  selectedProviders: string[]
): Promise<string[]> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${tmdbKey}`);
    if (!res.ok) return selectedProviders;
    
    const data = await res.json() as { results?: Record<string, { flatrate?: { provider_id: number }[]; rent?: { provider_id: number }[]; buy?: { provider_id: number }[]; free?: { provider_id: number }[]; ads?: { provider_id: number }[] }> };
    const regionData = data.results?.[country] || data.results?.["NL"] || data.results?.["US"] || {};
    
    const flatrate = regionData.flatrate || [];
    const rent = regionData.rent || [];
    const buy = regionData.buy || [];
    const free = regionData.free || [];
    const ads = regionData.ads || [];
    
    const allProviders = [...flatrate, ...rent, ...buy, ...free, ...ads];
    const offeredProviderIds = allProviders.map(p => p.provider_id);
    
    const actual = selectedProviders.filter(p => {
      if (p === "pirate") return true;
      const matchId = PROVIDER_MAP[p];
      return offeredProviderIds.includes(matchId);
    });
    
    if (actual.length > 0) {
      return actual;
    }
  } catch (err) {
    console.error(`Error querying watch providers for movie ${movieId}:`, err);
  }
  return selectedProviders; // default fallback if none found
}

// Helper function to query TMDB for YouTube trailers
async function getTrailerUrlForMovie(movieId: string, tmdbKey: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${tmdbKey}`);
    if (!res.ok) return undefined;
    const data = await res.json() as { results?: { site?: string; type?: string; key?: string }[] };
    const videos = data.results || [];
    // Search for YouTube videos with type 'Trailer' first, or any YouTube video as placeholder
    const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") || 
                    videos.find(v => v.site === "YouTube" && v.type === "Teaser") ||
                    videos.find(v => v.site === "YouTube");
    if (trailer?.key) {
      return `https://www.youtube.com/watch?v=${trailer.key}`;
    }
  } catch (err) {
    console.error(`Error querying trailer for movie ${movieId}:`, err);
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
        resStr += `&vote_average.gte=${minRating}`;
      }
      if (maxRating !== undefined && maxRating > 0) {
        resStr += `&vote_average.lte=${maxRating}`;
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

    // Slice the first 20 randomized movie items
    const items = rawResults.slice(0, 20);

    // Map TMDB genres to Dutch
    const genreNamesMap: Record<number, string> = {
      28: "Actie", 12: "Avontuur", 16: "Animatie", 35: "Komedie", 80: "Misdaad",
      99: "Documentaire", 18: "Drama", 10751: "Familie", 14: "Fantasie", 36: "Geschiedenis",
      27: "Horror", 10402: "Muziek", 9648: "Mysterie", 10749: "Romantiek", 878: "Sci-Fi",
      10770: "TV-Film", 53: "Thriller", 10752: "Oorlog", 37: "Western"
    };

    // Build formatted items and fetch actual streaming providers in parallel
    const promises = items.map(async (item) => {
      const itemGenres = (item.genre_ids || [])
        .map(id => genreNamesMap[id])
        .filter((g): g is string => g !== undefined);

      const backdropUrl = item.backdrop_path 
        ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
        : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=60";

      // Removed manual synopsis truncation of 150 characters as requested
      const synopsis = item.overview || "Geen beschrijving beschikbaar.";

      const [actualProviders, fetchedTrailerUrl] = await Promise.all([
        getActualProvidersForMovie(String(item.id), tmdbKey, selectedCountry, selectedProviders),
        getTrailerUrlForMovie(String(item.id), tmdbKey).catch(() => undefined)
      ]);

      const releaseYear = item.release_date ? item.release_date.split("-")[0] : "2026";
      const fallbackTrailer = `https://www.youtube.com/results?search_query=${encodeURIComponent(item.title + " " + releaseYear + " trailer NL")}`;
      const trailerUrl = fetchedTrailerUrl || fallbackTrailer;

      const originalLang = item.original_language || "en";
      const languageName = LANGUAGE_MAP[originalLang] || originalLang.toUpperCase();

      return {
        id: String(item.id),
        title: item.title,
        year: releaseYear,
        rating: Number((item.vote_average || 0).toFixed(1)),
        genres: itemGenres.length > 0 ? itemGenres : ["Film"],
        synopsis: synopsis,
        providers: actualProviders,
        backdrop: backdropUrl,
        trailerUrl,
        language: languageName,
      };
    });

    const formattedMovies = await Promise.all(promises);
    return res.json({ source: "TMDB", movies: formattedMovies });
  } catch (error: any) {
    console.error("Movie curation error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while curating movies." });
  }
});

// Serve frontend with Vite middleware
const bootstrap = async () => {
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
