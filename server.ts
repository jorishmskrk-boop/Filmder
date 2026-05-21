import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment variables");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

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
    
    const data = await res.json();
    const regionData = data.results?.[country] || data.results?.["NL"] || data.results?.["US"] || {};
    
    const flatrate = regionData.flatrate || [];
    const rent = regionData.rent || [];
    const buy = regionData.buy || [];
    const free = regionData.free || [];
    const ads = regionData.ads || [];
    
    const allProviders = [...flatrate, ...rent, ...buy, ...free, ...ads];
    const offeredProviderIds = allProviders.map((p: any) => p.provider_id);
    
    const actual = selectedProviders.filter(p => {
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
    const data = await res.json();
    const videos = data.results || [];
    // Search for YouTube videos with type 'Trailer' first, or any YouTube video as placeholder
    const trailer = videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || 
                    videos.find((v: any) => v.site === "YouTube" && v.type === "Teaser") ||
                    videos.find((v: any) => v.site === "YouTube");
    if (trailer?.key) {
      return `https://www.youtube.com/watch?v=${trailer.key}`;
    }
  } catch (err) {
    console.error(`Error querying trailer for movie ${movieId}:`, err);
  }
  return undefined;
}

// API Endpoint to fetch movies (using TMDB proxy if key exists, otherwise fallback to Gemini)
app.post("/api/movies", async (req, res) => {
  try {
    const { apiKey, country, providers, vibe } = req.body;

    const selectedProviders: string[] = providers || ["netflix"];
    const selectedCountry = country || "US";
    const selectedVibe = vibe || ""; // Holds a comma-separated list of conventional genre IDs

    // Use user-provided key OR background server-side TMDB_API_KEY
    const serverTmdbKey = process.env.TMDB_API_KEY;
    const finalTmdbKey = (apiKey && apiKey.trim().length > 0) ? apiKey.trim() : (serverTmdbKey && serverTmdbKey.trim());

    if (finalTmdbKey && finalTmdbKey.length > 0) {
      const tmdbKey = finalTmdbKey;

      // Get official provider IDs
      const providerIds = selectedProviders
        .map(p => PROVIDER_MAP[p])
        .filter(id => id !== undefined);
      const providerIdString = providerIds.join("|");

      // Choose a random curation strategy to yield highly dynamic lists
      const curationPlan = Math.floor(Math.random() * 5);
      let page1 = Math.floor(Math.random() * 10) + 1;
      let page2 = page1 + 1;
      let customParams = "";
      let sortParam = "popularity.desc";

      switch (curationPlan) {
        case 0: // Curation A: High-popularity blockbuster favorites
          sortParam = "popularity.desc";
          page1 = Math.floor(Math.random() * 5) + 1;
          page2 = page1 + 1;
          break;
        case 1: // Curation B: Critically acclaimed IMDb staples
          sortParam = "vote_average.desc";
          customParams = "&vote_count.gte=250";
          page1 = Math.floor(Math.random() * 8) + 1;
          page2 = page1 + 1;
          break;
        case 2: // Curation C: Modern cinematographic wonders (2015 - present)
          sortParam = "popularity.desc";
          const currentYear = new Date().getFullYear();
          customParams = `&primary_release_date.gte=2015-01-01&primary_release_date.lte=${currentYear}-12-31`;
          page1 = Math.floor(Math.random() * 12) + 1;
          page2 = page1 + 1;
          break;
        case 3: // Curation D: Masterpieces & Nostalgia (1980 - 2012)
          sortParam = "popularity.desc";
          customParams = "&primary_release_date.gte=1980-01-01&primary_release_date.lte=2012-12-31&vote_average.gte=6.5";
          page1 = Math.floor(Math.random() * 10) + 1;
          page2 = page1 + 1;
          break;
        case 4: // Curation E: Well-kept hidden secrets and indie treasures
          sortParam = "popularity.desc";
          customParams = "&vote_count.gte=100&vote_count.lte=3000&vote_average.gte=7.1";
          page1 = Math.floor(Math.random() * 8) + 1;
          page2 = page1 + 1;
          break;
      }

      let discoverUrlPage1 = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${sortParam}&page=${page1}${customParams}`;
      let discoverUrlPage2 = `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&watch_region=${selectedCountry}&sort_by=${sortParam}&page=${page2}${customParams}`;

      if (providerIdString) {
        discoverUrlPage1 += `&with_watch_providers=${providerIdString}`;
        discoverUrlPage2 += `&with_watch_providers=${providerIdString}`;
      }

      // Convert comma-separated string of items from multiple choice to OR conditions in TMDB API
      const genresString = selectedVibe.trim() ? selectedVibe.trim().replace(/,/g, "|") : "";
      if (genresString) {
        discoverUrlPage1 += `&with_genres=${genresString}`;
        discoverUrlPage2 += `&with_genres=${genresString}`;
      }

      // Query TMDB pages in parallel for speed
      const [response1, response2] = await Promise.all([
        fetch(discoverUrlPage1),
        fetch(discoverUrlPage2).catch(() => null)
      ]);

      let rawResults: any[] = [];
      if (response1.ok) {
        const data1 = await response1.json();
        rawResults = rawResults.concat(data1.results || []);
      }
      if (response2 && response2.ok) {
        const data2 = await response2.json();
        rawResults = rawResults.concat(data2.results || []);
      }

      // De-duplicate items by TMDB ID
      const seenIds = new Set<number>();
      rawResults = rawResults.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

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
      const promises = items.map(async (item: any) => {
        const itemGenres = (item.genre_ids || [])
          .map((id: number) => genreNamesMap[id])
          .filter((g: string) => g !== undefined);

        const backdropUrl = item.backdrop_path 
          ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
          : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=60";

        let synopsis = item.overview || "Geen beschrijving beschikbaar.";
        if (synopsis.length > 150) {
          synopsis = synopsis.slice(0, 147) + "...";
        }

        const [actualProviders, fetchedTrailerUrl] = await Promise.all([
          getActualProvidersForMovie(item.id, tmdbKey, selectedCountry, selectedProviders),
          getTrailerUrlForMovie(item.id, tmdbKey).catch(() => undefined)
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

      const formattedSecrets = await Promise.all(promises);
      return res.json({ source: "TMDB", movies: formattedSecrets });
    }

    // Scenario B: Fallback Gemini AI curation
    const ai = getGeminiClient();

    const providerListStr = selectedProviders.join(", ");
    
    const tmdbGenresMap: Record<string, string> = {
      "28": "Actie", "12": "Avontuur", "16": "Animatie", "35": "Komedie", "80": "Misdaad",
      "99": "Documentaire", "18": "Drama", "10751": "Familie", "14": "Fantasie", "36": "Geschiedenis",
      "27": "Horror", "10402": "Muziek", "9648": "Mysterie", "10749": "Romantiek", "878": "Sci-Fi",
      "53": "Thriller", "10752": "Oorlog", "37": "Western"
    };

    const requestedGenreNames = selectedVibe.trim()
      ? selectedVibe.split(",").map(id => tmdbGenresMap[id]).filter(Boolean)
      : [];

    const genresPrompt = requestedGenreNames.length > 0
      ? `Zorg dat alle films behoren tot minstens een van de volgende genres: [${requestedGenreNames.join(", ")}].`
      : "Kies gevarieerde hoogstaande filmmeesterwerken van allerlei genres.";

    const focusOptions = [
      "Kies een mix van bekende iconische kaskrakers en verbazingwekkende verborgen juweeltjes.",
      "Geef prioriteit aan prijswinnende meesterwerken en legendarische IMDb favorieten.",
      "Zorg voor een spannende en kleurrijke mix van klassiekers en moderne bioscoopsensaties.",
      "Richt je op sfeervolle, ontroerende en meeslepende verhalen die iedereen bijblijven.",
      "Kies unieke arthouse/indie cultfavorieten met diepgang en een fantastische sfeer.",
      "Selecteer meesterwerken met onvergetelijke plot-twists, zinderende spanning en briljante scripts.",
      "Focus op nostalgische jaren 80, 90 en 2000 klassiekers met een gigantische cultstatus.",
      "Zet voornamelijk zeldzame parels in het zonnetje die iedereen gezien moet hebben."
    ];
    const pickedFocus = focusOptions[Math.floor(Math.random() * focusOptions.length)];

    const promptString = `Genereer 15 populaire of veelgeprezen films die te streamen zijn in ${selectedCountry} op: [${providerListStr}]. ${genresPrompt} ${pickedFocus} Belangrijk: voor het attribuut 'providers' in het JSON resultaat mag je alleen de specifieke streamingsdienst opgeven waarop die specifieke film daadwerkelijk te zien is (bijvoorbeeld ['netflix'] of ['disney']). Zet er dus niet blindelings de hele lijst [${providerListStr}] in!`;

    const systemInstruction = 
      "Je bent Filmder, een gezellige en enthousiaste filmkenner. Output STRIKT een JSON array van objecten die voldoen aan de Movie interface. Alle genres/categorieën moeten in natuurlijk Nederlands staan (bijv. 'Actie', 'Drama', 'Komedie', 'Muziek', 'Animatie', 'Documentaire', 'Spanning', 'Klassieker' in plaats van Engelse woorden). De synopsis MOET exact één pakkende, prikkelende en menselijke Nederlandse zin zijn die klinkt als een persoonlijke tip van een vriend, zonder AI-clichés. De backdrop is een hoge kwaliteit landschapsfoto van Unsplash passende bij de sfeer van de film. Zorg dat het 'language' attribuut de gesproken taal van de film in natuurlijk Nederlands bevat (bijvoorbeeld 'Engels', 'Nederlands', 'Frans', 'Japans', 'Spaans').";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptString,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              year: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              synopsis: { type: Type.STRING },
              providers: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              backdrop: { type: Type.STRING },
              language: { type: Type.STRING }
            },
            required: ["id", "title", "year", "rating", "genres", "synopsis", "providers", "backdrop", "language"]
          }
        }
      }
    });

    const moviesText = response.text || "[]";
    let movies = JSON.parse(moviesText);

    if (Array.isArray(movies)) {
      movies = movies.map((movie: any) => {
        const query = encodeURIComponent(`${movie.title} ${movie.year || "2026"} trailer NL`);
        return {
          ...movie,
          trailerUrl: movie.trailerUrl || `https://www.youtube.com/results?search_query=${query}`,
          language: movie.language || "Engels"
        };
      });
    }

    return res.json({ source: "Gemini", movies });
  } catch (error: any) {
    console.error("Movie curation error:", error);
    return res.status(500).json({ error: error.message || "An error occurred while curating movies." });
  }
});

// Serve frontend with hot module replacement check
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
