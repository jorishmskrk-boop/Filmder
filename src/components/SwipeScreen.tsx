import { useState, useEffect, useRef, SVGProps } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { Heart, X, Sparkles, AlertCircle, Award, Star, RefreshCw, MessageSquare, Info, Play } from "lucide-react";
import { Movie, Room } from "../types";
import Confetti from "./Confetti";
import ProviderLogo from "./ProviderLogo";

interface SwipeScreenProps {
  room: Room;
  currentUserId: string;
  onSwipe: (movieId: string, liked: boolean) => void;
  onSendReaction: (emoji: string) => void;
  onResetDeck: () => void;
  onFetchNewBatch: () => void;
}

const REACTION_MAP: Record<string, { label: string; color: string }> = {
  "❤️": { label: "Favoriet", color: "from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/30" },
  "🔥": { label: "Must Watch", color: "from-orange-500/20 to-amber-550/20 text-amber-400 border-amber-500/30" },
  "😂": { label: "Hilarisch", color: "from-yellow-500/20 to-lime-500/20 text-yellow-400 border-yellow-500/30" },
  "🍿": { label: "Zin In", color: "from-emerald-500/20 to-teal-550/20 text-emerald-400 border-emerald-500/30" },
  "😱": { label: "Spannend", color: "from-violet-500/20 to-fuchsia-500/20 text-violet-400 border-violet-550/30" },
};

export default function SwipeScreen({
  room,
  currentUserId,
  onSwipe,
  onSendReaction,
  onResetDeck,
  onFetchNewBatch,
}: SwipeScreenProps) {
  // Find partner details
  const usersList = Object.entries(room.users || {});
  const partnerEntry = usersList.find(([uid]) => uid !== currentUserId);
  const partnerId = partnerEntry?.[0];
  const partnerName = partnerEntry?.[1] || "Partner";

  // Filter unswiped movies
  const mySwipes = room.swipes?.[currentUserId] || {};
  const unswipedMovies = (room.movies || []).filter(m => mySwipes[m.id] === undefined);

  // Reaction display state
  const [partnerReaction, setPartnerReaction] = useState<{ label: string; text: string } | null>(null);
  const activeReactionTimer = useRef<NodeJS.Timeout | null>(null);

  // Handle active matching overlay
  const [celebrationMatch, setCelebrationMatch] = useState<Movie | null>(null);

  // Track swipe direction for exit animation custom propagation
  const [swipeDirection, setSwipeDirection] = useState<"like" | "dislike" | null>(null);

  // Reset direction on card change
  useEffect(() => {
    setSwipeDirection(null);
  }, [unswipedMovies[0]?.id]);

  // Monitor reactions
  useEffect(() => {
    if (!partnerId) return;
    const reaction = room.reactions?.[partnerId];
    if (!reaction) return;

    // Only show if reaction is recent (made within the last 15 seconds)
    const timeDiff = Date.now() - reaction.timestamp;
    if (timeDiff < 15000) {
      if (activeReactionTimer.current) clearTimeout(activeReactionTimer.current);

      const mapped = REACTION_MAP[reaction.emoji] || { label: reaction.emoji, color: "" };
      setPartnerReaction({
        label: mapped.label,
        text: `${partnerName} stuurde: "${mapped.label}"`,
      });

      activeReactionTimer.current = setTimeout(() => {
        setPartnerReaction(null);
      }, 2500);
    }
  }, [room.reactions, partnerId, partnerName]);

  // Monitor matched movies list to trigger full screen celebration only when both players are finished
  const hasCelebrated = useRef(false);
  useEffect(() => {
    const currentMatches = room.matches || [];
    const totalMovies = (room.movies || []).length;
    if (totalMovies === 0) return;

    const users = Object.keys(room.users || {});
    const allPlayersFinished = users.every(uid => {
      const swipes = room.swipes?.[uid] || {};
      return Object.keys(swipes).length >= totalMovies;
    });

    if (allPlayersFinished && currentMatches.length > 0) {
      if (!hasCelebrated.current) {
        const newestMatch = currentMatches[currentMatches.length - 1];
        setCelebrationMatch(newestMatch);
        hasCelebrated.current = true;
      }
    } else {
      hasCelebrated.current = false;
    }
  }, [room.matches, room.users, room.swipes, room.movies]);

  // Swiping keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (celebrationMatch) return;
      if (unswipedMovies.length === 0) return;

      const topMovie = unswipedMovies[0];
      if (e.key === "ArrowLeft") {
        setSwipeDirection("dislike");
        onSwipe(topMovie.id, false);
      } else if (e.key === "ArrowRight") {
        setSwipeDirection("like");
        onSwipe(topMovie.id, true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [unswipedMovies, onSwipe, celebrationMatch]);

  const currentMovie = unswipedMovies[0];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-2 relative select-none">
      
      {/* Floating Partner Reaction Notification Banner */}
      <AnimatePresence>
        {partnerReaction && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#12121d]/95 backdrop-blur-md border border-[#ff5637]/30 text-[#ffb4a5] py-3 px-5 rounded-2xl flex items-center gap-2.5 shadow-[0_5px_22px_rgba(255,86,55,0.15)] z-30"
          >
            <span className="w-2 h-2 rounded-full bg-[#ff5637] animate-ping" />
            <span className="text-xs font-bold font-sans">{partnerReaction.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col lg:flex-row gap-8 items-stretch justify-center min-h-[calc(100vh-180px)]">
        
        {/* Left Column: Swiper Deck Area */}
        <div className="flex-[1.8] flex flex-col items-center justify-center relative bg-black/20 border border-white/5 p-6 md:p-8 rounded-[40px] w-full">
          
          {/* Movie Card Stack */}
          <div className="relative w-full max-w-[520px] h-[340px] md:h-[360px]">
            
            {/* Background Cards */}
            {currentMovie && (
              <div className="absolute inset-0 bg-[#0c0a0e]/60 rounded-[32px] border border-white/5 translate-y-4 scale-95 opacity-30 pointer-events-none transition-all duration-300 animate-pulse"></div>
            )}
            
            <AnimatePresence mode="popLayout" custom={swipeDirection}>
              {currentMovie ? (
                <CinephileCard
                  key={currentMovie.id}
                  movie={currentMovie}
                  onSwipe={onSwipe}
                  swipeDirection={swipeDirection}
                  setSwipeDirection={setSwipeDirection}
                />
              ) : (
                // Deck empty fallback view
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black/20 rounded-[32px] border border-white/5 border-dashed p-8 flex flex-col justify-center items-center text-center space-y-4"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-900 text-slate-500 flex items-center justify-center mx-auto border border-white/10">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-[#e3e0f1] font-display">Einde van de filmstapel!</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Er zijn geen films meer beschikbaar binnen je geselecteerde criteria en streamingdiensten. Pas de lobby-instellingen aan of herlaad de stapel!
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      id="reset-deck-btn"
                      onClick={onResetDeck}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-[#12121d] border border-white/10 hover:border-white/30 text-slate-300 rounded-xl cursor-pointer hover:bg-black/30 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
                      Geziene films herhalen
                    </button>
                    <button
                      id="fetch-new-deck-btn"
                      onClick={onFetchNewBatch}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-[#ff5637] to-[#ba1c00] text-white rounded-xl cursor-pointer hover:opacity-95 transition-all shadow-md active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Gloednieuwe stapel ophalen
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Swipe Action Controls */}
          {currentMovie && (
            <div className="flex items-center gap-8 mt-12">
              <button
                id="swipe-dislike-btn"
                type="button"
                onClick={() => {
                  setSwipeDirection("dislike");
                  onSwipe(currentMovie.id, false);
                }}
                className="w-16 h-16 rounded-full border border-white/10 bg-[#12121d]/80 flex items-center justify-center text-slate-400 hover:text-white hover:border-white/30 hover:scale-105 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Slecht weigeren (Links)"
              >
                <X className="w-8 h-8" />
              </button>
              
              <button
                id="swipe-like-btn"
                type="button"
                onClick={() => {
                  setSwipeDirection("like");
                  onSwipe(currentMovie.id, true);
                }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff5637] to-[#ba1c00] flex items-center justify-center text-white shadow-xl shadow-red-500/20 ring-4 ring-[#ff5637]/10 group hover:scale-[1.06] transition-all active:scale-0.96 cursor-pointer"
                title="Leuk vinden (Rechts)"
              >
                <Heart className="w-12 h-12 fill-white text-white group-hover:scale-110 transition-transform" />
              </button>

              <button
                id="swipe-reset-btn"
                type="button"
                onClick={onResetDeck}
                className="w-16 h-16 rounded-full border border-white/10 bg-[#12121d]/80 flex items-center justify-center text-slate-400 hover:text-[#ffdb3c] hover:border-[#ffdb3c]/50 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Stapel resetten"
              >
                <RefreshCw className="w-6 h-6" />
              </button>
            </div>
          )}

          {currentMovie && (
            <div className="text-center mt-4 text-[11px] text-slate-500 tracking-wider">
              TIP: Gebruik de pijltoetsen <span className="text-[#ffdb3c] font-bold border border-white/10 px-1 py-0.5 rounded bg-black/40">← Links (Weigeren)</span> of <span className="text-[#ff5637] font-bold border border-white/10 px-1 py-0.5 rounded bg-black/40">→ Rechts (Leuk)</span> op je toetsenbord.
            </div>
          )} </div>
                  {/* Right Column: Immersive Info & Activity Sidebar */}
        <aside className="flex-1 flex flex-col gap-6 justify-between lg:max-w-xs xl:max-w-sm w-full">
          
          {/* Live Activity Card */}
          <div className="glass-card rounded-3xl p-6 shadow-sm flex flex-col justify-center border border-white/5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Status</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff5637] to-[#ba1c00] flex items-center justify-center text-white font-black select-none uppercase font-display border border-white/10">
                  {partnerId ? partnerName.slice(0, 2).toUpperCase() : "SL"}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 border-2 border-[#12121d] rounded-full ${partnerId ? "bg-[#ffdb3c]" : "bg-neutral-800"}`}></div>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">
                  {partnerId ? partnerName : "Alleen Swipen"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {partnerId 
                    ? room.reactions?.[partnerId] 
                      ? `Reageerde met "${REACTION_MAP[room.reactions[partnerId].emoji]?.label || room.reactions[partnerId].emoji}"` 
                      : "Swipet door de catalogus..."
                    : "Nodig je partner uit!"}
                </p>
              </div>
            </div>
          </div>

          {/* Match Progress overview list */}
          <div className="glass-card rounded-3xl p-6 flex-1 flex flex-col justify-between border border-white/5 min-h-[180px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recente Matches</h3>
                <span className="text-xs font-extrabold bg-[#ff5637]/10 text-[#ffb4a5] px-2.5 py-0.5 rounded-full border border-[#ff5637]/25 select-none">
                  {room.matches?.length || 0} Matches
                </span>
              </div>
              
              <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {room.matches && room.matches.length > 0 ? (
                  room.matches.slice(-3).reverse().map((matchItem) => (
                    <div key={matchItem.id} className="flex gap-3 group animate-all duration-300 items-center justify-between">
                      <div className="flex gap-3 items-center min-w-0">
                        <div
                          className="w-10 h-14 rounded-lg bg-cover bg-center shrink-0 border border-white/5"
                          style={{ backgroundImage: `url('${matchItem.backdrop}')` }}
                        />
                        <div className="flex flex-col justify-center min-w-0 font-sans">
                          <p className="text-sm font-bold text-white group-hover:text-[#ff5637] leading-tight line-clamp-1 transition-colors font-display">
                            {matchItem.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 gap-1.5 flex items-center">
                            <span>{matchItem.year}</span>
                            <span className="inline-flex items-center gap-0.5 text-[#ffdb3c] font-bold">★ {matchItem.rating}</span>
                          </p>
                          <div className="flex gap-1 mt-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5637] animate-pulse" title="Jij vond dit leuk" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#ffe16d]" title="Je partner vond dit leuk" />
                          </div>
                        </div>
                      </div>
                      {matchItem.trailerUrl && (
                        <a
                          href={matchItem.trailerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-[#ff5637]/10 hover:bg-gradient-to-br hover:from-[#ff5637] hover:to-[#ba1c00] text-[#ffb4a5] hover:text-white rounded-xl transition-all border border-white/5 shrink-0 shadow-sm hover:scale-105 cursor-pointer"
                          title="Bekijk filmtrailer op YouTube"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-5 text-center leading-relaxed">
                    Nog geen gezamenlijke matches. Liket allebei een film om matches te genereren!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Reactions Tray without raw emojis */}
          <div className="space-y-3 glass-card rounded-3xl p-4 border border-white/5">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">Reactie Sturen</h3>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {Object.entries(REACTION_MAP).map(([emoji, item]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSendReaction(emoji)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-white/5 bg-gradient-to-r from-[#ff5637]/10 to-transparent text-[#ffb4a5] select-none cursor-pointer active:scale-95 transition-all hover:border-[#ff5637]/45 hover:from-[#ff5637]/20"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

        </aside>

      </div>

      {/* Match Celebration Screen Overlay modal */}
      <AnimatePresence>
        {celebrationMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#060508]/95 backdrop-blur-md z-40 flex items-center justify-center p-4"
          >
            <Confetti />

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card border border-[#ff5637]/30 max-w-sm w-full rounded-[2rem] overflow-hidden p-6 text-center space-y-6 shadow-2xl shadow-[#ff5637]/25 relative"
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#ff5637]/15 border border-[#ff5637]/30 text-[#ffb4a5] text-xs font-bold uppercase tracking-widest mb-2 animate-bounce font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[#ffdb3c]" />
                Jullie hebben een Match!
              </div>

              <div className="w-full h-36 rounded-2xl overflow-hidden relative border border-white/5 shadow-inner">
                <img
                  src={celebrationMatch.backdrop}
                  alt={celebrationMatch.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121d] to-transparent" />
              </div>

              <div className="space-y-1 inline-block w-full">
                <h3 className="text-2xl font-black font-display tracking-tight text-[#e3e0f1] px-2">
                  {celebrationMatch.title}
                </h3>
                <p className="text-[#ffe16d] text-xs font-sans font-extrabold flex items-center justify-center gap-1.5 mt-1">
                  <span>Uitgebracht in {celebrationMatch.year}</span>
                  <span className="text-[#ffdb3c]">★ {celebrationMatch.rating}</span>
                </p>
              </div>

              <p className="text-[#e3e0f1]/90 text-xs leading-relaxed italic block px-2 font-medium">
                "{celebrationMatch.synopsis}"
              </p>

              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Te zien op jouw diensten:
                </span>
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {celebrationMatch.providers.map((p, idx) => (
                    <div
                      key={idx}
                      className="w-14 h-9 overflow-hidden rounded-xl shadow-md shrink-0 select-none"
                    >
                      <ProviderLogo id={p} active={true} size={16} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full pt-2">
                {celebrationMatch.trailerUrl && (
                  <a
                    id="celebration-trailer-link"
                    href={celebrationMatch.trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-3 px-4 rounded-full bg-red-655 hover:bg-gradient-to-br hover:from-red-600 hover:to-red-700 text-white font-extrabold flex items-center justify-center gap-2 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 text-xs uppercase tracking-widest"
                  >
                    <Play className="w-3.5 h-3.5 fill-white text-white shrink-0" />
                    Bekijk Trailer
                  </a>
                )}
                <button
                  id="close-match-celebration-btn"
                  type="button"
                  onClick={() => setCelebrationMatch(null)}
                  className="w-full py-3 px-4 rounded-full glow-button text-white font-extrabold tracking-wide shadow-md active:scale-95 transition-all cursor-pointer text-xs uppercase tracking-widest"
                >
                  Verder Swipen!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

interface CinephileCardProps {
  key?: string | number;
  movie: Movie;
  onSwipe: (movieId: string, liked: boolean) => void;
  swipeDirection: "like" | "dislike" | null;
  setSwipeDirection: (direction: "like" | "dislike" | null) => void;
}

function CinephileCard({ movie, onSwipe, swipeDirection, setSwipeDirection }: CinephileCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0.5, 1, 1, 1, 0.5]);

  // Stamp overlay opacities
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  return (
    <motion.div
      key={movie.id}
      custom={swipeDirection}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={(direction) => ({
        x: direction === "like" ? 450 : direction === "dislike" ? -450 : 0,
        rotate: direction === "like" ? 18 : direction === "dislike" ? -18 : 0,
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.25 }
      })}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      style={{ x, rotate, opacity }}
      onDragEnd={(event, info) => {
        const swipeThreshold = 130;
        if (info.offset.x > swipeThreshold) {
          setSwipeDirection("like");
          onSwipe(movie.id, true);
        } else if (info.offset.x < -swipeThreshold) {
          setSwipeDirection("dislike");
          onSwipe(movie.id, false);
        }
      }}
      className="absolute inset-0 bg-[#12121d] rounded-[32px] border border-white/10 overflow-hidden shadow-2xl group flex flex-col justify-between cursor-grab active:cursor-grabbing select-none"
    >
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.02]" 
        style={{ backgroundImage: `url('${movie.backdrop}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
      </div>

      {/* LIKE Badge Stamp Overlay */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-10 left-10 border-4 border-emerald-500 text-emerald-500 font-extrabold text-2xl uppercase px-4 py-1.5 rounded-xl z-25 pointer-events-none select-none tracking-widest font-mono shadow-md shadow-emerald-500/10 bg-black/45 backdrop-blur-xs"
      >
        VIND IK LEUK!
      </motion.div>

      {/* NOPE Badge Stamp Overlay */}
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="absolute top-10 right-10 border-4 border-rose-500 text-rose-500 font-extrabold text-2xl uppercase px-4 py-1.5 rounded-xl z-25 pointer-events-none select-none tracking-widest font-mono shadow-md shadow-rose-500/10 bg-black/45 backdrop-blur-xs"
      >
        NEE BEDANKT
      </motion.div>

      <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end z-10 pointer-events-none">
        <div className="flex items-center gap-2 mb-3">
          {movie.genres.slice(0, 3).map((g, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-[#ff5637]/15 border border-[#ff5637]/30 text-[#ffb4a5] text-[10px] font-bold uppercase tracking-wider rounded-full select-none"
            >
              {g}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {movie.trailerUrl && (
              <a
                id="movie-trailer-link"
                href={movie.trailerUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto flex items-center gap-1 bg-gradient-to-r from-red-655 to-red-600 hover:from-red-500 hover:to-red-600 border border-red-500/25 px-2.5 py-1.5 text-[9px] font-extrabold text-white uppercase tracking-widest rounded-full shrink-0 cursor-pointer shadow-md transition-all active:scale-95 hover:scale-105"
                title="Bekijk de trailer op YouTube"
              >
                <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
                Trailer
              </a>
            )}
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/5 px-2.5 py-1.5 rounded-full">
              <Star className="w-3.5 h-3.5 text-[#ffdb3c] fill-[#ffdb3c] shrink-0" />
              <span className="text-xs font-bold text-[#ffdb3c]">{movie.rating}</span>
            </div>
          </div>
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight tracking-tight drop-shadow-md font-display">
          {movie.title}
        </h2>

        <p className="text-slate-300 text-xs md:text-sm line-clamp-2 italic mb-4 font-sans leading-relaxed">
          "{movie.synopsis}"
        </p>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-slate-300">
            <span className="px-1.5 py-0.5 bg-[#8c7fff]/15 border border-[#8c7fff]/25 text-[#cec9ff] text-[9px] font-extrabold rounded tracking-wider shrink-0 select-none">
              STREAM
            </span>
            {movie.providers.map((p, pIdx) => (
              <div key={pIdx} className="w-12 h-8 overflow-hidden rounded-xl shrink-0 select-none shadow">
                <ProviderLogo id={p} active={true} size={14} />
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0 select-none">
            {movie.language && (
              <span className="px-2 py-0.5 bg-slate-900 border border-white/5 text-slate-300 text-[10px] rounded-md font-sans font-semibold tracking-wide">
                {movie.language}
              </span>
            )}
            <span className="px-2 py-0.5 bg-slate-900 border border-white/5 text-slate-400 text-[10px] rounded-md font-mono font-bold">
              {movie.year}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Tv(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1.5em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
      <path d="m17 2-5 5-5-5" />
    </svg>
  );
}

