# Cleaning log: Inside Airbnb Washington, DC

Source: https://insideairbnb.com/get-the-data/ (scrape 2026-09-20), CC BY 4.0

| Step | Rows remaining |
|---|---|
| Raw listings loaded | 6906 |
| Drop rows with blank price | 5993 |
| Drop price < $20 | 5993 |
| Drop price > 99th percentile ($1,448.81) | 5933 |
| Drop inactive (0 reviews in last 12 months) | 4268 |

Columns kept: 32 → id, neighbourhood_cleansed, latitude, longitude, property_type, room_type, accommodates, bedrooms, beds, bathrooms, bathrooms_text, minimum_nights, availability_365, number_of_reviews, number_of_reviews_ltm, reviews_per_month, review_scores_rating, estimated_occupancy_l365d, estimated_revenue_l365d, instant_bookable, host_is_superhost, last_scraped, price, has_license, has_washer, has_free_parking, has_workspace, has_pool, has_gym, has_self_checkin, amenity_count, is_apartment_style

Personal / free-text columns removed: host_id, host_url, host_profile_id, host_profile_url, host_name, host_location, host_about, host_thumbnail_url, host_picture_url, host_neighbourhood, listing_url, picture_url, name, description, neighborhood_overview

All other columns removed (65 total dropped): listing_url, scrape_id, source, name, description, neighborhood_overview, picture_url, host_id, host_url, host_profile_id, host_profile_url, host_name, host_since, hosts_time_as_user_years, hosts_time_as_user_months, hosts_time_as_host_years, hosts_time_as_host_months, host_location, host_about, host_response_time, host_response_rate, host_acceptance_rate, host_thumbnail_url, host_picture_url, host_neighbourhood, host_listings_count, host_total_listings_count, host_verifications, host_has_profile_pic, host_identity_verified, neighbourhood, neighbourhood_group_cleansed, price_quote_checkin_date, price_quote_checkout_date, price_quote_total_price, price_quote_price_per_night, price_quote_raw, maximum_nights, minimum_minimum_nights, maximum_minimum_nights, minimum_maximum_nights, maximum_maximum_nights, minimum_nights_avg_ntm, maximum_nights_avg_ntm, calendar_updated, has_availability, availability_30, availability_60, availability_90, calendar_last_scraped, number_of_reviews_l30d, availability_eoy, number_of_reviews_ly, first_review, last_review, review_scores_accuracy, review_scores_cleanliness, review_scores_checkin, review_scores_communication, review_scores_location, review_scores_value, calculated_host_listings_count, calculated_host_listings_count_entire_homes, calculated_host_listings_count_private_rooms, calculated_host_listings_count_shared_rooms

Transformations: price '$1,234.00' → number; licence number → has_license 0/1; lat/long rounded to 3 decimals; amenities JSON → pipe list + 6 flags; is_apartment_style = Entire condo / rental unit / serviced apartment.

Calendar: 2,520,690 daily rows → 55,484 listing-month rows (kept listings in the clean file only). The calendar has no price column; 'unavailable' = booked OR blocked by the host.

## Sample case: 1-bed apartment-style entire home, sleeps 2-4, Capitol Hill, Lincoln Park

Percentiles use PERCENTILE.INC (linear interpolation).

- comps_n: 151
- P25: 158.03
- P40_launch: 189.50
- median_market: 208.67
- P75: 246.69
- P75_top_rated_premium: 260.39
- top_rated_n: 106
- median_est_occupancy_nights: 162.00
- est_annual_revenue: 33,804.54

## Map file
neighbourhoods.geojson (365 KB, 39 polygons) simplified to dc_neighbourhoods.json (25 KB): Douglas-Peucker tolerance 0.0002 deg (~20 m), coordinates rounded to 4 decimals, properties reduced to `neighbourhood`. All 34 listing neighbourhoods match a polygon. Script: scripts/simplify_geojson.py
