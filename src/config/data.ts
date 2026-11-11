export const DATA_BASE = "https://raw.githubusercontent.com/Tirush04/dc-str-advisor-data/main/";
export const LISTINGS = DATA_BASE + "dc_listings_clean.csv";
export const CALENDAR = DATA_BASE + "dc_calendar_monthly.csv";
export const MAP = DATA_BASE + "dc_neighbourhoods.json";
export const LOG = DATA_BASE + "cleaning_log.md";
export const MIRROR = "https://cdn.jsdelivr.net/gh/Tirush04/dc-str-advisor-data@main/";

export const ORIGINAL_MAP = "https://data.insideairbnb.com/united-states/dc/washington-dc/2026-09-19/visualisations/neighbourhoods.geojson";

export const LOCAL_DATA = {
  LISTINGS: "/data/dc_listings_clean.csv",
  CALENDAR: "/data/dc_calendar_monthly.csv",
  MAP: "/data/dc_neighbourhoods.json",
  LOG: "/data/cleaning_log.md",
};

export const EXPECTED_LISTING_COLUMNS = [
  "id",
  "neighbourhood_cleansed",
  "latitude",
  "longitude",
  "property_type",
  "room_type",
  "accommodates",
  "bedrooms",
  "beds",
  "bathrooms",
  "bathrooms_text",
  "minimum_nights",
  "availability_365",
  "number_of_reviews",
  "number_of_reviews_ltm",
  "reviews_per_month",
  "review_scores_rating",
  "estimated_occupancy_l365d",
  "estimated_revenue_l365d",
  "instant_bookable",
  "host_is_superhost",
  "last_scraped",
  "price",
  "has_license",
  "has_washer",
  "has_free_parking",
  "has_workspace",
  "has_pool",
  "has_gym",
  "has_self_checkin",
  "amenity_count",
  "is_apartment_style",
];

export const OFFICIAL_DLCP_URL = "https://dlcp.dc.gov/shorttermrental";
export const INSIDE_AIRBNB_DATA_URL = "https://insideairbnb.com/get-the-data/";
