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
  UserCheck,
  Eye,
  Check,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
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

function MainApp() {
  const {
    listings,
    calendar,
    geoJson,
    isLoading,
    error,
    retryLoad,
    isMapAvailable,
  } = useData();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'guided' | 'explorer' | 'competition' | 'chat' | 'data'
  >('guided');

  // Guided flow step: 1 (Property) -> 2 (Price) -> 3 (Plan)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // View mode: Advisor View (full details, tables, provenance) vs Owner View (high impact big type)
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

  // Initialize profile from URL search params if present
  const [profile, setProfile] = useState<PropertyProfile>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hood = params.get('hood');
      if (hood) {
        return {
          neighbourhood: hood,
          propertyType: (params.get('type') as any) || 'Condo',
          roomType: (params.get('room') as any) || 'Entire home/apt',
          bedrooms: parseInt(params.get('beds') || '1'),
          bathrooms: parseFloat(params.get('baths') || '1'),
          accommodatesMin: parseInt(params.get('accMin') || '2'),
          accommodatesMax: parseInt(params.get('accMax') || '4'),
          amenities: {
            has_washer: params.get('washer') === '1',
            has_free_parking: params.get('parking') === '1',
            has_workspace: params.get('desk') === '1',
            has_pool: params.get('pool') === '1',
            has_gym: params.get('gym') === '1',
            has_self_checkin: params.get('self') === '1',
          },
          monthlyCarryingCost: params.get('cost')
            ? parseFloat(params.get('cost')!)
            : undefined,
        };
      }
    }
    return DEFAULT_SAMPLE_PROFILE;
  });

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
  const bookingOutlook = useMemo(() => {
    const compIds = filterResult.comps.map((c) => c.id);
    return computeBookingOutlook(calendar, compIds);
  }, [calendar, filterResult.comps]);

  // Compute Amenity Premiums
  const amenityPremiums = useMemo(() => {
    return computeAmenityPremiums(listings, profile.neighbourhood);
  }, [listings, profile.neighbourhood]);

  // Compute Neighbourhood Stats
  const neighbourhoodStats = useMemo(() => {
    return computeNeighbourhoodStats(listings);
  }, [listings]);

  // Compute Competition & Compliance Metrics
  const compliance = useMemo(() => {
    return computeComplianceMetrics(
      listings,
      profile.neighbourhood,
      filterResult.provenance
    );
  }, [listings, profile.neighbourhood, filterResult.provenance]);

  // Build the complete context JSON for AI safety and prompts
  const contextJson = useMemo(() => {
    return {
      property: {
        neighbourhood: profile.neighbourhood,
        property_style: profile.propertyType,
        bedrooms: profile.bedrooms,
        bathrooms: profile.bathrooms,
        accommodates_range: `${profile.accommodatesMin}–${profile.accommodatesMax}`,
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
      revenue_and_occupancy: {
        booked_nights_median: revenue.bookedNightsMedian,
        annual_revenue_median: revenue.annualRevenueMedian,
        annual_revenue_p25: revenue.annualRevenueP25,
        annual_revenue_p75: revenue.annualRevenueP75,
        simple_check_product: Math.round(revenue.simpleCheckProduct),
        break_even_nightly_price: revenue.breakEvenNightlyPrice
          ? Number(revenue.breakEvenNightlyPrice.toFixed(2))
          : null,
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
        dataset_scrape_date: '2026-09-20',
        dataset_source: 'Inside Airbnb (Washington, DC)',
        percentile_method: 'Linear interpolation (Excel PERCENTILE.INC)',
      },
    };
  }, [profile, pricing, revenue, amenityPremiums, compliance]);

  // Scenario share link URL generator
  const handleShareScenario = useCallback(() => {
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
    navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }, [profile]);

  // Loading skeleton state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-teal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-900">
          Loading DC Short-Term Rental Market Data...
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Parsing 4,268 active listings and 12-month forward calendar records from Inside Airbnb (Washington, DC).
        </p>
      </div>
    );
  }

  // Error fallback state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-md text-rose-900 space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold">Unable to Load Dataset</h2>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={retryLoad}
              className="px-4 py-2 bg-rose-800 text-white rounded-xl text-xs font-semibold hover:bg-rose-900"
            >
              Retry Loading
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-300"
            >
              Upload Cleaned CSV
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* ============================================================ */}
      {/* TOP BAR CONTRACT: Zone 1 (Wordmark) - Zone 2 (Links) - Zone 3 (Action) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand title, one line wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('guided');
              setCurrentStep(1);
            }}
            className="text-lg font-bold tracking-tight text-teal-950 whitespace-nowrap shrink-0 hover:text-teal-800 transition-colors flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block" />
            <span>DC STR Advisor</span>
          </button>

          {/* Zone 2: 4–5 single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveTab('guided');
                setViewMode('advisor');
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'guided' && viewMode === 'advisor'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800 pb-1'
                  : ''
              }`}
            >
              Price & Plan
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('explorer')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'explorer'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800 pb-1'
                  : ''
              }`}
            >
              Neighbourhood Explorer
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('competition')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'competition'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800 pb-1'
                  : ''
              }`}
            >
              Competition & DLCP
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeTab === 'chat'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800 pb-1'
                  : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              <span>Ask the Data</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'data'
                  ? 'text-teal-800 font-bold border-b-2 border-teal-800 pb-1'
                  : ''
              }`}
            >
              Data & Method
            </button>
          </nav>

          {/* Zone 3: Primary Action & Mode Toggles */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Owner view / Advisor view toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('advisor')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'advisor'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Advisor view: full tables, provenance audits, and financial sliders"
              >
                Advisor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('owner')}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'owner'
                    ? 'bg-white text-teal-900 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Owner view: large high-impact type for showing on screen during client meetings"
              >
                Owner
              </button>
            </div>

            {/* Share scenario */}
            <button
              type="button"
              onClick={handleShareScenario}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
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
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-teal-400" />
              <span>Client Brief</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Landing Hero banner (dismissible or expandable) */}
        {showLandingBanner && activeTab === 'guided' && (
          <div className="relative">
            <LandingHero
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
            {/* Top KPI Cards Strip (always visible in Advisor mode) */}
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

                {/* Step 3: Your Plan (Revenue, Booking Pace, Amenities, Brief) */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <RevenueCard
                      revenue={revenue}
                      pricing={pricing}
                      profile={profile}
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
                        onOpenProvenance={(p) => setActiveProvenance(p)}
                      />

                      <AmenityPremiumCard
                        amenities={amenityPremiums}
                        neighbourhood={profile.neighbourhood}
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
                        className="px-5 py-2.5 bg-white text-slate-900 hover:bg-teal-50 font-semibold rounded-xl text-xs transition-colors shrink-0 shadow-xs"
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
                onSelectNeighbourhood={(hood) => {
                  setProfile({ ...profile, neighbourhood: hood });
                  setActiveTab('guided');
                  setCurrentStep(2);
                }}
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

            {activeTab === 'data' && <DataMethodTab />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Data: Inside Airbnb, Washington DC, scraped 2026-09-20,{' '}
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
              className="text-slate-400 hover:text-slate-700 underline font-mono text-[11px]"
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
