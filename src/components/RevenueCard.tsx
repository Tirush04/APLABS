import React, { useState, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { RevenueMetrics, PricingTiers, PropertyProfile, Provenance, Listing } from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import {
  Sparkles,
  Info,
  Sliders,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface RevenueCardProps {
  revenue: RevenueMetrics;
  pricing: PricingTiers;
  profile: PropertyProfile;
  comps?: Listing[];
  onOpenProvenance: (p: Provenance) => void;
  onOpenExplain: () => void;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({
  revenue,
  pricing,
  profile,
  comps = [],
  onOpenProvenance,
  onOpenExplain,
}) => {
  // Slider bounds from min/max comp price (guard max > min)
  const { minSliderPrice, maxSliderPrice } = useMemo(() => {
    if (comps && comps.length > 0) {
      const prices = comps.map((c) => Number(c.price)).filter((p) => !isNaN(p) && p > 0);
      if (prices.length > 0) {
        const minP = Math.floor(Math.min(...prices));
        const maxP = Math.ceil(Math.max(...prices));
        if (maxP > minP) {
          return { minSliderPrice: minP, maxSliderPrice: maxP };
        }
      }
    }
    const fallbackMin = Math.max(30, Math.floor(pricing.p25 * 0.7));
    const fallbackMax = Math.max(fallbackMin + 50, Math.ceil(pricing.topRatedP75 * 1.5));
    return { minSliderPrice: fallbackMin, maxSliderPrice: fallbackMax };
  }, [comps, pricing.p25, pricing.topRatedP75]);

  // Scenario "What if" nightly price slider
  const [scenarioPrice, setScenarioPrice] = useState<number>(() => {
    const raw = Math.round(pricing.recommendedPrice);
    const stepped = Math.round(raw / 5) * 5;
    return Math.max(minSliderPrice, Math.min(maxSliderPrice, stepped));
  });

  // Sync scenario price when recommended price changes
  React.useEffect(() => {
    const raw = Math.round(pricing.recommendedPrice);
    const stepped = Math.round(raw / 5) * 5;
    setScenarioPrice(Math.max(minSliderPrice, Math.min(maxSliderPrice, stepped)));
  }, [pricing.recommendedPrice, minSliderPrice, maxSliderPrice]);

  const scenarioAnnualRevenue = Math.round(
    scenarioPrice * revenue.bookedNightsMedian
  );

  const scenarioProvenance: Provenance = revenue.scenarioProvenance || {
    metricName: 'What-If Scenario Projected Revenue',
    datasetFile: 'dc_listings_clean.csv',
    filterApplied: `Scenario price ($${scenarioPrice}) × median booked nights (${revenue.bookedNightsMedian})`,
    rowCount: pricing.n,
    formula: 'scenario_price × median(estimated_booked_nights_l365d)',
    listingIds: pricing.provenance.listingIds,
    method: 'Parametric scenario extrapolation using actual comp sample median booked nights',
  };

  const monthlyRevProvenance: Provenance = {
    metricName: 'Estimated Monthly Revenue (P50)',
    datasetFile: 'dc_listings_clean.csv',
    filterApplied: pricing.provenance.filterApplied,
    rowCount: revenue.revenueProvenance?.rowCount || pricing.n,
    formula: 'annual_revenue_median ÷ 12',
    listingIds: pricing.provenance.listingIds,
    method: 'Even 12-month division of median estimated annual revenue',
  };

  if (pricing.n === 0) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Not enough similar listings: try a nearby neighbourhood</h4>
          <p className="text-xs text-amber-800 mt-0.5">
            Zero active comparable listings found to project revenue. Adjust your criteria or neighbourhood.
          </p>
        </div>
      </div>
    );
  }

  const occupancyPct = revenue.occupancyPct || Math.round((revenue.bookedNightsMedian / 365) * 100);

  const oneSentenceHeadline = `Expect approximately ${formatCurrency(
    revenue.annualRevenueMedian
  )} in annual revenue across ${formatNumber(
    revenue.bookedNightsMedian
  )} booked nights (~${occupancyPct}% occupancy).`;

  // Computed relation for simple check product
  const diffFromSimple = Math.round(revenue.simpleCheckProduct - revenue.annualRevenueMedian);
  const diffAbs = Math.abs(diffFromSimple);
  const simpleRelationText = diffFromSimple >= 0
    ? `The simple product ($${Math.round(revenue.simpleCheckProduct).toLocaleString()}) is higher than the actual median estimate ($${revenue.annualRevenueMedian.toLocaleString()}) by $${diffAbs.toLocaleString()}/yr.`
    : `The simple product ($${Math.round(revenue.simpleCheckProduct).toLocaleString()}) is lower than the actual median estimate ($${revenue.annualRevenueMedian.toLocaleString()}) by $${diffAbs.toLocaleString()}/yr.`;

  // First month where cumulative revenue covers cumulative costs
  const coveredMonthEntry = revenue.monthsToCover?.find(
    (m) => m.cumulativeRev >= m.cumulativeCost
  );
  const coveredMonth = coveredMonthEntry ? coveredMonthEntry.month : null;

  return (
    <div className="space-y-6">
      {/* 1. Leading One-Sentence Headline */}
      <div className="p-5 md:p-6 bg-slate-900 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-teal-300 font-semibold block">
            Step 3 · Financial Projection & Break-even
          </span>
          <p className="text-lg md:text-xl font-medium tracking-tight mt-1 text-slate-50">
            {oneSentenceHeadline}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Based on historical 365-day review and availability performance from {pricing.n} active comps.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExplain}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors shrink-0 shadow-xs min-h-[44px]"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          <span>Explain this to my client</span>
        </button>
      </div>

      {/* 2. Low / Base / High Revenue Range Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Low (P25) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Conservative (25th Percentile)</span>
            <ProvenanceButton
              provenance={revenue.revenueProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-700">
              {formatCurrency(revenue.annualRevenueP25)}
            </span>
            <span className="text-xs text-slate-500">/ yr</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">
            25th percentile of estimated_revenue_l365d (n={revenue.revenueProvenance?.rowCount || pricing.n})
          </p>
        </div>

        {/* Base (Median) */}
        <div className="p-5 bg-teal-50/50 rounded-2xl border-2 border-teal-700 shadow-sm relative">
          <div className="flex items-center justify-between text-xs text-teal-900 font-semibold">
            <span>Base Case (Market Median)</span>
            <ProvenanceButton
              provenance={revenue.revenueProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-teal-950">
              {formatCurrency(revenue.annualRevenueMedian)}
            </span>
            <span className="text-xs text-teal-800">/ yr</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-teal-900">
            <span>
              ~{formatCurrency(Math.round(revenue.annualRevenueMedian / 12))}/mo
            </span>
            <ProvenanceButton
              provenance={monthlyRevProvenance}
              onClick={onOpenProvenance}
            />
          </div>
        </div>

        {/* High (P75) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outperformer (75th Percentile)</span>
            <ProvenanceButton
              provenance={revenue.revenueProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {formatCurrency(revenue.annualRevenueP75)}
            </span>
            <span className="text-xs text-slate-500">/ yr</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">
            75th percentile of estimated_revenue_l365d (n={revenue.revenueProvenance?.rowCount || pricing.n})
          </p>
        </div>
      </div>

      {/* 3. Method Discipline Callout: Product of Medians vs Median Revenue */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">
                Methodological Note: Median Revenue vs Simple Check Product
              </span>
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                Simple Check: {formatCurrency(revenue.simpleCheckProduct)}/yr
              </span>
            </div>
            <ProvenanceButton
              provenance={revenue.simpleCheckProvenance || revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <p className="leading-relaxed">
            Annual revenue ({formatCurrency(revenue.annualRevenueMedian)}) is computed as the{' '}
            <strong>median of actual estimated annual earnings</strong> across the comp set, not by
            multiplying median price ({formatCurrency(pricing.recommendedPrice)}) by median nights
            ({formatNumber(revenue.bookedNightsMedian)} nights). {simpleRelationText} A simple product
            distorts true earnings because listings charging above-median prices often book fewer nights.
          </p>
        </div>
      </div>

      {/* 4. "What If" Scenario Nightly Price Slider */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Scenario: your price × median booked nights (not the estimate)
              </h3>
              <p className="text-xs text-slate-500">
                Adjust nightly price to test projected revenue at {formatNumber(revenue.bookedNightsMedian)} booked nights/yr
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
              Scenario Model
            </span>
            <ProvenanceButton
              provenance={scenarioProvenance}
              onClick={onOpenProvenance}
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase">
              Assumed Nightly Rate:
            </span>
            <span className="text-xl font-bold font-mono text-teal-900">
              {formatCurrency(scenarioPrice)} / night
            </span>
          </div>

          <input
            type="range"
            min={minSliderPrice}
            max={maxSliderPrice}
            step="5"
            value={scenarioPrice}
            onChange={(e) => setScenarioPrice(Number(e.target.value))}
            className="w-full accent-teal-700 cursor-pointer h-2"
          />

          <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Min comp: ${minSliderPrice}</span>
            <span className="text-teal-800 font-semibold">
              Market Median: {formatCurrency(pricing.recommendedPrice)}
            </span>
            <span>Max comp: ${maxSliderPrice}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">
              Projected Annual Revenue
            </span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrency(scenarioAnnualRevenue)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              at {revenue.bookedNightsMedian} nights booked
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">
              Monthly Cashflow Equivalent
            </span>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formatCurrency(Math.round(scenarioAnnualRevenue / 12))}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">gross before management fee</p>
          </div>
        </div>
      </div>

      {/* 5. Owner Carrying Cost & Break-even Analysis (if owner cost provided) */}
      {profile.monthlyCarryingCost && profile.monthlyCarryingCost > 0 ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Carrying Cost & Break-even Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Owner carrying cost: {formatCurrency(profile.monthlyCarryingCost)}/mo ({formatCurrency(profile.monthlyCarryingCost * 12)}/yr)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Nightly Break-even Price</span>
                <span className="text-lg font-bold font-mono text-emerald-800">
                  {revenue.bookedNightsMedian === 0
                    ? "Break-even can't be computed"
                    : `${formatCurrency(revenue.breakEvenNightlyPrice || 0)} / night`}
                </span>
              </div>
              {revenue.breakEvenProvenance && (
                <ProvenanceButton
                  provenance={revenue.breakEvenProvenance}
                  onClick={onOpenProvenance}
                />
              )}
            </div>
          </div>

          {revenue.bookedNightsMedian === 0 ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
              Break-even can't be computed because median booked nights is 0.
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900">
              <p className="font-semibold">
                Break-even Nightly Formula:
              </p>
              <p className="mt-0.5 font-mono">
                ({formatCurrency(profile.monthlyCarryingCost)} × 12 months) ÷ {revenue.bookedNightsMedian} median booked nights = {formatCurrency(revenue.breakEvenNightlyPrice || 0)}/night.
              </p>
              <p className="mt-1">
                {pricing.recommendedPrice >= (revenue.breakEvenNightlyPrice || 0) ? (
                  <span>
                    ✓ Recommended market price ({formatCurrency(pricing.recommendedPrice)}) exceeds break-even by{' '}
                    <strong>{formatCurrency(pricing.recommendedPrice - (revenue.breakEvenNightlyPrice || 0))}/night</strong>, delivering positive net margin.
                  </span>
                ) : (
                  <span className="text-amber-800 font-semibold">
                    ⚠️ Market rate ({formatCurrency(pricing.recommendedPrice)}) is below break-even. Consider targeting the Premium tier or optimizing amenities to bridge the gap.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Months to cover chart */}
          {revenue.monthsToCover && revenue.monthsToCover.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Cumulative Revenue vs Carrying Cost
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {coveredMonth ? `Costs covered by month ${coveredMonth}` : 'Costs not fully covered within 12 months'}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  n = {pricing.n} comps
                </span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenue.monthsToCover}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m) => `Mo ${m}`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      label={{ value: 'Month', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#64748B' }}
                    />
                    <YAxis
                      tickFormatter={(val) => (val === 0 ? '$0' : `$${Math.round(val / 1000)}k`)}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      label={{ value: 'Cumulative Amount ($)', angle: -90, position: 'insideLeft', offset: -5, fontSize: 11, fill: '#64748B' }}
                    />
                    <Tooltip
                      formatter={(val: any) => formatCurrency(Number(val))}
                      labelFormatter={(label) => `Month ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeRev"
                      name="Cumulative STR Revenue (Median)"
                      stroke="#0F766E"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeCost"
                      name="Cumulative Carrying Cost"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex items-center justify-between text-xs text-slate-600">
          <div>
            <p className="font-semibold text-slate-800">Want break-even analysis?</p>
            <p className="text-slate-500">
              Enter your monthly carrying cost (mortgage, HOA, utilities) in the Property Profile on Step 1 to unlock the break-even price.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
