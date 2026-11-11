import React, { useEffect, useRef, useState } from 'react';
import { PricingTiers, RevenueMetrics, Provenance } from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { HelpCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
    const prev = prevValuesRef.current;
    setChanges({
      priceDiff: Math.round(pricing.recommendedPrice - prev.price),
      revDiff: Math.round(revenue.annualRevenueMedian - prev.rev),
      occDiff: Math.round(revenue.bookedNightsMedian - prev.occ),
      nDiff: pricing.n - prev.n,
    });

    prevValuesRef.current = {
      price: pricing.recommendedPrice,
      rev: revenue.annualRevenueMedian,
      occ: revenue.bookedNightsMedian,
      n: pricing.n,
    };
  }, [pricing.recommendedPrice, revenue.annualRevenueMedian, revenue.bookedNightsMedian, pricing.n]);

  const renderDiff = (diff: number, isCurrency: boolean = false, suffix: string = '') => {
    if (diff === 0) return <span className="text-slate-400 inline-flex items-center text-xs"><Minus className="w-3 h-3 mr-0.5" /> unchanged</span>;
    const isUp = diff > 0;
    const absVal = Math.abs(diff);
    const display = isCurrency ? `$${absVal}` : `${absVal}${suffix}`;
    return (
      <span
        className={`inline-flex items-center text-xs font-semibold ${
          isUp ? 'text-teal-700' : 'text-slate-500'
        }`}
      >
        {isUp ? <TrendingUp className="w-3 h-3 mr-0.5 text-teal-600" /> : <TrendingDown className="w-3 h-3 mr-0.5 text-slate-500" />}
        {isUp ? `+${display}` : `-${display}`}
      </span>
    );
  };

  return (
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
            provenance={pricing.provenance}
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
            provenance={pricing.provenance}
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
          <span className="text-[11px] text-slate-500 font-mono">IQR: ${Math.round(pricing.p75 - pricing.p25)}</span>
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
            provenance={revenue.provenance}
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
            ~{Math.round((revenue.bookedNightsMedian / 365) * 100)}% annualized
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
            provenance={revenue.provenance}
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
              title="Number of active listings in Washington, DC meeting the exact comparable criteria"
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
  );
};
