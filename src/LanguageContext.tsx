import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "nl" | "en";

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const translations: Record<Language, Record<string, string>> = {
  nl: {
    // Header & Tabs
    app_title: "Filmder",
    tab_swipe: "Swipen",
    tab_matches: "Matches",
    leave_lobby_title: "Lobby verlaten",
    leave_lobby_confirm: "Lobby verlaten.",
    room_badge: "LOBBY:",
    loading_movies: "Filmstapel selecteren en aanbevelingen van Filmder laden...",
    regio: "REGIO",
    sfeer: "SFEER",
    sfeer_selectie: "FILMSELECTIE",
    groepscode_footer: "Groepscode:",
    samen_kiezen_footer: "Samen jullie filmavond kiezen",

    // Landing Screen
    live_match_badge: "Samen live films matchen",
    tagline: "Swipe door de leukste films met je partner of vrienden en vind in real-time de perfecte match voor jullie filmavond.",
    your_nickname: "Jouw naam / nickname",
    nickname_placeholder: "Jouw naam...",
    choose_region: "Kies je regio",
    active_providers: "Actieve streamingdiensten",
    vibe_label: "Sfeer & genre omschrijving (optioneel)",
    vibe_placeholder: "Typ een genre, actrice of sfeer (bijv. 'romantisch en grappig', 'scifi', '90s thriller')",
    show_genres: "Bekijk alle genres",
    close_genres: "Sluit genrelijst",
    all_genres_selected: "Alle genres geselecteerd",
    select_all_genres: "Selecteer alles",
    clear_genres: "Deselecteer alles",
    advanced_filters: "Filters",
    min_tmdb_rating: "Minimale TMDB-beoordeling",
    release_year_filter: "Releasejaar",
    max_duration: "Maximale filmduur",
    no_limit: "Geen limiet",
    minutes_label: "minuten",
    family_friendly: "Gezinsvriendelijke films (geen 16+/18+)",
    create_lobby: "Maak lobby aan",
    join_existing_lobby: "Deelnemen aan bestaande lobby",
    enter_4_digit: "Voer de lobbycode in (4 of 5 karakters)...",
    connect_lobby_btn: "Verbinden met lobby",
    invitation_received: "Uitnodiging gevonden voor lobby: {code}. Vul je naam in om deel te nemen.",
    room_created: "Lobby succesvol aangemaakt.",
    lobby_not_found: "Er bestaat geen lobby met code {code}. Controleer de code en probeer het opnieuw.",
    join_success: "Succesvol verbonden met lobby {code}.",
    welcome_invite: "Je bent uitgenodigd door je partner. Klik hieronder om direct met {code} te verbinden:",
    quick_join: "Direct verbinden met {code}",

    // Lobby Screen
    leave_lobby: "Lobby verlaten",
    movie_lobby_title: "Filmlobby",
    share_room_code: "Deel de groepscode",
    lobby_title: "Filmlobby",
    waiting_connection: "Wachten op connectie...",
    share_code: "Deel de groepscode",
    connected_players: "Verbonden spelers",
    host_you: "Host (jij)",
    participant: "Deelnemer",
    waiting_partner: "Wachten totdat een partner verbinding maakt...",
    invite_partner_label: "Partner direct uitnodigen (kopieer link)",
    waiting_partner_recommend: "We raden aan om op je partner te wachten, maar je kunt ook alvast in je eentje beginnen met swipen.",
    start_swiping_unready: "Begin alvast met swipen",
    start_swiping_ready: "Samen swipen starten",

    // Swipe Screen
    tip_keyboard: "Tip: gebruik de pijltoetsen ← links (weigeren) of → rechts (leuk) op je toetsenbord.",
    react_love: "Verliefd",
    react_fire: "Must watch",
    react_laugh: "Hilarisch",
    react_popcorn: "Zin in",
    react_scared: "Spannend",
    trailer: "Trailer",
    stream_providers: "STREAM",
    empty_deck_title: "Einde van de stapel",
    empty_deck_desc: "Je hebt door alle beschikbare films geswiped. Wacht tot je partner ook klaar is, of bekijk jullie matches.",
    waiting_partner_finish: "Wachten tot je partner klaar is met swipen...",
    reset_lobby_desc: "Willen jullie de lobby helemaal resetten en opnieuw beginnen met dezelfde filmselectie?",
    reset_lobby_btn: "Swipes herstarten",
    fetch_new_movies_desc: "Sfeer aanpassen of nieuwe films inladen? Haal een gloednieuwe stapel films op met jullie instellingen:",
    fetch_new_movies_btn: "Nieuwe filmstapel laden",
    matching_celebration: "Het is een match",
    matching_celebration_desc: "Jullie vinden deze film allebei fantastisch. Tijd om popcorn te maken.",
    back_to_swipes_btn: "Verder swipen",
    go_to_matches_btn: "Bekijk alle matches",

    // Matches Screen
    matches_title: "Jullie matches: {count}",
    matches_desc: "Hier staan alle films die jullie allebei leuk vonden. Veel kijkplezier.",
    no_matches_title: "Nog geen matches...",
    no_matches_desc: "Blijf swipen. Zodra jullie allebei dezelfde film leuk vinden, verschijnt die direct hier.",
    start_swiping_now: "Nu swipen",
    watch_trailer_tooltip: "Bekijk trailer",
    synopsis_more: "meer tonen",
    synopsis_less: "minder tonen",
  },
  en: {
    // Header & Tabs
    app_title: "Filmder",
    tab_swipe: "Swipe",
    tab_matches: "Matches",
    leave_lobby_title: "Leave lobby",
    leave_lobby_confirm: "Left lobby.",
    room_badge: "LOBBY:",
    loading_movies: "Selecting movie deck and loading recommendations from Filmder...",
    regio: "REGION",
    sfeer: "VIBE",
    sfeer_selectie: "MOVIE SELECTION",
    groepscode_footer: "Room code:",
    samen_kiezen_footer: "Choosing your movie night together",

    // Landing Screen
    live_match_badge: "Live-matching movies together",
    tagline: "Swipe through the best movies with your partner or friends and find the perfect match for your movie night in real-time.",
    your_nickname: "Your name / nickname",
    nickname_placeholder: "Your name...",
    choose_region: "Choose your region",
    active_providers: "Active streaming services",
    vibe_label: "Vibe & genre description (optional)",
    vibe_placeholder: "Type a genre, actress or vibe (e.g. 'romantic and funny', 'scifi', '90s thriller')",
    show_genres: "View all genres",
    close_genres: "Close genre list",
    all_genres_selected: "All genres selected",
    select_all_genres: "Select all",
    clear_genres: "Deselect all",
    advanced_filters: "Filters",
    min_tmdb_rating: "Minimum TMDB rating",
    release_year_filter: "Release year",
    max_duration: "Maximum movie duration",
    no_limit: "No limit",
    minutes_label: "minutes",
    family_friendly: "Family friendly movies (no 16+/18+)",
    create_lobby: "Create lobby",
    join_existing_lobby: "Join existing lobby",
    enter_4_digit: "Enter the lobby code (4 or 5 characters)...",
    connect_lobby_btn: "Connect to lobby",
    invitation_received: "Invitation found for lobby: {code}. Enter your name to join.",
    room_created: "Lobby created successfully.",
    lobby_not_found: "No lobby exists with code {code}. Please check the code and try again.",
    join_success: "Connected successfully to lobby {code}.",
    welcome_invite: "You have been invited by your partner. Click below to connect directly with {code}:",
    quick_join: "Quick join with {code}",

    // Lobby Screen
    leave_lobby: "Leave lobby",
    movie_lobby_title: "Movie lobby",
    share_room_code: "Share lobby code",
    lobby_title: "Movie lobby",
    waiting_connection: "Waiting for connection...",
    share_code: "Share lobby code",
    connected_players: "Connected players",
    host_you: "Host (you)",
    participant: "Participant",
    waiting_partner: "Waiting for partner to connect...",
    invite_partner_label: "Invite partner (copy link)",
    waiting_partner_recommend: "We recommend waiting for your partner, but you can also start swiping on your own.",
    start_swiping_unready: "Start swiping early",
    start_swiping_ready: "Start swiping together",

    // Swipe Screen
    tip_keyboard: "Tip: use arrow keys ← left (dislike) or → right (like) on your keyboard.",
    react_love: "In love",
    react_fire: "Must watch",
    react_laugh: "Hilarious",
    react_popcorn: "Excited",
    react_scared: "Thrilling",
    trailer: "Trailer",
    stream_providers: "STREAM",
    empty_deck_title: "End of the deck",
    empty_deck_desc: "You have swiped through all available movies. Wait until your partner is finished as well, or view your matches.",
    waiting_partner_finish: "Waiting for partner to finish swiping...",
    reset_lobby_desc: "Do you want to completely reset the lobby and start over with the same movie selection?",
    reset_lobby_btn: "Restart swipes",
    fetch_new_movies_desc: "Want to adjust vibe parameters or load new movies? Fetch a brand new deck with your filters:",
    fetch_new_movies_btn: "Load new movie deck",
    matching_celebration: "It's a match",
    matching_celebration_desc: "You both love this movie. Time to make some popcorn.",
    back_to_swipes_btn: "Keep swiping",
    go_to_matches_btn: "View all matches",

    // Matches Screen
    matches_title: "Your matches: {count}",
    matches_desc: "Here are all the movies you both liked. Enjoy your movie night.",
    no_matches_title: "No matches yet...",
    no_matches_desc: "Keep swiping. Once you both like the same movie, it will appear right here.",
    start_swiping_now: "Swipe now",
    watch_trailer_tooltip: "Watch trailer",
    synopsis_more: "show more",
    synopsis_less: "show less",
  },
};

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("flixmatch_lang");
    return (saved as Language) || "nl";
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem("flixmatch_lang", lang);
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const dict = translations[language];
    return dict[key] || translations["nl"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
