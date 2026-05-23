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

    // Choose a random curation strategy to yield highly dynamic lists (9 plans)
    const sortOptions = ["popularity.desc", "revenue.desc", "vote_average.desc", "vote_count.desc", "primary_release_date.desc"];
    let sortParam = sortOptions[Math.floor(Math.random() * sortOptions.length)];
    
    // To drastically maximize results entropy and rotate movies on pages 1/2, 
    // we stagger the minimum vote counts randomly (ranging from 120 up to 750) list by list.
    const randomVoteCounts = [120, 180, 250, 350, 500, 750];
    const voteMin = randomVoteCounts[Math.floor(Math.random() * randomVoteCounts.length)];
    let customParams = `&vote_count.gte=${voteMin}`;
    let maxPageTarget = 40; // Max page depth we want to target for discovery

    const curationPlan = Math.floor(Math.random() * 9);

    // Set curation strategy sort codes and target page range limits
    switch (curationPlan) {
      case 0:
        sortParam = Math.random() > 0.5 ? "popularity.desc" : "revenue.desc";
        maxPageTarget = 45;
        break;
      case 1:
        sortParam = "vote_average.desc";
        customParams = `&vote_count.gte=${Math.max(voteMin, 400)}`; // Higher rating threshold requires a stronger vote count
        maxPageTarget = 35;
        break;
      case 2:
        const currentYear = new Date().getFullYear();
        customParams += `&primary_release_date.gte=2015-01-01&primary_release_date.lte=${currentYear}-12-31`;
        maxPageTarget = 55;
        break;
      case 3:
        sortParam = "popularity.desc";
        customParams += "&primary_release_date.gte=1980-01-01&primary_release_date.lte=2015-12-31";
        maxPageTarget = 45;
        break;
      case 4:
        sortParam = "vote_count.desc";
        customParams += `&vote_count.gte=${Math.max(voteMin, 200)}&vote_count.lte=2500`;
        maxPageTarget = 35;
        break;
      case 5:
        sortParam = "popularity.desc";
        customParams += "&primary_release_date.gte=1995-01-01";
        maxPageTarget = 40;
        break;
      case 6:
        customParams += "&with_genres=878,53,9648";
        maxPageTarget = 35;
        break;
      case 7:
        customParams += "&with_genres=35,10749,16,12";
        maxPageTarget = 40;
        break;
      case 8:
        sortParam = "vote_average.desc";
        customParams += `&primary_release_date.gte=1950-01-01&primary_release_date.lte=1989-12-31&vote_count.gte=${Math.max(voteMin, 200)}`;
        maxPageTarget = 20;
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
      
      const hasUserYearFilter = (minYear !== undefined && minYear > 0) || (maxYear !== undefined && maxYear > 0) || (releaseDecade && releaseDecade !== "all");

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
      } else {
        // Broad parametric era randomization (60% likelihood) to fetch and group extremely different movies!
        if (Math.random() < 0.6) {
          const currentYear = new Date().getFullYear();
          const periods = [
            { gte: "2020-01-01", lte: `${currentYear}-12-31` }, // Modern
            { gte: "2013-01-01", lte: "2019-12-31" },          // High-definition tens
            { gte: "2005-01-01", lte: "2012-12-31" },          // Early LCD era
            { gte: "1997-01-01", lte: "2004-12-31" },          // Millennial movies
            { gte: "1990-01-01", lte: "1996-12-31" },          // Nineties peak
            { gte: "1980-01-01", lte: "1989-12-31" },          // Golden Eighties
            { gte: "1960-01-01", lte: "1979-12-31" }           // Retro and classic cinema
          ];
          const chosenPeriod = periods[Math.floor(Math.random() * periods.length)];
          resStr += `&primary_release_date.gte=${chosenPeriod.gte}&primary_release_date.lte=${chosenPeriod.lte}`;
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
    let probedPage1Results: TMDBItem[] = [];
    let probedTotalPages = 1;

    // Use a multi-tier fallback system to avoid zero-results crashes if filters are too restrictive
    while (rawResults.length < 5 && fallbackLevel <= 4) {
      let activeCustomParams = customParams;
      let activeSortParam = sortParam;
      let activeGenresString = genresString;
      let activeProviderIdString = providerIdString;
      let safeMaxPage = 1;

      if (fallbackLevel === 0) {
        // Fallback Tier 0 (Default): Use our safe, dynamically calculated randomized page offsets!
        // We probe Page 1 of this exact configuration to find out the safe total_pages bounds.
        const baseQueryPart = `&watch_region=${selectedCountry}&sort_by=${activeSortParam}${activeCustomParams}` +
          (activeProviderIdString ? `&with_watch_providers=${activeProviderIdString}` : "") +
          (activeGenresString ? `&with_genres=${activeGenresString}` : "");

        probedTotalPages = 1;
        probedPage1Results = [];
        try {
          const probeUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&page=1${baseQueryPart}`;
          const probeRes = await fetch(probeUrl);
          if (probeRes.ok) {
            const probeData = await probeRes.json() as TMDBResponse;
            probedTotalPages = probeData.total_pages || 1;
            probedPage1Results = probeData.results || [];
          }
        } catch (e) {
          console.error("Error probing TMDB page count:", e);
        }

        if (activeProviderIdString) {
          // Keep it highly dense to ensure results exist under watch provider filters
          safeMaxPage = Math.min(probedTotalPages, 5);
        } else {
          // Without provider restrictions we can go slightly deeper safely
          safeMaxPage = Math.min(probedTotalPages, 12);
        }
      } else if (fallbackLevel === 1) {
        // Fallback Tier 1: Try a safe, guaranteed range of pages
        const maxLimit = activeProviderIdString ? 6 : 15;
        safeMaxPage = Math.min(probedTotalPages || 1, maxLimit);
      } else if (fallbackLevel === 2) {
        // Fallback Tier 2: Completely neutralize restrictive curation plan filters, keeping user filters only
        const maxLimit = activeProviderIdString ? 8 : 20;
        safeMaxPage = Math.min(probedTotalPages || 1, maxLimit);
        activeSortParam = "popularity.desc";
        activeCustomParams = appendUserFilters(""); // Wipe random curation limits but keep user filters
      } else if (fallbackLevel === 3) {
        // Fallback Tier 3: Neutralize advanced custom ratings, runtime ceilings, release decade boundaries
        safeMaxPage = 12;
        activeSortParam = "popularity.desc";
        activeCustomParams = "";
        activeGenresString = "";
      } else if (fallbackLevel === 4) {
        // Fallback Tier 4: Universal backup, ignore watch providers restriction completely to guarantee we fetch something
        safeMaxPage = 20;
        activeSortParam = "popularity.desc";
        activeCustomParams = "";
        activeGenresString = "";
        activeProviderIdString = "";
      }

      if (safeMaxPage < 1) safeMaxPage = 1;

      // Select up to 3 distinct random page numbers for maximum diversity!
      const pageSet = new Set<number>();
      let selectionAttempts = 0;
      const targetPagesCount = Math.min(safeMaxPage, 3);
      while (pageSet.size < targetPagesCount && selectionAttempts < 15) {
        selectionAttempts++;
        const p = Math.floor(Math.random() * safeMaxPage) + 1;
        pageSet.add(p);
      }
      const pagesToFetch = Array.from(pageSet);

      try {
        let levelResults: TMDBItem[] = [];

        // Build URLs for all selected pages and run in parallel
        const fetchPromises = pagesToFetch.map(async (pageStrNumber) => {
          // Re-use probed cached Page 1 if possible
          if (fallbackLevel === 0 && pageStrNumber === 1 && typeof probedPage1Results !== "undefined" && probedPage1Results.length > 0) {
            return probedPage1Results;
          }

          let pageUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${activeSortParam}&page=${pageStrNumber}${activeCustomParams}`;
          if (activeProviderIdString) {
            pageUrl += `&with_watch_providers=${activeProviderIdString}`;
          }
          if (activeGenresString) {
            pageUrl += `&with_genres=${activeGenresString}`;
          }

          try {
            const pageRes = await fetch(pageUrl);
            if (pageRes.ok) {
              const data = await pageRes.json() as TMDBResponse;
              return data.results || [];
            }
          } catch (err) {
            console.error(`Error fetching page ${pageStrNumber} in fallbackLevel ${fallbackLevel}:`, err);
          }
          return [];
        });

        const resultsArrays = await Promise.all(fetchPromises);
        resultsArrays.forEach(arr => {
          levelResults = levelResults.concat(arr);
        });

        // Bisection fallback if all random pages turned up empty (highly possible under restrictive watch filters for deep pages)
        if (levelResults.length === 0 && pagesToFetch.some(p => p > 1)) {
          let bisectionUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${activeSortParam}&page=1${activeCustomParams}`;
          if (activeProviderIdString) {
            bisectionUrl += `&with_watch_providers=${activeProviderIdString}`;
          }
          if (activeGenresString) {
            bisectionUrl += `&with_genres=${activeGenresString}`;
          }
          const bRes = await fetch(bisectionUrl).catch(() => null);
          if (bRes?.ok) {
            const bData = await bRes.json() as TMDBResponse;
            levelResults = bData.results || [];
          }
        }

        if (levelResults.length > 0) {
          // De-duplicate items by TMDB ID AND filter out already excluded / swiped movies!
          const seenIds = new Set<number>();
          rawResults = levelResults.filter(item => {
            const idStr = String(item.id);
            if (seenIds.has(item.id)) return false;
            if (excludeIds.includes(idStr)) return false;
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
        }
      } else {
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
