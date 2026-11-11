import React, { useMemo, useState } from 'react';
import { PropertyProfile } from '../types';
import {
  Home,
  Building2,
  Users,
  Bed,
  Bath,
  DollarSign,
  Sparkles,
  Check,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

interface PropertyProfileCardProps {
  profile: PropertyProfile;
  onChange: (profile: PropertyProfile) => void;
  neighbourhoods: string[];
  onLoadSample: () => void;
  onNextStep?: () => void;
}

export const PropertyProfileCard: React.FC<PropertyProfileCardProps> = ({
  profile,
  onChange,
  neighbourhoods,
  onLoadSample,
  onNextStep,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredNeighbourhoods = useMemo(() => {
    if (!searchQuery) return neighbourhoods;
    return neighbourhoods.filter((n) =>
      n.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [neighbourhoods, searchQuery]);

  const updateField = <K extends keyof PropertyProfile>(
    field: K,
    value: PropertyProfile[K]
  ) => {
    onChange({ ...profile, [field]: value });
  };

  const updateAmenity = (
    amenityKey: keyof PropertyProfile['amenities'],
    checked: boolean
  ) => {
    onChange({
      ...profile,
      amenities: {
        ...profile.amenities,
        [amenityKey]: checked,
      },
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 md:p-8 space-y-8">
      {/* Top Banner with Load Sample */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
            Step 1 · Property Characteristics
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Define your DC property
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instant comparable matching using Inside Airbnb data (scrape 2026-09-20)
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          <span>Load sample case (Capitol Hill 1-bed condo)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Neighbourhood Selector */}
        <div className="space-y-2 relative">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Neighbourhood cleansed
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full text-left px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 flex items-center justify-between hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700"
            >
              <span className="truncate">{profile.neighbourhood}</span>
              <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Search 39 DC neighbourhoods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg mb-2 focus:outline-hidden focus:ring-1 focus:ring-teal-700"
                  autoFocus
                />
                <div className="space-y-0.5">
                  {filteredNeighbourhoods.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        updateField('neighbourhood', n);
                        setIsDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                        profile.neighbourhood === n
                          ? 'bg-teal-50 text-teal-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{n}</span>
                      {profile.neighbourhood === n && (
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                      )}
                    </button>
                  ))}
                  {filteredNeighbourhoods.length === 0 && (
                    <p className="text-xs text-slate-400 py-2 text-center">
                      No matching neighbourhood found
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Selected neighbourhood sets the local geographic comp boundaries.
          </p>
        </div>

        {/* 2. Property Type (Condo vs House) */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Property Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateField('propertyType', 'Condo')}
              className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                profile.propertyType === 'Condo'
                  ? 'border-teal-700 bg-teal-50/60 text-teal-950 font-semibold ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <Building2 className="w-5 h-5 text-teal-700 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Condo / Apartment</p>
                <p className="text-[10px] text-slate-500">is_apartment_style = 1</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateField('propertyType', 'House')}
              className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                profile.propertyType === 'House'
                  ? 'border-teal-700 bg-teal-50/60 text-teal-950 font-semibold ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <Home className="w-5 h-5 text-teal-700 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Single Family / Rowhouse</p>
                <p className="text-[10px] text-slate-500">is_apartment_style = 0</p>
              </div>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Condo clients receive apartment-style comps; townhouse/house clients receive non-apartment comps.
          </p>
        </div>

        {/* 3. Stepper controls: Bedrooms, Bathrooms, Guests */}
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Capacity & Layout
          </label>

          <div className="grid grid-cols-3 gap-3">
            {/* Bedrooms */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Bedrooms
              </span>
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => updateField('bedrooms', Math.max(0, profile.bedrooms - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Decrease bedrooms"
                >
                  -
                </button>
                <span className="text-base font-bold font-mono text-slate-900">
                  {profile.bedrooms}
                </span>
                <button
                  type="button"
                  onClick={() => updateField('bedrooms', Math.min(6, profile.bedrooms + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Increase bedrooms"
                >
                  +
                </button>
              </div>
            </div>

            {/* Bathrooms */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Baths
              </span>
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => updateField('bathrooms', Math.max(1, profile.bathrooms - 0.5))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Decrease bathrooms"
                >
                  -
                </button>
                <span className="text-base font-bold font-mono text-slate-900">
                  {profile.bathrooms}
                </span>
                <button
                  type="button"
                  onClick={() => updateField('bathrooms', Math.min(5, profile.bathrooms + 0.5))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Increase bathrooms"
                >
                  +
                </button>
              </div>
            </div>

            {/* Guests Capacity */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Sleeps
              </span>
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMin = Math.max(1, profile.accommodatesMin - 1);
                    onChange({
                      ...profile,
                      accommodatesMin: nextMin,
                      accommodatesMax: Math.max(nextMin, profile.accommodatesMax - 1),
                    });
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Decrease guests"
                >
                  -
                </button>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {profile.accommodatesMin}–{profile.accommodatesMax}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...profile,
                      accommodatesMax: Math.min(10, profile.accommodatesMax + 1),
                    });
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                  aria-label="Increase guests"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Optional Owner Monthly Carrying Cost */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Monthly Carrying Cost (Optional)
            </label>
            <span className="text-[11px] text-teal-800 font-medium bg-teal-50 px-2 py-0.5 rounded">
              owner input
            </span>
          </div>

          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="number"
              min="0"
              step="50"
              placeholder="e.g. 2400 (mortgage + HOA + taxes + utilities)"
              value={profile.monthlyCarryingCost || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                updateField('monthlyCarryingCost', isNaN(val) ? undefined : val);
              }}
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Used on Step 3 to calculate break-even nightly price and months-to-cover schedule.
          </p>
        </div>
      </div>

      {/* 5. Key Amenities Checkboxes */}
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Key Amenities Present
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { key: 'has_washer', label: 'In-Unit Washer / Dryer' },
            { key: 'has_free_parking', label: 'Free Parking' },
            { key: 'has_workspace', label: 'Dedicated Workspace' },
            { key: 'has_self_checkin', label: 'Self Check-in (Keypad)' },
            { key: 'has_gym', label: 'Gym / Fitness Center' },
            { key: 'has_pool', label: 'Swimming Pool' },
          ].map((item) => {
            const isChecked = profile.amenities[item.key as keyof PropertyProfile['amenities']];
            return (
              <label
                key={item.key}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 text-xs ${
                  isChecked
                    ? 'border-teal-700 bg-teal-50/50 text-teal-950 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    updateAmenity(
                      item.key as keyof PropertyProfile['amenities'],
                      e.target.checked
                    )
                  }
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600 w-4 h-4"
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Next Step Action */}
      {onNextStep && (
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Comps and pricing recalculate dynamically with every change.
          </p>
          <button
            type="button"
            onClick={onNextStep}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
          >
            Continue to Step 2: Your Price →
          </button>
        </div>
      )}
    </div>
  );
};
