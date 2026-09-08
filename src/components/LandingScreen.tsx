import { useState, useEffect, FormEvent } from "react";
import { Sparkles, Tv, Globe, Heart, Key, ChevronDown, ChevronUp, X, Film } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { COUNTRIES, PROVIDERS, GENRES } from "../constants";
import { Preferences } from "../types";
import FilmFlameLogo from "./FilmFlameLogo";
import ProviderLogo from "./ProviderLogo";
import { useLanguage } from "../LanguageContext";

interface LandingScreenProps {
  onCreateRoom: (preferences: Preferences) => void;
  onJoinRoom: (roomCode: string, preferences: Preferences) => void;
  initialJoinCode?: string | null;
}

const PROVIDER_THEMES: Record<string, {
  bgActive: string;
  borderActive: string;
  textActive: string;
  shadow: string;
  accentColor: string;
  badgeText: string;
}> = {
  netflix: {
    bgActive: "bg-black/80 border-[#E50914]/80 text-[#E50914]",
    borderActive: "border-[#E50914]",
    textActive: "text-[#E50914]",
    shadow: "shadow-[0_4px_12px_rgba(229,9,20,0.15)]",
    accentColor: "bg-[#E50914]",
    badgeText: "N",
  },
  disney: {
    bgActive: "bg-[#001030]/90 border-[#0063E5]/80 text-[#4296FF]",
    borderActive: "border-[#0063E5]",
    textActive: "text-[#D1E4FF]",
    shadow: "shadow-[0_4px_12px_rgba(0,99,229,0.15)]",
    accentColor: "bg-[#0063E5]",
    badgeText: "D+",
  },
  prime: {
    bgActive: "bg-[#051120]/90 border-[#00A8E1]/80 text-[#00A8E1]",
    borderActive: "border-[#00A8E1]",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(0,168,225,0.15)]",
    accentColor: "bg-[#00A8E1]",
    badgeText: "Pv",
  },
  max: {
    bgActive: "bg-[#000820]/90 border-[#002DFF]/80 text-white",
    borderActive: "border-[#002DFF]",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(0,45,255,0.15)]",
    accentColor: "bg-[#002DFF]",
    badgeText: "MAX",
  },
  apple: {
    bgActive: "bg-neutral-900/90 border-white/60 text-white",
    borderActive: "border-white",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(255,255,255,0.08)]",
    accentColor: "bg-white text-black",
    badgeText: "TV",
  },
  hulu: {
    bgActive: "bg-[#00140F]/90 border-[#1CE783]/80 text-[#1CE783]",
    borderActive: "border-[#1CE783]",
    textActive: "text-[#1CE783]",
    shadow: "shadow-[0_4px_12px_rgba(28,231,131,0.15)]",
    accentColor: "bg-[#1CE783] text-black",
    badgeText: "h",
  },
  paramount: {
    bgActive: "bg-[#002060]/90 border-[#0057FF]/80 text-white",
    borderActive: "border-[#0057FF]",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(0,87,255,0.15)]",
    accentColor: "bg-[#0057FF]",
    badgeText: "P+",
  },
  videoland: {
    bgActive: "bg-[#10000B]/90 border-[#EC008C]/80 text-[#EC008C]",
    borderActive: "border-[#EC008C]",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(236,0,140,0.15)]",
    accentColor: "bg-[#EC008C]",
    badgeText: "VL",
  },
  npostart: {
    bgActive: "bg-[#150D00]/90 border-[#FF7000]/80 text-[#FF7000]",
    borderActive: "border-[#FF7000]",
    textActive: "text-white",
    shadow: "shadow-[0_4px_12px_rgba(255,112,0,0.15)]",
    accentColor: "bg-[#FF7000]",
    badgeText: "NPO",
  },
  viaplay: {
    bgActive: "bg-[#150005]/90 border-[#FF1333]/80 text-white",
    borderActive: "border-[#FF1333]",
    textActive: "text-[#FFB3BC]",
    shadow: "shadow-[0_4px_12px_rgba(255,19,51,0.15)]",
    accentColor: "bg-[#FF1333]",
    badgeText: "VP",
  },
  pirate: {
    bgActive: "bg-amber-950/40 border-[#ffbf3e]/80 text-[#ffbf3e]",
    borderActive: "border-[#ffbf3e]",
    textActive: "text-[#ffbf3e]",
    shadow: "shadow-[0_4px_12px_rgba(255,191,62,0.25)]",
    accentColor: "bg-[#ffbf3e]",
    badgeText: "🏴‍☠️",
  },
};

export default function LandingScreen({ onCreateRoom, onJoinRoom, initialJoinCode }: LandingScreenProps) {
  const { language, t } = useLanguage();
  // Try loading default preferences from LocalStorage
  const [name, setName] = useState(() => {
    const saved = localStorage.getItem("flixmatch_name");
    return saved || "";
  });

  const [country, setCountry] = useState(() => localStorage.getItem("flixmatch_country") || "NL");
  const [providers, setProviders] = useState<string[]>(() => {
    const saved = localStorage.getItem("flixmatch_providers");
    return saved ? JSON.parse(saved) : ["netflix", "videoland"];
  });
  const [vibe, setVibe] = useState(() => {
    const saved = localStorage.getItem("flixmatch_vibe") || "";
    if (["surprise", "romantic", "scary", "comedy", "scifi", "action", "indie"].includes(saved)) {
      return "";
    }
    return saved;
  });

  // Six custom user preference filters for min/max ranges
  const [minRuntime, setMinRuntime] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_min_runtime_range");
    return saved ? parseInt(saved) : 60;
  });
  const [maxRuntime, setMaxRuntime] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_max_runtime_range");
    return saved ? parseInt(saved) : 180;
  });
  const [minRating, setMinRating] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_min_rating_range");
    return saved ? parseFloat(saved) : 5.5;
  });
  const [maxRating, setMaxRating] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_max_rating_range");
    return saved ? parseFloat(saved) : 10.0;
  });
  const [minYear, setMinYear] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_min_year");
    return saved ? parseInt(saved) : 1980;
  });
  const [maxYear, setMaxYear] = useState<number>(() => {
    const saved = localStorage.getItem("flixmatch_max_year");
    return saved ? parseInt(saved) : 2026;
  });
  const [ageRating, setAgeRating] = useState<boolean>(() => {
    return localStorage.getItem("flixmatch_age_rating") === "true";
  });

  const [joinCode, setJoinCode] = useState(initialJoinCode ? initialJoinCode.toUpperCase() : "");
  const [showJoinInput, setShowJoinInput] = useState(!!initialJoinCode);
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
    minRuntime,
    maxRuntime: maxRuntime < 240 ? maxRuntime : undefined,
    minRating,
    maxRating: maxRating < 10 ? maxRating : undefined,
    minYear,
    maxYear,
    ageRating: ageRating ? true : undefined,
  };

  // Perform localStorage updates on triggers/actions to entirely eliminate typing delays
  const saveToLocalStorage = () => {
    localStorage.setItem("flixmatch_name", name);
    localStorage.setItem("flixmatch_country", country);
    localStorage.setItem("flixmatch_providers", JSON.stringify(providers));
    localStorage.setItem("flixmatch_vibe", vibe);
    localStorage.setItem("flixmatch_min_runtime_range", String(minRuntime));
    localStorage.setItem("flixmatch_max_runtime_range", String(maxRuntime));
    localStorage.setItem("flixmatch_min_rating_range", String(minRating));
    localStorage.setItem("flixmatch_max_rating_range", String(maxRating));
    localStorage.setItem("flixmatch_min_year", String(minYear));
    localStorage.setItem("flixmatch_max_year", String(maxYear));
    localStorage.setItem("flixmatch_age_rating", String(ageRating));
  };

  const handleCreate = () => {
    saveToLocalStorage();
    onCreateRoom(currentPrefs);
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length === 4 || cleanCode.length === 5) {
      saveToLocalStorage();
      onJoinRoom(cleanCode, currentPrefs);
    }
  };

  const handleQuickJoinCode = () => {
    if (initialJoinCode) {
      saveToLocalStorage();
      onJoinRoom(initialJoinCode.toUpperCase(), currentPrefs);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 relative">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[340px] h-[340px] pointer-events-none rounded-full bg-[#ff5637]/5 blur-[120px]" />

      {/* Hero Header */}
      <div className="text-center mb-10 relative z-10 animate-fade-in flex flex-col items-center">
        {/* Animated Brand Logo */}
        <motion.div
          animate={{ 
            y: [0, -8, 0],
            filter: [
              "drop-shadow(0 4px 15px rgba(255,86,55,0.15))", 
              "drop-shadow(0 15px 35px rgba(255,86,55,0.35))", 
              "drop-shadow(0 4px 15px rgba(255,86,55,0.15))"
            ]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="mb-5 select-none"
        >
          <FilmFlameLogo size={110} />
        </motion.div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff5637]/10 border border-[#ff5637]/25 text-[#ffb4a5] text-xs font-bold uppercase tracking-widest mb-4 shadow-md font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#ff5637]" />
          {t("live_match_badge")}
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter font-display text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffb4a5] to-[#ff5637] mb-3 select-none">
          Filmder
        </h1>
        <p className="text-[#e3e0f1] font-sans text-sm md:text-base max-w-md mx-auto leading-relaxed opacity-85">
          {t("tagline")}
        </p>
      </div>

      <div className="glass-card rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6 relative z-10">
        
        {/* Profile Nickname */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block select-none">
            {t("your_nickname")}
          </label>
          <div className="relative">
            <input
              id="nickname-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              className="w-full bg-black/20 border border-white/5 hover:border-white/10 focus:border-[#ff5637] focus:ring-2 focus:ring-[#ff5637]/20 focus:outline-none rounded-xl py-3 px-4 text-[#e3e0f1] font-semibold placeholder-slate-400 transition-all shadow-inner"
              placeholder={t("nickname_placeholder")}
              required
            />
          </div>
        </div>

        {/* Invite Prompt */}
        {initialJoinCode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#ff5637]/20 to-black/10 border border-[#ff5637]/30 shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ff5637]/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#ffdb3c] fill-[#ffdb3c]" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-[#ffe16d] uppercase tracking-wider">{language === "nl" ? "Uitnodiging ontvangen" : "Invitation received"}</p>
                <p className="text-[11px] text-slate-200">
                  {language === "nl" ? "Je bent uitgenodigd voor Lobby" : "You have been invited for Lobby"} <span className="text-white font-mono font-black bg-black/40 px-1.5 py-0.5 rounded text-xs border border-white/5">{initialJoinCode}</span>.
                </p>
              </div>
            </div>
            <button
              id="initial-join-cta-btn"
              type="button"
              disabled={!name.trim()}
              onClick={handleQuickJoinCode}
              className="py-2 px-3.5 rounded-xl bg-[#ffdb3c] hover:bg-[#ffe16d] text-slate-950 text-[10px] font-black uppercase tracking-wider transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {language === "nl" ? "Stap direct in" : "Join instantly"}
            </button>
          </motion.div>
        )}

        {/* Streaming Providers selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
            <Tv className="w-4 h-4 text-[#ff5637]" />
            {t("active_providers")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
            {PROVIDERS.map((prov) => {
              const active = providers.includes(prov.id);
              const theme = PROVIDER_THEMES[prov.id] || {
                bgActive: "bg-[#ff5637]/10 border-[#ff5637]/50 text-[#ffb4a5]",
                borderActive: "border-[#ff5637]/50",
                textActive: "text-[#ffb4a5]",
                shadow: "shadow-sm",
                accentColor: "bg-[#ff5637]",
                badgeText: "★"
              };
              return (
                <button
                  key={prov.id}
                  id={`provider-${prov.id}`}
                  type="button"
                  onClick={() => toggleProvider(prov.id)}
                  className={`relative overflow-hidden flex items-center gap-1.5 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all duration-350 cursor-pointer w-full select-none ${
                    active
                      ? `${theme.bgActive} ${theme.borderActive} ${theme.shadow} scale-[1.02]`
                      : "bg-[#161621]/40 border-white/5 text-slate-400 hover:border-slate-800 hover:bg-[#161621]/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-center shrink-0 w-9 h-6 sm:w-12 sm:h-8 rounded-lg sm:rounded-xl overflow-hidden shadow-inner select-none bg-[#090911]/40">
                    <ProviderLogo id={prov.id} active={active} size={15} />
                  </div>
                  <span className={`text-[10px] sm:text-[11px] font-semibold text-left leading-tight select-none ${active ? "text-white" : "text-slate-300"}`}>
                    {prov.name}
                  </span>
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
              {t("advanced_filters")}
            </span>
            <span className="text-slate-400">
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showAdvanced && (
            <div className="px-5 pb-5 pt-3 border-t border-white/5 space-y-4 bg-black/20 animate-fade-in animate-duration-300">
              
              {/* Relocated Genre Multiple Choice Selector */}
              <div id="genre-dropdown-container" className="space-y-2 relative">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 justify-between">
                  <span className="flex items-center gap-1.5 select-none font-bold">
                    <Film className="w-4 h-4 text-[#ff5637]" />
                    {language === "nl" ? "Kies filmgenres (meerdere opties mogelijk)" : "Choose movie genres (multiple allowed)"}
                  </span>
                  {selectedGenres.length > 0 && (
                    <span className="text-[10px] font-extrabold text-[#ffe16d] bg-[#ffdb3c]/15 px-2.5 py-0.5 rounded-full border border-[#ffdb3c]/20 select-none uppercase tracking-wide">
                      {selectedGenres.length} {language === "nl" ? "geselecteerd" : "selected"}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div
                    id="genre-dropdown-trigger"
                    onClick={() => setShowGenresDropdown(!showGenresDropdown)}
                    className="w-full bg-[#12121d] border border-white/5 hover:border-white/10 rounded-xl py-2.5 px-3 text-[#e3e0f1] text-[11px] font-bold transition-all cursor-pointer flex justify-between items-center gap-2 min-h-[44px]"
                  >
                    <div className="flex flex-wrap gap-1.5 flex-1 max-w-[calc(100%-24px)]">
                      {selectedGenres.length === 0 ? (
                        <span className="text-slate-500 text-xs py-0.5 select-none font-semibold">
                          {language === "nl" ? "Alle genres (geen filter)" : "All genres (no filter)"}
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
                              className="inline-flex items-center gap-1 bg-[#ff5637]/15 border border-[#ff5637]/35 hover:bg-[#ff5637]/25 hover:border-[#ff5637] text-[#ffb4a5] text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-transform hover:scale-105"
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
                            {selectedGenres.length === GENRES.length ? "Deselecteer alles" : "Selecteer alles"}
                          </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
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
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
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

              {/* Region Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 block select-none">
                  <Globe className="w-3.5 h-3.5 text-[#ff5637]" />
                  {t("choose_region")}
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
              </div>

              {/* Unique Advanced Filters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                
                {/* Year Range Selector */}
                <div className="space-y-2 col-span-1 sm:col-span-2 bg-black/25 p-3.5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block select-none">
                      {language === "nl" ? "Jaartallen range" : "Release year range"}
                    </span>
                    <span className="text-xs text-[#ff5637] font-extrabold font-mono select-none">
                      {minYear} - {maxYear}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Min:</span>
                      <input
                        type="range"
                        min={1950}
                        max={2026}
                        step={1}
                        value={minYear}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMinYear(val);
                          if (val > maxYear) setMaxYear(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Max:</span>
                      <input
                        type="range"
                        min={1950}
                        max={2026}
                        step={1}
                        value={maxYear}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMaxYear(val);
                          if (val < minYear) setMinYear(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                  </div>
                </div>

                {/* Speelduur Range Selector */}
                <div className="space-y-2 col-span-1 sm:col-span-2 bg-black/25 p-3.5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block select-none">
                      {language === "nl" ? "Speelduur range" : "Runtime range"}
                    </span>
                    <span className="text-xs text-[#ff5637] font-extrabold font-mono select-none">
                      {minRuntime} min - {maxRuntime >= 240 ? t("no_limit") : `${maxRuntime} min`}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Min:</span>
                      <input
                        type="range"
                        min={45}
                        max={240}
                        step={5}
                        value={minRuntime}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMinRuntime(val);
                          if (val > maxRuntime) setMaxRuntime(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Max:</span>
                      <input
                        type="range"
                        min={45}
                        max={240}
                        step={5}
                        value={maxRuntime}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setMaxRuntime(val);
                          if (val < minRuntime) setMinRuntime(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                  </div>
                </div>

                {/* Rating/Score Range Selector */}
                <div className="space-y-2 col-span-1 sm:col-span-2 bg-black/25 p-3.5 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block select-none">
                      Min & Max Score (TMDB)
                    </span>
                    <span className="text-xs text-[#ff5637] font-extrabold font-mono select-none">
                      {minRating.toFixed(1)} ★ - {maxRating.toFixed(1)} ★
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Min:</span>
                      <input
                        type="range"
                        min={1.0}
                        max={10.0}
                        step={0.1}
                        value={minRating}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setMinRating(val);
                          if (val > maxRating) setMaxRating(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold uppercase w-8 select-none">Max:</span>
                      <input
                        type="range"
                        min={1.0}
                        max={10.0}
                        step={0.1}
                        value={maxRating}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setMaxRating(val);
                          if (val < minRating) setMinRating(val);
                        }}
                        className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-[#ff5637]"
                      />
                    </div>
                  </div>
                </div>

                {/* Kids-friendly check */}
                <div className="flex items-center justify-between bg-[#12121d]/50 col-span-1 sm:col-span-2 p-3 rounded-xl border border-white/5 mt-auto">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                    {t("family_friendly")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAgeRating(!ageRating)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      ageRating ? "bg-[#ff5637]" : "bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        ageRating ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Button Panel */}
        {!name.trim() && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center animate-pulse">
            <p className="text-xs font-bold text-amber-400">
              {language === "nl" ? "Vul eerst hierboven jouw naam/nickname in om door te gaan." : "Enter your name/nickname above first to continue."}
            </p>
          </div>
        )}

        {initialJoinCode ? (
          <div className="pt-4 border-t border-white/5 space-y-3.5">
            <button
               id="join-shared-room-btn"
               type="button"
               onClick={handleQuickJoinCode}
               disabled={!name.trim()}
               className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-full bg-gradient-to-r from-[#ffdb3c] to-[#ff9f1c] hover:brightness-110 text-slate-950 font-extrabold tracking-wide active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none uppercase text-xs"
            >
              <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950 shrink-0 select-none" />
              {language === "nl" ? `Nu Deelnemen Aan Lobby ${initialJoinCode}` : `Join Lobby Now ${initialJoinCode}`}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  window.location.search = "";
                }}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                {language === "nl" ? "Of start zelf een nieuwe lobby" : "Or start a new lobby yourself"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              id="create-room-btn"
              type="button"
              onClick={handleCreate}
              disabled={!name.trim()}
              className="flex items-center justify-center gap-2.5 py-4 px-6 rounded-full glow-button hover:brightness-110 text-white font-extrabold tracking-wide active:scale-[0.98] transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <Heart className="w-4 h-4 fill-white shrink-0 text-white animate-pulse" />
              {t("create_lobby")}
            </button>

            <button
              id="join-toggle-btn"
              type="button"
              onClick={() => setShowJoinInput(!showJoinInput)}
              disabled={!name.trim()}
              className="flex items-center justify-center gap-2 py-4 px-6 rounded-full bg-black/20 border border-white/5 hover:bg-white/5 hover:border-[#ff5637]/30 text-white font-extrabold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <Key className="w-4 h-4 text-[#ffdb3c] shrink-0" />
              {language === "nl" ? "Code invoeren" : "Enter code"}
            </button>
          </div>
        )}

        {/* Join Code Input Form */}
        {showJoinInput && (
          <form onSubmit={handleJoinSubmit} className="pt-4 border-t border-white/5 space-y-3 animate-fade-in">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block text-center">
              {t("enter_4_digit")}
            </label>
            <div className="flex gap-2 max-w-xs mx-auto">
              <input
                id="join-code-input"
                type="text"
                maxLength={5}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                className="w-full bg-black/20 border border-white/5 focus:border-[#ff5637] text-center text-2xl tracking-[0.2em] font-black py-3 text-white rounded-xl focus:outline-none placeholder:tracking-normal"
                placeholder="CODE5"
              />
              <button
                id="join-submit-btn"
                type="submit"
                disabled={joinCode.length !== 4 && joinCode.length !== 5}
                className="px-6 rounded-full glow-button text-white font-extrabold cursor-pointer disabled:opacity-45 disabled:pointer-events-none transition-all"
              >
                {t("connect_lobby_btn")}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
