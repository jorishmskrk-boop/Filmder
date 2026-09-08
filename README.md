# Filmder

Swipe samen met je partner of vrienden door films en vind in real-time een match voor je filmavond — Tinder, maar dan voor films. Maak een lobby aan, deel de code, en swipe allebei door een gedeelde stapel films. Zodra jullie dezelfde film liken, is het een match.

- Filmdata (poster, synopsis, genres, trailer, streamingdiensten) komt van [TMDB](https://www.themoviedb.org/).
- IMDb-scores worden opgehaald via [OMDb](https://www.omdbapi.com/) (met automatische fallback naar de TMDB-score als het daglimiet bereikt is).
- Lobby's en realtime swipe-synchronisatie draaien op Firebase (Firestore + anonieme auth).

## Lokaal draaien

**Vereisten:** Node.js

1. Installeer dependencies:
   `npm install`
2. Zet `TMDB_API_KEY` (verplicht) en optioneel `OMDB_API_KEY` in `.env` — zie [.env.example](.env.example).
3. Start de app:
   `npm run dev`

## Scripts

- `npm run dev` — start de dev-server (Express + Vite middleware)
- `npm run build` — bouwt de frontend en bundelt de server voor productie
- `npm run start` — start de gebouwde productie-server
- `npm run lint` — TypeScript type-check
