import React from 'react';
import { Sparkles, ArrowRight, Home, Building2, CheckCircle2 } from 'lucide-react';

interface LandingHeroProps {
  onTrySample: () => void;
  onStartCustom: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onTrySample,
  onStartCustom,
}) => {
  return (
    <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center max-w-4xl mx-auto my-6">
      {/* Background soft ambient accents */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-teal-50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-slate-100 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-full text-xs font-bold tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          Inside Airbnb Washington, DC Scraped Market Intelligence
        </span>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-2xl mx-auto text-balance">
          What should this DC home earn on Airbnb?
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          Get a rigorous, data-grounded price recommendation in under 60 seconds. Every figure is computed in TypeScript code from 4,268 active DC listings—never hallucinated by AI.
        </p>

        {/* 2 Primary Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={onTrySample}
            className="w-full sm:w-auto px-6 py-3.5 bg-teal-800 hover:bg-teal-900 text-white font-semibold rounded-xl text-sm transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-teal-200" />
            <span>Try the sample 1-bed condo</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onStartCustom}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4 text-slate-600" />
            <span>Start with my property</span>
          </button>
        </div>

        {/* Features Checklist */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            4,268 DC Active Comps
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            100% Code-Audited Numbers
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            1-Click Printable Client Brief
          </span>
        </div>
      </div>
    </div>
  );
};
