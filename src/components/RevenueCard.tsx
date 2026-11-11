import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { RevenueMetrics, PricingTiers, PropertyProfile, Provenance } from '../types';
import { formatCurrency, formatNumber } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import {
  DollarSign,
  Calendar,
  Sparkles,
  Info,
  Sliders,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface RevenueCardProps {
  revenue: RevenueMetrics;
  pricing: PricingTiers;
  profile: PropertyProfile;
  onOpenProvenance: (p: Provenance) => void;
  onOpenExplain: () => void;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({
  revenue,
  pricing,
  profile,
  onOpenProvenance,
  onOpenExplain,
}) => {
  // Scenario "What if" nightly price slider
  const [scenarioPrice, setScenarioPrice] = useState<number>(
    Math.round(pricing.recommendedPrice)
  );

  // Sync scenario price when recommended price changes if untouched
  React.useEffect(() => {
    setScenarioPrice(Math.round(pricing.recommendedPrice));
  }, [pricing.recommendedPrice]);

  const scenarioAnnualRevenue = Math.round(
    scenarioPrice * revenue.bookedNightsMedian
  );

  const oneSentenceHeadline = `Expect approximately ${formatCurrency(
    revenue.annualRevenueMedian
  )} in annual revenue across ${formatNumber(
    revenue.bookedNightsMedian
  )} booked nights (~${Math.round(
    (revenue.bookedNightsMedian / 365) * 100
  )}% occupancy).`;

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
            Based on historical 365-day review and availability performance from active comps.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenExplain}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors shrink-0 shadow-xs"
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
              provenance={revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-700">
              {formatCurrency(revenue.annualRevenueP25)}
            </span>
            <span className="text-xs text-slate-500">/ yr</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            P25 historical performance during slower ramp-up or lower seasonal capture.
          </p>
        </div>

        {/* Base (Median) */}
        <div className="p-5 bg-teal-50/50 rounded-2xl border-2 border-teal-700 shadow-sm relative">
          <div className="flex items-center justify-between text-xs text-teal-900 font-semibold">
            <span>Base Case (Market Median)</span>
            <ProvenanceButton
              provenance={revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-teal-950">
              {formatCurrency(revenue.annualRevenueMedian)}
            </span>
            <span className="text-xs text-teal-800">/ yr</span>
          </div>
          <p className="text-xs text-teal-900 mt-2">
            Median annual revenue across comparable listings. (~{formatCurrency(Math.round(revenue.annualRevenueMedian / 12))}/mo)
          </p>
        </div>

        {/* High (P75) */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Outperformer (75th Percentile)</span>
            <ProvenanceButton
              provenance={revenue.provenance}
              onClick={onOpenProvenance}
            />
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-slate-900">
              {formatCurrency(revenue.annualRevenueP75)}
            </span>
            <span className="text-xs text-slate-500">/ yr</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Top 25% of comps with high review volume, professional photography, and superhost status.
          </p>
        </div>
      </div>

      {/* 3. Method Discipline Callout: Product of Medians vs Median Revenue */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">
              Methodological Note: Median Revenue vs Simple Check Product
            </span>
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
              Simple Check: {formatCurrency(revenue.simpleCheckProduct)}/yr
            </span>
          </div>
          <p className="leading-relaxed">
            Annual revenue ({formatCurrency(revenue.annualRevenueMedian)}) is computed as the{' '}
            <strong>median of actual estimated annual earnings</strong> across the comp set, not by
            multiplying median price ({formatCurrency(pricing.recommendedPrice)}) by median nights
            ({formatNumber(revenue.bookedNightsMedian)} nights = {formatCurrency(revenue.simpleCheckProduct)}). A product
            of medians overstates true revenue because listings charging above-median prices often book fewer nights.
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
                "What If" Scenario Planner
              </h3>
              <p className="text-xs text-slate-500">
                Adjust nightly price to test projected revenue at {formatNumber(revenue.bookedNightsMedian)} booked nights/yr
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
            Scenario Model
          </span>
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
            min={Math.max(50, Math.floor(pricing.p25 * 0.7))}
            max={Math.ceil(pricing.topRatedP75 * 1.5)}
            step="5"
            value={scenarioPrice}
            onChange={(e) => setScenarioPrice(Number(e.target.value))}
            className="w-full accent-teal-700 cursor-pointer"
          />

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Min: ${Math.max(50, Math.floor(pricing.p25 * 0.7))}</span>
            <span className="text-teal-800 font-semibold">
              Market Median: {formatCurrency(pricing.recommendedPrice)}
            </span>
            <span>Max: ${Math.ceil(pricing.topRatedP75 * 1.5)}</span>
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

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Nightly Break-even Price</span>
              <span className="text-lg font-bold font-mono text-emerald-800">
                {formatCurrency(revenue.breakEvenNightlyPrice || 0)} / night
              </span>
            </div>
          </div>

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

          {/* Months to cover chart */}
          {revenue.monthsToCover && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Cumulative Revenue vs Cumulative Carrying Cost (12 Months)
              </h4>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenue.monthsToCover}
                    margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m) => `Mo ${m}`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <Tooltip
                      formatter={(val: any) => formatCurrency(Number(val))}
                      labelFormatter={(label) => `Month ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
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
