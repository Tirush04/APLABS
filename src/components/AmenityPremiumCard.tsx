import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { AmenityComparison, Provenance } from '../types';
import { formatCurrency, formatDiff } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { Sparkles, Info, Check } from 'lucide-react';

interface AmenityPremiumCardProps {
  amenities: AmenityComparison[];
  compCount: number;
  userAmenities?: Record<string, boolean>;
  onOpenProvenance: (p: Provenance) => void;
}

export const AmenityPremiumCard: React.FC<AmenityPremiumCardProps> = ({
  amenities,
  compCount,
  userAmenities = {},
  onOpenProvenance,
}) => {
  // Sort amenities by diff descending
  const sortedAmenities = [...amenities].sort((a, b) => b.diff - a.diff);

  // Filter amenities with n > 0 on both sides for chart bars
  const chartData = sortedAmenities.map((a) => ({
    ...a,
    hasZeroSide: a.withN === 0 || a.withoutN === 0,
  }));

  const validDiffAmenities = sortedAmenities.filter((a) => !a.isLowSample && a.withN > 0 && a.withoutN > 0);
  const highestAmenity = validDiffAmenities.find((a) => a.diff > 0);

  const headline = highestAmenity
    ? `Among your ${compCount} similar listings, properties with ${highestAmenity.label.toLowerCase()} command a ${formatDiff(
        highestAmenity.diff
      )}/night median premium.`
    : `Median price variance for key amenities among your ${compCount} similar listings.`;

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Amenity premium among your {compCount} similar listings
            </h3>
            <p className="text-xs text-slate-500">
              Nightly price differential for active comps with vs without each amenity
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          n = {compCount} comps
        </span>
      </div>

      <p className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
        {headline}
      </p>

      {/* Horizontal Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 10, right: 30, left: 40, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis
              type="number"
              tickFormatter={(v) => (v === 0 ? '$0' : `${v > 0 ? '+' : ''}${v}`)}
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={{ stroke: '#CBD5E1' }}
              label={{
                value: 'Median price difference ($/night)',
                position: 'insideBottom',
                offset: -15,
                fontSize: 11,
                fill: '#64748B',
              }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: '#334155' }}
              width={140}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as AmenityComparison & { hasZeroSide: boolean };
                  if (data.hasZeroSide) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg space-y-1">
                        <p className="font-bold text-sm">{data.label}</p>
                        <p className="text-amber-400">n/a: Zero listings on one side (with: {data.withN}, without: {data.withoutN})</p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-xl text-xs shadow-lg space-y-1.5 max-w-xs">
                      <p className="font-bold text-sm">{data.label}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800">
                        <div>
                          <span className="text-slate-400 block">With (n={data.withN})</span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {formatCurrency(data.medWith)}/nt
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Without (n={data.withoutN})</span>
                          <span className="font-mono font-semibold text-slate-300">
                            {formatCurrency(data.medWithout)}/nt
                          </span>
                        </div>
                      </div>
                      <p className="font-mono text-teal-300 font-semibold pt-1">
                        Difference: {formatDiff(data.diff)}/night
                      </p>
                      {data.isLowSample && (
                        <p className="text-amber-400 text-[10px] flex items-center gap-1 mt-1">
                          ⚠️ Low sample (either side has n &lt; 10)
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine x={0} stroke="#94A3B8" />
            <Bar dataKey={(entry: any) => (entry.hasZeroSide ? 0 : entry.diff)} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => {
                let fillColor = '#0F766E'; // teal
                if (entry.hasZeroSide) {
                  fillColor = 'transparent';
                } else if (entry.isLowSample) {
                  fillColor = '#CBD5E1'; // grey out if n < 10
                } else if (entry.diff < 0) {
                  fillColor = '#94A3B8';
                }
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Amenity Breakdown List with Provenance & Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
        {sortedAmenities.map((amenity) => {
          const isUserTicked = Boolean(userAmenities[amenity.key]);
          const isZeroSide = amenity.withN === 0 || amenity.withoutN === 0;

          return (
            <div
              key={amenity.key}
              className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                isUserTicked
                  ? 'border-teal-700 bg-teal-50/40 ring-1 ring-teal-700/30'
                  : amenity.isLowSample
                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isUserTicked && (
                    <span className="p-0.5 bg-teal-700 text-white rounded-full">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <p className="font-semibold truncate max-w-[120px]">{amenity.label}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-mono font-bold ${
                      isZeroSide
                        ? 'text-slate-400'
                        : amenity.isLowSample
                        ? 'text-slate-400'
                        : amenity.diff >= 0
                        ? 'text-teal-800'
                        : 'text-slate-600'
                    }`}
                  >
                    {isZeroSide ? 'n/a' : formatDiff(amenity.diff)}
                  </span>
                  <ProvenanceButton
                    provenance={amenity.provenance}
                    onClick={onOpenProvenance}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>With: n={amenity.withN}</span>
                <span>Without: n={amenity.withoutN}</span>
              </div>

              {isUserTicked && !isZeroSide && (
                <p className="text-[10px] text-teal-800 font-medium pt-0.5 border-t border-teal-200/60">
                  You have this: similar listings with it charge {formatDiff(amenity.diff)}{' '}
                  {amenity.diff >= 0 ? 'more' : 'less'}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Mandatory exact caption */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Association, not causation.</strong> Greyed out bars indicate low sample size where either side has fewer than 10 listings in this comp set. If an amenity has zero listings on either side, it is labeled n/a with no bar.
        </p>
      </div>
    </div>
  );
};
