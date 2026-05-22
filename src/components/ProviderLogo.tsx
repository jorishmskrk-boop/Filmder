import { HTMLAttributes } from "react";

interface ProviderLogoProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  active?: boolean;
  size?: number;
  className?: string;
}

const BRAND_DETAILS: Record<string, {
  bgActive: string;       // Brand specific background when selected
  bgInactive: string;     // Dimmed background when unselected
  textColorActive: string;// For fallback text
  textColorInactive: string;
}> = {
  netflix: {
    bgActive: "bg-white", // Solid premium white so Red and any Dark logo colors are fully readable
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#E50914] font-black",
    textColorInactive: "text-slate-600"
  },
  disney: {
    bgActive: "bg-[#001130] border border-[#4296FF]/30", // Royal signature navy blue
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#4296FF]",
    textColorInactive: "text-slate-600"
  },
  disneyplus: {
    bgActive: "bg-[#001130] border border-[#4296FF]/30",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#4296FF]",
    textColorInactive: "text-slate-600"
  },
  prime: {
    bgActive: "bg-white", // Prime Video has blue smile + black text/elements, white background is flawless
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#00A8E1]",
    textColorInactive: "text-slate-600"
  },
  amazonprime: {
    bgActive: "bg-white",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#00A8E1]",
    textColorInactive: "text-slate-600"
  },
  max: {
    bgActive: "bg-[#002be7] border border-blue-400/20", // Vivid electric brand blue
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-white",
    textColorInactive: "text-slate-500"
  },
  hbomax: {
    bgActive: "bg-[#002be7] border border-blue-400/20",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-white",
    textColorInactive: "text-slate-500"
  },
  apple: {
    bgActive: "bg-white", // Elegant pure white for black Apple TV+ SVG logo
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-black",
    textColorInactive: "text-slate-600"
  },
  appletv: {
    bgActive: "bg-white",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-black",
    textColorInactive: "text-slate-600"
  },
  npostart: {
    bgActive: "bg-white", // White background for crisp NPO Start text & orange accent
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#FF7000]",
    textColorInactive: "text-slate-600"
  },
  npo: {
    bgActive: "bg-white",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#FF7000]",
    textColorInactive: "text-slate-600"
  },
  viaplay: {
    bgActive: "bg-white", // Pure white for perfect visibility of red viaplay symbol and typography
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-white",
    textColorInactive: "text-slate-600"
  },
  skyshowtime: {
    bgActive: "bg-white", // White background so the multicolor Peacock logo & black wordmark pop beautifully
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-white",
    textColorInactive: "text-slate-600"
  },
  hulu: {
    bgActive: "bg-[#0b1419] border border-[#1CE783]/20",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#1CE783]",
    textColorInactive: "text-slate-600"
  },
  paramount: {
    bgActive: "bg-[#0064FF]",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-white",
    textColorInactive: "text-slate-600"
  },
  videoland: {
    bgActive: "bg-white", // Perfect hot pink contrast
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#EC008C]",
    textColorInactive: "text-slate-600"
  },
  pirate: {
    bgActive: "bg-amber-950/40 border border-[#ffbf3e]/40",
    bgInactive: "bg-slate-950/25",
    textColorActive: "text-[#ffbf3e] font-black",
    textColorInactive: "text-slate-600"
  }
};

export default function ProviderLogo({ id, active = true, size = 18, className = "", ...props }: ProviderLogoProps) {
  const normalizedId = id.toLowerCase().replace(/plus/g, "").trim();
  const brand = BRAND_DETAILS[normalizedId] || {
    bgActive: "bg-slate-800",
    bgInactive: "bg-slate-900/30",
    textColorActive: "text-white",
    textColorInactive: "text-slate-500"
  };

  // Map of local SVG files matching the keys
  let svgSrc = "";
  if (normalizedId === "netflix") {
    svgSrc = "/Netflix_2016_N_logo.svg";
  } else if (normalizedId === "disney" || normalizedId === "disneyplus") {
    svgSrc = "/Disney_Plus_logo.svg";
  } else if (normalizedId === "prime" || normalizedId === "amazon" || normalizedId === "amazonprime") {
    svgSrc = "/Prime_Video_logo_(2024).svg";
  } else if (normalizedId === "max" || normalizedId === "hbomax" || normalizedId === "hbo") {
    svgSrc = "/HBO_Max_(2025).svg";
  } else if (normalizedId === "apple" || normalizedId === "appletv") {
    svgSrc = "/Apple_TV_Plus_Logo.svg";
  } else if (normalizedId === "npostart" || normalizedId === "npo") {
    svgSrc = "/NPO_Start_logo.svg";
  } else if (normalizedId === "viaplay") {
    svgSrc = "/Viaplay_logo.svg";
  } else if (normalizedId === "skyshowtime") {
    svgSrc = "/SkyShowtime_Logo.svg";
  }

  // Determine current badge style wrapper classes
  const activeBgClass = brand.bgActive;
  const currentBgClass = active ? activeBgClass : brand.bgInactive;

  return (
    <div 
      className={`relative w-full h-full flex items-center justify-center rounded-xl transition-all duration-300 overflow-hidden px-2 py-1 ${currentBgClass} ${className}`} 
      {...props}
    >
      {svgSrc ? (
        <img
          src={svgSrc}
          alt={id}
          className={`object-contain transition-all duration-300 pointer-events-none ${
            active
              ? "filter-none opacity-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] scale-100"
              : "grayscale opacity-25 brightness-[0.7] contrast-100"
          }`}
          style={{ height: size, maxWidth: "100%" }}
          referrerPolicy="no-referrer"
        />
      ) : (
        // Retain premium custom text/icon fallbacks for Hulu, Paramount, and Videoland
        <div
          className={`font-sans tracking-tight leading-none text-center select-none ${
            active ? "opacity-100 scale-100" : "opacity-30"
          }`}
        >
          {normalizedId === "hulu" && (
            <span className={`text-[12px] font-black lowercase ${active ? "text-[#1CE783]" : "text-slate-500"}`}>
              hulu
            </span>
          )}
          {normalizedId === "paramount" && (
            <div className="flex flex-col items-center justify-center leading-none">
              <span className={`text-[8.5px] font-black italic uppercase leading-none ${active ? "text-white" : "text-slate-500"}`}>
                PMT
              </span>
              <span className={`text-[6px] font-black leading-none mt-0.5 ${active ? "text-sky-200" : "text-slate-500"}`}>
                PLUS
              </span>
            </div>
          )}
          {normalizedId === "videoland" && (
            <span className={`px-1 py-0.5 rounded font-black tracking-tighter text-[8px] uppercase ${active ? "bg-[#EC008C] text-white" : "bg-slate-800 text-slate-500"}`}>
              v|deo
            </span>
          )}
          {normalizedId === "pirate" && (
            <div className={`flex flex-col items-center justify-center leading-none ${active ? "animate-pulse-slow" : ""}`}>
              <svg
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={active ? "text-[#ffbf3e] drop-shadow-[0_2px_12px_rgba(255,191,62,0.45)]" : "text-slate-500"}
                style={{ width: size + 8, height: size + 8 }}
              >
                {/* Bowsprit / rigging lines at the front */}
                <path d="M8,34 L21,38" strokeWidth="1.5" />
                <path d="M14,35 C17,31 19,25 21,21" strokeWidth="1" />
                
                {/* Fore mast sails (billowing leftwards/backwards) */}
                <path d="M22,18 C15,21 15,29 22,31" fill="currentColor" fillOpacity={active ? "0.2" : "0"} strokeWidth="1.5" />
                <path d="M22,29 C16,31 16,36 22,38" fill="currentColor" fillOpacity={active ? "0.2" : "0"} strokeWidth="1.5" />
                
                {/* Main mast (center) with iconic large billowing sails */}
                <path d="M36,7 C26,11 26,23 36,25" fill="currentColor" fillOpacity={active ? "0.35" : "0"} strokeWidth="2.5" />
                <path d="M36,23 C26,25 26,34 36,36" fill="currentColor" fillOpacity={active ? "0.35" : "0"} strokeWidth="2.5" />
                <line x1="36" y1="7" x2="36" y2="40" strokeWidth="2.5" />
                <line x1="22" y1="18" x2="22" y2="40" strokeWidth="1.5" />

                {/* Mizzen mast (back) sail */}
                <path d="M49,19 C42,22 42,32 49,34" fill="currentColor" fillOpacity={active ? "0.2" : "0"} strokeWidth="1.5" />
                <line x1="49" y1="19" x2="49" y2="40" strokeWidth="1.5" />

                {/* Classical Galleon wooden Hull with curved high bow and curved high stern */}
                <path d="M13,38 C19,45 43,45 53,38 C55,35 56,29 56,29 C46,32 19,32 13,31 C10,31 11,35 13,38 Z" fill="currentColor" strokeWidth="1.8" />

                {/* Splashing waves directly under the pirate ship */}
                <path d="M5,44 C11,46 17,42 23,44 C29,46 35,42 41,44 C47,46 53,42 59,44" strokeWidth="2.5" />
                
                {/* Pirate Flag flying on top of the main mast */}
                <path d="M36,7 L43,9 L36,11" fill="currentColor" strokeWidth="1" />
              </svg>
            </div>
          )}
          {!["hulu", "paramount", "videoland", "pirate"].includes(normalizedId) && (
            <span className={`text-[10px] uppercase font-bold tracking-wider ${active ? brand.textColorActive : brand.textColorInactive}`}>
              {id}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
