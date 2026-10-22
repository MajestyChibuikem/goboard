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

  if (isMinimized) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#131129] via-[#1e1b4b] to-[#2e1065] text-white px-4 py-3 shadow-md border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Season {campaignConfig.seasonNumber}
          </span>
          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {campaignConfig.title}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-white/10 px-2.5 py-0.5 rounded-lg">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            +{campaignConfig.rewardPerPaper} GC / Paper (₦{campaignConfig.nairaPer500Coins.toLocaleString()})
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onOpenCampaignHub('upload')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 font-bold text-xs hover:brightness-105 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Paper
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title="Expand Campaign Banner"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#1e1b4b] to-[#311042] text-white shadow-xl border border-indigo-500/30">
      {/* Decorative Gacha / Event Glow Accents */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.9) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
        aria-hidden="true"
      />

      {/* Minimize toggle */}
      <button
        type="button"
        onClick={() => setIsMinimized(true)}
        className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
        title="Minimize Banner"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <div className="relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left column: Event details & CTAs */}
        <div className="space-y-4 max-w-2xl">
          {/* Event Badges */}
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Season {campaignConfig.seasonNumber} • Live Event
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              {campaignConfig.rewardPerPaper} GoCoins = ₦{campaignConfig.nairaPer500Coins.toLocaleString()}
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-indigo-200 border border-white/10">
              <Target className="w-3 h-3 text-indigo-300" />
              5 Slots / Course
            </span>
          </div>

          {/* Headline & Description */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
              {campaignConfig.title}
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/85 mt-1.5 leading-relaxed">
              {campaignConfig.description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenCampaignHub('upload')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-neutral-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              Upload Exam Paper
              <span className="px-1.5 py-0.5 rounded-md bg-neutral-950/15 text-[10px] font-black">
                +{campaignConfig.rewardPerPaper} GC
              </span>
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('tracker')}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs sm:text-sm border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Target className="w-4 h-4 text-amber-300" />
              Course Slot Tracker
            </button>

            <button
              type="button"
              onClick={() => onOpenCampaignHub('submissions')}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-200 hover:text-white font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              My Uploads
            </button>

            <button
              type="button"
              onClick={onOpenPaydaySetup}
              className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-300 hover:text-emerald-200 font-semibold text-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Payday Setup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right column: Payday Countdown & Reward Rate Card */}
        <div className="lg:w-72 shrink-0 bg-black/25 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Payday Countdown
            </span>
            <span className="text-[10px] font-semibold text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md">
              No Min. Threshold
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
                  className="bg-white/10 rounded-xl py-2 px-1 border border-white/10"
                >
                  <div className="text-lg sm:text-xl font-black text-white tabular-nums leading-none">
                    {String(unit.value).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] font-semibold text-indigo-200/80 uppercase tracking-wider mt-1">
                    {unit.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200/90">
            <span>Best timestamp + clear scan wins</span>
            <span className="font-bold text-amber-300">1 upload / course</span>
          </div>
        </div>
      </div>
    </div>
  );
};
