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
    live_match_badge: "Samen Live Films Matchen",
    tagline: "Swipe door de leukste films met je partner of vrienden en vind in real-time de perfecte match voor jullie filmavond!",
    your_nickname: "Jouw Naam / Nickname",
    nickname_placeholder: "Jouw naam...",
    choose_region: "Kies Jouw Regio",
    active_providers: "Actieve Streamingdiensten",
    vibe_label: "Sfeer & Genre Omschrijving (Optioneel)",
    vibe_placeholder: "Typ een genre, actrice of sfeer (bijv. 'romantisch en grappig', 'scifi', '90s thriller')",
    show_genres: "Bekijk alle genres",
    close_genres: "Sluit genrelijst",
    all_genres_selected: "Alle genres geselecteerd",
    select_all_genres: "Selecteer Alles",
    clear_genres: "Deselecteer Alles",
    advanced_filters: "Filters",
    min_tmdb_rating: "Minimale TMDB Beoordeling",
    release_year_filter: "Release Jaar",
    max_duration: "Maximale Filmduur",
    no_limit: "Geen limiet",
    minutes_label: "minuten",
    family_friendly: "Gezinsvriendelijke films (geen 16+/18+)",
    create_lobby: "Maak lobby aan",
    join_existing_lobby: "Deelnemen aan Bestaande Lobby",
    enter_4_digit: "Voer de lobbycode in (4 of 5 karakters)...",
    connect_lobby_btn: "Verbinden met Lobby",
    invitation_received: "Uitnodiging gevonden voor lobby: {code}! Vul je naam in om deel te nemen.",
    room_created: "Lobby succesvol aangemaakt!",
    lobby_not_found: "Er bestaat geen lobby met code {code}. Controleer de code en probeer het opnieuw!",
    join_success: "Succesvol verbonden met lobby {code}!",
    welcome_invite: "U bent uitgenodigd door uw partner! Klik hieronder om direct met {code} te verbinden:",
    quick_join: "Direct Verbinden met {code}",

    // Lobby Screen
    leave_lobby: "Lobby verlaten",
    movie_lobby_title: "Film Lobby",
    share_room_code: "Deel de Groepscode",
    lobby_title: "Film Lobby",
    waiting_connection: "Wachten op connectie...",
    share_code: "Deel de Groepscode",
    connected_players: "Verbonden Spelers",
    host_you: "Host (Jij)",
    participant: "Deelnemer",
    waiting_partner: "Wachten totdat een partner verbinding maakt...",
    invite_partner_label: "Partner Direct Uitnodigen (Kopieer link)",
    waiting_partner_recommend: "We raden aan om op je partner te wachten, maar je kunt ook alvast in je eentje beginnen met swipen!",
    start_swiping_unready: "Begin Alvast met Swipen ⚡",
    start_swiping_ready: "Samen Swipen Starten! 🚀",

    // Swipe Screen
    tip_keyboard: "TIP: Gebruik de pijltoetsen ← links (Weigeren) of → rechts (Leuk) op je toetsenbord.",
    react_love: "Verliefd",
    react_fire: "Must Watch",
    react_laugh: "Hilarisch",
    react_popcorn: "Zin In",
    react_scared: "Spannend",
    trailer: "Trailer",
    stream_providers: "STREAM",
    empty_deck_title: "Einde van de Stapel!",
    empty_deck_desc: "Je hebt door alle beschikbare films geswiped. Wacht tot je partner ook klaar is, of bekijk jullie matches!",
    waiting_partner_finish: "Wachten tot je partner klaar is met swipen...",
    reset_lobby_desc: "Willen jullie de lobby helemaal resetten en opnieuw beginnen met dezelfde filmselectie?",
    reset_lobby_btn: "Swipes Herstarten",
    fetch_new_movies_desc: "Sfeer aanpassen of nieuwe films inladen? Haal een gloednieuwe stapel films op met jullie instellingen:",
    fetch_new_movies_btn: "Nieuwe Filmstapel Laden 🎬",
    matching_celebration: "Het is een Match! 🎉",
    matching_celebration_desc: "Jullie vinden deze film allebei fantastisch. Tijd om popcorn te maken!",
    back_to_swipes_btn: "Verder Swipen",
    go_to_matches_btn: "Bekijk Alle Matches",

    // Matches Screen
    matches_title: "Jullie Matches: {count}",
    matches_desc: "Hier staan alle films die jullie allebei leuk vonden! Veel kijkplezier! 🍿🔥",
    no_matches_title: "Nog geen matches...",
    no_matches_desc: "Blijf swipen! Zodra jullie allebei dezelfde film leuk vinden, verschijnt die direct hier.",
    start_swiping_now: "Nu Swipen",
    watch_trailer_tooltip: "Bekijk trailer",
    synopsis_more: "meer tonen",
    synopsis_less: "minder tonen",
  },
  en: {
    // Header & Tabs
    app_title: "Filmder",
    tab_swipe: "Swipe",
    tab_matches: "Matches",
    leave_lobby_title: "Leave Lobby",
    leave_lobby_confirm: "Left lobby.",
    room_badge: "LOBBY:",
    loading_movies: "Selecting movie deck and loading recommendations from Filmder...",
    regio: "REGION",
    sfeer: "VIBE",
    sfeer_selectie: "MOVIE SELECTION",
    groepscode_footer: "Room Code:",
    samen_kiezen_footer: "Choosing your movie night together",

    // Landing Screen
    live_match_badge: "Live-matching Movies Together",
    tagline: "Swipe through the best movies with your partner or friends and find the perfect match for your movie night in real-time!",
    your_nickname: "Your Name / Nickname",
    nickname_placeholder: "Your name...",
    choose_region: "Choose Your Region",
    active_providers: "Active Streaming Services",
    vibe_label: "Vibe & Genre Description (Optional)",
    vibe_placeholder: "Type a genre, actress or vibe (e.g. 'romantic and funny', 'scifi', '90s thriller')",
    show_genres: "View all genres",
    close_genres: "Close genre list",
    all_genres_selected: "All genres selected",
    select_all_genres: "Select All",
    clear_genres: "Deselect All",
    advanced_filters: "Filters",
    min_tmdb_rating: "Minimum TMDB Rating",
    release_year_filter: "Release Year Filter",
    max_duration: "Maximum Movie Duration",
    no_limit: "No limit",
    minutes_label: "minutes",
    family_friendly: "Family friendly movies (no 16+/18+)",
    create_lobby: "Create Lobby",
    join_existing_lobby: "Join Existing Lobby",
    enter_4_digit: "Enter the lobby code (4 or 5 characters)...",
    connect_lobby_btn: "Connect to Lobby",
    invitation_received: "Invitation found for lobby: {code}! Enter your name to join.",
    room_created: "Lobby created successfully!",
    lobby_not_found: "No lobby exists with code {code}. Please check the code and try again!",
    join_success: "Connected successfully to lobby {code}!",
    welcome_invite: "You have been invited by your partner! Click below to connect directly with {code}:",
    quick_join: "Quick Join with {code}",

    // Lobby Screen
    leave_lobby: "Leave Lobby",
    movie_lobby_title: "Movie Lobby",
    share_room_code: "Share Lobby Code",
    lobby_title: "Movie Lobby",
    waiting_connection: "Waiting for connection...",
    share_code: "Share Lobby Code",
    connected_players: "Connected Players",
    host_you: "Host (You)",
    participant: "Participant",
    waiting_partner: "Waiting for partner to connect...",
    invite_partner_label: "Invite Partner (Copy link)",
    waiting_partner_recommend: "We recommend waiting for your partner, but you can also start swiping on your own!",
    start_swiping_unready: "Start Swiping Early ⚡",
    start_swiping_ready: "Start Swiping Together! 🚀",

    // Swipe Screen
    tip_keyboard: "TIP: Use arrow keys ← left (Reject) or → right (Like) on your keyboard.",
    react_love: "In Love",
    react_fire: "Must Watch",
    react_laugh: "Hilarious",
    react_popcorn: "Excited",
    react_scared: "Thrilling",
    trailer: "Trailer",
    stream_providers: "STREAM",
    empty_deck_title: "End of the Deck!",
    empty_deck_desc: "You have swiped through all available movies. Wait until your partner is finished as well, or view your matches!",
    waiting_partner_finish: "Waiting for partner to finish swiping...",
    reset_lobby_desc: "Do you want to completely reset the lobby and start over with the same movie selection?",
    reset_lobby_btn: "Restart Swipes",
    fetch_new_movies_desc: "Want to adjust vibe parameters or load new movies? Fetch a brand new deck with your filters:",
    fetch_new_movies_btn: "Load New Movie Deck 🎬",
    matching_celebration: "It's a Match! 🎉",
    matching_celebration_desc: "You both love this movie. Time to make some popcorn!",
    back_to_swipes_btn: "Keep Swiping",
    go_to_matches_btn: "View All Matches",

    // Matches Screen
    matches_title: "Your Matches: {count}",
    matches_desc: "Here are all the movies you both liked! Enjoy your movie night! 🍿🔥",
    no_matches_title: "No matches yet...",
    no_matches_desc: "Keep swiping! Once you both like the same movie, it will appear right here.",
    start_swiping_now: "Swipe Now",
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
