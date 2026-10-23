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
      <div className="mb-6 rounded-2xl bg-white text-neutral-900 px-4 py-3 shadow-card border border-neutral-200/80 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden">
        <img
          src="/bannerbg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none opacity-60"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-white/70 pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Season {campaignConfig.seasonNumber}
          </span>
          <span className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
            {campaignConfig.title}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            <Coins className="w-3.5 h-3.5 text-amber-600" />
            +{campaignConfig.rewardPerPaper} GC (₦{campaignConfig.nairaPer500Coins.toLocaleString()}) / Course
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onOpenCampaignHub('upload')}
            className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-xs active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Paper
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
            title="Expand Campaign Banner"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Full Campaign Banner with /bannerbg.jpg ───
  return (
    <div className="mb-8 relative rounded-3xl overflow-hidden bg-white text-neutral-900 shadow-card border border-neutral-200/80 transition-all duration-300 group">
      {/* User's Luxury Silk Texture Background */}
      <img
        src="/bannerbg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none opacity-75 transition-transform duration-700 group-hover:scale-[1.01]"
        aria-hidden="true"
      />

      {/* Gentle White Gradient Overlay to guarantee pristine contrast and legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 to-white/70 pointer-events-none"
        aria-hidden="true"
      />

      {/* Minimize Toggle Button */}
      <button
        type="button"
        onClick={() => setIsMinimized(true)}
        className="absolute top-3.5 right-3.5 z-30 p-1.5 rounded-xl bg-white/80 hover:bg-white text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer backdrop-blur-md border border-neutral-200/80 shadow-xs"
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-300 shadow-xs backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Season {campaignConfig.seasonNumber} • Live Academic Bounty
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-800 border border-emerald-300 backdrop-blur-md shadow-xs">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              {campaignConfig.rewardPerPaper} GoCoins = ₦{campaignConfig.nairaPer500Coins.toLocaleString()} / Course
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-900/5 text-neutral-700 border border-neutral-300/60 backdrop-blur-md">
              <Target className="w-3 h-3 text-neutral-600" />
              5 Slots / Course
            </span>
          </div>

          {/* Headline & Description */}
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-neutral-900">
              {campaignConfig.title}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed max-w-xl">
              {campaignConfig.description ||
                'Upload verified Godfrey Okoye University exam question papers. The fastest clear submission per course wins 500 GoCoins (₦500) automatically deposited on Payday!'}
            </p>
          </div>

          {/* 3-Step Micro-Flow */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 backdrop-blur-md text-neutral-800 shadow-xs">
              <span className="w-5 h-5 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border border-amber-300">
                1
              </span>
              <span className="font-semibold">
                Race for Slot #1 <span className="text-neutral-500 font-normal">(Max 5)</span>
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 border border-neutral-200 backdrop-blur-md text-neutral-800 shadow-xs">
              <span className="w-5 h-5 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs border border-blue-300">
                2
              </span>
              <span className="font-semibold">Upload Clear Multi-Page Scan</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400 hidden sm:block shrink-0" />
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 backdrop-blur-md text-emerald-900 shadow-xs">
              <span className="w-5 h-5 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-300">
                3
              </span>
              <span className="font-semibold text-emerald-800">
                Direct Bank Payday <span className="text-emerald-600 font-normal">(₦500)</span>
              </span>
            </div>
          </div>

          {/* Action Buttons Tray */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onOpenCampaignHub('upload')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer border border-amber-400/40"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              Upload Exam Paper
              <span className="px-1.5 py-0.5 rounded-md bg-black/15 text-[10px] font-black tracking-wide">
                +{campaignConfig.rewardPerPaper} GC
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('tracker')}
              className="px-3.5 py-2.5 rounded-xl bg-white/90 hover:bg-white text-neutral-800 font-semibold text-xs sm:text-sm border border-neutral-200 shadow-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-4 h-4 text-amber-600" />
              Course Slot Tracker
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('submissions')}
              className="px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white text-neutral-700 font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/80 shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              My Uploads
            </button>

            <button
              type="button"
              onClick={onOpenPaydaySetup}
              className="px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-200 shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Payday Setup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Section: Glassmorphic Payday Countdown HUD */}
        <div className="w-full lg:w-76 shrink-0 bg-white/90 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-neutral-200 shadow-md flex flex-col justify-between gap-3 relative">
          {/* Top Card Kicker */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Payday Countdown
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
              Zero Min. Payout
            </span>
          </div>

          {timeLeft.isExpired ? (
            <div className="py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-300 text-center">
              <div className="text-sm font-extrabold text-emerald-800 tracking-wide">
                🎉 PAYDAY IS LIVE!
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
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
                  className="bg-neutral-50/90 rounded-xl py-2 px-1 border border-neutral-200/80 shadow-inner"
                >
                  <div className="text-lg sm:text-xl font-black text-neutral-900 tabular-nums leading-none">
                    {String(unit.value).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Best scan + timestamp wins</span>
            <span className="font-bold text-amber-700">1 upload / course</span>
          </div>
        </div>
      </div>
    </div>
  );
};
