import { Movie } from "../types";
import { Award, Star, Play, Ghost } from "lucide-react";
import ProviderLogo from "./ProviderLogo";

interface MatchesScreenProps {
  matches: Movie[];
  onBackToSwipes: () => void;
}

export default function MatchesScreen({ matches, onBackToSwipes }: MatchesScreenProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Overview stats header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-card rounded-[2rem] p-5 shadow-sm border border-white/5">
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display tracking-tight text-[#e3e0f1] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ff5637]" />
            Gezamenlijke Matches
          </h2>
          <p className="text-xs text-slate-300">
            {matches.length === 1 
              ? "Je hebt 1 gezamenlijke film-match! Pak de popcorn maar alvast!" 
              : `Jullie hebben ${matches.length} gezamenlijke matches op jullie lijst!`}
          </p>
        </div>

        <button
          id="watchlist-back-btn"
          onClick={onBackToSwipes}
          className="px-5 py-2.5 rounded-full bg-black/20 border border-white/5 hover:bg-white/5 hover:border-[#ff5637]/30 text-white text-xs font-bold transition-all cursor-pointer"
        >
          Verder Swipen
        </button>
      </div>

      {/* Grid of Matched Movies */}
      {matches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {matches.map((movie) => (
            <div
              key={movie.id}
              id={`matched-card-${movie.id}`}
              className="glass-card border border-white/5 hover:border-[#ff5637]/45 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col group"
            >
              {/* Cover Backdrop */}
              <div className="w-full h-36 relative overflow-hidden bg-slate-950">
                <img
                  src={movie.backdrop}
                  alt={movie.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Score overlay */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/5 text-[10px] font-bold text-[#ffdb3c]">
                  <Star className="w-3 h-3 fill-[#ffdb3c] text-[#ffdb3c]" />
                  <span>{movie.rating}</span>
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
                  <h3 className="text-base font-bold font-display text-[#e3e0f1] line-clamp-1 group-hover:text-[#ffb4a5] transition-colors">
                    {movie.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400">
                    <span>{movie.year}</span>
                    {movie.language && (
                      <>
                        <span>•</span>
                        <span className="uppercase">{movie.language}</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed italic block font-medium">
                  "{movie.synopsis}"
                </p>

                {/* Badge providers listing */}
                <div className="space-y-2 pt-2.5 border-t border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Beschikbaar op:
                  </span>
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {movie.providers.map((p, idx) => (
                      <div key={idx} className="w-14 h-9 overflow-hidden rounded-xl shadow shrink-0 select-none">
                        <ProviderLogo id={p} active={true} size={15} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Empty state
        <div className="text-center py-16 bg-black/10 border border-white/5 rounded-[2rem] space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 border border-white/10 mx-auto">
            <Ghost className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-display text-white">Nog geen gezamenlijke matches</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed px-4">
              Wanneer jullie allebei 'Leuk' (Rechts Swipen in de app) op exact dezelfde film selecteren, verschijnt die film hier direct live in real-time!
            </p>
          </div>
          <button
            id="watchlist-start-swipe-btn"
            onClick={onBackToSwipes}
            className="px-6 py-3 bg-gradient-to-r from-[#ff5637] to-[#ba1c00] text-white font-extrabold rounded-full cursor-pointer hover:brightness-110 active:scale-95 transition-all outline-none"
          >
            Nu beginnen met Swipen
          </button>
        </div>
      )}

    </div>
  );
}
