import { useState, useEffect } from "react";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, updateDoc, getDoc, onSnapshot, arrayUnion } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "./firebase";
import { Movie, Room, Preferences } from "./types";
import LandingScreen from "./components/LandingScreen";
import LobbyScreen from "./components/LobbyScreen";
import SwipeScreen from "./components/SwipeScreen";
import MatchesScreen from "./components/MatchesScreen";
import FilmFlameLogo from "./components/FilmFlameLogo";
import { Sparkles, MessageCircle, Tv, Heart, Users, Award, LogOut } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Match session state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [swipingStarted, setSwipingStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"swipe" | "matches">("swipe");
  const [sharedRoomCode, setSharedRoomCode] = useState<string | null>(null);

  // Local state for notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Auto loading batch states
  const [isAutoLoadingBatch, setIsAutoLoadingBatch] = useState(false);

  // 1. Initialize Firebase Anonymous authentication on component mount
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
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Scan and pre-populate room code if shared in the URL search params (?room=1234)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedRoom = params.get("room");
    if (sharedRoom && sharedRoom.length === 4) {
      const upperCode = sharedRoom.toUpperCase();
      setSharedRoomCode(upperCode);
      // Prompt notification
      setNotification(`Gedeelde lobby-uitnodigingscode gevonden: ${upperCode}. Vul je naam in om deel te nemen!`);
    }
  }, []);

  // 3. Keep real-time snapshot database subscription synced with roomCode changes
  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }

    const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
    const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);

    const unsubscribeRoom = onSnapshot(
      roomDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setRoom(data as Room);
        } else {
          // If room doesn't exist anymore or isn't loaded
          setRoomCode(null);
          setRoom(null);
          setErrorMsg("De ingevoerde lobby-code is niet gevonden of verlopen.");
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, docPath);
      }
    );

    return () => unsubscribeRoom();
  }, [roomCode]);

  // Helper trigger to fade notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Automatically load a completely new, fresh batch of movies when both are done and no matches are found
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
          const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
          const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);
          const savedKey = localStorage.getItem("flixmatch_tmdb_key") || "";

          const res = await fetch("/api/movies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: savedKey,
              country: room.country || "NL",
              providers: room.providers || ["netflix"],
              vibe: room.vibe || "",
            }),
          });

          if (!res.ok) {
            throw new Error(`Nieuwe batch ophalen mislukt: ${res.statusText}`);
          }

          const moviesData = await res.json();
          const movieCollection: Movie[] = moviesData.movies || [];

          if (movieCollection.length > 0) {
            const cleanSwipes: Record<string, any> = {};
            userIds.forEach((uid) => {
              cleanSwipes[uid] = {};
            });

            await updateDoc(roomDocRef, {
              movies: movieCollection,
              swipes: cleanSwipes,
              matches: [],
            });

            setNotification("Niemand vond de vorige films leuk... Er is automatisch een gloednieuwe stapel films geladen!");
          }
        } catch (err) {
          console.error("Fout bij het automatisch ophalen van een nieuwe batch:", err);
        } finally {
          setIsAutoLoadingBatch(false);
          setLoading(false);
        }
      };

      fetchNewBatch();
    }
  }, [room?.swipes, room?.movies, room?.matches, roomCode, user, isAutoLoadingBatch]);

  // Generate unique 4 digit code not intersecting known rooms
  const generate4DigitCode = (): string => {
    return String(Math.floor(1000 + Math.random() * 9000));
  };

  // Create match room session handler
  const handleCreateRoom = async (prefs: Preferences) => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const code = generate4DigitCode();
      const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${code}`;
      const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", code);

      // Call API server-side route to fetch movies (using TMDB key if provided, fallback to Gemini)
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: prefs.tmdbApiKey,
          country: prefs.country,
          providers: prefs.providers,
          vibe: prefs.vibe,
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

      try {
        await setDoc(roomDocRef, roomPayload);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }

      setRoomCode(code);
      setSwipingStarted(false);
      setActiveTab("swipe");
    } catch (err: any) {
      console.error("Error creating matching room:", err);
      setErrorMsg(err.message || "Er is een fout opgetreden bij het opzetten van de lobby.");
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
      const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", code);
      let roomSnap;
      try {
        roomSnap = await getDoc(roomDocRef);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.GET, docPath);
      }

      if (!roomSnap.exists()) {
        throw new Error(`Er bestaat geen lobby met code ${code}. Controleer de code en probeer het opnieuw!`);
      }

      // Update room registered users with joining player
      try {
        await updateDoc(roomDocRef, {
          [`users.${user.uid}`]: prefs.name,
          [`swipes.${user.uid}`]: {},
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }

      setRoomCode(code);
      setSwipingStarted(false);
      setActiveTab("swipe");

      // Set URL search parameter cleanly without reloading the page
      window.history.replaceState({}, "", `?room=${code}`);
    } catch (err: any) {
      console.error("Error joining matching room:", err);
      setErrorMsg(err.message || "Er is een fout opgetreden bij het deelnemen aan de lobby.");
    } finally {
      setLoading(false);
    }
  };

  // Swipe handle updating swiped values and checking match overlays
  const handleSwipeMovie = async (movieId: string, liked: boolean) => {
    if (!user || !roomCode || !room) return;

    const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
    const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);

    try {
      // Save swipe instantly to Firestore
      try {
        await updateDoc(roomDocRef, {
          [`swipes.${user.uid}.${movieId}`]: liked,
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }

      // If liked (true), check if partner also swiped true (on the same movie)
      if (liked) {
        const usersList = Object.keys(room.users || {});
        const partnerId = usersList.find((uid) => uid !== user.uid);

        if (partnerId) {
          const partnerSwipes = room.swipes?.[partnerId] || {};
          if (partnerSwipes[movieId] === true) {
            // Find movie object
            const matchedMovieObj = room.movies.find((m) => m.id === movieId);
            if (matchedMovieObj) {
              // Ensure we do not add duplicate matches
              const alreadyMatched = (room.matches || []).some((m) => m.id === movieId);
              if (!alreadyMatched) {
                try {
                  await updateDoc(roomDocRef, {
                    matches: arrayUnion(matchedMovieObj),
                  });
                } catch (err: any) {
                  handleFirestoreError(err, OperationType.WRITE, docPath);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error registering card swipe:", err);
    }
  };

  // Emojis floating reaction triggers
  const handleSendReaction = async (emoji: string) => {
    if (!user || !roomCode) return;

    const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
    const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);

    try {
      await updateDoc(roomDocRef, {
        [`reactions.${user.uid}`]: {
          emoji,
          timestamp: Date.now(),
        },
      });
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      } catch (wrappedErr) {
        console.error("Error sending emoji reaction:", wrappedErr);
      }
    }
  };

  // Reset entire card swipes database history for the active room
  const handleResetDeck = async () => {
    if (!roomCode || !room) return;

    const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
    const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);

    try {
      // Rebuild clean swipes structure for connected room users
      const cleanSwipes: Record<string, any> = {};
      Object.keys(room.users || {}).forEach((uid) => {
        cleanSwipes[uid] = {};
      });

      try {
        await updateDoc(roomDocRef, {
          swipes: cleanSwipes,
          matches: [],
        });
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }

      setNotification("De filmstapel is succesvol herladen en alle geselecteerde swipes zijn hersteld.");
    } catch (err) {
      console.error("Error resetting cinephile deck:", err);
    }
  };

  const handleFetchNewBatch = async () => {
    if (!roomCode || !room) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
      const roomDocRef = doc(db, "artifacts", "flixmatch-default-id", "public", "data", "rooms", roomCode);
      const savedKey = localStorage.getItem("flixmatch_tmdb_key") || "";

      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: savedKey,
          country: room.country || "NL",
          providers: room.providers || ["netflix"],
          vibe: room.vibe || "",
        }),
      });

      if (!res.ok) {
        throw new Error(`Mislukt om nieuwe filmstapel te laden: ${res.statusText}`);
      }

      const moviesData = await res.json();
      const movieCollection: Movie[] = moviesData.movies || [];

      if (movieCollection.length > 0) {
        const cleanSwipes: Record<string, any> = {};
        Object.keys(room.users || {}).forEach((uid) => {
          cleanSwipes[uid] = {};
        });

        await updateDoc(roomDocRef, {
          movies: movieCollection,
          swipes: cleanSwipes,
          matches: [],
        });

        setNotification("Er is succesvol een gloednieuwe stapel films geladen!");
      } else {
        throw new Error("Geen geschikte films gevonden voor de nieuwe instellingen.");
      }
    } catch (err: any) {
      console.error("Fout handmatig ophalen van nieuwe batch:", err);
      setErrorMsg(err.message || "Er is een fout opgetreden bij het laden van een nieuwe filmstapel.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveLobby = () => {
    setRoomCode(null);
    setSwipingStarted(false);
    // Clear room query params
    window.history.replaceState({}, "", window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-[#12121d] text-[#e3e0f1] font-sans flex flex-col justify-between relative overflow-hidden bg-gradient-mesh">
      {/* Background Cosmic Atmospheric Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-[#ff5637]/8 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-[#8c7fff]/8 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Top Main Navigation Header bar */}
      <header className="h-20 px-6 sm:px-8 flex items-center justify-between border-b border-white/5 relative z-20 bg-[#12121d]/85 backdrop-blur-xl sticky top-0">
        <div className="flex items-center gap-3">
          <FilmFlameLogo size={42} className="hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer" />
          <h1 className="text-3xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white via-[#ffb4a5] to-[#ff5637] font-display select-none">
            Filmder
          </h1>
        </div>

        {roomCode && room && (
          <div className="flex items-center gap-4 sm:gap-6 relative z-30">
            {/* Room code badge */}
            <div className="hidden sm:flex items-center gap-2 bg-[#1b1a26] border border-white/5 px-4 py-2 rounded-full shadow-inner">
              <span className="w-2 h-2 bg-[#ff5637] rounded-full animate-pulse"></span>
              <span className="text-xs font-mono tracking-widest text-[#e5bdb6] font-bold">
                LOBBY: <span className="text-[#ffdb3c] font-black">{roomCode}</span>
              </span>
            </div>

            {/* Overlapping player avatar roundels */}
            <div className="flex -space-x-2">
              {Object.entries(room.users || {}).map(([uid, name]) => {
                const isMe = uid === user?.uid;
                const displayName = String(name || "User");
                return (
                  <div
                    key={uid}
                    className={`w-9 h-9 rounded-full border-2 border-[#12121d] flex items-center justify-center text-xs font-black shadow-lg uppercase font-display select-none transition-transform hover:scale-115 ${
                      isMe ? "bg-gradient-to-br from-[#ff5637] to-[#ba1c00] text-white" : "bg-slate-800 text-[#e3e0f1]"
                    }`}
                    title={displayName}
                  >
                    {displayName.slice(0, 2)}
                  </div>
                );
              })}
            </div>

            {swipingStarted && (
              <div className="flex items-center bg-[#0d0d18] border border-white/5 rounded-2xl p-1 shrink-0 shadow-md">
                <button
                  id="tab-swipe-arena"
                  onClick={() => setActiveTab("swipe")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "swipe"
                      ? "bg-[#ff5637]/15 text-[#ffb4a5] border border-[#ff5637]/20 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Swipen
                </button>
                <button
                  id="tab-watchlist"
                  onClick={() => setActiveTab("matches")}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                    activeTab === "matches"
                      ? "bg-[#ff5637]/15 text-[#ffb4a5] border border-[#ff5637]/20 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Matches
                  {(room.matches || []).length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ff5637] px-1 text-[8px] font-black text-white border-2 border-[#12121d] animate-pulse shadow-md">
                      {(room.matches || []).length}
                    </span>
                  )}
                </button>
              </div>
            )}

            <button
              id="leave-lobby-header-btn"
              onClick={handleLeaveLobby}
              className="p-2 text-slate-500 hover:text-[#ff5637] transition-all hover:scale-110 cursor-pointer"
              title="Lobby verlaat"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 relative z-10 flex flex-col justify-center">
        
        {/* Loader status */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in text-center">
            <div className="w-10 h-10 border-4 border-[#ff5637] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#e5bdb6] font-mono tracking-wide">
              Filmstapel selecteren en aanbevelingen van Filmder laden...
            </p>
          </div>
        )}

        {/* Action Error Alerts banner */}
        {!loading && errorMsg && (
          <div className="max-w-md mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 text-xs text-center font-bold leading-relaxed shadow-xl">
            {errorMsg}
          </div>
        )}

        {/* Toast Notification message banner */}
        {!loading && notification && (
          <div className="max-w-md mx-auto mb-6 bg-[#ffdb3c]/10 border border-[#ffdb3c]/20 text-[#ffe16d] rounded-2xl p-3.5 text-center text-xs font-bold shadow-xl animate-fade-in font-sans">
            {notification}
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
            />
          ) : (
            <MatchesScreen
              matches={room.matches || []}
              onBackToSwipes={() => setActiveTab("swipe")}
            />
          )
        )}
      </main>

      {/* Bottom Status Bar Footer */}
      <footer className="h-12 px-8 flex items-center justify-between bg-[#0d0d18] border-t border-white/5 select-none z-10 relative">
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold tracking-widest uppercase">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5637] animate-pulse"></span> 
            REGIO: {room ? room.country : "NL"}
          </span>
          <span className="text-slate-800">|</span>
          <span className="text-slate-300">SFEER: {room ? room.vibe.toUpperCase() : "FILMSELECTIE"}</span>
        </div>
        <div className="text-[10px] text-slate-400 font-sans hidden sm:block font-extrabold tracking-wide">
          {room ? `Groepscode: ${room.id}` : "Samen jullie filmavond kiezen"}
        </div>
      </footer>
    </div>
  );
}
