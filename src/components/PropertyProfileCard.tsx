import React, { useMemo, useState } from 'react';
import { PropertyProfile } from '../types';
import {
  Home,
  Building2,
  Check,
  Search,
  DollarSign,
  Sparkles,
  AlertCircle,
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
  const [costError, setCostError] = useState<string | null>(null);

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

  const handleCostChange = (rawVal: string) => {
    if (rawVal === '') {
      setCostError(null);
      updateField('monthlyCarryingCost', undefined);
      return;
    }

    const parsed = parseFloat(rawVal);
    if (isNaN(parsed) || parsed < 0 || parsed > 50000) {
      setCostError('Monthly carrying cost must be between $0 and $50,000.');
    } else {
      setCostError(null);
      updateField('monthlyCarryingCost', Math.max(0, Math.min(50000, parsed)));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-8 space-y-6 sm:space-y-8">
      {/* Top Banner with Load Sample */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">
            Step 1 · Property Characteristics
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
            Define your DC property
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instant comparable matching using Inside Airbnb data (scrape 2026-09-20)
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors shrink-0 min-h-[44px]"
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
              className="w-full text-left px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 flex items-center justify-between hover:border-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700 min-h-[44px]"
            >
              <span className="truncate">{profile.neighbourhood}</span>
              <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto">
                <input
                  type="text"
                  placeholder={`Search ${neighbourhoods.length} DC neighbourhoods...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg mb-2 focus:outline-hidden focus:ring-1 focus:ring-teal-700 min-h-[36px]"
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
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between min-h-[38px] ${
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
              className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 min-h-[44px] ${
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
              className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 min-h-[44px] ${
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

        {/* 3. Capacity & Layout: Bedrooms, Bathrooms, Separate Min & Max Guest Steppers */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Capacity & Layout
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Bedrooms (0 = Studio) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Bedrooms
              </span>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => updateField('bedrooms', Math.max(0, profile.bedrooms - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold min-h-[32px] min-w-[32px]"
                  aria-label="Decrease bedrooms"
                >
                  −
                </button>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {profile.bedrooms === 0 ? 'Studio' : `${profile.bedrooms} bed`}
                </span>
                <button
                  type="button"
                  onClick={() => updateField('bedrooms', Math.min(6, profile.bedrooms + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold min-h-[32px] min-w-[32px]"
                  aria-label="Increase bedrooms"
                >
                  +
                </button>
              </div>
            </div>

            {/* Bathrooms (for reference, not used in matching) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Baths (reference)
              </span>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => updateField('bathrooms', Math.max(0.5, profile.bathrooms - 0.5))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold min-h-[32px] min-w-[32px]"
                  aria-label="Decrease bathrooms"
                >
                  −
                </button>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {profile.bathrooms}
                </span>
                <button
                  type="button"
                  onClick={() => updateField('bathrooms', Math.min(6, profile.bathrooms + 0.5))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold min-h-[32px] min-w-[32px]"
                  aria-label="Increase bathrooms"
                >
                  +
                </button>
              </div>
            </div>

            {/* Min Guests Stepper (1-16, min <= max) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Min Guests
              </span>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextMin = Math.max(1, profile.accommodatesMin - 1);
                    updateField('accommodatesMin', nextMin);
                  }}
                  disabled={profile.accommodatesMin <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-40 min-h-[32px] min-w-[32px]"
                  aria-label="Decrease minimum guests"
                >
                  −
                </button>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {profile.accommodatesMin}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextMin = Math.min(profile.accommodatesMax, profile.accommodatesMin + 1);
                    updateField('accommodatesMin', nextMin);
                  }}
                  disabled={profile.accommodatesMin >= profile.accommodatesMax}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-40 min-h-[32px] min-w-[32px]"
                  aria-label="Increase minimum guests"
                >
                  +
                </button>
              </div>
            </div>

            {/* Max Guests Stepper (1-16, min <= max) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                Max Guests
              </span>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextMax = Math.max(profile.accommodatesMin, profile.accommodatesMax - 1);
                    updateField('accommodatesMax', nextMax);
                  }}
                  disabled={profile.accommodatesMax <= profile.accommodatesMin}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-40 min-h-[32px] min-w-[32px]"
                  aria-label="Decrease maximum guests"
                >
                  −
                </button>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {profile.accommodatesMax}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextMax = Math.min(16, profile.accommodatesMax + 1);
                    updateField('accommodatesMax', nextMax);
                  }}
                  disabled={profile.accommodatesMax >= 16}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold disabled:opacity-40 min-h-[32px] min-w-[32px]"
                  aria-label="Increase maximum guests"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Baths are for reference (not used in matching). Guest capacity matches listings sleeping between {profile.accommodatesMin} and {profile.accommodatesMax} guests.
          </p>
        </div>

        {/* 4. Optional Owner Monthly Carrying Cost (Clamped 0-50,000 with inline validation) */}
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
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="number"
              min="0"
              max="50000"
              step="50"
              placeholder="e.g. 2400 (mortgage + HOA + taxes + utilities)"
              value={profile.monthlyCarryingCost !== undefined ? profile.monthlyCarryingCost : ''}
              onChange={(e) => handleCostChange(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700 min-h-[44px]"
            />
          </div>
          {costError ? (
            <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{costError}</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Clamped between $0 and $50,000. Used on Step 3 to calculate break-even nightly price and months-to-cover schedule.
            </p>
          )}
        </div>
      </div>

      {/* 5. Key Amenities Checkboxes */}
      <div className="space-y-3 pt-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Key Amenities Present
          </label>
          <p className="text-xs text-slate-500 mt-0.5">
            Amenities highlight premiums; they don't change the comp set.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
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
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 text-xs min-h-[44px] ${
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
            className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors min-h-[44px]"
          >
            Continue to Step 2: Your Price →
          </button>
        </div>
      )}
    </div>
  );
};
