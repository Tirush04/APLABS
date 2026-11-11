import React, { useState, useEffect } from 'react';
import {
  PropertyProfile,
  PricingTiers,
  RevenueMetrics,
  AmenityComparison,
  BookingOutlookMonth,
} from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { enforceNumberGuard } from '../utils/numberGuard';
import { useData } from '../context/DataContext';
import {
  Printer,
  X,
  Sparkles,
  Building,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface ClientBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PropertyProfile;
  pricing: PricingTiers;
  revenue: RevenueMetrics;
  amenities: AmenityComparison[];
  outlook: BookingOutlookMonth[];
  contextJson: Record<string, any>;
}

export const ClientBriefModal: React.FC<ClientBriefModalProps> = ({
  isOpen,
  onClose,
  profile,
  pricing,
  revenue,
  amenities,
  outlook,
  contextJson,
}) => {
  const { addAIGuardLog } = useData();
  const [narrative, setNarrative] = useState<string>('');
  const [loadingNarrative, setLoadingNarrative] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingNarrative(true);

    fetch('/api/gemini/brief-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextJson }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const raw = data.text || '';
        const guard = enforceNumberGuard(raw, contextJson);
        setNarrative(guard.sanitizedText);
        setVerified(guard.verified);

        addAIGuardLog({
          source: 'brief',
          originalResponse: raw,
          flaggedTokens: guard.flaggedTokens,
          verified: guard.verified,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        // Fallback deterministic narrative if AI call fails
        const fallback = `Based on ${pricing.n} comparable active listings in ${profile.neighbourhood}, we recommend launching at ${formatCurrency(pricing.p40)}/night to secure initial reviews before normalizing to the market median of ${formatCurrency(pricing.recommendedPrice)}/night (typical range ${formatCurrency(pricing.p25)}–${formatCurrency(pricing.p75)}). At an estimated median occupancy of ${revenue.bookedNightsMedian} booked nights per year, projected annual gross revenue is ${formatCurrency(revenue.annualRevenueMedian)}. Premium-tier listings with ratings of 4.8★ or higher achieve up to ${formatCurrency(pricing.topRatedP75)}/night.`;
        setNarrative(fallback);
        setVerified(true);
      })
      .finally(() => {
        if (isMounted) setLoadingNarrative(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, contextJson, pricing, revenue, profile]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const topAmenities = [...amenities]
    .filter((a) => !a.isLowSample && a.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 my-8 text-slate-800 printable-card">
        {/* Actions bar (hidden in print) */}
        <div className="no-print flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
              Client Advisory Brief (One-Pager)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print or Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Header */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
          <div>
            <span className="text-xs font-bold text-teal-800 uppercase tracking-widest block">
              DC Short-Term Rental Advisory
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Short-Term Rental Market Valuation Brief
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Subject: {profile.bedrooms}-Bedroom {profile.propertyType} · {profile.neighbourhood}, Washington, DC
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-900 block">
              DC STR Advisor
            </span>
            <span className="text-[11px] text-slate-500 block font-mono">
              Scrape: 2026-09-20
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              Sample n = {pricing.n} comps
            </span>
          </div>
        </div>

        {/* 3-Sentence Executive Narrative */}
        <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              Advisory Executive Summary
            </span>
            {verified && (
              <span className="text-[10px] text-teal-800 font-medium">
                ✓ Numbers strictly audited
              </span>
            )}
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-sans">
            {loadingNarrative ? 'Generating executive narrative...' : narrative}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="p-3.5 bg-teal-50/50 rounded-xl border border-teal-200">
            <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wide block">
              Recommended Nightly Rate
            </span>
            <p className="text-2xl font-bold font-mono text-teal-950 mt-1">
              {formatCurrency(pricing.recommendedPrice)}
            </p>
            <span className="text-[11px] text-teal-800 font-mono mt-0.5 block">
              Typical: {formatCurrency(pricing.p25)}–{formatCurrency(pricing.p75)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
              Annual Est. Booked Nights
            </span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatNumber(revenue.bookedNightsMedian)}
            </p>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              ~{Math.round((revenue.bookedNightsMedian / 365) * 100)}% annualized occupancy
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
              Estimated Annual Revenue
            </span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrency(revenue.annualRevenueMedian)}
            </p>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Range: {formatCurrency(revenue.annualRevenueP25)}–{formatCurrency(revenue.annualRevenueP75)}
            </span>
          </div>
        </div>

        {/* Pricing Strategy Tiers */}
        <div className="my-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Recommended Pricing Roadmap
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-800 block">Launch Tier (P40)</span>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(pricing.p40)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                First 5–10 bookings to generate velocity and initial 5★ reviews.
              </p>
            </div>
            <div className="p-3 border-2 border-teal-700 bg-teal-50/40 rounded-lg">
              <span className="font-bold text-teal-950 block">Market Tier (Median)</span>
              <p className="text-lg font-bold font-mono text-teal-950 mt-1">
                {formatCurrency(pricing.recommendedPrice)}
              </p>
              <p className="text-[10px] text-teal-800 mt-0.5">
                Target rate for steady-state equilibrium.
              </p>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-800 block">Premium Tier (P75★)</span>
              <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                {formatCurrency(pricing.topRatedP75)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                For top-rated comps with pristine amenities and superhost badge.
              </p>
            </div>
          </div>
        </div>

        {/* Top Amenity Differentials */}
        {topAmenities.length > 0 && (
          <div className="my-6">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              High-Value Amenity Differentials in {profile.neighbourhood}
            </h3>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {topAmenities.map((amenity) => (
                <div key={amenity.key} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="font-semibold text-slate-800 truncate">{amenity.label}</p>
                  <p className="font-bold font-mono text-teal-800 mt-1">
                    +{formatCurrency(amenity.diff)} / night
                  </p>
                  <p className="text-[10px] text-slate-500">n: {amenity.withN} vs {amenity.withoutN}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Method & Compliance Footnote */}
        <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
          <p>
            <strong>Data Source & Method:</strong> Inside Airbnb Washington, DC scrape 2026-09-20 (CC BY 4.0).
            Percentiles computed via linear interpolation (Excel PERCENTILE.INC).
            Annual revenue computed as median of actual estimated revenue, not a product of medians.
          </p>
          <p>
            <strong>Regulatory Disclaimer:</strong> Host licensing and local DC DLCP regulations apply. This brief is for advisory planning purposes.
          </p>
        </div>
      </div>
    </div>
  );
};
