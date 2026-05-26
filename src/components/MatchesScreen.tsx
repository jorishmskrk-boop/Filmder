import { Movie, Room } from "../types";
import { Award, Star, Play, Ghost, Heart, Sparkles } from "lucide-react";
import ProviderLogo from "./ProviderLogo";
import { useLanguage } from "../LanguageContext";

interface MatchesScreenProps {
  matches: Movie[];
  room: Room;
  currentUserId: string;
  onBackToSwipes: () => void;
  isSolo?: boolean;
  onRemoveMatch: (movieId: string) => void;
  onToggleSuperLike: (movieId: string) => void;
  onFetchSimilarBatch?: () => void;
}

export default function MatchesScreen({
  matches,
  room,
  currentUserId,
  onBackToSwipes,
  isSolo = false,
  onRemoveMatch,
  onToggleSuperLike,
  onFetchSimilarBatch,
}: MatchesScreenProps) {
  const { language, t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Overview stats header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card rounded-[2rem] p-5 shadow-sm border border-white/5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display tracking-tight text-[#e3e0f1] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ff5637]" />
            {isSolo 
              ? (language === "nl" ? "Mijn Favoriete Films" : "My Favorite Movies")
              : (language === "nl" ? "Gezamenlijke Matches" : "Mutual Matches")}
          </h2>
          <p className="text-xs text-slate-300">
            {isSolo ? (
              matches.length === 1 
                ? (language === "nl" 
                    ? "Je hebt 1 film bewaard! Pak de popcorn maar alvast!" 
                    : "You have 1 saved movie! Get the popcorn ready!") 
                : (language === "nl"
                    ? `Je hebt ${matches.length} films op je favorietenlijst!`
                    : `You have ${matches.length} movies on your favorites list!`)
            ) : (
              matches.length === 1 
                ? (language === "nl" 
                    ? "Je hebt 1 gezamenlijke film-match! Pak de popcorn maar alvast!" 
                    : "You have 1 mutual movie match! Get the popcorn ready!") 
                : (language === "nl"
                    ? `Jullie hebben ${matches.length} gezamenlijke matches op jullie lijst!`
                    : `You have ${matches.length} mutual matches on your list!`)
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {matches.length > 0 && onFetchSimilarBatch && (
            <button
              id="watchlist-similar-btn"
              onClick={onFetchSimilarBatch}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-[#ff5637]/20 to-[#ba1c00]/20 border border-[#ff5637]/45 hover:border-[#ff5637] text-[#ffdb3c] hover:text-white text-xs font-bold transition-all cursor-pointer select-none flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
              title={language === "nl" ? "Maak een nieuwe filmstapel gebaseerd op je matches" : "Create a new movie stack based on your matches"}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ffdb3c] animate-pulse" />
              <span>{language === "nl" ? "Vind Vergelijkbare Films" : "Find Similar Movies"}</span>
            </button>
          )}

          <button
            id="watchlist-back-btn"
            onClick={onBackToSwipes}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/20 border border-white/5 hover:bg-white/5 hover:border-[#ff5637]/30 text-white text-xs font-bold transition-all cursor-pointer select-none text-center"
          >
            {language === "nl" ? "Verder Swipen" : "Keep Swiping"}
          </button>
        </div>
      </div>

      {/* Grid of Matched Movies */}
      {matches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...matches].reverse().map((movie) => {
            const superLikesCount = Object.keys(room?.superLikes || {}).filter(
              (uid) => room?.superLikes?.[uid]?.[movie.id] === true
            ).length;
            const hasMySuperLike = room?.superLikes?.[currentUserId]?.[movie.id] === true;

            return (
              <div
                key={movie.id}
                id={`matched-card-${movie.id}`}
                className="glass-card border border-white/5 hover:border-[#ff5637]/45 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col group"
              >
                {/* Cover Backdrop */}
                <div className="w-full h-36 relative overflow-hidden bg-slate-950 select-none">
                  <img
                    src={movie.backdrop}
                    alt={movie.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Floating extra heart (superLikesCount) stamp on top-left of image */}
                  {superLikesCount > 0 && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500 backdrop-blur-md border border-pink-400/25 text-[10px] font-black text-white shadow-md animate-bounce select-none">
                      <span>💖</span>
                      <span>{superLikesCount}</span>
                    </div>
                  )}

                  {/* Score overlay */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-[10.5px] font-extrabold shadow-lg">
                    <Star className="w-3 h-3 fill-[#ffdb3c] text-[#ffdb3c] shrink-0" />
                    <span className="text-white">{movie.rating}</span>
                    {movie.ratingSource === "IMDb" ? (
                      <span className="bg-[#f5c518] text-black text-[8px] font-black px-1.5 py-0.2 rounded-[3.5px] tracking-wide" title="IMDb Score">IMDb</span>
                    ) : (
                      <span className="bg-[#01b4e4] text-white text-[8px] font-black px-1.5 py-0.2 rounded-[3.5px] tracking-wide" title="TMDB Score">TMDB</span>
                    )}
                  </div>

                  {/* Cover trailer button overlay */}
                  {movie.trailerUrl && (
                    <a
                      href={movie.trailerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#ff5637] text-white flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <Play className="w-4 h-4 fill-white" />
                      </div>
                    </a>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#12121d] to-transparent" />
                </div>

                {/* Data body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold font-display text-[#e3e0f1] line-clamp-1 group-hover:text-[#ffb4a5] transition-colors select-text">
                      {movie.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 select-all">
                      <span>{movie.year}</span>
                      {movie.language && (
                        <>
                          <span>•</span>
                          <span className="uppercase">{movie.language}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-310 text-slate-350 text-xs line-clamp-2 leading-relaxed italic block font-medium select-text">
                    "{movie.synopsis}"
                  </p>

                  {movie.recommendedFrom && movie.recommendedFrom.length > 0 && (
                    <div className="text-[9.5px] text-slate-400 bg-white/5 border border-white/5 rounded-lg px-2 py-1 flex items-center gap-1 inline-flex max-w-full select-text">
                      <Sparkles className="w-3 h-3 text-[#ffdb3c] shrink-0 fill-[#ffdb3c]/10 animate-pulse" />
                      <span className="truncate" title={movie.recommendedFrom.join(", ")}>
                        {language === "nl" ? "Aanbevolen n.a.v." : "Recommended based on"}: <strong className="text-[#ffdb3c] font-bold">{movie.recommendedFrom.join(", ")}</strong>
                      </span>
                    </div>
                  )}

                  {/* Badge providers listing */}
                  <div className="space-y-2 pt-2.5 border-t border-white/5 select-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                      {language === "nl" ? "Beschikbaar op:" : "Available on:"}
                    </span>
                    <div className="flex flex-wrap gap-2.5 items-center">
                      {movie.providers.map((p, idx) => (
                        <div key={idx} className="w-14 h-9 overflow-hidden rounded-xl shadow shrink-0 select-none">
                          <ProviderLogo id={p} active={true} size={15} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action buttons footer */}
                  <div className="flex gap-2.5 mt-2">
                    {/* Extra Heart (Super Like) Button */}
                    <button
                      type="button"
                      onClick={() => onToggleSuperLike(movie.id)}
                      className={`flex-1 py-2 px-3 rounded-xl border transition-all duration-300 cursor-pointer select-none text-[11px] font-extrabold uppercase tracking-wide flex items-center justify-center gap-1.5 ${
                        hasMySuperLike
                          ? "bg-gradient-to-r from-pink-500 to-rose-500 border-pink-400 text-white shadow-md shadow-pink-500/25 hover:brightness-110 active:scale-95"
                          : "bg-pink-550/10 border-pink-500/20 text-pink-400 hover:bg-pink-500/20 active:scale-95"
                      }`}
                      title={language === "nl" ? "Geef een extra hartje!" : "Give an extra heart!"}
                    >
                      <Heart className={`w-3.5 h-3.5 ${hasMySuperLike ? "fill-white text-white" : "fill-none text-pink-400"}`} />
                      <span>{superLikesCount > 0 ? `${superLikesCount}` : "+1"}</span>
                    </button>

                    {/* Remove Match button */}
                    <button
                      type="button"
                      onClick={() => onRemoveMatch(movie.id)}
                      className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-450 hover:text-red-400 text-[11px] font-bold border border-red-500/15 rounded-xl transition-all cursor-pointer select-none uppercase tracking-wider shrink-0"
                      title={isSolo
                        ? (language === "nl" ? "Verwijder uit Favorieten" : "Remove from Favorites")
                        : (language === "nl" ? "Verwijder voor iedereen" : "Remove for everyone")}
                    >
                      {language === "nl" ? "Verwijder" : "Remove"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Empty state
        <div className="text-center py-16 bg-black/10 border border-white/5 rounded-[2rem] space-y-4 select-none">
          <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 border border-white/10 mx-auto">
            <Ghost className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-display text-white">
              {isSolo 
                ? (language === "nl" ? "Nog geen favoriete films" : "No favorite movies yet")
                : (language === "nl" ? "Nog geen gezamenlijke matches" : "No mutual matches yet")}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed px-4">
              {isSolo ? (
                language === "nl"
                  ? "Wanneer je een film naar 'Leuk' (Rechts Swipen) swipet, verschijnt deze hier direct zodat je ze later makkelijk kunt bekijken!"
                  : "When you swipe a movie to 'Like' (Swipe right), it will instantly appear here so you can easily review it later!"
              ) : (
                language === "nl" 
                  ? "Wanneer jullie allebei 'Leuk' (Rechts Swipen in de app) op exact dezelfde film selecteren, verschijnt die film hier direct live in real-time!" 
                  : "When both of you swipe 'Like' (Swipe right in the app) on the exact same movie, it will instantly appear here live in real-time!"
              )}
            </p>
          </div>
          <button
            id="watchlist-start-swipe-btn"
            onClick={onBackToSwipes}
            className="px-6 py-3 bg-gradient-to-r from-[#ff5637] to-[#ba1c00] text-white font-extrabold rounded-full cursor-pointer hover:brightness-110 active:scale-95 transition-all outline-none"
          >
            {language === "nl" ? "Nu beginnen met Swipen" : "Start Swiping Now"}
          </button>
        </div>
      )}

    </div>
  );
}
