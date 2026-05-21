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
          {!["hulu", "paramount", "videoland"].includes(normalizedId) && (
            <span className={`text-[10px] uppercase font-bold tracking-wider ${active ? brand.textColorActive : brand.textColorInactive}`}>
              {id}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
