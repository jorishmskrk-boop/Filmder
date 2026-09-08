import { X } from "lucide-react";
import { useLanguage } from "../LanguageContext";

interface TrailerModalProps {
  url: string;
  onClose: () => void;
}

export default function TrailerModal({ url, onClose }: TrailerModalProps) {
  const { language } = useLanguage();

  // Parse YouTube video ID to form an embeddable YouTube URL
  const getOutputEmbedUrl = (rawUrl: string): string => {
    if (!rawUrl) return "";
    try {
      let videoId: string | null = null;
      if (rawUrl.includes("youtube.com/watch")) {
        const urlObj = new URL(rawUrl);
        videoId = urlObj.searchParams.get("v");
      } else if (rawUrl.includes("youtu.be/")) {
        const parts = rawUrl.split("youtu.be/");
        videoId = parts[parts.length - 1].split("?")[0];
      } else if (rawUrl.includes("youtube.com/embed/")) {
        const parts = rawUrl.split("youtube.com/embed/");
        videoId = parts[parts.length - 1].split("?")[0];
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0`;
      }
    } catch (e) {
      console.error("Error formatting youtube URL:", e);
    }
    // Return original url or search fallback if not directly processable
    return rawUrl;
  };

  const embedUrl = getOutputEmbedUrl(url);
  const isEmbeddable = embedUrl.startsWith("https://www.youtube.com/embed/");

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#12121d] border border-white/10 rounded-[2rem] overflow-hidden max-w-3xl w-full flex flex-col shadow-2xl relative">
        {/* Header toolbar */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-white/5 bg-[#171725]">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
            {language === "nl" ? "Officiële Trailer" : "Official Trailer"}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            title={language === "nl" ? "Sluiten" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video iframe / Player block */}
        <div className="relative aspect-video w-full bg-black">
          {isEmbeddable ? (
            <iframe
              title="Movie Trailer Player"
              src={embedUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            ></iframe>
          ) : (
            <div className="absolute inset-0 p-8 flex flex-col justify-center items-center text-center space-y-4">
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                {language === "nl"
                  ? "We konden deze trailer niet rechtstreeks in de app embedden. Open de trailer via de knop hieronder!"
                  : "We could not embed this trailer directly. Open the external link to watch the trailer!"}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-6 rounded-full bg-red-600 hover:bg-gradient-to-br hover:from-red-600 hover:to-red-700 text-white font-extrabold tracking-wider transition-all cursor-pointer inline-flex items-center gap-2"
              >
                {language === "nl" ? "Open op YouTube" : "Open on YouTube"}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
