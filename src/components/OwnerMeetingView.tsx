import React from 'react';
import { PropertyProfile, PricingTiers, RevenueMetrics } from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { Building2, Sparkles, TrendingUp, ShieldCheck } from 'lucide-react';

interface OwnerMeetingViewProps {
  profile: PropertyProfile;
  pricing: PricingTiers;
  revenue: RevenueMetrics;
  onOpenExplain: () => void;
  onSwitchToAdvisor: () => void;
}

export const OwnerMeetingView: React.FC<OwnerMeetingViewProps> = ({
  profile,
  pricing,
  revenue,
  onOpenExplain,
  onSwitchToAdvisor,
}) => {
  // 3 plain-English computed takeaways
  const takeaway1 = `Charge approximately ${formatCurrency(
    pricing.recommendedPrice
  )} per night. In ${profile.neighbourhood}, similar ${profile.bedrooms}-bedroom ${
    profile.propertyType === 'Condo' ? 'condos' : 'homes'
  } command between ${formatCurrency(pricing.p25)} and ${formatCurrency(
    pricing.p75
  )} across ${pricing.n} active listings.`;

  const takeaway2 = `Plan for approximately ${formatNumber(
    revenue.bookedNightsMedian
  )} booked nights per year (~${Math.round(
    (revenue.bookedNightsMedian / 365) * 100
  )}% occupancy), delivering projected annual gross revenue of ${formatCurrency(
    revenue.annualRevenueMedian
  )} (conservative: ${formatCurrency(
    revenue.annualRevenueP25
  )}, high: ${formatCurrency(revenue.annualRevenueP75)}).`;

  const takeaway3 = `Launch with an introductory rate of ${formatCurrency(
    pricing.p40
  )}/night to win your first 5–10 bookings and reviews. Once established, top-rated comparable properties achieve ${formatCurrency(
    pricing.topRatedP75
  )}/night.`;

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8 animate-fade-in">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
          Client Meeting Presentation View
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Short-Term Rental Earnings Potential
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          {profile.bedrooms}-Bedroom {profile.propertyType} · {profile.neighbourhood}, Washington, DC
        </p>
      </div>

      {/* Hero Numbers in Big Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommended Nightly Price */}
        <div className="p-8 bg-gradient-to-br from-teal-900 to-slate-900 text-white rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-semibold text-teal-300 tracking-wider">
              Recommended Nightly Price
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white">
                {formatCurrency(pricing.recommendedPrice)}
              </span>
              <span className="text-lg text-teal-200">/ night</span>
            </div>
            <p className="text-xs text-teal-200 mt-3">
              Typical market range: {formatCurrency(pricing.p25)} to {formatCurrency(pricing.p75)}
            </p>
          </div>

          <div className="mt-8 pt-4 border-t border-teal-800 flex items-center justify-between text-xs text-teal-300">
            <span>Market Median (P50)</span>
            <span>Based on {pricing.n} similar homes</span>
          </div>
        </div>

        {/* Expected Annual Earnings */}
        <div className="p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">
              Expected Annual Revenue
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-teal-900">
                {formatCurrency(revenue.annualRevenueMedian)}
              </span>
              <span className="text-lg text-slate-500">/ year</span>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Expected range: {formatCurrency(revenue.annualRevenueP25)} – {formatCurrency(revenue.annualRevenueP75)}
            </p>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>~{formatNumber(revenue.bookedNightsMedian)} booked nights/yr</span>
            <span>~{formatCurrency(Math.round(revenue.annualRevenueMedian / 12))}/mo</span>
          </div>
        </div>
      </div>

      {/* 3 Plain-English Takeaways in Large Type */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-700" />
          <span>Key Strategic Takeaways for Your Property</span>
        </h2>

        <div className="space-y-4">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wide block mb-1">
              1. Optimal Pricing Position
            </span>
            <p className="text-base text-slate-800 leading-relaxed font-medium">
              {takeaway1}
            </p>
          </div>

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wide block mb-1">
              2. Annual Cashflow Expectation
            </span>
            <p className="text-base text-slate-800 leading-relaxed font-medium">
              {takeaway2}
            </p>
          </div>

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wide block mb-1">
              3. Launch to Premium Growth Strategy
            </span>
            <p className="text-base text-slate-800 leading-relaxed font-medium">
              {takeaway3}
            </p>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onOpenExplain}
            className="w-full sm:w-auto px-5 py-3 bg-teal-800 hover:bg-teal-900 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Meeting Talking Points (AI)</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToAdvisor}
            className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition-colors text-center"
          >
            Switch to Detailed Advisor View →
          </button>
        </div>
      </div>
    </div>
  );
};
