import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { NeighbourhoodStats } from '../types';
import { formatCurrency, formatPercent } from '../utils/math';
import { MapPin, Layers, X, Plus, Check, BarChart2 } from 'lucide-react';

interface NeighbourhoodExplorerProps {
  geoJson: any | null;
  neighbourhoodStats: Record<string, NeighbourhoodStats>;
  currentNeighbourhood: string;
  onSelectNeighbourhood: (neighbourhood: string) => void;
  isMapAvailable: boolean;
}

export const NeighbourhoodExplorer: React.FC<NeighbourhoodExplorerProps> = ({
  geoJson,
  neighbourhoodStats,
  currentNeighbourhood,
  onSelectNeighbourhood,
  isMapAvailable,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  // Side-by-side comparison (up to 3 neighbourhoods)
  const [comparedNeighbourhoods, setComparedNeighbourhoods] = useState<string[]>([
    currentNeighbourhood || 'Capitol Hill, Lincoln Park',
    'Dupont Circle, Connecticut Avenue/K Street',
    'Union Station, Stanton Park, Kingman Park',
  ]);

  const [activeTab, setActiveTab] = useState<'map' | 'ranked'>('map');

  // Sorted list of all neighbourhoods by median price
  const rankedNeighbourhoods = useMemo(() => {
    return Object.values(neighbourhoodStats).sort(
      (a, b) => b.medianPrice1BedEntire - a.medianPrice1BedEntire
    );
  }, [neighbourhoodStats]);

  // Color scale for choropleth map
  const getColor = (price: number) => {
    if (price <= 0) return '#E2E8F0';
    if (price < 140) return '#CCFBF1';
    if (price < 170) return '#99F6E4';
    if (price < 200) return '#5EEAD4';
    if (price < 230) return '#14B8A6';
    if (price < 260) return '#0F766E';
    return '#115E59';
  };

  useEffect(() => {
    if (!isMapAvailable || !geoJson || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // DC coordinates roughly: [38.9072, -77.0369]
    const map = L.map(mapContainerRef.current, {
      center: [38.9072, -77.02],
      zoom: 11.5,
      minZoom: 10,
      maxZoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    // Clean neutral basemap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

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
          fillOpacity: isSelected ? 0.85 : 0.65,
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
              Median 1-Bed Price: ${stat?.medianPrice1BedEntire ? formatCurrency(stat.medianPrice1BedEntire) : 'N/A'}/nt
            </p>
            <p style="margin: 2px 0 0 0; color: #475569;">
              Active 1-Bed Comps: <strong>${stat?.listingCount1BedEntire || 0}</strong> (Total: ${stat?.totalListings || 0})
            </p>
            <p style="margin: 2px 0 0 0; color: #475569;">
              Licensed Listings: <strong>${formatPercent(stat?.licenseShare || 0)}</strong>
            </p>
            <p style="margin: 4px 0 0 0; color: #0F766E; font-size: 10px; font-weight: 600;">
              👉 Click to load into Property Profile
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
            if (!comparedNeighbourhoods.includes(hoodName)) {
              setComparedNeighbourhoods((prev) => [hoodName, prev[0], prev[1]].slice(0, 3));
            }
          },
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 3,
              color: '#0F766E',
              fillOpacity: 0.85,
            });
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target);
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = geoLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isMapAvailable, geoJson, neighbourhoodStats, currentNeighbourhood, onSelectNeighbourhood]);

  const toggleCompare = (hood: string) => {
    if (comparedNeighbourhoods.includes(hood)) {
      if (comparedNeighbourhoods.length > 1) {
        setComparedNeighbourhoods((prev) => prev.filter((h) => h !== hood));
      }
    } else {
      setComparedNeighbourhoods((prev) => [...prev.slice(-2), hood]);
    }
  };

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
            Compare median 1-bedroom rates, licensing rates, and listing density across all 39 DC neighbourhoods.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            disabled={!isMapAvailable}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
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

      {/* Map or Ranked Fallback */}
      {isMapAvailable && activeTab === 'map' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-700" />
              <span className="text-xs font-semibold text-slate-700">
                Median 1-Bed Entire-Home Nightly Rate
              </span>
            </div>

            {/* Choropleth Legend */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
              <span>&lt;$140</span>
              <div className="flex items-center h-2.5 rounded overflow-hidden">
                <span className="w-5 h-full bg-[#CCFBF1]" />
                <span className="w-5 h-full bg-[#99F6E4]" />
                <span className="w-5 h-full bg-[#5EEAD4]" />
                <span className="w-5 h-full bg-[#14B8A6]" />
                <span className="w-5 h-full bg-[#0F766E]" />
                <span className="w-5 h-full bg-[#115E59]" />
              </div>
              <span>&gt;$260</span>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            className="w-full h-[450px] relative z-10"
            style={{ background: '#F8FAFC' }}
          />

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Selected in profile: <strong className="text-slate-900">{currentNeighbourhood}</strong>
            </span>
            <span className="text-[11px]">Click any zone to switch property profile location</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              All 39 DC Neighbourhoods Ranked by 1-Bed Price
            </h3>
            <span className="text-xs text-slate-500">
              Click "Load" to switch your Property Profile
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

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-slate-900">
                    {n.medianPrice1BedEntire > 0
                      ? `${formatCurrency(n.medianPrice1BedEntire)}/nt`
                      : 'N/A'}
                  </span>
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

      {/* Side-by-side comparison (up to 3 neighbourhoods) */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Side-by-Side Neighbourhood Benchmark (Up to 3)
            </h3>
            <p className="text-xs text-slate-500">
              Compare local market fundamentals to evaluate expansion or cross-listing opportunities
            </p>
          </div>

          <span className="text-xs font-mono text-slate-400">
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
                  {comparedNeighbourhoods.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleCompare(hoodName)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="Remove from comparison"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Median 1-Bed Price:</span>
                    <span className="font-bold font-mono text-slate-900">
                      {stats ? formatCurrency(stats.medianPrice1BedEntire) : 'N/A'}/nt
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">1-Bed Entire Comps:</span>
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
                    className="w-full mt-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-teal-700 hover:text-white rounded-lg transition-colors"
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
