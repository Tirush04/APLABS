import {
  Listing,
  CalendarEntry,
  PropertyProfile,
  PricingTiers,
  RevenueMetrics,
  BookingOutlookMonth,
  AmenityComparison,
  NeighbourhoodStats,
  Provenance,
} from '../types';
import { percentileInc, median } from './math';

export interface FilterResult {
  comps: Listing[];
  provenance: Provenance;
  isWidened: boolean;
  widenedSteps: string[];
}

/**
 * Filter comps based on property profile, with automatic multi-stage widening if n < 10
 */
export function filterCompsWithWidening(
  listings: Listing[],
  profile: PropertyProfile
): FilterResult {
  const widenedSteps: string[] = [];

  // Stage 0: Exact match filter
  // neighbourhood_cleansed, room_type == 'Entire home/apt', same bedrooms,
  // is_apartment_style (Condo -> 1, House -> 0), accommodates between min and max
  const targetAptStyle = profile.propertyType === 'Condo' ? 1 : 0;

  const exactFilterFn = (l: Listing) => {
    const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
    const roomMatch = l.room_type === profile.roomType;
    const bedMatch = Number(l.bedrooms) === profile.bedrooms;
    const styleMatch = Number(l.is_apartment_style) === targetAptStyle;
    const acc = Number(l.accommodates);
    const accMatch = acc >= profile.accommodatesMin && acc <= profile.accommodatesMax;
    return hoodMatch && roomMatch && bedMatch && styleMatch && accMatch;
  };

  let comps = listings.filter(exactFilterFn);
  let filterDescription = `neighbourhood = "${profile.neighbourhood}", room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, style = ${profile.propertyType} (is_apartment_style = ${targetAptStyle}), accommodates = ${profile.accommodatesMin}–${profile.accommodatesMax}`;

  // Check if widening is necessary (n < 10)
  if (comps.length < 10) {
    widenedSteps.push(
      `Initial exact filter yielded n=${comps.length} (<10). Widening property type: including all property styles (both apartment-style condos and houses) in ${profile.neighbourhood} with ${profile.bedrooms} bedroom(s).`
    );

    comps = listings.filter((l) => {
      const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
      const roomMatch = l.room_type === profile.roomType;
      const bedMatch = Number(l.bedrooms) === profile.bedrooms;
      const acc = Number(l.accommodates);
      const accMatch = acc >= profile.accommodatesMin && acc <= profile.accommodatesMax;
      return hoodMatch && roomMatch && bedMatch && accMatch;
    });

    filterDescription = `neighbourhood = "${profile.neighbourhood}", room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, all property styles, accommodates = ${profile.accommodatesMin}–${profile.accommodatesMax}`;
  }

  if (comps.length < 10) {
    widenedSteps.push(
      `Sample still low at n=${comps.length}. Widening guest capacity range to ±1 guest to capture comparable configurations.`
    );

    const minAcc = Math.max(1, profile.accommodatesMin - 1);
    const maxAcc = profile.accommodatesMax + 1;

    comps = listings.filter((l) => {
      const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
      const roomMatch = l.room_type === profile.roomType;
      const bedMatch = Number(l.bedrooms) === profile.bedrooms;
      const acc = Number(l.accommodates);
      const accMatch = acc >= minAcc && acc <= maxAcc;
      return hoodMatch && roomMatch && bedMatch && accMatch;
    });

    filterDescription += ` (guest range expanded to ${minAcc}–${maxAcc})`;
  }

  if (comps.length < 10) {
    widenedSteps.push(
      `Sample still low at n=${comps.length}. Widening to District-wide comps for ${profile.bedrooms}-bedroom ${profile.propertyType}s.`
    );

    comps = listings.filter((l) => {
      const roomMatch = l.room_type === profile.roomType;
      const bedMatch = Number(l.bedrooms) === profile.bedrooms;
      const styleMatch = Number(l.is_apartment_style) === targetAptStyle;
      return roomMatch && bedMatch && styleMatch;
    });

    filterDescription = `District-wide DC, room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, style = ${profile.propertyType}`;
  }

  const provenance: Provenance = {
    metricName: 'Comparable Listings Set',
    datasetFile: 'dc_listings_clean.csv',
    filterApplied: filterDescription,
    rowCount: comps.length,
    formula: 'Strict comp subset with linear interpolation percentiles and fallback widening steps if n < 10',
    listingIds: comps.map((c) => c.id),
    widenedSteps: widenedSteps.length > 0 ? widenedSteps : undefined,
    isLowSample: comps.length < 10,
  };

  return {
    comps,
    provenance,
    isWidened: widenedSteps.length > 0,
    widenedSteps,
  };
}

/**
 * Compute 3-tier pricing recommendations and IQR typical range
 */
export function computePricingTiers(comps: Listing[], provenanceBase: Provenance): PricingTiers {
  const prices = comps
    .map((c) => Number(c.price))
    .filter((p) => !isNaN(p) && p > 0);

  const n = prices.length;
  const p25 = percentileInc(prices, 0.25);
  const p40 = percentileInc(prices, 0.40);
  const med = percentileInc(prices, 0.50);
  const p75 = percentileInc(prices, 0.75);

  // Top-rated comps: review_scores_rating >= 4.8
  const topRated = comps.filter((c) => Number(c.review_scores_rating) >= 4.8);
  const topRatedPrices = topRated
    .map((c) => Number(c.price))
    .filter((p) => !isNaN(p) && p > 0);

  const topRatedN = topRatedPrices.length;
  const topRatedP75 = percentileInc(topRatedPrices, 0.75);

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Price Recommendation Tiers',
    formula: `Launch = 40th percentile (P40), Market = Median (P50), Premium = 75th percentile (P75) of comps with rating ≥ 4.8. Method: Excel PERCENTILE.INC linear interpolation.`,
    rowCount: n,
  };

  return {
    n,
    p25,
    p40,
    median: med,
    p75,
    topRatedN,
    topRatedP75,
    recommendedPrice: med,
    iqrBand: [p25, p75],
    prices,
    provenance,
  };
}

/**
 * Compute revenue metrics, break-even price, and months-to-cover schedule
 */
export function computeRevenueMetrics(
  comps: Listing[],
  pricing: PricingTiers,
  profile: PropertyProfile,
  provenanceBase: Provenance
): RevenueMetrics {
  const occupancies = comps
    .map((c) => Number(c.estimated_occupancy_l365d))
    .filter((o) => !isNaN(o));

  const revenues = comps
    .map((c) => Number(c.estimated_revenue_l365d))
    .filter((r) => !isNaN(r));

  const bookedNightsMedian = median(occupancies);
  const annualRevenueMedian = median(revenues);
  const annualRevenueP25 = percentileInc(revenues, 0.25);
  const annualRevenueP75 = percentileInc(revenues, 0.75);

  // Labeled simple check product (median price * median booked nights)
  const simpleCheckProduct = pricing.median * bookedNightsMedian;

  let breakEvenNightlyPrice: number | undefined;
  let monthsToCover: { month: number; cumulativeRev: number; cumulativeCost: number }[] | undefined;

  if (profile.monthlyCarryingCost && profile.monthlyCarryingCost > 0) {
    const annualCost = profile.monthlyCarryingCost * 12;
    breakEvenNightlyPrice = bookedNightsMedian > 0 ? annualCost / bookedNightsMedian : 0;

    const monthlyRev = annualRevenueMedian / 12;
    monthsToCover = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return {
        month,
        cumulativeRev: Math.round(monthlyRev * month),
        cumulativeCost: Math.round(profile.monthlyCarryingCost! * month),
      };
    });
  }

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Estimated Revenue & Occupancy',
    formula: `Booked nights = Median of estimated_occupancy_l365d. Annual revenue = Median of estimated_revenue_l365d across comps (NOT a product of medians). Simple check product = median price × median booked nights. Break-even = (monthly carrying cost × 12) ÷ median booked nights.`,
    rowCount: comps.length,
  };

  return {
    bookedNightsMedian,
    annualRevenueMedian,
    annualRevenueP25,
    annualRevenueP75,
    simpleCheckProduct,
    breakEvenNightlyPrice,
    monthsToCover,
    provenance,
  };
}

/**
 * Compute forward-looking 12-month booking pace from monthly calendar
 */
export function computeBookingOutlook(
  calendar: CalendarEntry[],
  compListingIds: (string | number)[]
): BookingOutlookMonth[] {
  if (!calendar || calendar.length === 0 || compListingIds.length === 0) {
    return [];
  }

  const compIdSet = new Set(compListingIds.map(String));
  const monthMap: Record<
    string,
    { totalNights: number; unavailNights: number; listingCount: number }
  > = {};

  for (let i = 0; i < calendar.length; i++) {
    const row = calendar[i];
    if (compIdSet.has(String(row.listing_id))) {
      const m = row.month;
      if (!monthMap[m]) {
        monthMap[m] = { totalNights: 0, unavailNights: 0, listingCount: 0 };
      }
      monthMap[m].totalNights += Number(row.nights) || 0;
      monthMap[m].unavailNights += Number(row.unavailable_nights) || 0;
      monthMap[m].listingCount += 1;
    }
  }

  const sortedMonths = Object.keys(monthMap).sort();
  // Take next 12 calendar months
  return sortedMonths.slice(0, 12).map((month) => {
    const data = monthMap[month];
    const pct = data.totalNights > 0 ? (data.unavailNights / data.totalNights) * 100 : 0;
    return {
      month,
      totalNights: data.totalNights,
      unavailableNights: data.unavailNights,
      unavailablePercent: Math.round(pct * 10) / 10,
      listingCount: data.listingCount,
    };
  });
}

/**
 * Compute Amenity Premiums: median price of 1-bedroom comps with vs without amenity
 */
export const AMENITY_METADATA = [
  { key: 'has_washer', label: 'In-Unit Washer / Dryer' },
  { key: 'has_free_parking', label: 'Free Parking' },
  { key: 'has_workspace', label: 'Dedicated Workspace' },
  { key: 'has_self_checkin', label: 'Self Check-In (Keypad/Lockbox)' },
  { key: 'has_gym', label: 'Fitness Center / Gym' },
  { key: 'has_pool', label: 'Swimming Pool' },
];

export function computeAmenityPremiums(
  listings: Listing[],
  neighbourhood: string
): AmenityComparison[] {
  // Focus on 1-bedroom comps in the chosen neighbourhood (entire home)
  const baseComps = listings.filter(
    (l) =>
      l.neighbourhood_cleansed === neighbourhood &&
      l.room_type === 'Entire home/apt' &&
      Number(l.bedrooms) === 1
  );

  return AMENITY_METADATA.map((amenity) => {
    const withComps = baseComps.filter((c) => Number(c[amenity.key as keyof Listing]) === 1);
    const withoutComps = baseComps.filter((c) => Number(c[amenity.key as keyof Listing]) === 0);

    const withPrices = withComps
      .map((c) => Number(c.price))
      .filter((p) => !isNaN(p) && p > 0);
    const withoutPrices = withoutComps
      .map((c) => Number(c.price))
      .filter((p) => !isNaN(p) && p > 0);

    const medWith = median(withPrices);
    const medWithout = median(withoutPrices);
    const diff = withPrices.length > 0 && withoutPrices.length > 0 ? medWith - medWithout : 0;
    const isLowSample = withPrices.length < 10 || withoutPrices.length < 10;

    const provenance: Provenance = {
      metricName: `Amenity Premium: ${amenity.label}`,
      datasetFile: 'dc_listings_clean.csv',
      filterApplied: `neighbourhood = "${neighbourhood}", room_type = "Entire home/apt", bedrooms = 1; split by ${amenity.key} (1 vs 0)`,
      rowCount: baseComps.length,
      formula: 'Median price with amenity - Median price without amenity',
      listingIds: baseComps.map((c) => c.id),
      isLowSample,
    };

    return {
      key: amenity.key,
      label: amenity.label,
      withN: withPrices.length,
      withoutN: withoutPrices.length,
      medWith: Math.round(medWith * 100) / 100,
      medWithout: Math.round(medWithout * 100) / 100,
      diff: Math.round(diff * 100) / 100,
      isLowSample,
      provenance,
    };
  });
}

/**
 * Compute neighbourhood-level statistics for map shading and side-by-side comparison
 */
export function computeNeighbourhoodStats(listings: Listing[]): Record<string, NeighbourhoodStats> {
  const groups: Record<string, Listing[]> = {};
  for (const l of listings) {
    const hood = l.neighbourhood_cleansed;
    if (!hood) continue;
    if (!groups[hood]) groups[hood] = [];
    groups[hood].push(l);
  }

  const result: Record<string, NeighbourhoodStats> = {};

  for (const [hood, items] of Object.entries(groups)) {
    const totalListings = items.length;
    const entireCount = items.filter((i) => i.room_type === 'Entire home/apt').length;
    const licenseCount = items.filter((i) => Number(i.has_license) === 1).length;
    const superhostCount = items.filter(
      (i) => i.host_is_superhost === 't' || i.host_is_superhost === true
    ).length;

    // 1-bedroom entire home subset
    const oneBedEntire = items.filter(
      (i) => i.room_type === 'Entire home/apt' && Number(i.bedrooms) === 1
    );
    const oneBedPrices = oneBedEntire
      .map((i) => Number(i.price))
      .filter((p) => !isNaN(p) && p > 0);
    const medianPrice1BedEntire = median(oneBedPrices);

    result[hood] = {
      neighbourhood: hood,
      totalListings,
      entireHomeShare: totalListings > 0 ? entireCount / totalListings : 0,
      licenseShare: totalListings > 0 ? licenseCount / totalListings : 0,
      superhostShare: totalListings > 0 ? superhostCount / totalListings : 0,
      medianPrice1BedEntire: Math.round(medianPrice1BedEntire * 100) / 100,
      listingCount1BedEntire: oneBedPrices.length,
    };
  }

  return result;
}

/**
 * Compute competition and compliance metrics for chosen neighbourhood
 */
export function computeComplianceMetrics(
  listings: Listing[],
  neighbourhood: string,
  provenanceBase: Provenance
) {
  const hoodListings = listings.filter((l) => l.neighbourhood_cleansed === neighbourhood);
  const total = hoodListings.length;
  const entire = hoodListings.filter((l) => l.room_type === 'Entire home/apt').length;
  const licensed = hoodListings.filter((l) => Number(l.has_license) === 1).length;
  const superhosts = hoodListings.filter(
    (l) => l.host_is_superhost === 't' || l.host_is_superhost === true
  ).length;

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Neighbourhood Competition & Compliance',
    filterApplied: `neighbourhood = "${neighbourhood}" (all active listings)`,
    rowCount: total,
    formula: 'Active count, Entire home share = entire / total, License share = has_license / total, Superhost share = superhost / total',
    listingIds: hoodListings.map((l) => l.id),
  };

  return {
    totalListings: total,
    entireHomeShare: total > 0 ? entire / total : 0,
    licenseShare: total > 0 ? licensed / total : 0,
    superhostShare: total > 0 ? superhosts / total : 0,
    provenance,
  };
}
