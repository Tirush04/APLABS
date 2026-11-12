import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { BookingOutlookMonth, Provenance } from '../types';
import { ProvenanceButton } from './ProvenanceModal';
import { Calendar, Info } from 'lucide-react';

interface BookingOutlookCardProps {
  outlook: BookingOutlookMonth[];
  compCount: number;
  scrapeDate?: string;
  onOpenProvenance: (p: Provenance) => void;
}

export const BookingOutlookCard: React.FC<BookingOutlookCardProps> = ({
  outlook,
  compCount,
  scrapeDate = '2026-09-20',
  onOpenProvenance,
}) => {
  const distinctCompsInCalendar = outlook.length > 0
    ? Math.max(...outlook.map((o) => o.listingCount))
    : compCount;

  const provenance: Provenance = {
    metricName: '12-Month Forward Booking Pace',
    datasetFile: 'dc_calendar_monthly.csv',
    filterApplied: `Monthly calendar records for ${compCount} comparable listings forward from scrape date ${scrapeDate}`,
    rowCount: outlook.reduce((acc, cur) => acc + cur.listingCount, 0),
    formula: '(unavailable_nights ÷ total_nights) × 100 per calendar month across all matching comps',
    listingIds: [],
    method: 'Aggregation of unavailable nights vs total calendar capacity per listing per month',
  };

  const chartData = outlook.map((item, idx) => {
    let label = item.month;
    if (idx === 0) {
      label = `${item.month} (partial, from 20 Sep)`;
    } else if (item.isPast) {
      label = `${item.month} (past)`;
    }
    return {
      ...item,
      displayMonth: label,
      shortMonth: item.month,
    };
  });

  const oneSentenceHeadline = outlook.length > 0
    ? `Current booking pace across similar listings shows ${outlook[0]?.unavailablePercent}% unavailable in the immediate month (${outlook[0]?.month}), tapering to ${outlook[outlook.length - 1]?.unavailablePercent}% forward (${outlook[outlook.length - 1]?.month}).`
    : 'No forward calendar records found for this comp set.';

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Booking pace: 12 months from the {scrapeDate} scrape
            </h3>
            <p className="text-xs text-slate-500">
              Share of nights currently unavailable (booked or host-blocked) by month
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
            n = {distinctCompsInCalendar} comps in calendar
          </span>
          <ProvenanceButton
            provenance={provenance}
            onClick={onOpenProvenance}
          />
        </div>
      </div>

      {outlook.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          No forward calendar records available for these listings.
        </div>
      ) : (
        <>
          {/* Leading sentence */}
          <p className="text-xs font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            {oneSentenceHeadline}
          </p>

          {/* Bar Chart */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 15, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="displayMonth"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  label={{ value: 'Month', position: 'insideBottom', offset: -35, fontSize: 11, fill: '#64748B' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  unit="%"
                  domain={[0, 100]}
                  label={{ value: '% of nights booked or blocked', angle: -90, position: 'insideLeft', offset: -5, fontSize: 11, fill: '#64748B' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as BookingOutlookMonth & { displayMonth: string };
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-md space-y-1">
                          <p className="font-semibold">{data.displayMonth}</p>
                          <p className="text-teal-300 font-mono">
                            {data.unavailablePercent}% unavailable
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            {data.unavailableNights.toLocaleString()} of {data.totalNights.toLocaleString()} nights booked/blocked
                          </p>
                          <p className="text-slate-400 text-[10px]">
                            Sample: {data.listingCount} distinct comps
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="unavailablePercent"
                  name="Unavailable %"
                  fill="#0F766E"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mandatory Exact Caption */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Forward-looking from the {scrapeDate} scrape. Near months look fuller because they have had more time to be booked. This shows booking pace, not seasonality. (n = {distinctCompsInCalendar} distinct comps found in calendar)
            </p>
          </div>
        </>
      )}
    </div>
  );
};
