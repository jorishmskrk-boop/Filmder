import { useState, useEffect } from "react";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import {
  auth,
  OperationType,
  handleFirestoreError,
  getRoomRef,
  createRoomInFirestore,
  joinRoomInFirestore,
  swipeMovieInFirestore,
  addMatchInFirestore,
  updateMatchesInFirestore,
  toggleSuperLikeInFirestore,
  sendGlobalReactionInFirestore,
  resetRoomDeckInFirestore,
  loadNewBatchInFirestore
} from "./firebase";
import { Movie, Room, Preferences } from "./types";
import { useRoomSession } from "./hooks/useRoomSession";
import LandingScreen from "./components/LandingScreen";
import LobbyScreen from "./components/LobbyScreen";
import SwipeScreen from "./components/SwipeScreen";
import MatchesScreen from "./components/MatchesScreen";
import FilmFlameLogo from "./components/FilmFlameLogo";
import { LogOut, User as UserIcon } from "lucide-react";
import { GENRES } from "./constants";
import toast, { Toaster } from "react-hot-toast";
import { useLanguage } from "./LanguageContext";

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic shared room code scanned from url
  const [sharedRoomCode, setSharedRoomCode] = useState<string | null>(null);

  // Auto loading batch state-lock
  const [isAutoLoadingBatch, setIsAutoLoadingBatch] = useState(false);

  // 1. Hook up the custom room session to handle room state, subscription and tabs
  const {
    roomCode,
    setRoomCode,
    room,
    swipingStarted,
    setSwipingStarted,
    activeTab,
    setActiveTab,
  } = useRoomSession(user, setErrorMsg);

  // 2. Initialize Firebase Anonymous authentication on component mount
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        try {
          const credentials = await signInAnonymously(auth);
          setUser(credentials.user);
        } catch (err) {
          console.error("Firebase Anonymous login error:", err);
          setErrorMsg("Anonieme Firebase-authenticatie met de cloudserver is mislukt.");
          toast.error("Firebase-authenticatie is mislukt.");
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 3. Scan and pre-populate room code if shared in the URL search params (?room=ABCDE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedRoom = params.get("room");
    if (sharedRoom && (sharedRoom.length === 4 || sharedRoom.length === 5)) {
      const upperCode = sharedRoom.toUpperCase();
      setSharedRoomCode(upperCode);
      toast.success(t("invitation_received").replace("{code}", upperCode), {
        duration: 6000,
      });
    }
  }, []);

  // 4. Automatically load a completely new, fresh batch of movies when both are done and no matches are found
  useEffect(() => {
    if (!roomCode || !room || !user || isAutoLoadingBatch) return;
    
    // Check if both users have finished swiping
    const userIds = Object.keys(room.users || {});
    if (userIds.length < 2) return; // Only trigger when both players are connected
    
    const totalMovies = (room.movies || []).length;
    if (totalMovies === 0) return;
    
    const allFinished = userIds.every(uid => {
      const swipes = room.swipes?.[uid] || {};
      return Object.keys(swipes).length >= totalMovies;
    });

    const hasMatches = (room.matches || []).length > 0;

    if (allFinished && !hasMatches) {
      const fetchNewBatch = async () => {
        setIsAutoLoadingBatch(true);
        setLoading(true);

        try {
          const swipedIds = new Set<string>();
          if (room.swipes) {
            Object.values(room.swipes).forEach((userSwipes: any) => {
              if (userSwipes) {
                Object.keys(userSwipes).forEach(movieId => swipedIds.add(String(movieId)));
              }
            });
          }
          if (room.movies) {
            room.movies.forEach((m: any) => swipedIds.add(String(m.id)));
          }
          const excludeIds = Array.from(swipedIds);

          const res = await fetch("/api/movies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              country: room.country || "NL",
              providers: room.providers || ["netflix"],
              vibe: room.vibe || "",
              maxRuntime: room.maxRuntime,
              minRuntime: room.minRuntime,
              minRating: room.minRating,
              maxRating: room.maxRating,
              releaseDecade: room.releaseDecade,
              minYear: room.minYear,
              maxYear: room.maxYear,
              ageRating: room.ageRating,
              excludeIds,
            }),
          });

          if (!res.ok) {
            throw new Error(`Nieuwe batch ophalen mislukt: ${res.statusText}`);
          }

          const moviesData = await res.json();
          const movieCollection: Movie[] = moviesData.movies || [];

          if (movieCollection.length > 0) {
            await loadNewBatchInFirestore(roomCode, userIds, movieCollection, true, moviesData.fallbackLevel);
            toast.success("Niemand vond de vorige films leuk... Er is automatisch een nieuwe stapel films geladen!");
          }
        } catch (err) {
          console.error("Fout bij het automatisch ophalen van een nieuwe batch:", err);
          toast.error("Automatisch ophalen van een nieuwe filmstapel is mislukt.");
        } finally {
          setIsAutoLoadingBatch(false);
          setLoading(false);
        }
      };

      fetchNewBatch();
    }
  }, [room?.swipes, room?.movies, room?.matches, roomCode, user, isAutoLoadingBatch]);

  // Generate unique 5 character alphanumeric code to increase entropy and prevent collisions
  const generate4DigitCode = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Create match room session handler
  const handleCreateRoom = async (prefs: Preferences) => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // Generate code and verify with Firestore that it is truly unused, loop until we find one
      let code = generate4DigitCode();
      let roomDocRef = getRoomRef(code);
      let isUnused = false;
      let attempts = 0;

      while (!isUnused && attempts < 15) {
        const docSnap = await getDoc(roomDocRef);
        if (!docSnap.exists()) {
          isUnused = true;
        } else {
          code = generate4DigitCode();
          roomDocRef = getRoomRef(code);
          attempts++;
        }
      }

      // Call API server-side route to fetch movies using server key ONLY
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: prefs.country,
          providers: prefs.providers,
          vibe: prefs.vibe,
          maxRuntime: prefs.maxRuntime,
          minRuntime: prefs.minRuntime,
          minRating: prefs.minRating,
          maxRating: prefs.maxRating,
          releaseDecade: prefs.releaseDecade,
          minYear: prefs.minYear,
          maxYear: prefs.maxYear,
          ageRating: prefs.ageRating,
        }),
      });

      if (!res.ok) {
        throw new Error(`Films ophalen mislukt: ${res.statusText}`);
      }

      const moviesData = await res.json();
      const movieCollection: Movie[] = moviesData.movies || [];

      if (movieCollection.length === 0) {
        throw new Error("Geen geschikte films gevonden. Probeer een andere sfeer-omschrijving of regio.");
      }

      // Build Room object in DB conforming to blueprint
      const roomPayload: Room = {
        id: code,
        createdAt: Date.now(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // TTL of 24 hours
        country: prefs.country,
        providers: prefs.providers,
        vibe: prefs.vibe,
        movies: movieCollection,
        users: {
          [user.uid]: prefs.name,
        },
        swipes: {
          [user.uid]: {},
        },
        matches: [],
        reactions: {},
      };

      if (prefs.maxRuntime !== undefined) roomPayload.maxRuntime = prefs.maxRuntime;
      if (prefs.minRuntime !== undefined) roomPayload.minRuntime = prefs.minRuntime;
      if (prefs.minRating !== undefined) roomPayload.minRating = prefs.minRating;
      if (prefs.maxRating !== undefined) roomPayload.maxRating = prefs.maxRating;
      if (prefs.releaseDecade !== undefined) roomPayload.releaseDecade = prefs.releaseDecade;
      if (prefs.minYear !== undefined) roomPayload.minYear = prefs.minYear;
      if (prefs.maxYear !== undefined) roomPayload.maxYear = prefs.maxYear;
      if (prefs.ageRating !== undefined) roomPayload.ageRating = prefs.ageRating;

      await createRoomInFirestore(code, roomPayload);

      setRoomCode(code);
      setSwipingStarted(false);
      setActiveTab("swipe");
      toast.success(t("room_created"));
    } catch (err: any) {
      console.error("Error creating matching room:", err);
      setErrorMsg(err.message || (language === "nl" ? "Er is een fout opgetreden bij het opzetten van de lobby." : "An error occurred while setting up the lobby."));
      toast.error(err.message || (language === "nl" ? "Lobby maken is mislukt." : "Failed to create lobby."));
    } finally {
      setLoading(false);
    }
  };

  // Join match room session handler
  const handleJoinRoom = async (code: string, prefs: Preferences) => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${code}`;
      const roomDocRef = getRoomRef(code);
      let roomSnap;
      try {
        roomSnap = await getDoc(roomDocRef);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, docPath);
      }

      if (!roomSnap || !roomSnap.exists()) {
        throw new Error(t("lobby_not_found").replace("{code}", code));
      }

      await joinRoomInFirestore(code, user.uid, prefs.name);

      setRoomCode(code);
      setSwipingStarted(false);
      setActiveTab("swipe");

      // Set URL search parameter cleanly without reloading the page
      window.history.replaceState({}, "", `?room=${code}`);
      toast.success(t("join_success").replace("{code}", code));
    } catch (err: any) {
      console.error("Error joining matching room:", err);
      setErrorMsg(err.message || (language === "nl" ? "Er is een fout opgetreden bij het deelnemen aan de lobby." : "An error occurred while joining the lobby."));
      toast.error(err.message || (language === "nl" ? "Deelnemen mislukt." : "Join failed."));
    } finally {
      setLoading(false);
    }
  };

  // Swipe handle updating swiped values and checking match overlays
  const handleSwipeMovie = async (movieId: string, liked: boolean) => {
    if (!user || !roomCode || !room) return;

    try {
      // Save swipe instantly to Firestore
      await swipeMovieInFirestore(roomCode, user.uid, movieId, liked);

      // If liked (true), check if all users in the room have liked it
      if (liked) {
        const userIds = Object.keys(room.users || {});
        if (userIds.length >= 2) {
          const allOthersLiked = userIds
            .filter((uid) => uid !== user.uid)
            .every((uid) => {
              const userSwipes = room.swipes?.[uid] || {};
              return userSwipes[movieId] === true;
            });

          if (allOthersLiked) {
            // Ensure we do not add duplicate matches
            const alreadyMatched = (room.matches || []).some((m) => {
              const matchedId = typeof m === "string" ? m : m.id;
              return matchedId === movieId;
            });

            if (!alreadyMatched) {
              const fullMovie = room.movies.find((m) => m.id === movieId);
              if (fullMovie) {
                await addMatchInFirestore(roomCode, fullMovie);
              } else {
                await addMatchInFirestore(roomCode, movieId);
              }
              toast.success("Match gevonden! 🎉", { icon: "🔥" });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error registering card swipe:", err);
    }
  };

  const handleToggleSuperLike = async (movieId: string) => {
    if (!user || !roomCode || !room) return;

    const alreadySuperLiked = room.superLikes?.[user.uid]?.[movieId] === true;

    try {
      await toggleSuperLikeInFirestore(roomCode, user.uid, movieId, !alreadySuperLiked);
      if (alreadySuperLiked) {
        toast.success(language === "nl" ? "Extra hartje verwijderd!" : "Extra heart removed!");
      } else {
        toast.success(language === "nl" ? "Extra hartje toegevoegd! 💖" : "Extra heart added! 💖");
      }
    } catch (err: any) {
      console.error("Error registering extra heart:", err);
    }
  };

  const handleRemoveMatch = async (movieId: string) => {
    if (!user || !roomCode || !room) return;

    try {
      if (isSolo) {
        // Solo mode: remove from favorites by setting swipe to false
        await swipeMovieInFirestore(roomCode, user.uid, movieId, false);
        toast.success(language === "nl" ? "Film verwijderd uit favorieten." : "Movie removed from favorites.");
      } else {
        // Multi-user mode: remove from matches array in Firestore
        const updatedMatches = (room.matches || []).filter((m) => {
          const matchedId = typeof m === "string" ? m : m.id;
          return matchedId !== movieId;
        });
        
        await updateMatchesInFirestore(roomCode, updatedMatches);
        toast.success(language === "nl" ? "Film verwijderd uit matches voor iedereen." : "Movie removed from matches for everyone.");
      }
    } catch (err: any) {
      console.error("Error removing match:", err);
    }
  };

  // Emojis floating reaction triggers
  const handleSendReaction = async (emoji: string) => {
    if (!user || !roomCode) return;

    try {
      await sendGlobalReactionInFirestore(roomCode, user.uid, emoji);
    } catch (err: any) {
      console.error("Error sending emoji reaction:", err);
    }
  };

  // Reset entire card swipes database history for the active room
  const handleResetDeck = async () => {
    if (!roomCode || !room) return;

    try {
      const userIds = Object.keys(room.users || {});
      await resetRoomDeckInFirestore(roomCode, userIds);
      toast.success(language === "nl" ? "Alle swipes hersteld!" : "All swipes reset!");
    } catch (err) {
      console.error("Error resetting cinephile deck:", err);
    }
  };

  const handleFetchNewBatch = async () => {
    if (!roomCode || !room) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const swipedIds = new Set<string>();
      if (room.swipes) {
        Object.values(room.swipes).forEach((userSwipes: any) => {
          if (userSwipes) {
            Object.keys(userSwipes).forEach(movieId => swipedIds.add(String(movieId)));
          }
        });
      }
      if (room.movies) {
        room.movies.forEach((m: any) => swipedIds.add(String(m.id)));
      }
      const excludeIds = Array.from(swipedIds);

      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: room.country || "NL",
          providers: room.providers || ["netflix"],
          vibe: room.vibe || "",
          maxRuntime: room.maxRuntime,
          minRating: room.minRating,
          releaseDecade: room.releaseDecade,
          ageRating: room.ageRating,
          excludeIds,
        }),
      });

      if (!res.ok) {
        throw new Error(language === "nl" ? `Mislukt om nieuwe filmstapel te laden: ${res.statusText}` : `Failed to load new movie deck: ${res.statusText}`);
      }

      const moviesData = await res.json();
      const movieCollection: Movie[] = moviesData.movies || [];

      if (movieCollection.length > 0) {
        const userIds = Object.keys(room.users || {});
        await loadNewBatchInFirestore(roomCode, userIds, movieCollection, false, moviesData.fallbackLevel);
        toast.success(language === "nl" ? "Er is een gloednieuwe stapel films geladen!" : "A brand new deck of movies has been loaded!");
      } else {
        throw new Error(language === "nl" ? "Geen geschikte films gevonden voor de nieuwe instellingen." : "No suitable movies found for the new settings.");
      }
    } catch (err: any) {
      console.error("Fout handmatig ophalen van nieuwe batch:", err);
      setErrorMsg(err.message || (language === "nl" ? "Er is een fout opgetreden bij het laden van een nieuwe filmstapel." : "An error occurred while loading a new movie deck."));
      toast.error(language === "nl" ? "Nieuwe batch laden is mislukt." : "Failed to load new batch.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSimilarBatch = async () => {
    if (!roomCode || !room) return;

    const isSolo = Object.keys(room.users || {}).length < 2;
    let seedMovies: Movie[] = [];
    if (room.matches && room.matches.length > 0) {
      seedMovies = room.matches;
    } else if (isSolo && room.movies && room.swipes && user?.uid) {
      const mySwipes = room.swipes[user.uid] || {};
      seedMovies = room.movies.filter(m => mySwipes[m.id] === true);
    }

    if (seedMovies.length === 0) {
      toast.error(
        language === "nl"
          ? "Je hebt ten minste één film-match of bewaarde film nodig om vergelijkbare films te kunnen zoeken!"
          : "You need at least one movie match or saved movie to find similar films!"
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const swipedIds = new Set<string>();
      if (room.swipes) {
        Object.values(room.swipes).forEach((userSwipes: any) => {
          if (userSwipes) {
            Object.keys(userSwipes).forEach(movieId => swipedIds.add(String(movieId)));
          }
        });
      }
      if (room.movies) {
        room.movies.forEach((m: any) => swipedIds.add(String(m.id)));
      }
      const excludeIds = Array.from(swipedIds).concat(seedMovies.map(m => String(m.id)));
      const seedIds = seedMovies.map(m => String(m.id));

      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieIds: seedIds,
          country: room.country || "NL",
          providers: room.providers || ["netflix"],
          maxRuntime: room.maxRuntime,
          minRating: room.minRating,
          releaseDecade: room.releaseDecade,
          ageRating: room.ageRating,
          excludeIds,
        }),
      });

      if (!res.ok) {
        throw new Error(
          language === "nl"
            ? `Mislukt om vergelijkbare films te zoeken: ${res.statusText}`
            : `Failed to fetch similar movies: ${res.statusText}`
        );
      }

      const rawData = await res.json();
      const recommendedMovies: Movie[] = rawData.movies || [];

      if (recommendedMovies.length > 0) {
        const userIds = Object.keys(room.users || {});
        // Load recommended movies, do NOT reset matches (resetMatches = false)
        await loadNewBatchInFirestore(roomCode, userIds, recommendedMovies, false);
        setSwipingStarted(true);
        setActiveTab("swipe");
        toast.success(
          language === "nl"
            ? `Succes! Een nieuwe stapel van ${recommendedMovies.length} vergelijkbare films is geladen!`
            : `Success! A new stack of ${recommendedMovies.length} similar movies has been loaded!`
        );
      } else {
        throw new Error(
          language === "nl"
            ? "Geen vergelijkbare films gevonden die voldoen aan de lobby-instellingen."
            : "No similar movies found matching your active room filters."
        );
      }
    } catch (err: any) {
      console.error("Fout bij ophalen van vergelijkbare films:", err);
      setErrorMsg(
        err.message ||
          (language === "nl"
            ? "Er is een fout opgetreden bij het laden van vergelijkbare films."
            : "An error occurred while loading recommended movies.")
      );
      toast.error(
        language === "nl" ? "Vergelijkbare films laden mislukt." : "Failed to load similar movies."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    setRoomCode(null);
    setSwipingStarted(false);
    // Clear room query params
    window.history.replaceState({}, "", window.location.pathname);
    toast(t("leave_lobby_confirm"));
  };

  const isSolo = room ? Object.keys(room.users || {}).length < 2 : false;
  const displayMatches = room && user
    ? (isSolo
        ? (room.movies || []).filter((m) => room.swipes?.[user.uid]?.[m.id] === true)
        : (room.matches || []))
    : [];

  // Removed single-player premature auto-navigate to matches tab so players stay in swipe screen until both finish and celebrate matches together

  // Map comma-separated genre IDs to human-readable names
  const getSfeerDisplay = () => {
    if (!room || !room.vibe) return t("sfeer_selectie");
    const ids = room.vibe.split(",");
    const names = ids
      .map((id) => {
        const genre = GENRES.find((g) => g.id === id.trim());
        return genre ? genre.name : id;
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : room.vibe;
  };

  return (
    <div className="min-h-screen bg-[#12121d] text-[#e3e0f1] font-sans flex flex-col justify-between relative overflow-hidden bg-gradient-mesh">
      {/* Global Toast Elements Configuration Container */}
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#1c1c28",
            color: "#e3e0f1",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "1rem",
            fontSize: "0.85rem",
          }
        }}
      />

      {/* Background Cosmic Atmospheric Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-[#ff5637]/8 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-[#8c7fff]/8 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Top Main Navigation Header bar */}
      <header className="h-16 sm:h-20 px-3 sm:px-8 flex items-center justify-between border-b border-white/5 relative z-20 bg-[#12121d]/85 backdrop-blur-xl sticky top-0 transition-all select-none">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <FilmFlameLogo size={32} className="sm:size-[42px] hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer shrink-0" />
          <h1 className={`text-xl sm:text-3xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-[#ffb4a5] to-[#ff5637] font-display select-none transition-all ${
            roomCode ? "hidden min-[380px]:block" : "block"
          }`}>
            {t("app_title")}
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 relative z-30">
          {roomCode && room && (
            <>
              {/* Room code badge */}
              <div className="hidden sm:flex items-center gap-2 bg-[#1b1a26] border border-white/5 px-4 py-2 rounded-full shadow-inner">
                <span className="w-2 h-2 bg-[#ff5637] rounded-full animate-pulse"></span>
                <span className="text-xs font-mono tracking-widest text-[#e5bdb6] font-bold">
                  {t("room_badge")} <span className="text-[#ffdb3c] font-black">{roomCode}</span>
                </span>
              </div>

              {/* Overlapping player avatar roundels */}
              <div className="flex -space-x-1.5 shrink-0">
                {Object.entries(room.users || {}).map(([uid, name]) => {
                  const isMe = uid === user?.uid;
                  const displayName = String(name || "User");
                  return (
                    <div
                      key={uid}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-[#12121d] flex items-center justify-center shadow-lg uppercase font-display select-none transition-transform hover:scale-115 shrink-0 ${
                        isMe ? "bg-gradient-to-br from-[#ff5637] to-[#ba1c00] text-white" : "bg-slate-800 text-[#e3e0f1]"
                      }`}
                      title={displayName}
                    >
                      <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                  );
                })}
              </div>

              {swipingStarted && (
                <div className="flex items-center bg-[#0d0d18] border border-white/5 rounded-2xl p-0.5 sm:p-1 shrink-0 shadow-md">
                  <button
                    id="tab-swipe-arena"
                    onClick={() => setActiveTab("swipe")}
                    className={`px-3 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "swipe"
                        ? "bg-[#ff5637]/15 text-[#ffb4a5] border border-[#ff5637]/20 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t("tab_swipe")}
                  </button>
                  <button
                    id="tab-watchlist"
                    onClick={() => setActiveTab("matches")}
                    className={`px-3 sm:px-4 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all relative cursor-pointer ${
                      activeTab === "matches"
                        ? "bg-[#ff5637]/15 text-[#ffb4a5] border border-[#ff5637]/20 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t("tab_matches")}
                  </button>
                </div>
              )}

              <button
                 id="leave-lobby-header-btn"
                 onClick={handleLeaveLobby}
                 className="p-2 text-slate-500 hover:text-[#ff5637] transition-all hover:scale-110 cursor-pointer shrink-0"
                 title={t("leave_lobby_title")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Persistent Language Toggle Switcher in Header */}
          <div
            id="language-toggle-header-btn"
            className="flex items-center gap-2 bg-[#161623]/90 border border-white/10 px-3 py-1.5 rounded-full select-none shrink-0 shadow-md h-9"
          >
            <button
              type="button"
              id="lang-btn-nl"
              onClick={() => language !== "nl" && setLanguage("nl")}
              className={`text-base leading-none transition-all cursor-pointer focus:outline-none ${
                language === "nl" ? "scale-115 filter drop-shadow-[0_0_5px_rgba(255,219,60,0.6)] opacity-100 font-bold" : "opacity-40 hover:opacity-80"
              }`}
              title="Wissel naar Nederlands"
              aria-label="Wissel naar Nederlands"
            >
              🇳🇱
            </button>
            <span className="text-[9px] text-slate-500 hover:text-slate-500 select-none block">|</span>
            <button
              type="button"
              id="lang-btn-en"
              onClick={() => language !== "en" && setLanguage("en")}
              className={`text-base leading-none transition-all cursor-pointer focus:outline-none ${
                language === "en" ? "scale-115 filter drop-shadow-[0_0_5px_rgba(255,219,60,0.6)] opacity-100 font-bold" : "opacity-40 hover:opacity-80"
              }`}
              title="Switch to English"
              aria-label="Switch to English"
            >
              🇬🇧
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 relative z-10 flex flex-col justify-center">
        
        {/* Loader status */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in text-center">
            <div className="w-10 h-10 border-4 border-[#ff5637] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#e5bdb6] font-mono tracking-wide">
              {t("loading_movies")}
            </p>
          </div>
        )}

        {/* Action Error Alerts banner */}
        {!loading && errorMsg && (
          <div className="max-w-md mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs text-center font-bold leading-relaxed shadow-xl">
            {errorMsg}
          </div>
        )}

        {/* Page Switch Controller based on match state */}
        {!loading && !room && (
          <LandingScreen
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            initialJoinCode={sharedRoomCode}
          />
        )}

        {!loading && room && !swipingStarted && (
          <LobbyScreen
            room={room}
            currentUserId={user?.uid || ""}
            onStartSwiping={() => setSwipingStarted(true)}
            onLeave={handleLeaveLobby}
          />
        )}

        {!loading && room && swipingStarted && (
          activeTab === "swipe" ? (
            <SwipeScreen
              room={room}
              currentUserId={user?.uid || ""}
              onSwipe={handleSwipeMovie}
              onSendReaction={handleSendReaction}
              onResetDeck={handleResetDeck}
              onFetchNewBatch={handleFetchNewBatch}
              onGoToMatches={() => setActiveTab("matches")}
              onFetchSimilarBatch={handleFetchSimilarBatch}
            />
          ) : (
            <MatchesScreen
              matches={displayMatches}
              room={room}
              currentUserId={user?.uid || ""}
              onBackToSwipes={() => setActiveTab("swipe")}
              isSolo={isSolo}
              onRemoveMatch={handleRemoveMatch}
              onToggleSuperLike={handleToggleSuperLike}
              onFetchSimilarBatch={handleFetchSimilarBatch}
            />
          )
        )}
      </main>

      {/* Bottom Status Bar Footer */}
      <footer className="h-12 px-8 flex items-center justify-between bg-[#0d0d18] border-t border-white/5 select-none z-10 relative">
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold tracking-widest uppercase">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5637] animate-pulse"></span> 
            {t("regio")}: {room ? room.country : "NL"}
          </span>
          <span className="text-slate-800">|</span>
          <span className="text-slate-300">{t("sfeer")}: {getSfeerDisplay()}</span>
        </div>
        <div className="text-[10px] text-slate-400 font-sans hidden sm:block font-extrabold tracking-wide">
          {room ? `${t("groepscode_footer")} ${room.id}` : t("samen_kiezen_footer")}
        </div>
      </footer>
    </div>
  );
}
