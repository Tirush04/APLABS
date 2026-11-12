/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DataProvider, useData } from './context/DataContext';
import { PropertyProfile, Provenance } from './types';
import {
  filterCompsWithWidening,
  computePricingTiers,
  computeRevenueMetrics,
  computeBookingOutlook,
  computeAmenityPremiums,
  computeNeighbourhoodStats,
  computeComplianceMetrics,
  computeSeasonalPriceTrend,
} from './utils/engine';
import { KpiCards } from './components/KpiCards';
import { StepProgressBar } from './components/StepProgressBar';
import { PropertyProfileCard } from './components/PropertyProfileCard';
import { PriceRecommendationCard } from './components/PriceRecommendationCard';
import { RevenueCard } from './components/RevenueCard';
import { BookingOutlookCard } from './components/BookingOutlookCard';
import { AmenityPremiumCard } from './components/AmenityPremiumCard';
import { NeighbourhoodExplorer } from './components/NeighbourhoodExplorer';
import { CompetitionCard } from './components/CompetitionCard';
import { AskTheDataCard } from './components/AskTheDataCard';
import { DataMethodTab } from './components/DataMethodTab';
import { ClientBriefModal } from './components/ClientBriefModal';
import { ProvenanceModal } from './components/ProvenanceModal';
import { ExplainModal } from './components/ExplainModal';
import { SelfTestModal } from './components/SelfTestModal';
import { OwnerMeetingView } from './components/OwnerMeetingView';
import { LandingHero } from './components/LandingHero';
import {
  Share2,
  FileText,
  Sparkles,
  AlertTriangle,
  Check,
  Upload,
  Copy,
} from 'lucide-react';

const DEFAULT_SAMPLE_PROFILE: PropertyProfile = {
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
  monthlyCarryingCost: undefined,
};

function parseAndValidateParams(
  search: string,
  validHoods?: Set<string>
): { profile: PropertyProfile; hadInvalid: boolean; hasAnyParams: boolean } {
  if (!search || search === '?') {
    return { profile: DEFAULT_SAMPLE_PROFILE, hadInvalid: false, hasAnyParams: false };
  }

  const params = new URLSearchParams(search);
  const keys = Array.from(params.keys());
  if (keys.length === 0) {
    return { profile: DEFAULT_SAMPLE_PROFILE, hadInvalid: false, hasAnyParams: false };
  }

  let hadInvalid = false;

  // hood
  let neighbourhood = DEFAULT_SAMPLE_PROFILE.neighbourhood;
  const hoodParam = params.get('hood');
  if (hoodParam !== null) {
    if (validHoods && validHoods.size > 0) {
      if (validHoods.has(hoodParam)) {
        neighbourhood = hoodParam;
      } else {
        hadInvalid = true;
      }
    } else {
      neighbourhood = hoodParam;
    }
  }

  // type in {Condo, House}
  let propertyType: 'Condo' | 'House' = DEFAULT_SAMPLE_PROFILE.propertyType;
  const typeParam = params.get('type');
  if (typeParam !== null) {
    if (typeParam === 'Condo' || typeParam === 'House') {
      propertyType = typeParam;
    } else {
      hadInvalid = true;
    }
  }

  // room forced to "Entire home/apt"
  const roomType: 'Entire home/apt' = 'Entire home/apt';
  const roomParam = params.get('room');
  if (roomParam !== null && roomParam !== 'Entire home/apt') {
    hadInvalid = true;
  }

  // beds: 0-6 integer
  let bedrooms = DEFAULT_SAMPLE_PROFILE.bedrooms;
  const bedsParam = params.get('beds');
  if (bedsParam !== null) {
    const parsed = parseInt(bedsParam, 10);
    if (!isNaN(parsed) && String(parsed) === bedsParam.trim() && parsed >= 0 && parsed <= 6) {
      bedrooms = parsed;
    } else {
      hadInvalid = true;
    }
  }

  // baths: 0.5-6
  let bathrooms = DEFAULT_SAMPLE_PROFILE.bathrooms;
  const bathsParam = params.get('baths');
  if (bathsParam !== null) {
    const parsed = parseFloat(bathsParam);
    if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 6) {
      bathrooms = parsed;
    } else {
      hadInvalid = true;
    }
  }

  // accMin / accMax: 1-16 integers with accMin <= accMax
  let accommodatesMin = DEFAULT_SAMPLE_PROFILE.accommodatesMin;
  let accommodatesMax = DEFAULT_SAMPLE_PROFILE.accommodatesMax;
  const accMinParam = params.get('accMin');
  const accMaxParam = params.get('accMax');
  if (accMinParam !== null || accMaxParam !== null) {
    const minVal = accMinParam !== null ? parseInt(accMinParam, 10) : accommodatesMin;
    const maxVal = accMaxParam !== null ? parseInt(accMaxParam, 10) : accommodatesMax;
    const minValid = !isNaN(minVal) && minVal >= 1 && minVal <= 16;
    const maxValid = !isNaN(maxVal) && maxVal >= 1 && maxVal <= 16;
    if (minValid && maxValid && minVal <= maxVal) {
      accommodatesMin = minVal;
      accommodatesMax = maxVal;
    } else {
      hadInvalid = true;
    }
  }

  // cost: 0-50000
  let monthlyCarryingCost: number | undefined = undefined;
  const costParam = params.get('cost');
  if (costParam !== null) {
    const parsed = parseFloat(costParam);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 50000) {
      monthlyCarryingCost = parsed;
    } else {
      hadInvalid = true;
    }
  }

  const amenities = {
    has_washer: params.get('washer') === '1',
    has_free_parking: params.get('parking') === '1',
    has_workspace: params.get('desk') === '1',
    has_pool: params.get('pool') === '1',
    has_gym: params.get('gym') === '1',
    has_self_checkin: params.get('self') === '1',
  };

  if (hadInvalid) {
    return {
      profile: DEFAULT_SAMPLE_PROFILE,
      hadInvalid: true,
      hasAnyParams: true,
    };
  }

  return {
    profile: {
      neighbourhood,
      propertyType,
      roomType,
      bedrooms,
      bathrooms,
      accommodatesMin,
      accommodatesMax,
      amenities,
      monthlyCarryingCost,
    },
    hadInvalid: false,
    hasAnyParams: true,
  };
}

function MainApp() {
  const {
    listings,
    calendar,
    geoJson,
    isLoading,
    error,
    retryLoad,
    uploadCustomListings,
    scrapeDate,
    isMapAvailable,
  } = useData();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'guided' | 'explorer' | 'competition' | 'chat' | 'data'
  >('guided');

  // Guided flow step: 1 (Property) -> 2 (Price) -> 3 (Plan)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // View mode: Advisor View vs Owner View
  const [viewMode, setViewMode] = useState<'advisor' | 'owner'>('advisor');

  // Landing hero banner visibility
  const [showLandingBanner, setShowLandingBanner] = useState<boolean>(true);

  // Modals state
  const [activeProvenance, setActiveProvenance] = useState<Provenance | null>(null);
  const [explainModal, setExplainModal] = useState<{
    isOpen: boolean;
    screenName: string;
  }>({ isOpen: false, screenName: '' });
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [isSelfTestOpen, setIsSelfTestOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);
  const [urlResetNotice, setUrlResetNotice] = useState<string | null>(null);

  // Initialize profile from URL search params if present
  const [profile, setProfile] = useState<PropertyProfile>(() => {
    if (typeof window !== 'undefined') {
      const initial = parseAndValidateParams(window.location.search);
      return initial.profile;
    }
    return DEFAULT_SAMPLE_PROFILE;
  });

  // Lifted compare state for explorer
  const [comparedNeighbourhoods, setComparedNeighbourhoods] = useState<string[]>([
    DEFAULT_SAMPLE_PROFILE.neighbourhood,
  ]);

  // Keep active profile neighbourhood in comparison list
  useEffect(() => {
    if (profile.neighbourhood) {
      setComparedNeighbourhoods((prev) => {
        if (prev.includes(profile.neighbourhood)) return prev;
        return [profile.neighbourhood, ...prev].slice(0, 3);
      });
    }
  }, [profile.neighbourhood]);

  const handleToggleCompare = useCallback((hood: string) => {
    setComparedNeighbourhoods((prev) => {
      if (prev.includes(hood)) {
        return prev.length > 1 ? prev.filter((h) => h !== hood) : prev;
      }
      return [...prev.slice(-2), hood];
    });
  }, []);

  // Re-validate URL params once listings dataset is loaded to check neighbourhood validity
  useEffect(() => {
    if (typeof window === 'undefined' || listings.length === 0) return;
    const validHoods = new Set<string>();
    listings.forEach((l) => {
      if (l.neighbourhood_cleansed) validHoods.add(l.neighbourhood_cleansed);
    });

    const validated = parseAndValidateParams(window.location.search, validHoods);
    if (validated.hasAnyParams && validated.hadInvalid) {
      setProfile(DEFAULT_SAMPLE_PROFILE);
      setUrlResetNotice('Some link settings were invalid and were reset');
    }
  }, [listings]);

  // Unique list of neighbourhoods for dropdown
  const neighbourhoods = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.neighbourhood_cleansed) set.add(l.neighbourhood_cleansed);
    });
    return Array.from(set).sort();
  }, [listings]);

  // Compute Comps with fallback widening if n < 10
  const filterResult = useMemo(() => {
    return filterCompsWithWidening(listings, profile);
  }, [listings, profile]);

  // Compute 3 Price Tiers
  const pricing = useMemo(() => {
    return computePricingTiers(filterResult.comps, filterResult.provenance);
  }, [filterResult]);

  // Compute Revenue & Break-even Metrics
  const revenue = useMemo(() => {
    return computeRevenueMetrics(
      filterResult.comps,
      pricing,
      profile,
      filterResult.provenance
    );
  }, [filterResult, pricing, profile]);

  // Compute 12-Month Booking Outlook Pace from calendar data
  const bookingOutlookResult = useMemo(() => {
    const compIds = filterResult.comps.map((c) => c.id);
    return computeBookingOutlook(calendar, compIds);
  }, [calendar, filterResult.comps]);

  const bookingOutlook = bookingOutlookResult.outlook;

  // Compute 12-Month Seasonal Price & Demand Trend for Comps
  const seasonalTrendResult = useMemo(() => {
    return computeSeasonalPriceTrend(
      calendar,
      filterResult.comps,
      filterResult.provenance
    );
  }, [calendar, filterResult.comps, filterResult.provenance]);

  // Compute Amenity Premiums among comps
  const amenityPremiums = useMemo(() => {
    return computeAmenityPremiums(filterResult.comps, filterResult.provenance);
  }, [filterResult.comps, filterResult.provenance]);

  // Compute Neighbourhood Stats for current profile
  const neighbourhoodStats = useMemo(() => {
    return computeNeighbourhoodStats(listings, profile);
  }, [listings, profile]);

  // Compute Competition & Compliance Metrics
  const compliance = useMemo(() => {
    return computeComplianceMetrics(
      listings,
      profile.neighbourhood,
      filterResult.provenance
    );
  }, [listings, profile.neighbourhood, filterResult.provenance]);

  // Context JSON strictly matching computed numbers
  const contextJson = useMemo(() => {
    const next3Months = bookingOutlook.slice(0, 3);
    const next3MonthsTotalNights = next3Months.reduce((sum: number, m: any) => sum + m.totalNights, 0);
    const next3MonthsUnavailNights = next3Months.reduce((sum: number, m: any) => sum + m.unavailableNights, 0);
    const booking_outlook_next_3m_unavailable_pct = next3MonthsTotalNights > 0
      ? Math.round((next3MonthsUnavailNights / next3MonthsTotalNights) * 100)
      : 0;

    const occupancy_pct = revenue.occupancyPct || Math.round((revenue.bookedNightsMedian / 365) * 100);

    return {
      property: {
        neighbourhood: profile.neighbourhood,
        property_style: profile.propertyType,
        bedrooms: profile.bedrooms,
        bathrooms: profile.bathrooms,
        accommodates_min: profile.accommodatesMin,
        accommodates_max: profile.accommodatesMax,
        monthly_carrying_cost: profile.monthlyCarryingCost || 'none entered',
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
      seasonal_price_trends: seasonalTrendResult.trend.map((t) => ({
        month: t.month,
        median_booked_price: t.medianBookedPrice,
        weighted_avg_price: t.weightedAvgPrice,
        demand_rate_pct: t.demandRate,
        booked_comps_count: t.bookedListingsCount,
      })),
      revenue_and_occupancy: {
        booked_nights_median: revenue.bookedNightsMedian,
        occupancy_pct: occupancy_pct,
        annual_revenue_median: revenue.annualRevenueMedian,
        annual_revenue_p25: revenue.annualRevenueP25,
        annual_revenue_p75: revenue.annualRevenueP75,
        simple_check_product: Math.round(revenue.simpleCheckProduct),
        break_even_nightly_price: revenue.breakEvenNightlyPrice
          ? Number(revenue.breakEvenNightlyPrice.toFixed(2))
          : null,
      },
      booking_outlook: {
        next_3m_unavailable_pct: booking_outlook_next_3m_unavailable_pct,
        months_sampled: next3Months.map((m: any) => ({
          month: m.month,
          unavailable_pct: Math.round(m.unavailablePercent),
        })),
      },
      amenity_premiums_vs_without: amenityPremiums.map((a) => ({
        amenity: a.label,
        premium_diff_per_night: a.diff,
        with_n: a.withN,
        without_n: a.withoutN,
        is_low_sample: a.isLowSample,
      })),
      neighbourhood_compliance: {
        active_listings_total: compliance.totalListings,
        entire_home_share_pct: Math.round(compliance.entireHomeShare * 100),
        license_share_pct: Math.round(compliance.licenseShare * 100),
        superhost_share_pct: Math.round(compliance.superhostShare * 100),
      },
      audit: {
        scrape_year: 2026,
        dataset_scrape_date: scrapeDate,
        dataset_source: 'Inside Airbnb (Washington, DC)',
        percentile_method: 'Linear interpolation (Excel PERCENTILE.INC)',
      },
    };
  }, [profile, pricing, revenue, seasonalTrendResult, bookingOutlook, amenityPremiums, compliance, scrapeDate]);

  // Scenario share link with try/catch and selectable fallback
  const handleShareScenario = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('hood', profile.neighbourhood);
    params.set('type', profile.propertyType);
    params.set('room', profile.roomType);
    params.set('beds', profile.bedrooms.toString());
    params.set('baths', profile.bathrooms.toString());
    params.set('accMin', profile.accommodatesMin.toString());
    params.set('accMax', profile.accommodatesMax.toString());
    if (profile.monthlyCarryingCost) {
      params.set('cost', profile.monthlyCarryingCost.toString());
    }
    params.set('washer', profile.amenities.has_washer ? '1' : '0');
    params.set('parking', profile.amenities.has_free_parking ? '1' : '0');
    params.set('desk', profile.amenities.has_workspace ? '1' : '0');
    params.set('pool', profile.amenities.has_pool ? '1' : '0');
    params.set('gym', profile.amenities.has_gym ? '1' : '0');
    params.set('self', profile.amenities.has_self_checkin ? '1' : '0');

    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setShareFallbackUrl(null);
        setTimeout(() => setShareCopied(false), 2500);
      } else {
        setShareFallbackUrl(shareUrl);
      }
    } catch {
      setShareFallbackUrl(shareUrl);
    }
  }, [profile]);

  const handleSelectNeighbourhood = useCallback((hood: string) => {
    setProfile((prev) => ({ ...prev, neighbourhood: hood }));
    setActiveTab('guided');
    setCurrentStep(2);
    setViewMode('advisor');
  }, []);

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-teal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900">
          Loading DC Short-Term Rental Market Data...
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Parsing active listings and 12-month forward calendar records from Inside Airbnb (Washington, DC).
        </p>
      </div>
    );
  }

  // Error fallback state with direct file upload
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl max-w-md text-rose-900 space-y-4 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold">Unable to Load Dataset</h2>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={retryLoad}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-800 text-white rounded-xl text-xs font-semibold hover:bg-rose-900 min-h-[44px]"
            >
              Retry Loading
            </button>
            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-50 min-h-[44px]">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await uploadCustomListings(f);
                }}
                className="sr-only"
                aria-label="Upload CSV file"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Dismissible URL reset warning notice */}
      {urlResetNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{urlResetNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUrlResetNotice(null)}
            className="text-amber-700 hover:text-amber-950 font-bold px-2 py-1 rounded-sm hover:bg-amber-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      {/* Share fallback dialog if clipboard write failed */}
      {shareFallbackUrl && (
        <div className="bg-teal-50 border-b border-teal-200 px-4 py-3 text-xs text-teal-900 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <span className="font-semibold">Copy scenario link:</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              readOnly
              value={shareFallbackUrl}
              onFocus={(e) => e.target.select()}
              className="w-full sm:w-80 px-2.5 py-1.5 text-xs bg-white border border-teal-300 rounded-lg font-mono text-slate-800"
              aria-label="Scenario link URL"
            />
            <button
              type="button"
              onClick={() => setShareFallbackUrl(null)}
              className="px-2.5 py-1.5 bg-teal-800 text-white rounded-lg text-xs font-semibold hover:bg-teal-900 min-h-[44px]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TOP BAR: Zone 1 (Wordmark) - Zone 2 (Links) - Zone 3 (Action) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 flex-wrap">
          {/* Zone 1: Brand title */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('guided');
              setCurrentStep(1);
              setViewMode('advisor');
            }}
            className="text-lg font-bold tracking-tight text-teal-950 hover:text-teal-800 transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block" />
            <span>DC STR Advisor</span>
          </button>

          {/* Zone 2: Desktop 5 nav links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveTab('guided');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors min-h-[44px] flex items-center ${
                activeTab === 'guided' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800'
                  : ''
              }`}
            >
              Price & Plan
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('explorer');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors min-h-[44px] flex items-center ${
                activeTab === 'explorer' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800'
                  : ''
              }`}
            >
              Neighbourhood Explorer
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('competition');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors min-h-[44px] flex items-center ${
                activeTab === 'competition' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800'
                  : ''
              }`}
            >
              Competition & DLCP
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('chat');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors min-h-[44px] flex items-center gap-1 ${
                activeTab === 'chat' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800'
                  : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              <span>Ask the Data</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('data');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors min-h-[44px] flex items-center ${
                activeTab === 'data' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800'
                  : ''
              }`}
            >
              Data & Method
            </button>
          </nav>

          {/* Zone 3: Primary Actions & Accessible Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Owner view / Advisor view toggle with aria-pressed */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('advisor')}
                aria-pressed={viewMode === 'advisor'}
                className={`px-3 py-1.5 rounded-lg transition-colors min-h-[36px] ${
                  viewMode === 'advisor'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Advisor view: full tables, provenance audits, and financial sliders"
              >
                Advisor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('owner')}
                aria-pressed={viewMode === 'owner'}
                className={`px-3 py-1.5 rounded-lg transition-colors min-h-[36px] ${
                  viewMode === 'owner'
                    ? 'bg-white text-teal-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Owner view: large high-impact type for client meetings"
              >
                Owner
              </button>
            </div>

            {/* Share scenario */}
            <button
              type="button"
              onClick={handleShareScenario}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Share property scenario link"
              title="Copy scenario link with current property inputs"
            >
              {shareCopied ? (
                <Check className="w-4 h-4 text-teal-700" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Printable Client Brief CTA */}
            <button
              type="button"
              onClick={() => setIsBriefOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs min-h-[44px]"
            >
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>Client Brief</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Strip (below md) */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 overflow-x-auto bg-slate-50 border-t border-slate-200 text-xs font-medium no-print">
          <button
            type="button"
            onClick={() => {
              setActiveTab('guided');
              setViewMode('advisor');
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
              activeTab === 'guided' && viewMode === 'advisor'
                ? 'bg-teal-800 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Price & Plan
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('explorer');
              setViewMode('advisor');
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
              activeTab === 'explorer' && viewMode === 'advisor'
                ? 'bg-teal-800 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Neighbourhood Explorer
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('competition');
              setViewMode('advisor');
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
              activeTab === 'competition' && viewMode === 'advisor'
                ? 'bg-teal-800 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Competition & DLCP
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              setViewMode('advisor');
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors flex items-center gap-1 min-h-[44px] ${
              activeTab === 'chat' && viewMode === 'advisor'
                ? 'bg-teal-800 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask the Data</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('data');
              setViewMode('advisor');
            }}
            className={`px-3 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
              activeTab === 'data' && viewMode === 'advisor'
                ? 'bg-teal-800 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Data & Method
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Landing Hero banner */}
        {showLandingBanner && activeTab === 'guided' && (
          <div className="relative">
            <LandingHero
              listingsCount={listings.length}
              onTrySample={() => {
                setProfile(DEFAULT_SAMPLE_PROFILE);
                setCurrentStep(2);
                setShowLandingBanner(false);
              }}
              onStartCustom={() => {
                setCurrentStep(1);
                setShowLandingBanner(false);
              }}
            />
          </div>
        )}

        {/* View Mode Switching: OWNER VIEW vs ADVISOR VIEW */}
        {viewMode === 'owner' ? (
          <OwnerMeetingView
            profile={profile}
            pricing={pricing}
            revenue={revenue}
            onOpenProvenance={(p) => setActiveProvenance(p)}
            onOpenExplain={() =>
              setExplainModal({
                isOpen: true,
                screenName: 'Owner Meeting Earnings Summary',
              })
            }
            onSwitchToAdvisor={() => setViewMode('advisor')}
          />
        ) : (
          <>
            {/* Top KPI Cards Strip */}
            <KpiCards
              pricing={pricing}
              revenue={revenue}
              onOpenProvenance={(p) => setActiveProvenance(p)}
            />

            {/* Content Tabs */}
            {activeTab === 'guided' && (
              <div className="space-y-6">
                {/* 3-Step Guided Progress Bar */}
                <StepProgressBar
                  currentStep={currentStep}
                  onSelectStep={(step) => setCurrentStep(step)}
                />

                {/* Step 1: Your Property */}
                {currentStep === 1 && (
                  <PropertyProfileCard
                    profile={profile}
                    onChange={setProfile}
                    neighbourhoods={neighbourhoods}
                    onLoadSample={() => {
                      setProfile(DEFAULT_SAMPLE_PROFILE);
                      setCurrentStep(2);
                    }}
                    onNextStep={() => setCurrentStep(2)}
                  />
                )}

                {/* Step 2: Your Price */}
                {currentStep === 2 && (
                  <PriceRecommendationCard
                    pricing={pricing}
                    comps={filterResult.comps}
                    profile={profile}
                    seasonalTrend={seasonalTrendResult.trend}
                    seasonalProvenance={seasonalTrendResult.provenance}
                    onOpenProvenance={(p) => setActiveProvenance(p)}
                    onOpenExplain={() =>
                      setExplainModal({
                        isOpen: true,
                        screenName: 'Price Recommendation Tiers',
                      })
                    }
                    onNextStep={() => setCurrentStep(3)}
                    onPrevStep={() => setCurrentStep(1)}
                  />
                )}

                {/* Step 3: Your Plan */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <RevenueCard
                      revenue={revenue}
                      pricing={pricing}
                      profile={profile}
                      comps={filterResult.comps}
                      onOpenProvenance={(p) => setActiveProvenance(p)}
                      onOpenExplain={() =>
                        setExplainModal({
                          isOpen: true,
                          screenName: 'Revenue & Break-even Financial Plan',
                        })
                      }
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <BookingOutlookCard
                        outlook={bookingOutlook}
                        compCount={pricing.n}
                        scrapeDate={scrapeDate}
                        onOpenProvenance={(p) => setActiveProvenance(p)}
                      />

                      <AmenityPremiumCard
                        amenities={amenityPremiums}
                        compCount={filterResult.comps.length}
                        userAmenities={profile.amenities}
                        onOpenProvenance={(p) => setActiveProvenance(p)}
                      />
                    </div>

                    <div className="p-6 bg-teal-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-base text-teal-50">
                          Ready for your client presentation?
                        </h3>
                        <p className="text-xs text-teal-200 mt-0.5">
                          Generate the verified one-page summary brief to hand to the homeowner or print as PDF.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsBriefOpen(true)}
                        className="px-5 py-2.5 bg-white text-slate-900 hover:bg-teal-50 font-semibold rounded-xl text-xs transition-colors shrink-0 shadow-xs min-h-[44px]"
                      >
                        Open Client Brief (1-Pager) →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'explorer' && (
              <NeighbourhoodExplorer
                geoJson={geoJson}
                neighbourhoodStats={neighbourhoodStats}
                currentNeighbourhood={profile.neighbourhood}
                profile={profile}
                comparedNeighbourhoods={comparedNeighbourhoods}
                onToggleCompare={handleToggleCompare}
                onSelectNeighbourhood={handleSelectNeighbourhood}
                onOpenProvenance={(p) => setActiveProvenance(p)}
                isMapAvailable={isMapAvailable}
              />
            )}

            {activeTab === 'competition' && (
              <CompetitionCard
                neighbourhood={profile.neighbourhood}
                totalListings={compliance.totalListings}
                entireHomeShare={compliance.entireHomeShare}
                licenseShare={compliance.licenseShare}
                superhostShare={compliance.superhostShare}
                provenance={compliance.provenance}
                onOpenProvenance={(p) => setActiveProvenance(p)}
              />
            )}

            {activeTab === 'chat' && (
              <AskTheDataCard
                contextJson={contextJson}
                profile={profile}
                pricing={pricing}
                revenue={revenue}
                onOpenProvenance={(p) => setActiveProvenance(p)}
              />
            )}

            {activeTab === 'data' && <DataMethodTab comps={filterResult.comps} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Data: Inside Airbnb, Washington DC, scraped {scrapeDate},{' '}
            <a
              href="https://insideairbnb.com/get-the-data/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-800 hover:underline font-medium"
            >
              https://insideairbnb.com/get-the-data/
            </a>
            , CC BY 4.0.
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSelfTestOpen(true)}
              className="text-slate-400 hover:text-slate-700 underline font-mono text-[11px] min-h-[44px] flex items-center"
              title="Run unit test suite against Excel benchmarks"
            >
              /selftest
            </button>
            <span className="text-slate-300">·</span>
            <span>DC STR Advisor v1.0</span>
          </div>
        </div>
      </footer>

      {/* Modals & Overlays */}
      <ProvenanceModal
        provenance={activeProvenance}
        isOpen={activeProvenance !== null}
        onClose={() => setActiveProvenance(null)}
      />

      <ExplainModal
        isOpen={explainModal.isOpen}
        screenName={explainModal.screenName}
        contextJson={contextJson}
        onClose={() => setExplainModal({ isOpen: false, screenName: '' })}
      />

      <ClientBriefModal
        isOpen={isBriefOpen}
        onClose={() => setIsBriefOpen(false)}
        profile={profile}
        pricing={pricing}
        revenue={revenue}
        amenities={amenityPremiums}
        outlook={bookingOutlook}
        contextJson={contextJson}
        scrapeDate={scrapeDate}
      />

      <SelfTestModal
        isOpen={isSelfTestOpen}
        onClose={() => setIsSelfTestOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <MainApp />
    </DataProvider>
  );
}
