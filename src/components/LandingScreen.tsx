import { useState, useEffect, FormEvent } from "react";
import { Sparkles, Tv, Globe, Heart, Lock, Key, ChevronDown, ChevronUp, X, Film } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { COUNTRIES, PROVIDERS, GENRES } from "../constants";
import { Preferences } from "../types";

interface LandingScreenProps {
  onCreateRoom: (preferences: Preferences) => void;
  onJoinRoom: (roomCode: string, preferences: Preferences) => void;
}

export default function LandingScreen({ onCreateRoom, onJoinRoom }: LandingScreenProps) {
  // Try loading default preferences from LocalStorage
  const [name, setName] = useState(() => {
    const saved = localStorage.getItem("flixmatch_name");
    if (saved) return saved;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `Kijker_${rand}`;
  });

  const [country, setCountry] = useState(() => localStorage.getItem("flixmatch_country") || "NL");
  const [providers, setProviders] = useState<string[]>(() => {
    const saved = localStorage.getItem("flixmatch_providers");
    return saved ? JSON.parse(saved) : ["netflix", "videoland"];
  });
  const [vibe, setVibe] = useState(() => {
    const saved = localStorage.getItem("flixmatch_vibe") || "";
    // Clear out old vibes if they exist
    if (["surprise", "romantic", "scary", "comedy", "scifi", "action", "indie"].includes(saved)) {
      return "";
    }
    return saved;
  });
  const [tmdbApiKey, setTmdbApiKey] = useState(() => localStorage.getItem("flixmatch_tmdb_key") || "");

  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGenresDropdown, setShowGenresDropdown] = useState(false);

  const selectedGenres = vibe.trim() ? vibe.split(",") : [];

  const toggleGenre = (genreId: string) => {
    let updated: string[];
    if (selectedGenres.includes(genreId)) {
      updated = selectedGenres.filter(id => id !== genreId);
    } else {
      updated = [...selectedGenres, genreId];
    }
    setVibe(updated.join(","));
  };

  const handleToggleSelectAllGenres = () => {
    if (selectedGenres.length === GENRES.length) {
      setVibe("");
    } else {
      setVibe(GENRES.map(g => g.id).join(","));
    }
  };

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("flixmatch_name", name);
    localStorage.setItem("flixmatch_country", country);
    localStorage.setItem("flixmatch_providers", JSON.stringify(providers));
    localStorage.setItem("flixmatch_vibe", vibe);
    localStorage.setItem("flixmatch_tmdb_key", tmdbApiKey);
  }, [name, country, providers, vibe, tmdbApiKey]);

  // Click outside to close genres dropdown
  useEffect(() => {
    if (!showGenresDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#genre-dropdown-container")) {
        setShowGenresDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showGenresDropdown]);

  const toggleProvider = (id: string) => {
    if (providers.includes(id)) {
      if (providers.length > 1) {
        setProviders(providers.filter(p => p !== id));
      }
    } else {
      setProviders([...providers, id]);
    }
  };

  const currentPrefs: Preferences = {
    name,
    country,
    providers,
    vibe,
    tmdbApiKey,
  };

  const handleCreate = () => {
    onCreateRoom(currentPrefs);
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim();
    if (cleanCode.length === 4) {
      onJoinRoom(cleanCode, currentPrefs);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 relative">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[340px] h-[340px] pointer-events-none rounded-full bg-[#ff5637]/5 blur-[120px]" />

      {/* Hero Header */}
      <div className="text-center mb-10 relative z-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff5637]/10 border border-[#ff5637]/25 text-[#ffb4a5] text-xs font-bold uppercase tracking-widest mb-4 shadow-[0_0_15px_rgba(255,86,55,0.08)] font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#ff5637]" />
          Samen Live Films Matchen
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter font-display text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffb4a5] to-[#ff5637] mb-3 select-none">
          Filmder
        </h1>
        <p className="text-[#e3e0f1] font-sans text-sm md:text-base max-w-md mx-auto leading-relaxed opacity-85">
          Swipe door de leukste films met je partner of vrienden en vind in real-time de perfecte match voor jullie filmavond!
        </p>
      </div>

      <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6 relative z-10">
        
        {/* Profile Nickname */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
            Jouw Naam / Nickname
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#ff5637] text-xs font-mono font-bold select-none">
              @
            </span>
            <input
              id="nickname-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              className="w-full bg-black/20 border border-white/5 hover:border-white/10 focus:border-[#ff5637] focus:ring-2 focus:ring-[#ff5637]/20 focus:outline-none rounded-xl py-3 pl-8 pr-4 text-[#e3e0f1] font-semibold placeholder-slate-600 transition-all shadow-inner"
              placeholder="Bijv. FilmFanaat"
            />
          </div>
        </div>

        {/* Genre Multiple Choice Selector */}
        <div id="genre-dropdown-container" className="space-y-2 relative">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 justify-between">
            <span className="flex items-center gap-1.5 select-none font-bold">
              <Film className="w-4 h-4 text-[#ff5637]" />
              Kies Filmgenres (Meerdere opties mogelijk)
            </span>
            {selectedGenres.length > 0 && (
              <span className="text-[10px] font-extrabold text-[#ffe16d] bg-[#ffdb3c]/15 px-2 py-0.5 rounded-full border border-[#ffdb3c]/20 select-none uppercase tracking-wide animate-pulse">
                {selectedGenres.length} geselecteerd
              </span>
            )}
          </label>
          <div className="relative">
            <div
              id="genre-dropdown-trigger"
              onClick={() => setShowGenresDropdown(!showGenresDropdown)}
              className="w-full bg-black/20 border border-white/5 hover:border-white/10 rounded-2xl py-2.5 px-3 text-[#e3e0f1] text-sm font-semibold transition-all cursor-pointer flex justify-between items-center gap-2 min-h-[48px]"
            >
              <div className="flex flex-wrap gap-1.5 flex-1 max-w-[calc(100%-24px)]">
                {selectedGenres.length === 0 ? (
                  <span className="text-slate-400 text-xs py-1 select-none font-medium text-slate-500">
                    Alle Genres (Geen filter)
                  </span>
                ) : (
                  selectedGenres.map(id => {
                    const genreObj = GENRES.find(g => g.id === id);
                    if (!genreObj) return null;
                    return (
                      <span
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGenre(id);
                        }}
                        className="inline-flex items-center gap-1 bg-[#ff5637]/15 border border-[#ff5637]/35 hover:bg-[#ff5637]/25 hover:border-[#ff5637] text-[#ffb4a5] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full transition-transform hover:scale-105"
                      >
                        {genreObj.name}
                        <X className="w-2.5 h-2.5 hover:text-white shrink-0 ml-0.5" />
                      </span>
                    );
                  })
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${showGenresDropdown ? "rotate-180" : ""}`} />
            </div>

            <AnimatePresence>
              {showGenresDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute left-0 right-0 mt-2 bg-[#12121d]/95 border border-white/10 rounded-2xl p-4 shadow-[0_15px_35px_rgba(0,0,0,0.85)] z-50 max-h-72 overflow-y-auto custom-scrollbar space-y-3.5 backdrop-blur-xl"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                      Selecteer genres die je wil zien
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelectAllGenres();
                      }}
                      className="text-[10px] text-[#ffb4a5] font-extrabold hover:text-white transition-colors cursor-pointer px-2 py-1 hover:bg-[#ff5637]/10 rounded"
                    >
                      {selectedGenres.length === GENRES.length ? "Deselecteer Alles" : "Selecteer Alles"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {GENRES.map((g) => {
                      const active = selectedGenres.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGenre(g.id);
                          }}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                            active
                              ? "bg-[#ff5637]/15 border-[#ff5637]/40 text-[#ffb4a5] shadow-[0_2px_8px_rgba(255,86,55,0.06)]"
                              : "bg-black/20 border-white/5 text-slate-300 hover:border-white/10 hover:text-white"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            active 
                              ? "border-[#ff5637] bg-[#ff5637] text-white" 
                              : "border-slate-700 bg-transparent text-transparent"
                          }`}>
                            {active && <span className="text-[9px] font-black">✓</span>}
                          </div>
                          <span className="truncate select-none">{g.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Streaming Providers selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
            <Tv className="w-4 h-4 text-[#ff5637]" />
            Actieve Streamingdiensten
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {PROVIDERS.map((prov) => {
              const active = providers.includes(prov.id);
              return (
                <button
                  key={prov.id}
                  id={`provider-${prov.id}`}
                  type="button"
                  onClick={() => toggleProvider(prov.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                    active
                      ? "bg-[#ff5637]/10 border-[#ff5637]/50 text-[#ffb4a5] shadow-[0_0_12px_rgba(255,86,55,0.06)] scale-[1.02]"
                      : "bg-black/20 border-white/5 text-slate-300 hover:border-[#ff5637]/35 hover:text-white"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${active ? "bg-[#ff5637] animate-pulse" : "bg-neutral-800"}`} />
                  <span className="truncate">{prov.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Advanced / Background Settings */}
        <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/10">
          <button
            id="advanced-settings-toggle"
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-slate-400 hover:text-white text-xs font-extrabold uppercase tracking-widest cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#8c7fff]" />
              Achtergrond Instellingen (Kijkregio)
            </span>
            <span className="text-slate-400">
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showAdvanced && (
            <div className="px-5 pb-5 pt-3 border-t border-white/5 space-y-4 bg-black/20 animate-fade-in animate-duration-300">
              {/* Region Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 block">
                  <Globe className="w-3.5 h-3.5 text-[#ff5637]" />
                  Kijkregio
                </label>
                <select
                  id="region-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#12121d] border border-white/5 hover:border-white/10 focus:border-[#ff5637] focus:outline-none rounded-xl py-2.5 px-3 text-xs text-[#e3e0f1] font-bold transition-all cursor-pointer"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Standaard ingesteld op Nederland (NL). Pas dit aan om aanbevelingen voor andere landen te bekijken.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions Button Panel */}
        <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            id="create-room-btn"
            type="button"
            onClick={handleCreate}
            className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-full glow-button hover:brightness-110 text-white font-extrabold tracking-wide active:scale-[0.98] transition-all cursor-pointer"
          >
            <Heart className="w-4 h-4 fill-white shrink-0 text-white animate-pulse" />
            Lobby Aanmaken
          </button>

          <button
            id="join-toggle-btn"
            type="button"
            onClick={() => setShowJoinInput(!showJoinInput)}
            className="flex items-center justify-center gap-2 py-4 px-6 rounded-full bg-black/20 border border-white/5 hover:bg-white/5 hover:border-[#ff5637]/30 text-white font-extrabold transition-all cursor-pointer"
          >
            <Key className="w-4 h-4 text-[#ffdb3c] shrink-0" />
            Code Invoeren
          </button>
        </div>

        {/* Join Code Input Form */}
        {showJoinInput && (
          <form onSubmit={handleJoinSubmit} className="pt-4 border-t border-white/5 space-y-3 animate-fade-in">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block text-center">
              Voer de 4-cijferige kamer-code in
            </label>
            <div className="flex gap-2 max-w-xs mx-auto">
              <input
                id="join-code-input"
                type="text"
                pattern="[0-9]*"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full bg-black/20 border border-white/5 focus:border-[#ff5637] text-center text-2xl tracking-[0.5em] font-black py-3 text-white rounded-xl focus:outline-none"
                placeholder="0000"
              />
              <button
                id="join-submit-btn"
                type="submit"
                disabled={joinCode.length !== 4}
                className="px-6 rounded-full glow-button text-white font-extrabold cursor-pointer disabled:opacity-45 disabled:pointer-events-none transition-all"
              >
                Deelnemen
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

