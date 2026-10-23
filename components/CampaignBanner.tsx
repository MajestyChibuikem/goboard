import React, { useState, useEffect } from 'react';
import { CampaignConfig } from '../types';
import {
  Coins,
  Upload,
  Sparkles,
  Clock,
  Target,
  ShieldCheck,
  ChevronRight,
  FileText,
  ChevronUp,
  ChevronDown,
  Zap,
} from 'lucide-react';

export type CampaignHubTab = 'upload' | 'tracker' | 'submissions';

interface CampaignBannerProps {
  campaignConfig: CampaignConfig;
  onOpenCampaignHub: (tab?: CampaignHubTab) => void;
  onOpenPaydaySetup: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

function calculateTimeRemaining(targetIso: string): TimeRemaining {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;

  if (Number.isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isExpired: false };
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({
  campaignConfig,
  onOpenCampaignHub,
  onOpenPaydaySetup,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(campaignConfig.paydayDate)
  );
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    setTimeLeft(calculateTimeRemaining(campaignConfig.paydayDate));
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(campaignConfig.paydayDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [campaignConfig.paydayDate]);

  if (!campaignConfig.isActive) {
    return null;
  }

  // ─── Minimized Sleek Bar ───
  if (isMinimized) {
    return (
      <div className="mb-6 rounded-2xl bg-[#070b19] text-white px-4 py-3 shadow-md border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden">
        <img
          src="/season1-banner-bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-screen pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/40 shrink-0 shadow-xs">
            <img src="/season1-bounty-crest.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Season {campaignConfig.seasonNumber}
          </span>
          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {campaignConfig.title}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            +{campaignConfig.rewardPerPaper} GC (₦{campaignConfig.nairaPer500Coins.toLocaleString()}) / Winner
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onOpenCampaignHub('upload')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-neutral-950 font-black text-xs hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
            Upload Paper
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Expand Campaign Banner"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Full Pinterest-Inspired Obsidian & Gold Bounty Banner ───
  return (
    <div className="mb-8 relative rounded-3xl overflow-hidden bg-[#070b18] text-white shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_35px_rgba(245,158,11,0.12)] border border-amber-500/30 hover:border-amber-400/50 transition-all duration-300 group">
      {/* Cinematic Background Layer */}
      <img
        src="/season1-banner-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-45 mix-blend-screen pointer-events-none select-none transition-transform duration-700 group-hover:scale-[1.01]"
        aria-hidden="true"
      />

      {/* Atmospheric Radial Glow Accents */}
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-amber-500/25 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-[#070b18]/95 via-[#070b18]/80 to-[#070b18]/90 pointer-events-none"
        aria-hidden="true"
      />

      {/* Minimize Toggle Button */}
      <button
        type="button"
        onClick={() => setIsMinimized(true)}
        className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer backdrop-blur-md border border-white/10"
        title="Minimize Banner"
        aria-label="Minimize Banner"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <div className="relative z-10 p-5 sm:p-7 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 sm:gap-8">
        {/* Left Column: Details, Rules Flow & CTAs */}
        <div className="space-y-4 max-w-2xl min-w-0">
          {/* Header Badges Tray */}
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400/25 to-yellow-500/20 text-amber-300 border border-amber-400/40 shadow-sm backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Season {campaignConfig.seasonNumber} • Live Academic Bounty
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 backdrop-blur-md">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {campaignConfig.rewardPerPaper} GoCoins = ₦{campaignConfig.nairaPer500Coins.toLocaleString()} / Course
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-indigo-200 border border-white/10 backdrop-blur-md">
              <Target className="w-3 h-3 text-indigo-300" />
              5 Slots / Course
            </span>
          </div>

          {/* Headline & Description */}
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight text-white">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-300 to-amber-500">
                {campaignConfig.title}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300/90 mt-2 leading-relaxed max-w-xl">
              {campaignConfig.description ||
                'Upload verified Godfrey Okoye University exam question papers. The fastest clear submission per course wins 500 GoCoins (₦500) automatically deposited on Payday!'}
            </p>
          </div>

          {/* Pinterest-Style 3-Step Micro-Flow */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-neutral-200">
              <span className="w-5 h-5 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold text-xs border border-amber-400/30">
                1
              </span>
              <span className="font-semibold">
                Race for Slot #1 <span className="text-neutral-400 font-normal">(Max 5)</span>
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 hidden sm:block shrink-0" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-neutral-200">
              <span className="w-5 h-5 rounded-lg bg-blue-400/20 text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-400/30">
                2
              </span>
              <span className="font-semibold">Upload Clear Multi-Page Scan</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 hidden sm:block shrink-0" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-neutral-200">
              <span className="w-5 h-5 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-bold text-xs border border-emerald-400/30">
                3
              </span>
              <span className="font-semibold text-emerald-300">
                Direct Bank Payday <span className="text-emerald-400 font-normal">(₦500)</span>
              </span>
            </div>
          </div>

          {/* Action Buttons Tray */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onOpenCampaignHub('upload')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-neutral-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border border-amber-300/40"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              Upload Exam Paper
              <span className="px-1.5 py-0.5 rounded-md bg-neutral-950/20 text-[10px] font-black tracking-wide">
                +{campaignConfig.rewardPerPaper} GC
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('tracker')}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm border border-white/15 backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-4 h-4 text-amber-300" />
              Course Slot Tracker
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('submissions')}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-white/5"
            >
              <FileText className="w-3.5 h-3.5" />
              My Uploads
            </button>

            <button
              type="button"
              onClick={onOpenPaydaySetup}
              className="px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/30"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Payday Setup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Section: 3D Bounty Crest + Glassmorphic Countdown HUD */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4 shrink-0 lg:w-80">
          {/* 3D Bounty Crest Artwork Card */}
          <div className="w-full sm:w-48 lg:w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-400/25 backdrop-blur-md">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-amber-400/50 shadow-md shadow-amber-500/20 shrink-0">
              <img
                src="/season1-bounty-crest.jpg"
                alt="Season 1 Bounty Crest"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Merit Award
              </div>
              <div className="text-xs font-bold text-white leading-snug truncate">
                Official Paper Bounty
              </div>
              <div className="text-[11px] text-neutral-300 flex items-center gap-1 mt-0.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Fastest scan wins 500 GC</span>
              </div>
            </div>
          </div>

          {/* Glassmorphic Payday Countdown Card */}
          <div className="w-full bg-[#050814]/75 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-amber-500/25 shadow-2xl flex flex-col justify-between gap-3 relative overflow-hidden">
            {/* Top Card Kicker */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Payday Countdown
              </span>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                Zero Min. Payout
              </span>
            </div>

            {timeLeft.isExpired ? (
              <div className="py-3 px-4 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-center">
                <div className="text-sm font-extrabold text-emerald-300 tracking-wide">
                  🎉 PAYDAY IS LIVE!
                </div>
                <div className="text-[11px] text-emerald-100/80 mt-0.5">
                  Verified students are being paid out
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Days', value: timeLeft.days },
                  { label: 'Hours', value: timeLeft.hours },
                  { label: 'Mins', value: timeLeft.minutes },
                  { label: 'Secs', value: timeLeft.seconds },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    className="bg-white/5 rounded-xl py-2 px-1 border border-white/10 shadow-inner"
                  >
                    <div className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-neutral-300 tabular-nums leading-none">
                      {String(unit.value).padStart(2, '0')}
                    </div>
                    <div className="text-[9px] font-bold text-amber-300/80 uppercase tracking-wider mt-1">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-300">
              <span>Best scan + timestamp wins</span>
              <span className="font-bold text-amber-300">1 upload / course</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
