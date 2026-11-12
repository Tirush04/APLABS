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
  SeasonalPriceTrendPoint,
} from '../types';
import { percentileInc, median } from './math';

export interface FilterResult {
  comps: Listing[];
  provenance: Provenance;
  isWidened: boolean;
  widenedSteps: string[];
}

export const isValidNumber = (val: any): boolean => {
  return val !== null && val !== undefined && val !== '' && !isNaN(Number(val));
};

/**
 * Filter comps based on property profile, with automatic multi-stage widening if n < 10.
 * Excludes rows with missing / empty / null / non-numeric bedrooms.
 */
export function filterCompsWithWidening(
  listings: Listing[],
  profile: PropertyProfile
): FilterResult {
  const widenedSteps: string[] = [];
  const targetAptStyle = profile.propertyType === 'Condo' ? 1 : 0;

  // Filter listings ensuring valid bedrooms
  const validListings = listings.filter((l) => isValidNumber(l.bedrooms));

  const exactFilterFn = (l: Listing) => {
    const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
    const roomMatch = l.room_type === profile.roomType;
    const bedMatch = Number(l.bedrooms) === profile.bedrooms;
    const styleMatch = Number(l.is_apartment_style) === targetAptStyle;
    const acc = isValidNumber(l.accommodates) ? Number(l.accommodates) : 0;
    const accMatch = acc >= profile.accommodatesMin && acc <= profile.accommodatesMax;
    return hoodMatch && roomMatch && bedMatch && styleMatch && accMatch;
  };

  let comps = validListings.filter(exactFilterFn);
  let filterDescription = `neighbourhood = "${profile.neighbourhood}", room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, style = ${profile.propertyType} (is_apartment_style = ${targetAptStyle}), accommodates = ${profile.accommodatesMin}–${profile.accommodatesMax}`;

  // Check if widening is necessary (n < 10)
  if (comps.length < 10) {
    widenedSteps.push(
      `Property styles: all property styles in ${profile.neighbourhood} with ${profile.bedrooms} bedroom(s)`
    );

    comps = validListings.filter((l) => {
      const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
      const roomMatch = l.room_type === profile.roomType;
      const bedMatch = Number(l.bedrooms) === profile.bedrooms;
      const acc = isValidNumber(l.accommodates) ? Number(l.accommodates) : 0;
      const accMatch = acc >= profile.accommodatesMin && acc <= profile.accommodatesMax;
      return hoodMatch && roomMatch && bedMatch && accMatch;
    });

    filterDescription = `neighbourhood = "${profile.neighbourhood}", room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, all property styles, accommodates = ${profile.accommodatesMin}–${profile.accommodatesMax}`;
  }

  if (comps.length < 10) {
    const minAcc = Math.max(1, profile.accommodatesMin - 1);
    const maxAcc = profile.accommodatesMax + 1;
    widenedSteps.push(
      `Guest capacity range expanded to ${minAcc}–${maxAcc} guests`
    );

    comps = validListings.filter((l) => {
      const hoodMatch = l.neighbourhood_cleansed === profile.neighbourhood;
      const roomMatch = l.room_type === profile.roomType;
      const bedMatch = Number(l.bedrooms) === profile.bedrooms;
      const acc = isValidNumber(l.accommodates) ? Number(l.accommodates) : 0;
      const accMatch = acc >= minAcc && acc <= maxAcc;
      return hoodMatch && roomMatch && bedMatch && accMatch;
    });

    filterDescription += ` (guest range expanded to ${minAcc}–${maxAcc})`;
  }

  if (comps.length < 10) {
    widenedSteps.push(
      `District-wide DC: all DC neighbourhoods for ${profile.bedrooms}-bed ${profile.propertyType}s`
    );

    comps = validListings.filter((l) => {
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
    method: 'Filtered subset matching profile criteria',
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
  // Drop null, undefined, empty string before Number()
  const compsWithPrice = comps.filter((c) => isValidNumber(c.price) && Number(c.price) > 0);
  const prices = compsWithPrice.map((c) => Number(c.price));
  const priceListingIds = compsWithPrice.map((c) => c.id);

  const n = prices.length;
  const p25 = percentileInc(prices, 0.25);
  const p40 = percentileInc(prices, 0.40);
  const med = percentileInc(prices, 0.50);
  const p75 = percentileInc(prices, 0.75);

  // Top-rated comps: review_scores_rating >= 4.8
  const topRated = comps.filter(
    (c) =>
      isValidNumber(c.review_scores_rating) &&
      Number(c.review_scores_rating) >= 4.8 &&
      isValidNumber(c.price) &&
      Number(c.price) > 0
  );
  const topRatedPrices = topRated.map((c) => Number(c.price));
  const topRatedN = topRatedPrices.length;
  const topRatedListingIds = topRated.map((c) => c.id);
  const topRatedP75 = percentileInc(topRatedPrices, 0.75);

  const baseFilter = provenanceBase.filterApplied;

  const launchProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Launch Tier Nightly Price (P40)',
    formula: '40th percentile of nightly prices across matching comparable listings',
    method: 'Percentile PERCENTILE.INC (linear interpolation)',
    rowCount: n,
    listingIds: priceListingIds,
    isLowSample: n < 10,
  };

  const marketProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Market Tier Nightly Price (Median / P50)',
    formula: '50th percentile (Median) of nightly prices across matching comparable listings',
    method: 'Percentile PERCENTILE.INC (linear interpolation)',
    rowCount: n,
    listingIds: priceListingIds,
    isLowSample: n < 10,
  };

  const premiumProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Premium Tier Nightly Price (Top-Rated P75)',
    filterApplied: `${baseFilter}; review_scores_rating >= 4.8`,
    formula: '75th percentile of nightly prices for comps with review score rating ≥ 4.8★',
    method: 'Percentile PERCENTILE.INC (linear interpolation on top-rated comps)',
    rowCount: topRatedN,
    listingIds: topRatedListingIds,
    isLowSample: topRatedN < 10,
  };

  const p25Provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Typical Low Nightly Price (P25)',
    formula: '25th percentile of nightly prices across matching comparable listings',
    method: 'Percentile PERCENTILE.INC (linear interpolation)',
    rowCount: n,
    listingIds: priceListingIds,
    isLowSample: n < 10,
  };

  const p75Provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Typical High Nightly Price (P75)',
    formula: '75th percentile of nightly prices across matching comparable listings',
    method: 'Percentile PERCENTILE.INC (linear interpolation)',
    rowCount: n,
    listingIds: priceListingIds,
    isLowSample: n < 10,
  };

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Price Recommendation Tiers',
    formula: `Launch = 40th percentile (P40), Market = Median (P50), Premium = 75th percentile (P75) of comps with rating ≥ 4.8. Method: Excel PERCENTILE.INC linear interpolation.`,
    method: 'Percentile PERCENTILE.INC',
    rowCount: n,
    listingIds: priceListingIds,
    isLowSample: n < 10,
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
    launchProvenance,
    marketProvenance,
    premiumProvenance,
    p25Provenance,
    p75Provenance,
    provenance,
  };
}

/**
 * Compute revenue metrics, occupancy %, break-even price, and months-to-cover schedule
 */
export function computeRevenueMetrics(
  comps: Listing[],
  pricing: PricingTiers,
  profile: PropertyProfile,
  provenanceBase: Provenance
): RevenueMetrics {
  const compsWithOccupancy = comps.filter((c) => isValidNumber(c.estimated_occupancy_l365d));
  const occupancies = compsWithOccupancy.map((c) => Number(c.estimated_occupancy_l365d));
  const occupancyListingIds = compsWithOccupancy.map((c) => c.id);

  const compsWithRevenue = comps.filter((c) => isValidNumber(c.estimated_revenue_l365d));
  const revenues = compsWithRevenue.map((c) => Number(c.estimated_revenue_l365d));
  const revenueListingIds = compsWithRevenue.map((c) => c.id);

  const bookedNightsMedian = median(occupancies);
  const annualRevenueMedian = median(revenues);
  const annualRevenueP25 = percentileInc(revenues, 0.25);
  const annualRevenueP75 = percentileInc(revenues, 0.75);

  const occupancyPct = Math.round((bookedNightsMedian / 365) * 100);

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

  const occupancyProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Annual Occupancy Percentage',
    formula: 'Median booked nights ÷ 365 days × 100%',
    method: 'Formula: (Median(occupancy) ÷ 365) × 100',
    rowCount: occupancies.length,
    listingIds: occupancyListingIds,
    isLowSample: occupancies.length < 10,
  };

  const revenueProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Estimated Annual Revenue (Median)',
    formula: 'Median of estimated_revenue_l365d across matching comps (NOT a product of medians)',
    method: 'Median of field',
    rowCount: revenues.length,
    listingIds: revenueListingIds,
    isLowSample: revenues.length < 10,
  };

  const bookedNightsProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Annual Booked Nights (Median)',
    formula: 'Median of estimated_occupancy_l365d across matching comps',
    method: 'Median of field',
    rowCount: occupancies.length,
    listingIds: occupancyListingIds,
    isLowSample: occupancies.length < 10,
  };

  const breakEvenProvenance: Provenance | undefined =
    profile.monthlyCarryingCost && profile.monthlyCarryingCost > 0
      ? {
          ...provenanceBase,
          metricName: 'Break-Even Nightly Rate',
          formula: `(Monthly carrying cost of $${profile.monthlyCarryingCost} × 12 months) ÷ median booked nights (${bookedNightsMedian})`,
          method: 'Formula: (Monthly Cost × 12) ÷ Booked Nights',
          rowCount: occupancies.length,
          listingIds: occupancyListingIds,
        }
      : undefined;

  const scenarioProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Scenario Revenue Model',
    formula: 'Custom selected nightly price × median booked nights (162)',
    method: 'Formula: custom_price × median_booked_nights',
    rowCount: occupancies.length,
    listingIds: occupancyListingIds,
  };

  const simpleCheckProvenance: Provenance = {
    ...provenanceBase,
    metricName: 'Simple Check Product',
    formula: `Median nightly price ($${pricing.median.toFixed(2)}) × median booked nights (${bookedNightsMedian}) = $${Math.round(simpleCheckProduct).toLocaleString()}`,
    method: 'Formula: median_price × median_booked_nights',
    rowCount: comps.length,
    listingIds: comps.map((c) => c.id),
  };

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Estimated Revenue & Occupancy',
    formula: `Booked nights = Median of estimated_occupancy_l365d. Annual revenue = Median of estimated_revenue_l365d across comps (NOT a product of medians). Simple check product = median price × median booked nights. Break-even = (monthly carrying cost × 12) ÷ median booked nights.`,
    method: 'Median of field + formulaic reconciliation',
    rowCount: revenues.length,
    listingIds: revenueListingIds,
  };

  return {
    bookedNightsMedian,
    occupancyPct,
    annualRevenueMedian,
    annualRevenueP25,
    annualRevenueP75,
    simpleCheckProduct,
    breakEvenNightlyPrice,
    monthsToCover,
    occupancyProvenance,
    revenueProvenance,
    bookedNightsProvenance,
    breakEvenProvenance,
    scenarioProvenance,
    simpleCheckProvenance,
    provenance,
  };
}

/**
 * Compute forward-looking 12-month booking pace from monthly calendar
 */
export function computeBookingOutlook(
  calendar: CalendarEntry[],
  compListingIds: string[]
): {
  outlook: BookingOutlookMonth[];
  distinctCompsCount: number;
  provenance: Provenance;
} {
  if (!calendar || calendar.length === 0 || compListingIds.length === 0) {
    return {
      outlook: [],
      distinctCompsCount: 0,
      provenance: {
        metricName: '12-Month Forward Booking Outlook Pace',
        datasetFile: 'dc_calendar_monthly.csv',
        filterApplied: 'No calendar comps found',
        rowCount: 0,
        formula: 'Sum(unavailable_nights) / Sum(nights) per month',
        method: 'Share = count ÷ total',
        listingIds: [],
      },
    };
  }

  const compIdSet = new Set(compListingIds.map(String));
  const matchedCompIds = new Set<string>();
  const monthMap: Record<
    string,
    { totalNights: number; unavailNights: number; listingCount: number }
  > = {};

  for (let i = 0; i < calendar.length; i++) {
    const row = calendar[i];
    const idStr = String(row.listing_id);
    if (compIdSet.has(idStr)) {
      matchedCompIds.add(idStr);
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
  const outlook = sortedMonths.slice(0, 12).map((month, idx) => {
    const data = monthMap[month];
    const pct = data.totalNights > 0 ? (data.unavailNights / data.totalNights) * 100 : 0;
    return {
      month,
      totalNights: data.totalNights,
      unavailableNights: data.unavailNights,
      unavailablePercent: Math.round(pct * 10) / 10,
      listingCount: data.listingCount,
      isPartial: idx === 0, // First month: partial, from 20 Sep scrape
      isPast: month < '2026-11', // Month in past
    };
  });

  const provenance: Provenance = {
    metricName: '12-Month Forward Booking Outlook Pace',
    datasetFile: 'dc_calendar_monthly.csv',
    filterApplied: `12-month forward calendar entries for ${matchedCompIds.size} distinct active comps`,
    rowCount: matchedCompIds.size,
    formula: 'For each month: unavailable_nights ÷ total_nights across calendar records of matching comps',
    method: 'Share = count ÷ total',
    listingIds: Array.from(matchedCompIds),
  };

  return {
    outlook,
    distinctCompsCount: matchedCompIds.size,
    provenance,
  };
}

/**
 * Compute Amenity Premiums using the EXACT SAME COMPS as pricing (filterResult.comps)
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
  comps: Listing[],
  provenanceBase: Provenance
): AmenityComparison[] {
  return AMENITY_METADATA.map((amenity) => {
    const withComps = comps.filter((c) => Number(c[amenity.key as keyof Listing]) === 1);
    const withoutComps = comps.filter((c) => Number(c[amenity.key as keyof Listing]) === 0);

    const withPrices = withComps
      .filter((c) => isValidNumber(c.price))
      .map((c) => Number(c.price))
      .filter((p) => p > 0);

    const withoutPrices = withoutComps
      .filter((c) => isValidNumber(c.price))
      .map((c) => Number(c.price))
      .filter((p) => p > 0);

    const medWith = withPrices.length > 0 ? median(withPrices) : 0;
    const medWithout = withoutPrices.length > 0 ? median(withoutPrices) : 0;
    const diff = withPrices.length > 0 && withoutPrices.length > 0 ? medWith - medWithout : 0;
    const isLowSample = withPrices.length < 10 || withoutPrices.length < 10;

    const withListingIds = withComps.map((c) => c.id);
    const withoutListingIds = withoutComps.map((c) => c.id);

    const withProvenance: Provenance = {
      ...provenanceBase,
      metricName: `Comps WITH ${amenity.label}`,
      filterApplied: `${provenanceBase.filterApplied}; ${amenity.key} = 1`,
      rowCount: withPrices.length,
      formula: `Median nightly price of comps featuring ${amenity.label}`,
      method: 'Median of field',
      listingIds: withListingIds,
      isLowSample: withPrices.length < 10,
    };

    const withoutProvenance: Provenance = {
      ...provenanceBase,
      metricName: `Comps WITHOUT ${amenity.label}`,
      filterApplied: `${provenanceBase.filterApplied}; ${amenity.key} = 0`,
      rowCount: withoutPrices.length,
      formula: `Median nightly price of comps lacking ${amenity.label}`,
      method: 'Median of field',
      listingIds: withoutListingIds,
      isLowSample: withoutPrices.length < 10,
    };

    const provenance: Provenance = {
      ...provenanceBase,
      metricName: `Amenity Premium: ${amenity.label}`,
      filterApplied: `${provenanceBase.filterApplied}; split by ${amenity.key} (1 vs 0)`,
      rowCount: comps.length,
      formula: `Median price WITH (${withPrices.length > 0 ? '$' + Math.round(medWith) : 'n/a'}) − Median price WITHOUT (${withoutPrices.length > 0 ? '$' + Math.round(medWithout) : 'n/a'})`,
      method: 'Formula: Median(With) − Median(Without)',
      listingIds: comps.map((c) => c.id),
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
      withListingIds,
      withoutListingIds,
      withProvenance,
      withoutProvenance,
      provenance,
    };
  });
}

/**
 * Compute neighbourhood-level statistics for map shading and side-by-side comparison.
 * Matches current property profile criteria (bedrooms, room type, property style, accommodates range)
 */
export function computeNeighbourhoodStats(
  listings: Listing[],
  profile: PropertyProfile
): Record<string, NeighbourhoodStats> {
  const groups: Record<string, Listing[]> = {};
  for (const l of listings) {
    const hood = l.neighbourhood_cleansed;
    if (!hood) continue;
    if (!groups[hood]) groups[hood] = [];
    groups[hood].push(l);
  }

  const result: Record<string, NeighbourhoodStats> = {};
  const targetAptStyle = profile.propertyType === 'Condo' ? 1 : 0;

  for (const [hood, items] of Object.entries(groups)) {
    const totalListings = items.length;
    const entireCount = items.filter((i) => i.room_type === 'Entire home/apt').length;
    const licenseCount = items.filter((i) => Number(i.has_license) === 1).length;
    const superhostCount = items.filter(
      (i) => i.host_is_superhost === 't' || i.host_is_superhost === true
    ).length;

    // Matching profile subset in this neighbourhood
    const profileMatches = items.filter((i) => {
      const roomMatch = i.room_type === profile.roomType;
      const bedMatch = isValidNumber(i.bedrooms) && Number(i.bedrooms) === profile.bedrooms;
      const styleMatch = Number(i.is_apartment_style) === targetAptStyle;
      const acc = isValidNumber(i.accommodates) ? Number(i.accommodates) : 0;
      const accMatch = acc >= profile.accommodatesMin && acc <= profile.accommodatesMax;
      return roomMatch && bedMatch && styleMatch && accMatch;
    });

    const prices = profileMatches
      .filter((i) => isValidNumber(i.price))
      .map((i) => Number(i.price))
      .filter((p) => p > 0);

    const medianPrice = prices.length > 0 ? median(prices) : 0;

    const provenance: Provenance = {
      metricName: `Median Rate in ${hood}`,
      datasetFile: 'dc_listings_clean.csv',
      filterApplied: `neighbourhood = "${hood}", room_type = "${profile.roomType}", bedrooms = ${profile.bedrooms}, style = ${profile.propertyType}, accommodates = ${profile.accommodatesMin}–${profile.accommodatesMax}`,
      rowCount: prices.length,
      formula: 'Median of price across matching listings in neighbourhood',
      method: 'Median of field',
      listingIds: profileMatches.map((i) => i.id),
      isLowSample: prices.length < 10,
    };

    result[hood] = {
      neighbourhood: hood,
      totalListings,
      entireHomeShare: totalListings > 0 ? entireCount / totalListings : 0,
      licenseShare: totalListings > 0 ? licenseCount / totalListings : 0,
      superhostShare: totalListings > 0 ? superhostCount / totalListings : 0,
      medianPrice1BedEntire: Math.round(medianPrice * 100) / 100,
      listingCount1BedEntire: prices.length,
      provenance,
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
    method: 'Share = count ÷ total',
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

/**
 * Compute monthly seasonal price and demand trend for the selected comp set
 */
export function computeSeasonalPriceTrend(
  calendar: CalendarEntry[],
  comps: Listing[],
  provenanceBase: Provenance
): {
  trend: SeasonalPriceTrendPoint[];
  provenance: Provenance;
} {
  if (!calendar || calendar.length === 0 || !comps || comps.length === 0) {
    return {
      trend: [],
      provenance: {
        ...provenanceBase,
        metricName: 'Seasonal Price & Demand Trend',
        formula: 'No comp data available',
        method: 'Formula',
        rowCount: 0,
      },
    };
  }

  const compPriceMap = new Map<string, number>();
  comps.forEach((c) => {
    if (isValidNumber(c.price)) {
      const p = Number(c.price);
      if (p > 0) compPriceMap.set(String(c.id), p);
    }
  });

  const monthMap: Record<
    string,
    {
      totalUnavail: number;
      totalNights: number;
      weightedSum: number;
      bookedPrices: number[];
    }
  > = {};

  for (let i = 0; i < calendar.length; i++) {
    const row = calendar[i];
    const listingIdStr = String(row.listing_id);
    if (compPriceMap.has(listingIdStr)) {
      const m = row.month;
      if (!monthMap[m]) {
        monthMap[m] = {
          totalUnavail: 0,
          totalNights: 0,
          weightedSum: 0,
          bookedPrices: [],
        };
      }
      const price = compPriceMap.get(listingIdStr)!;
      const unavail = Number(row.unavailable_nights) || 0;
      const nights = Number(row.nights) || 0;

      monthMap[m].totalUnavail += unavail;
      monthMap[m].totalNights += nights;
      monthMap[m].weightedSum += price * unavail;
      if (unavail > 0) {
        monthMap[m].bookedPrices.push(price);
      }
    }
  }

  const sortedMonths = Object.keys(monthMap).sort().slice(0, 12);
  const trend: SeasonalPriceTrendPoint[] = sortedMonths.map((m) => {
    const d = monthMap[m];
    const medBooked = median(d.bookedPrices);
    const weightedAvg = d.totalUnavail > 0 ? d.weightedSum / d.totalUnavail : medBooked;
    const demandRate = d.totalNights > 0 ? (d.totalUnavail / d.totalNights) * 100 : 0;

    return {
      month: m,
      displayMonth: m,
      medianBookedPrice: Math.round(medBooked * 100) / 100,
      weightedAvgPrice: Math.round(weightedAvg * 100) / 100,
      demandRate: Math.round(demandRate * 10) / 10,
      bookedListingsCount: d.bookedPrices.length,
    };
  });

  const provenance: Provenance = {
    ...provenanceBase,
    metricName: 'Seasonal Price & Demand Trend',
    datasetFile: 'dc_calendar_monthly.csv + dc_listings_clean.csv',
    formula:
      'Monthly median nightly price of active comps with booked nights in each calendar month, alongside weighted average nightly rate (price × unavailable_nights ÷ total_unavailable_nights) and booking demand rate (unavailable %)',
    method: 'Median of booked prices & weighted average',
    rowCount: comps.length,
    listingIds: comps.map((c) => c.id),
  };

  return { trend, provenance };
}
