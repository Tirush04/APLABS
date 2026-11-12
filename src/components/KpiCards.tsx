import React, { useEffect, useRef, useState } from 'react';
import { PricingTiers, RevenueMetrics, Provenance } from '../types';
import { formatCurrency, formatNumber, formatDiff } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { HelpCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface KpiCardsProps {
  pricing: PricingTiers;
  revenue: RevenueMetrics;
  onOpenProvenance: (p: Provenance) => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  pricing,
  revenue,
  onOpenProvenance,
}) => {
  const isFirstRender = useRef(true);
  const [hasChanged, setHasChanged] = useState(false);

  // Track previous values for change indicators (▲/▼)
  const prevValuesRef = useRef({
    price: pricing.recommendedPrice,
    rev: revenue.annualRevenueMedian,
    occ: revenue.bookedNightsMedian,
    n: pricing.n,
  });

  const [changes, setChanges] = useState({
    priceDiff: 0,
    revDiff: 0,
    occDiff: 0,
    nDiff: 0,
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const prev = prevValuesRef.current;
    const priceDiff = Math.round(pricing.recommendedPrice - prev.price);
    const revDiff = Math.round(revenue.annualRevenueMedian - prev.rev);
    const occDiff = Math.round(revenue.bookedNightsMedian - prev.occ);
    const nDiff = pricing.n - prev.n;

    if (priceDiff !== 0 || revDiff !== 0 || occDiff !== 0 || nDiff !== 0) {
      setHasChanged(true);
      setChanges({ priceDiff, revDiff, occDiff, nDiff });
    }

    prevValuesRef.current = {
      price: pricing.recommendedPrice,
      rev: revenue.annualRevenueMedian,
      occ: revenue.bookedNightsMedian,
      n: pricing.n,
    };
  }, [pricing.recommendedPrice, revenue.annualRevenueMedian, revenue.bookedNightsMedian, pricing.n]);

  const renderDiff = (diff: number, isCurrency: boolean = false, suffix: string = '') => {
    if (!hasChanged || diff === 0) {
      return (
        <span className="text-slate-400 inline-flex items-center text-xs">
          <Minus className="w-3 h-3 mr-0.5" /> unchanged
        </span>
      );
    }
    const isUp = diff > 0;
    const formatted = isCurrency
      ? formatDiff(diff)
      : isUp
      ? `+${diff}${suffix}`
      : `${diff}${suffix}`.replace('-', '−');

    return (
      <span
        className={`inline-flex items-center text-xs font-semibold ${
          isUp ? 'text-teal-700' : 'text-slate-500'
        }`}
      >
        {isUp ? (
          <TrendingUp className="w-3 h-3 mr-0.5 text-teal-600" />
        ) : (
          <TrendingDown className="w-3 h-3 mr-0.5 text-slate-500" />
        )}
        {formatted}
      </span>
    );
  };

  const hasWidening = Boolean(
    (pricing.provenance.widenedSteps && pricing.provenance.widenedSteps.length > 0) ||
    pricing.n < 10
  );

  if (pricing.n === 0) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Not enough similar listings: try a nearby neighbourhood</h4>
          <p className="text-xs text-amber-800 mt-0.5">
            Zero active comparable listings found matching these criteria. Please adjust your filters or choose an adjacent neighbourhood to compute market estimates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Widening Warning Banner */}
      {hasWidening && (
        <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Comp set widened:</strong> Not enough exact matches (n &lt; 10); widened to:{' '}
            {pricing.provenance.widenedSteps?.join(' → ') || 'expanded comp criteria'}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* 1. Recommended Price */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs relative group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1 group/tooltip">
              <span>Recommended Price</span>
              <span
                className="text-slate-400 hover:text-slate-700 cursor-help"
                title="Median nightly price of similar active listings in this neighbourhood"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <ProvenanceButton
              provenance={pricing.marketProvenance || pricing.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formatCurrency(pricing.recommendedPrice)}
            </span>
            <span className="text-xs text-slate-500">/ night</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Market median</span>
            {renderDiff(changes.priceDiff, true)}
          </div>
        </div>

        {/* 2. Typical Range */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs relative group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <span>Typical Range</span>
              <span
                className="text-slate-400 hover:text-slate-700 cursor-help"
                title="The middle 50% of comparable listings (25th to 75th percentiles)"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <ProvenanceButton
              provenance={pricing.p25Provenance || pricing.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono tracking-tight text-slate-900">
              {formatCurrency(pricing.p25)}–{formatCurrency(pricing.p75)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Middle 50% band</span>
            <span className="text-[11px] text-slate-500 font-mono">
              IQR: ${Math.round(pricing.p75 - pricing.p25)}
            </span>
          </div>
        </div>

        {/* 3. Est. Occupancy */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs relative group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <span>Est. Occupancy</span>
              <span
                className="text-slate-400 hover:text-slate-700 cursor-help"
                title="Median booked nights over the last 365 days across comparable listings"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <ProvenanceButton
              provenance={revenue.occupancyProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formatNumber(revenue.bookedNightsMedian)}
            </span>
            <span className="text-xs text-slate-500">nights / yr</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              ~{revenue.occupancyPct || Math.round((revenue.bookedNightsMedian / 365) * 100)}% annualized
            </span>
            {renderDiff(changes.occDiff, false, ' nts')}
          </div>
        </div>

        {/* 4. Est. Annual Revenue */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs relative group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <span>Est. Annual Revenue</span>
              <span
                className="text-slate-400 hover:text-slate-700 cursor-help"
                title="Median annual earnings computed from comparable listings in Inside Airbnb model"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <ProvenanceButton
              provenance={revenue.revenueProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-teal-800">
              {formatCurrency(revenue.annualRevenueMedian)}
            </span>
            <span className="text-xs text-slate-500">/ yr</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              ~{formatCurrency(Math.round(revenue.annualRevenueMedian / 12))}/mo
            </span>
            {renderDiff(changes.revDiff, true)}
          </div>
        </div>

        {/* 5. Similar Listings (n) */}
        <div className="col-span-2 md:col-span-1 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs relative group hover:border-teal-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <span>Similar Listings (n)</span>
              <span
                className="text-slate-400 hover:text-slate-700 cursor-help"
                title="Number of active listings in Washington, DC meeting the comparable criteria"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
            </div>
            <ProvenanceButton
              provenance={pricing.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {pricing.n}
            </span>
            <span className="text-xs text-slate-500">active comps</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {pricing.topRatedN} top-rated (≥4.8★)
            </span>
            {renderDiff(changes.nDiff, false)}
          </div>
        </div>
      </div>
    </div>
  );
};
