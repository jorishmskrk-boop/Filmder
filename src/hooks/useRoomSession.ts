import { useState, useEffect } from "react";
import { onSnapshot } from "firebase/firestore";
import { OperationType, handleFirestoreError, getRoomRef, isRoomExpired } from "../firebase";
import { Room, Movie } from "../types";
import { User } from "firebase/auth";

export function useRoomSession(user: User | null, setErrorMsg: (msg: string | null) => void) {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [swipingStarted, setSwipingStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<"swipe" | "matches">("swipe");

  // Keep real-time snapshot database subscription synced with roomCode changes
  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }

    const docPath = `artifacts/flixmatch-default-id/public/data/rooms/${roomCode}`;
    const roomDocRef = getRoomRef(roomCode);

    const unsubscribeRoom = onSnapshot(
      roomDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          if (isRoomExpired(data.expiresAt)) {
            setRoomCode(null);
            setRoom(null);
            setErrorMsg("Deze lobby is verlopen (lobbies zijn 24 uur geldig).");
            return;
          }

          const moviesList = (data.movies || []) as Movie[];
          const rawMatches = (data.matches || []) as (Movie | string)[];

          // Map and resolve any string matches back to whole Movie items client-side
          const resolvedMatches = rawMatches
            .map((item) => {
              if (typeof item === "string") {
                return moviesList.find((m) => m.id === item);
              }
              return item;
            })
            .filter((m): m is Movie => m !== undefined);

          setRoom({
            ...data,
            matches: resolvedMatches,
          } as Room);
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
  }, [roomCode, setErrorMsg]);

  return {
    roomCode,
    setRoomCode,
    room,
    setRoom,
    swipingStarted,
    setSwipingStarted,
    activeTab,
    setActiveTab,
  };
}
