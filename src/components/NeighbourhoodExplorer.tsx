import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { NeighbourhoodStats, PropertyProfile, Provenance } from '../types';
import { formatCurrency, formatPercent } from '../utils/math';
import { ProvenanceButton } from './ProvenanceModal';
import { MapPin, Layers, X, Plus, BarChart2 } from 'lucide-react';

interface NeighbourhoodExplorerProps {
  geoJson: any | null;
  neighbourhoodStats: Record<string, NeighbourhoodStats>;
  currentNeighbourhood: string;
  profile: PropertyProfile;
  comparedNeighbourhoods: string[];
  onToggleCompare: (neighbourhood: string) => void;
  onSelectNeighbourhood: (neighbourhood: string) => void;
  onOpenProvenance: (p: Provenance) => void;
  isMapAvailable: boolean;
}

export const NeighbourhoodExplorer: React.FC<NeighbourhoodExplorerProps> = ({
  geoJson,
  neighbourhoodStats,
  currentNeighbourhood,
  profile,
  comparedNeighbourhoods,
  onToggleCompare,
  onSelectNeighbourhood,
  onOpenProvenance,
  isMapAvailable,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  const [activeTab, setActiveTab] = useState<'map' | 'ranked'>('map');

  // Sorted list of all neighbourhoods by median price
  const rankedNeighbourhoods = useMemo(() => {
    return Object.values(neighbourhoodStats).sort(
      (a, b) => b.medianPrice1BedEntire - a.medianPrice1BedEntire
    );
  }, [neighbourhoodStats]);

  // Compute 5 data quintiles from valid positive medians
  const quintiles = useMemo(() => {
    const validPrices = rankedNeighbourhoods
      .map((n) => n.medianPrice1BedEntire)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    if (validPrices.length === 0) {
      return [120, 160, 200, 240, 280];
    }

    const q = (p: number) => {
      const idx = Math.min(
        validPrices.length - 1,
        Math.max(0, Math.floor(p * (validPrices.length - 1)))
      );
      return Math.round(validPrices[idx]);
    };

    return [q(0.2), q(0.4), q(0.6), q(0.8), q(1.0)];
  }, [rankedNeighbourhoods]);

  // Color scale for choropleth map using quintiles
  const getColor = useCallback((price: number) => {
    if (price <= 0) return '#E2E8F0'; // grey: no listings
    if (price <= quintiles[0]) return '#CCFBF1';
    if (price <= quintiles[1]) return '#99F6E4';
    if (price <= quintiles[2]) return '#5EEAD4';
    if (price <= quintiles[3]) return '#14B8A6';
    if (price <= quintiles[4]) return '#0F766E';
    return '#115E59';
  }, [quintiles]);

  const bedLabel = profile.bedrooms === 0 ? 'Studio' : `${profile.bedrooms}-bed`;
  const legendTitle = `Median price, ${bedLabel} ${profile.propertyType}, sleeps ${profile.accommodatesMin}–${profile.accommodatesMax}`;

  // Initialize Map Once
  useEffect(() => {
    if (!isMapAvailable || !mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [38.9072, -77.02],
      zoom: 11.5,
      minZoom: 10,
      maxZoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      geoJsonLayerRef.current = null;
    };
  }, [isMapAvailable]);

  // Handle GeoJSON Layer & Updates without recreating the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geoJson) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    const geoLayer = L.geoJSON(geoJson, {
      style: (feature) => {
        const hoodName =
          feature?.properties?.neighbourhood ||
          feature?.properties?.neighbourhood_cleansed ||
          '';
        const stat = neighbourhoodStats[hoodName];
        const isSelected = hoodName === currentNeighbourhood;
        return {
          fillColor: getColor(stat?.medianPrice1BedEntire || 0),
          weight: isSelected ? 3 : 1.2,
          opacity: 1,
          color: isSelected ? '#0F766E' : '#64748B',
          dashArray: isSelected ? '' : '2',
          fillOpacity: isSelected ? 0.9 : 0.65,
        };
      },
      onEachFeature: (feature, layer) => {
        const hoodName =
          feature?.properties?.neighbourhood ||
          feature?.properties?.neighbourhood_cleansed ||
          '';
        const stat = neighbourhoodStats[hoodName];

        const tooltipContent = `
          <div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <p style="font-weight: 700; color: #0F172A; margin: 0 0 4px 0;">${hoodName}</p>
            <p style="margin: 0; color: #0F766E; font-weight: 600;">
              Median Rate: ${stat?.medianPrice1BedEntire ? formatCurrency(stat.medianPrice1BedEntire) : 'N/A'}/nt
            </p>
            <p style="margin: 2px 0 0 0; color: #475569;">
              Active Comps: <strong>${stat?.listingCount1BedEntire || 0}</strong> (Total: ${stat?.totalListings || 0})
            </p>
            <p style="margin: 2px 0 0 0; color: #475569;">
              Licensed: <strong>${formatPercent(stat?.licenseShare || 0)}</strong>
            </p>
            <p style="margin: 4px 0 0 0; color: #0F766E; font-size: 10px; font-weight: 600;">
              👉 Click to select as Property Profile
            </p>
          </div>
        `;

        layer.bindTooltip(tooltipContent, {
          sticky: true,
          direction: 'auto',
          className: 'custom-leaflet-tooltip',
        });

        layer.on({
          click: () => {
            onSelectNeighbourhood(hoodName);
          },
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 3,
              color: '#0F766E',
              fillOpacity: 0.9,
            });
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target);
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = geoLayer;
  }, [geoJson, neighbourhoodStats, currentNeighbourhood, getColor, onSelectNeighbourhood]);

  // Provenance builder for a neighbourhood
  const getHoodProvenance = (stat: NeighbourhoodStats): Provenance => ({
    metricName: `Median Rate (${bedLabel} ${profile.propertyType})`,
    datasetFile: 'dc_listings_clean.csv',
    filterApplied: `neighbourhood = ${stat.neighbourhood}, room_type = Entire home/apt, bedrooms = ${profile.bedrooms}`,
    rowCount: stat.listingCount1BedEntire,
    formula: 'median(price) across matching profile criteria',
    listingIds: [],
    method: 'Linear interpolation (PERCENTILE.INC p=0.50) on profile-matched neighbourhood subset',
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-teal-800 font-semibold block">
            Market Intelligence
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            DC Neighbourhood Explorer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare median {bedLabel} rates, licensing rates, and listing density across DC neighbourhoods.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            disabled={!isMapAvailable}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 min-h-[44px] ${
              activeTab === 'map' && isMapAvailable
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Choropleth Map</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ranked')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 min-h-[44px] ${
              activeTab === 'ranked' || !isMapAvailable
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Ranked Table</span>
          </button>
        </div>
      </div>

      {/* Map or Ranked View */}
      {isMapAvailable && activeTab === 'map' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-700" />
              <span className="text-xs font-semibold text-slate-800">
                {legendTitle}
              </span>
            </div>

            {/* Choropleth Legend visible on mobile and desktop */}
            <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-xs bg-[#E2E8F0] border border-slate-300" />
                <span>No listings</span>
              </div>
              <div className="flex items-center h-3 rounded overflow-hidden border border-slate-200">
                <span className="px-1.5 h-full bg-[#CCFBF1] text-[9px] text-teal-950 flex items-center">
                  ≤${quintiles[0]}
                </span>
                <span className="px-1.5 h-full bg-[#99F6E4] text-[9px] text-teal-950 flex items-center">
                  ≤${quintiles[1]}
                </span>
                <span className="px-1.5 h-full bg-[#5EEAD4] text-[9px] text-teal-950 flex items-center">
                  ≤${quintiles[2]}
                </span>
                <span className="px-1.5 h-full bg-[#14B8A6] text-[9px] text-white flex items-center">
                  ≤${quintiles[3]}
                </span>
                <span className="px-1.5 h-full bg-[#0F766E] text-[9px] text-white flex items-center">
                  &gt;${quintiles[3]}
                </span>
              </div>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-[450px] relative z-10"
            style={{ background: '#F8FAFC' }}
          />

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Active profile: <strong className="text-slate-900">{currentNeighbourhood}</strong>
            </span>
            <span className="text-[11px]">Click zone to select · use Benchmark section below to compare</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Ranked Neighbourhoods ({rankedNeighbourhoods.length})
            </h3>
            <span className="text-xs text-slate-500">
              Click "Select" to switch Property Profile or "+ Compare"
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
            {rankedNeighbourhoods.map((n, idx) => (
              <div
                key={n.neighbourhood}
                className={`p-3 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  n.neighbourhood === currentNeighbourhood ? 'bg-teal-50/60 font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 font-mono text-slate-400 text-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-slate-900 font-medium">{n.neighbourhood}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {n.listingCount1BedEntire} comps · {formatPercent(n.licenseShare)} licensed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 mr-2">
                    {n.medianPrice1BedEntire > 0
                      ? `${formatCurrency(n.medianPrice1BedEntire)}/nt`
                      : 'N/A'}
                  </span>
                  <ProvenanceButton
                    provenance={getHoodProvenance(n)}
                    onClick={onOpenProvenance}
                  />
                  <button
                    type="button"
                    onClick={() => onToggleCompare(n.neighbourhood)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors border ${
                      comparedNeighbourhoods.includes(n.neighbourhood)
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {comparedNeighbourhoods.includes(n.neighbourhood) ? 'Comparing' : '+ Compare'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectNeighbourhood(n.neighbourhood)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-teal-700 hover:text-white rounded-lg transition-colors"
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Neighbourhood Benchmark */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Side-by-Side Neighbourhood Benchmark (Up to 3)
            </h3>
            <p className="text-xs text-slate-500">
              Compare local market fundamentals for {bedLabel} {profile.propertyType} properties
            </p>
          </div>

          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
            {comparedNeighbourhoods.length} of 3 selected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparedNeighbourhoods.map((hoodName) => {
            const stats = neighbourhoodStats[hoodName];
            const isCurrent = hoodName === currentNeighbourhood;
            return (
              <div
                key={hoodName}
                className={`p-4 rounded-xl border relative transition-all ${
                  isCurrent
                    ? 'border-teal-700 bg-teal-50/40 shadow-xs'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="pr-6">
                    {isCurrent && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded">
                        Active Profile
                      </span>
                    )}
                    <h4 className="font-bold text-slate-900 text-sm mt-1">
                      {hoodName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1">
                    {stats && (
                      <ProvenanceButton
                        provenance={getHoodProvenance(stats)}
                        onClick={onOpenProvenance}
                      />
                    )}
                    {comparedNeighbourhoods.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onToggleCompare(hoodName)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        aria-label="Remove from comparison"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Median Rate:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {stats && stats.medianPrice1BedEntire > 0
                        ? `${formatCurrency(stats.medianPrice1BedEntire)}/nt`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Similar Comps:</span>
                    <span className="font-mono text-slate-800">
                      {stats?.listingCount1BedEntire || 0} listings
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Total Active Listings:</span>
                    <span className="font-mono text-slate-800">
                      {stats?.totalListings || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Licensed Share:</span>
                    <span className="font-mono font-semibold text-teal-700">
                      {formatPercent(stats?.licenseShare || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Superhost Share:</span>
                    <span className="font-mono text-slate-800">
                      {formatPercent(stats?.superhostShare || 0)}
                    </span>
                  </div>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => onSelectNeighbourhood(hoodName)}
                    className="w-full mt-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-teal-700 hover:text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    Load into Property Profile
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
