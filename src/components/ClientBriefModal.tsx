import React, { useState, useEffect, useRef } from 'react';
import {
  PropertyProfile,
  PricingTiers,
  RevenueMetrics,
  AmenityComparison,
  BookingOutlookMonth,
} from '../types';
import { formatCurrency, formatNumber, formatDiff } from '../utils/math';
import { enforceNumberGuard } from '../utils/numberGuard';
import { useData } from '../context/DataContext';
import {
  Printer,
  X,
  Sparkles,
  AlertTriangle,
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
  scrapeDate?: string;
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
  scrapeDate = '2026-09-20',
}) => {
  const { addAIGuardLog } = useData();
  const [narrative, setNarrative] = useState<string>('');
  const [loadingNarrative, setLoadingNarrative] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(true);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const hasWidening = Boolean(
    (pricing.provenance.widenedSteps && pricing.provenance.widenedSteps.length > 0) ||
    pricing.n < 10
  );

  const isDistrictWide = Boolean(
    pricing.provenance.widenedSteps?.some((step) =>
      step.toLowerCase().includes('district') || step.toLowerCase().includes('all dc')
    )
  );

  const locationLabel = isDistrictWide ? 'across DC' : `in ${profile.neighbourhood}`;
  const bedLabel = profile.bedrooms === 0 ? 'Studio' : `${profile.bedrooms}-bedroom`;
  const occupancyPct = revenue.occupancyPct || Math.round((revenue.bookedNightsMedian / 365) * 100);

  useEffect(() => {
    if (!isOpen || pricing.n === 0) return;

    let isMounted = true;
    setLoadingNarrative(true);
    setIsFallback(false);

    const fallback = `Based on ${pricing.n} comparable active listings ${locationLabel}, we recommend launching at ${formatCurrency(pricing.p40)}/night before normalizing to the market median of ${formatCurrency(pricing.recommendedPrice)}/night (typical range ${formatCurrency(pricing.p25)}–${formatCurrency(pricing.p75)}). At an estimated median occupancy of ${revenue.bookedNightsMedian} booked nights per year (~${occupancyPct}%), projected annual gross revenue is ${formatCurrency(revenue.annualRevenueMedian)}.`;

    fetch('/api/gemini/brief-narrative', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextJson }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const raw = data.text || '';
        const guard = enforceNumberGuard(raw, contextJson);
        setNarrative(guard.sanitizedText);
        setVerified(guard.verified);
        setIsFallback(false);

        addAIGuardLog({
          source: 'brief',
          originalResponse: raw,
          flaggedTokens: guard.flaggedTokens,
          verified: guard.verified,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Client brief AI error:', err);
        setNarrative(fallback);
        setVerified(true);
        setIsFallback(true);
      })
      .finally(() => {
        if (isMounted) setLoadingNarrative(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, contextJson, pricing, revenue, profile, locationLabel, occupancyPct]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const topAmenities = [...amenities]
    .filter((a) => !a.isLowSample && a.diff > 0 && a.withN > 0 && a.withoutN > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  // Appendix records for the printed document
  const appendixFigures = [
    {
      metric: 'Recommended Rate (Market Median P50)',
      value: `${formatCurrency(pricing.recommendedPrice)}/night`,
      filter: pricing.marketProvenance?.filterApplied || pricing.provenance.filterApplied,
      n: pricing.marketProvenance?.rowCount || pricing.n,
      formula: pricing.marketProvenance?.formula || 'Median of active comp prices (Excel PERCENTILE.INC)',
    },
    {
      metric: 'Typical Range (25th to 75th Percentile)',
      value: `${formatCurrency(pricing.p25)} – ${formatCurrency(pricing.p75)}/night`,
      filter: pricing.p25Provenance?.filterApplied || pricing.provenance.filterApplied,
      n: pricing.p25Provenance?.rowCount || pricing.n,
      formula: '25th and 75th percentiles via linear interpolation',
    },
    {
      metric: 'Launch Tier (P40)',
      value: `${formatCurrency(pricing.p40)}/night`,
      filter: pricing.launchProvenance?.filterApplied || pricing.provenance.filterApplied,
      n: pricing.launchProvenance?.rowCount || pricing.n,
      formula: '40th percentile via linear interpolation',
    },
    ...(pricing.topRatedN >= 10
      ? [
          {
            metric: 'Premium Tier (P75 of ≥4.8★ Comps)',
            value: `${formatCurrency(pricing.topRatedP75)}/night`,
            filter: pricing.premiumProvenance?.filterApplied || 'Rating ≥ 4.8★ subset of comps',
            n: pricing.topRatedN,
            formula: '75th percentile of top-rated comps',
          },
        ]
      : []),
    {
      metric: 'Annual Est. Booked Nights',
      value: `${formatNumber(revenue.bookedNightsMedian)} nights/yr (~${occupancyPct}%)`,
      filter: revenue.occupancyProvenance?.filterApplied || revenue.provenance.filterApplied,
      n: revenue.occupancyProvenance?.rowCount || pricing.n,
      formula: 'Median of estimated_booked_nights_l365d across comps',
    },
    {
      metric: 'Estimated Annual Revenue (Median)',
      value: `${formatCurrency(revenue.annualRevenueMedian)}/year`,
      filter: revenue.revenueProvenance?.filterApplied || revenue.provenance.filterApplied,
      n: revenue.revenueProvenance?.rowCount || pricing.n,
      formula: 'Median of estimated_revenue_l365d across comps (not product of medians)',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="brief-modal-title"
          className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto sm:my-8 text-slate-800 printable-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky action bar (hidden in print) */}
          <div className="no-print sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                Client Advisory Brief (One-Pager)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs min-h-[44px]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print or Save as PDF</span>
              </button>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="px-2.5 py-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Widening Notice Banner if applicable */}
            {hasWidening && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Comp set widened:</strong> Not enough exact matches (n &lt; 10); widened to:{' '}
                  {pricing.provenance.widenedSteps?.join(' → ') || 'expanded criteria'}.
                </span>
              </div>
            )}

            {/* Printable Document Header */}
            <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
              <div>
                <span className="text-xs font-bold text-teal-800 uppercase tracking-widest block">
                  DC Short-Term Rental Advisory
                </span>
                <h1 id="brief-modal-title" className="text-2xl font-bold text-slate-900 mt-1">
                  Short-Term Rental Market Valuation Brief
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subject: {bedLabel} {profile.propertyType} · {locationLabel}, Washington, DC
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 block">
                  DC STR Advisor
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  Scrape: {scrapeDate}
                </span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  Sample n = {pricing.n} comps
                </span>
              </div>
            </div>

            {pricing.n === 0 ? (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-center">
                Not enough similar listings: try a nearby neighbourhood.
              </div>
            ) : (
              <>
                {/* Executive Narrative */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                      {isFallback
                        ? 'Summary generated from computed values (AI unavailable)'
                        : 'Advisory Executive Summary'}
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

                {/* Key Metrics Grid: 1 col on mobile, 3 col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      ~{occupancyPct}% annualized occupancy
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

                {/* Pricing Strategy Tiers: 1 col on mobile, 3 col on sm+ */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Recommended Pricing Roadmap
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 border border-slate-200 rounded-lg">
                      <span className="font-bold text-slate-800 block">Launch Tier (P40)</span>
                      <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                        {formatCurrency(pricing.p40)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Introductory pricing to generate early reviews.
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
                    {pricing.topRatedN >= 10 ? (
                      <div className="p-3 border border-slate-200 rounded-lg">
                        <span className="font-bold text-slate-800 block">Premium Tier (P75★)</span>
                        <p className="text-lg font-bold font-mono text-slate-900 mt-1">
                          {formatCurrency(pricing.topRatedP75)}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          For top-rated comps with pristine amenities and superhost badge.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-400">
                        <span className="font-bold block">Premium Tier</span>
                        <p className="text-xs mt-1">
                          Not enough top-rated listings (n={pricing.topRatedN})
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Amenity Differentials */}
                {topAmenities.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      High-Value Amenity Differentials {locationLabel}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {topAmenities.map((amenity) => (
                        <div key={amenity.key} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <p className="font-semibold text-slate-800 truncate">{amenity.label}</p>
                          <p className="font-bold font-mono text-teal-800 mt-1">
                            {formatDiff(amenity.diff)} / night
                          </p>
                          <p className="text-[10px] text-slate-500">n: {amenity.withN} vs {amenity.withoutN}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Printed Appendix: per figure -> filter, n, formula */}
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Data Audit Appendix (Formulas & Comp Counts)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-slate-700 font-semibold">
                        <tr>
                          <th className="p-2">Metric Figure</th>
                          <th className="p-2">Value</th>
                          <th className="p-2">Comp Filter</th>
                          <th className="p-2">Sample (n)</th>
                          <th className="p-2">Formula / Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {appendixFigures.map((fig, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-sans font-medium text-slate-900">{fig.metric}</td>
                            <td className="p-2 font-bold text-teal-900">{fig.value}</td>
                            <td className="p-2 text-slate-500 max-w-[160px] truncate">{fig.filter}</td>
                            <td className="p-2">{fig.n}</td>
                            <td className="p-2 text-slate-500">{fig.formula}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Method & Compliance Footnote */}
                <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
                  <p>
                    <strong>Data Source:</strong> Inside Airbnb Washington, DC scrape {scrapeDate} (CC BY 4.0).
                    Percentiles computed via linear interpolation (Excel PERCENTILE.INC).
                    Annual revenue computed as median of actual estimated revenue, not a product of medians.
                  </p>
                  <p>
                    <strong>Regulatory Disclaimer:</strong> Host licensing and local DC DLCP regulations apply. This brief is for advisory planning purposes.
                  </p>
                </div>
              </>
            )}

            {/* Bottom Close Button (no-print) */}
            <div className="no-print pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
