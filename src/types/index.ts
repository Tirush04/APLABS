export interface Listing {
  id: string;
  neighbourhood_cleansed: string;
  latitude: number;
  longitude: number;
  property_type: string;
  room_type: string;
  accommodates: number;
  bedrooms: number;
  beds: number;
  bathrooms?: number;
  bathrooms_text?: string;
  minimum_nights: number;
  availability_365: number;
  number_of_reviews: number;
  number_of_reviews_ltm: number;
  reviews_per_month: number;
  review_scores_rating: number;
  estimated_occupancy_l365d: number;
  estimated_revenue_l365d: number;
  instant_bookable: string | boolean;
  host_is_superhost: string | boolean;
  last_scraped: string;
  price: number;
  has_license: number;
  has_washer: number;
  has_free_parking: number;
  has_workspace: number;
  has_pool: number;
  has_gym: number;
  has_self_checkin: number;
  amenity_count: number;
  is_apartment_style: number;
}

export interface CalendarEntry {
  listing_id: string;
  month: string;
  nights: number;
  unavailable_nights: number;
}

export interface PropertyProfile {
  neighbourhood: string;
  propertyType: 'Condo' | 'House';
  roomType: 'Entire home/apt' | 'Private room' | 'Shared room';
  bedrooms: number;
  bathrooms: number;
  accommodatesMin: number;
  accommodatesMax: number;
  amenities: {
    has_washer: boolean;
    has_free_parking: boolean;
    has_workspace: boolean;
    has_pool: boolean;
    has_gym: boolean;
    has_self_checkin: boolean;
  };
  monthlyCarryingCost?: number;
}

export interface Provenance {
  metricName: string;
  datasetFile: string;
  filterApplied: string;
  rowCount: number;
  formula: string;
  listingIds: string[];
  method?: string; // Percentile PERCENTILE.INC / Share = count ÷ total / Median of field / Formula
  widenedSteps?: string[];
  isLowSample?: boolean;
}

export interface PricingTiers {
  n: number;
  p25: number;
  p40: number; // Launch tier
  median: number; // Market tier
  p75: number;
  topRatedN: number;
  topRatedP75: number; // Premium tier
  recommendedPrice: number;
  iqrBand: [number, number];
  prices: number[];
  launchProvenance: Provenance;
  marketProvenance: Provenance;
  premiumProvenance: Provenance;
  p25Provenance: Provenance;
  p75Provenance: Provenance;
  provenance: Provenance;
}

export interface RevenueMetrics {
  bookedNightsMedian: number;
  occupancyPct: number;
  annualRevenueMedian: number;
  annualRevenueP25: number;
  annualRevenueP75: number;
  simpleCheckProduct: number;
  breakEvenNightlyPrice?: number;
  monthsToCover?: { month: number; cumulativeRev: number; cumulativeCost: number }[];
  occupancyProvenance: Provenance;
  revenueProvenance: Provenance;
  bookedNightsProvenance: Provenance;
  breakEvenProvenance?: Provenance;
  scenarioProvenance?: Provenance;
  simpleCheckProvenance?: Provenance;
  provenance: Provenance;
}

export interface BookingOutlookMonth {
  month: string;
  totalNights: number;
  unavailableNights: number;
  unavailablePercent: number;
  listingCount: number;
  isPast?: boolean;
  isPartial?: boolean;
}

export interface AmenityComparison {
  key: string;
  label: string;
  withN: number;
  withoutN: number;
  medWith: number;
  medWithout: number;
  diff: number;
  isLowSample: boolean;
  withListingIds: string[];
  withoutListingIds: string[];
  withProvenance: Provenance;
  withoutProvenance: Provenance;
  provenance: Provenance;
}

export interface NeighbourhoodStats {
  neighbourhood: string;
  totalListings: number;
  entireHomeShare: number;
  licenseShare: number;
  superhostShare: number;
  medianPrice1BedEntire: number;
  listingCount1BedEntire: number;
  provenance?: Provenance;
}

export interface AIGuardLogEntry {
  id: string;
  timestamp: string;
  source: 'chat' | 'explain' | 'brief';
  originalResponse: string;
  flaggedTokens: string[];
  verified: boolean;
}

export interface SeasonalPriceTrendPoint {
  month: string;
  displayMonth: string;
  medianBookedPrice: number;
  weightedAvgPrice: number;
  demandRate: number; // unavailable %
  bookedListingsCount: number;
}
