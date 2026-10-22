import React from "react";

/**
 * Pixel-accurate Thonny 4 toolbar icons matching the user's reference screenshot:
 * New, Open, Save, Run, Debug, Step Over, Step Into, Step Out, Resume, Octagonal STOP, and Flag icon.
 */

export const NewFileIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <path
      d="M4 2h8l4 4v12H4V2z"
      fill="#F8FAFC"
      stroke="#475569"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M12 2v4h4"
      fill="#CBD5E1"
      stroke="#475569"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const OpenFolderIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <path
      d="M2 5h5.5l1.5 2H17v9H2V5z"
      fill="#F6C445"
      stroke="#785C12"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M2 16l2-7h14l-2 7H2z"
      fill="#FDE068"
      stroke="#785C12"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M13 2.5c2 0 3.2 1 3.5 2.5"
      fill="none"
      stroke="#475569"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

export const SaveDiskIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <path
      d="M3 2.5h11.5L17 5v12.5H3V2.5z"
      fill="#5C6BC0"
      stroke="#283593"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <rect x="6" y="2.5" width="7" height="5" fill="#E8EAF6" stroke="#283593" strokeWidth="0.9" />
    <rect x="10.2" y="3.5" width="1.6" height="3" fill="#3949AB" />
    <rect x="5" y="10.5" width="10" height="7" fill="#FFFFFF" stroke="#283593" strokeWidth="0.9" />
  </svg>
);

export const RunScriptIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <circle cx="10" cy="10" r="8.2" fill="#388E3C" stroke="#1B5E20" strokeWidth="1.2" />
    <polygon points="8,6 14.5,10 8,14" fill="#FFFFFF" />
  </svg>
);

export const DebugScriptIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    {/* Antennae */}
    <path d="M7.5 5.2L6 3M12.5 5.2L14 3" stroke="#2E5A36" strokeWidth="1.3" strokeLinecap="round" />
    {/* Legs */}
    <path
      d="M6 8.5L3 7.5M6 11L2.8 11M6.2 13.5L3.2 14.8M14 8.5L17 7.5M14 11L17.2 11M13.8 13.5L16.8 14.8"
      stroke="#2E5A36"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    {/* Bug body */}
    <ellipse cx="10" cy="11" rx="4.2" ry="5.2" fill="#558B2F" stroke="#1B5E20" strokeWidth="1.2" />
    <line x1="10" y1="6.5" x2="10" y2="16" stroke="#1B5E20" strokeWidth="1" />
  </svg>
);

export const StepOverIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <rect x="6" y="13.5" width="8" height="3" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
    <path
      d="M4.5 11.5C5.5 5.5 14.5 5.5 15.5 11"
      fill="none"
      stroke="#90A4AE"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <polygon points="16,12 12.8,10.5 16.5,8.5" fill="#90A4AE" />
  </svg>
);

export const StepIntoIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <rect x="6" y="13.5" width="8" height="3" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
    <path
      d="M6 4.5H10V10.5"
      fill="none"
      stroke="#90A4AE"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polygon points="10,12.5 7.2,9.2 12.8,9.2" fill="#90A4AE" />
  </svg>
);

export const StepOutIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <rect x="6" y="13.5" width="8" height="3" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
    <path
      d="M10 12V6H14.5"
      fill="none"
      stroke="#90A4AE"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polygon points="16.5,6 13.2,3.5 13.2,8.5" fill="#90A4AE" />
  </svg>
);

export const ResumeIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <rect x="4" y="4.5" width="2.5" height="11" fill="#90A4AE" />
    <polygon points="8.5,4.5 16.5,10 8.5,15.5" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
  </svg>
);

export const StopRestartIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" aria-hidden="true">
    <polygon
      points="6.2,1.8 13.8,1.8 18.2,6.2 18.2,13.8 13.8,18.2 6.2,18.2 1.8,13.8 1.8,6.2"
      fill="#D32F2F"
      stroke="#8E0000"
      strokeWidth="1"
    />
    <text
      x="10"
      y="12.1"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="5.4"
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
      letterSpacing="-0.2"
    >
      STOP
    </text>
  </svg>
);

export const UkraineFlagIcon: React.FC = () => (
  <svg viewBox="0 0 20 16" className="w-[18px] h-[15px]" aria-hidden="true">
    <rect x="1" y="1" width="18" height="7" fill="#0057B7" />
    <rect x="1" y="8" width="18" height="7" fill="#FFD700" />
    <rect x="1" y="1" width="18" height="14" fill="none" stroke="#B0B0B0" strokeWidth="0.8" />
  </svg>
);
