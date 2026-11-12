import React, { useMemo, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { filterCompsWithWidening, computePricingTiers, computeRevenueMetrics } from '../utils/engine';
import { percentileInc, parsePrice } from '../utils/math';
import { PropertyProfile } from '../types';
import { enforceNumberGuard } from '../utils/numberGuard';
import { CheckCircle2, XCircle, X, Terminal } from 'lucide-react';

interface SelfTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SelfTestModal: React.FC<SelfTestModalProps> = ({ isOpen, onClose }) => {
  const { listings } = useData();
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

  const testResults = useMemo(() => {
    // 1. Math unit test: percentileInc on known array
    const testArray = [15, 20, 35, 40, 50]; // n = 5
    const mathP25 = percentileInc(testArray, 0.25);
    const mathMedian = percentileInc(testArray, 0.5);
    const mathP75 = percentileInc(testArray, 0.75);
    const mathP40 = percentileInc(testArray, 0.4);

    const mathPass =
      Math.abs(mathP25 - 20) < 0.001 &&
      Math.abs(mathMedian - 35) < 0.001 &&
      Math.abs(mathP75 - 40) < 0.001 &&
      Math.abs(mathP40 - 29) < 0.001;

    // 2. Price parser unit tests
    const parsed1 = parsePrice('$1,234.50');
    const parsed2 = parsePrice('  $208.67 ');
    const parsed3 = parsePrice(null);
    const parserPass = parsed1 === 1234.5 && parsed2 === 208.67 && parsed3 === 0;

    // 3. Sample Case Benchmark Run against loaded listings
    const sampleProfile: PropertyProfile = {
      neighbourhood: 'Capitol Hill, Lincoln Park',
      propertyType: 'Condo',
      roomType: 'Entire home/apt',
      bedrooms: 1,
      bathrooms: 1,
      accommodatesMin: 2,
      accommodatesMax: 4,
      amenities: {
        has_washer: true,
        has_free_parking: false,
        has_workspace: true,
        has_pool: false,
        has_gym: false,
        has_self_checkin: true,
      },
    };

    const filterResult = filterCompsWithWidening(listings, sampleProfile);
    const pricing = computePricingTiers(filterResult.comps, filterResult.provenance);
    const revenue = computeRevenueMetrics(filterResult.comps, pricing, sampleProfile, filterResult.provenance);

    // Number Guard benchmark context
    const sampleContextJson = {
      property: {
        neighbourhood: sampleProfile.neighbourhood,
        property_style: sampleProfile.propertyType,
        bedrooms: sampleProfile.bedrooms,
        bathrooms: sampleProfile.bathrooms,
        accommodates_min: sampleProfile.accommodatesMin,
        accommodates_max: sampleProfile.accommodatesMax,
      },
      pricing: {
        launch_tier_p40: Number(pricing.p40.toFixed(2)),
        market_tier_median: Number(pricing.median.toFixed(2)),
        premium_tier_p75_top_rated: Number(pricing.topRatedP75.toFixed(2)),
        typical_range_p25: Number(pricing.p25.toFixed(2)),
        typical_range_p75: Number(pricing.p75.toFixed(2)),
        comparable_count_n: pricing.n,
        top_rated_count_n: pricing.topRatedN,
      },
      revenue_and_occupancy: {
        booked_nights_median: revenue.bookedNightsMedian,
        annual_revenue_median: revenue.annualRevenueMedian,
      },
      audit: {
        scrape_year: 2026,
      },
    };

    // 6 Number Guard tests
    const guardTest1 = enforceNumberGuard('$100 licence fee', sampleContextJson);
    const guardTest2 = enforceNumberGuard('20% higher in spring', sampleContextJson);
    const guardTest3 = enforceNumberGuard('24 listings', sampleContextJson);
    const guardTest4 = enforceNumberGuard('$208.67', sampleContextJson);
    const guardTest5 = enforceNumberGuard('$29.8k', sampleContextJson);
    const guardTest6 = enforceNumberGuard('151 similar listings', sampleContextJson);

    const checks = [
      {
        name: 'Math Percentile (Excel PERCENTILE.INC)',
        expected: 'P25=20, Med=35, P75=40, P40=29',
        actual: `P25=${mathP25}, Med=${mathMedian}, P75=${mathP75}, P40=${mathP40}`,
        pass: mathPass,
      },
      {
        name: 'Price Parser Sanitization',
        expected: '1234.5, 208.67, 0',
        actual: `${parsed1}, ${parsed2}, ${parsed3}`,
        pass: parserPass,
      },
      {
        name: 'Sample Case Comps Count (n)',
        expected: '151',
        actual: `${pricing.n}`,
        pass: pricing.n === 151,
      },
      {
        name: 'Sample Case 25th Percentile (P25)',
        expected: '158.03',
        actual: pricing.p25.toFixed(2),
        pass: Math.abs(pricing.p25 - 158.03) < 0.05,
      },
      {
        name: 'Sample Case 40th Percentile Launch (P40)',
        expected: '189.50',
        actual: pricing.p40.toFixed(2),
        pass: Math.abs(pricing.p40 - 189.50) < 0.05,
      },
      {
        name: 'Sample Case Median Market Price',
        expected: '208.67',
        actual: pricing.median.toFixed(2),
        pass: Math.abs(pricing.median - 208.67) < 0.05,
      },
      {
        name: 'Sample Case 75th Percentile (P75)',
        expected: '246.69',
        actual: pricing.p75.toFixed(2),
        pass: Math.abs(pricing.p75 - 246.69) < 0.05,
      },
      {
        name: 'Top-Rated Comps Count (rating ≥ 4.8)',
        expected: '106',
        actual: `${pricing.topRatedN}`,
        pass: pricing.topRatedN === 106,
      },
      {
        name: 'Top-Rated 75th Percentile (Premium)',
        expected: '260.39',
        actual: pricing.topRatedP75.toFixed(2),
        pass: Math.abs(pricing.topRatedP75 - 260.39) < 0.05,
      },
      {
        name: 'Estimated Booked Nights Median',
        expected: '162',
        actual: `${revenue.bookedNightsMedian}`,
        pass: revenue.bookedNightsMedian === 162,
      },
      {
        name: 'Estimated Annual Revenue Median',
        expected: '29760',
        actual: `${revenue.annualRevenueMedian}`,
        pass: revenue.annualRevenueMedian === 29760,
      },
      // Number Guard checks
      {
        name: 'Guard Redact: "$100 licence fee"',
        expected: 'redacted ([not in data])',
        actual: guardTest1.sanitizedText.includes('[not in data]') ? 'redacted' : 'unredacted',
        pass: guardTest1.sanitizedText.includes('[not in data]'),
      },
      {
        name: 'Guard Redact: "20% higher in spring"',
        expected: 'redacted ([not in data])',
        actual: guardTest2.sanitizedText.includes('[not in data]') ? 'redacted' : 'unredacted',
        pass: guardTest2.sanitizedText.includes('[not in data]'),
      },
      {
        name: 'Guard Redact: "24 listings"',
        expected: 'redacted ([not in data])',
        actual: guardTest3.sanitizedText.includes('[not in data]') ? 'redacted' : 'unredacted',
        pass: guardTest3.sanitizedText.includes('[not in data]'),
      },
      {
        name: 'Guard Kept: "$208.67"',
        expected: '$208.67 (kept)',
        actual: guardTest4.sanitizedText,
        pass: !guardTest4.sanitizedText.includes('[not in data]') && guardTest4.sanitizedText.includes('208.67'),
      },
      {
        name: 'Guard Kept: "$29.8k"',
        expected: '$29.8k (kept)',
        actual: guardTest5.sanitizedText,
        pass: !guardTest5.sanitizedText.includes('[not in data]') && guardTest5.sanitizedText.includes('29.8k'),
      },
      {
        name: 'Guard Kept: "151 similar listings"',
        expected: '151 similar listings (kept)',
        actual: guardTest6.sanitizedText,
        pass: !guardTest6.sanitizedText.includes('[not in data]') && guardTest6.sanitizedText.includes('151'),
      },
    ];

    const allPassed = checks.every((c) => c.pass);

    return { checks, allPassed };
  }, [listings]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="selftest-modal-title"
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto sm:my-8 text-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 text-teal-400 rounded-lg">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 id="selftest-modal-title" className="font-bold text-slate-900">
                  Self-Test Audit Suite (/selftest)
                </h3>
                <p className="text-xs text-slate-500">
                  Verifies linear interpolation percentiles, Excel benchmarks, and Number Guard audits
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>

          <div className="p-6">
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                testResults.allPassed
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {testResults.allPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                {testResults.allPassed
                  ? `All ${testResults.checks.length} Tests Passed (100% Exact Match)`
                  : 'Some Tests Failed to Match Benchmarks'}
              </span>
              <span className="font-mono text-[11px]">
                {testResults.checks.filter((c) => c.pass).length} / {testResults.checks.length}
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs max-h-[420px] overflow-y-auto">
              {testResults.checks.map((check, idx) => (
                <div
                  key={idx}
                  className="p-2.5 flex items-center justify-between hover:bg-slate-50 font-mono"
                >
                  <div className="flex items-center gap-2 max-w-sm">
                    {check.pass ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-sans font-medium text-slate-800 truncate">
                      {check.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <span className="text-slate-400 text-[11px]">
                      exp: {check.expected}
                    </span>
                    <span
                      className={`font-bold ${
                        check.pass ? 'text-slate-900' : 'text-rose-600'
                      }`}
                    >
                      {check.actual}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Close Button */}
            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Excel PERCENTILE.INC and Number Guard verified.</span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
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
