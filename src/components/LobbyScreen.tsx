import { useState } from "react";
import { Copy, Users, Play, ArrowLeft, CheckCircle, Sparkles, User } from "lucide-react";
import { Room } from "../types";
import { useLanguage } from "../LanguageContext";

interface LobbyScreenProps {
  room: Room;
  currentUserId: string;
  onStartSwiping: () => void;
  onLeave: () => void;
}

export default function LobbyScreen({ room, currentUserId, onStartSwiping, onLeave }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const { language, t } = useLanguage();

  // Generate dynamic invite link
  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${room.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usersList = Object.entries(room.users || {}).sort(([uidA], [uidB]) => {
    if (uidA === currentUserId && uidB !== currentUserId) return -1;
    if (uidA !== currentUserId && uidB === currentUserId) return 1;
    return uidA.localeCompare(uidB);
  });
  const hasPartner = usersList.length >= 2;

  return (
    <div className="max-w-md mx-auto px-4 py-8 relative">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[260px] h-[260px] pointer-events-none rounded-full bg-[#8c7fff]/5 blur-[100px]" />

      {/* Back button */}
      <button
        id="lobby-leave-btn"
        onClick={onLeave}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 font-bold select-none cursor-pointer transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {t("leave_lobby")}
      </button>

      {/* Main Container */}
      <div className="glass-card rounded-[2rem] p-6 md:p-8 text-center shadow-2xl space-y-7 relative z-10 transition-all select-none">
        
        {/* Title Header */}
        <div className="space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff5637] to-[#ba1c00] text-white flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-red-500/20">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-[#e3e0f1]">
            {t("movie_lobby_title")}
          </h2>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ffdb3c] animate-ping" />
            <p className="text-[#ffe16d] text-[10px] uppercase font-bold tracking-widest leading-none">
              {language === "nl" ? "Wachten op connectie..." : "Waiting for connection..."}
            </p>
          </div>
        </div>

        {/* Room Code Display Card */}
        <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            {t("share_room_code")}
          </span>
          <div className="text-4xl font-black font-display tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ffb4a5] to-[#ff5637] drop-shadow-[0_0_10px_rgba(255,86,55,0.2)] select-all pl-3">
            {room.id}
          </div>
        </div>

        {/* Active Participants */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left pl-1">
            {language === "nl" ? `Verbonden Spelers (${usersList.length})` : `Connected Players (${usersList.length})`}
          </h3>
          <div className="space-y-2.5">
            {usersList.map(([uid, username]) => {
              const isMe = uid === currentUserId;
              return (
                <div
                  key={uid}
                  id={`user-row-${uid}`}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${
                    isMe
                      ? "bg-[#ff5637]/10 border-[#ff5637]/30 text-[#ffb4a5]"
                      : "bg-black/20 border-white/5 text-[#e3e0f1]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-[#ffb4a5]">
                        <User className="w-4 h-4 animate-fade-in" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#ffdb3c] rounded-full border-2 border-[#12121d]" />
                    </div>
                    <span className="font-bold">{username}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                    {isMe ? (language === "nl" ? "Host (Jij)" : "Host (You)") : (language === "nl" ? "Speler" : "Player")}
                  </span>
                </div>
              );
            })}

            {usersList.length < 2 && (
              <div className="p-3.5 rounded-xl border border-dashed border-white/10 bg-black/10 text-slate-400 text-xs italic py-4">
                {language === "nl" ? "Deel de onderstaande link om vrienden uit te nodigen voor je lobby." : "Share the link below to invite friends to join your lobby."}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Invite Link Card */}
        <div className="space-y-2 text-left">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">
            {language === "nl" ? "Vrienden direct uitnodigen (kopieer link)" : "Directly invite friends (copy link)"}
          </label>
          <div className="flex bg-black/20 border border-white/5 hover:border-white/10 rounded-xl overflow-hidden transition-all">
            <input
              id="invite-link-input"
              type="text"
              readOnly
              value={inviteLink}
              className="w-full bg-transparent border-none text-xs text-slate-300 py-3.5 px-3 focus:outline-none select-all overflow-ellipsis font-medium"
            />
            <button
              id="copy-invite-btn"
              type="button"
              onClick={handleCopyLink}
              className="px-4 bg-slate-900/60 border-l border-white/15 text-[#ffb4a5] hover:text-white transition-colors cursor-pointer flex items-center justify-center min-w-[55px]"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-[#ffdb3c]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Start Swiping Button */}
        <div className="pt-2">
          {!hasPartner && (
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {language === "nl" ? "We raden aan om op je partner te wachten, maar je kunt ook alvast in je eentje beginnen met swipen." : "We recommend waiting for your partner, but you can also start swiping by yourself."}
            </p>
          )}
          <button
            id="enter-swipe-deck-btn"
            type="button"
            onClick={onStartSwiping}
            className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-full glow-button text-white font-extrabold shadow-lg active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white text-white shrink-0" />
            {hasPartner ? t("start_swiping_ready") : t("start_swiping_unready")}
            {hasPartner && (
              <span className="flex items-center gap-0.5 ml-1.5 text-[9px] px-2 py-0.5 rounded-full bg-black/30 text-[#ffdb3c] font-black uppercase tracking-widest border border-[#ffdb3c]/30 animate-pulse">
                <Sparkles className="w-3 h-3 text-[#ffdb3c] fill-[#ffdb3c]" />
                {language === "nl" ? "Samen actief" : "Together active"}
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
