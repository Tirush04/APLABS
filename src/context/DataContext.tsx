import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import {
  LISTINGS,
  CALENDAR,
  MAP,
  LOG,
  MIRROR,
  ORIGINAL_MAP,
  LOCAL_DATA,
  EXPECTED_LISTING_COLUMNS,
} from '../config/data';
import { Listing, CalendarEntry, AIGuardLogEntry } from '../types';

interface DataContextType {
  listings: Listing[];
  calendar: CalendarEntry[];
  geoJson: any | null;
  cleaningLog: string;
  isLoading: boolean;
  error: string | null;
  loadSource: string;
  detectedSource: 'GitHub' | 'jsDelivr' | 'Local' | 'User Upload';
  scrapeDate: string;
  isMapAvailable: boolean;
  aiGuardLogs: AIGuardLogEntry[];
  addAIGuardLog: (entry: Omit<AIGuardLogEntry, 'id' | 'timestamp'>) => void;
  retryLoad: () => void;
  uploadCustomListings: (file: File) => Promise<{ success: boolean; message: string }>;
  downloadCleanedCsv: () => void;
  downloadCompsCsv: (comps: Listing[]) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [geoJson, setGeoJson] = useState<any | null>(null);
  const [cleaningLog, setCleaningLog] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<string>('primary');
  const [detectedSource, setDetectedSource] = useState<'GitHub' | 'jsDelivr' | 'Local' | 'User Upload'>('Local');
  const [isMapAvailable, setIsMapAvailable] = useState<boolean>(true);
  const [aiGuardLogs, setAiGuardLogs] = useState<AIGuardLogEntry[]>([]);

  const addAIGuardLog = useCallback((entry: Omit<AIGuardLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AIGuardLogEntry = {
      ...entry,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
    };
    setAiGuardLogs((prev) => [newEntry, ...prev]);
  }, []);

  const fetchWithFallback = async (
    primaryUrl: string,
    mirrorUrl: string,
    localUrl: string
  ): Promise<{ text: string; source: 'GitHub' | 'jsDelivr' | 'Local' }> => {
    try {
      const res = await fetch(primaryUrl);
      if (res.ok) {
        const text = await res.text();
        return { text, source: 'GitHub' };
      }
    } catch {}

    try {
      const res = await fetch(mirrorUrl);
      if (res.ok) {
        const text = await res.text();
        return { text, source: 'jsDelivr' };
      }
    } catch {}

    const res = await fetch(localUrl);
    if (!res.ok) throw new Error(`Could not load data file from any source: ${primaryUrl}`);
    const text = await res.text();
    return { text, source: 'Local' };
  };

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all four data files concurrently with Promise.all
      const [listingsRes, calendarRes, logRes, mapRes] = await Promise.all([
        fetchWithFallback(LISTINGS, `${MIRROR}dc_listings_clean.csv`, LOCAL_DATA.LISTINGS),
        fetchWithFallback(CALENDAR, `${MIRROR}dc_calendar_monthly.csv`, LOCAL_DATA.CALENDAR),
        fetchWithFallback(LOG, `${MIRROR}cleaning_log.md`, LOCAL_DATA.LOG).catch(() => ({
          text: '# Data Cleaning Log\n\nCleaned dataset from Inside Airbnb, Washington DC, scraped 2026-09-20.',
          source: 'Local' as const,
        })),
        fetchWithFallback(MAP, `${MIRROR}dc_neighbourhoods.json`, LOCAL_DATA.MAP).catch(() => null),
      ]);

      setDetectedSource(listingsRes.source);
      setLoadSource(`${listingsRes.source} Source (scraped 2026-09-20)`);

      // Parse Listings CSV
      const parsedListings = await new Promise<Listing[]>((resolve, reject) => {
        Papa.parse(listingsRes.text, {
          header: true,
          dynamicTyping: (field) => field !== 'id' && field !== 'listing_id',
          skipEmptyLines: true,
          complete: (results) => {
            const cleanData = (results.data as any[])
              .filter((r) => r.id && r.neighbourhood_cleansed)
              .map((r) => ({ ...r, id: String(r.id) }));
            resolve(cleanData as Listing[]);
          },
          error: (err: any) => reject(err),
        });
      });

      // Parse Calendar CSV
      const parsedCalendar = await new Promise<CalendarEntry[]>((resolve, reject) => {
        Papa.parse(calendarRes.text, {
          header: true,
          dynamicTyping: (field) => field !== 'id' && field !== 'listing_id',
          skipEmptyLines: true,
          complete: (results) => {
            const cleanCal = (results.data as any[]).map((r) => ({
              ...r,
              listing_id: String(r.listing_id),
            }));
            resolve(cleanCal as CalendarEntry[]);
          },
          error: (err: any) => reject(err),
        });
      });

      // GeoJSON Map
      let geoData: any = null;
      if (mapRes && mapRes.text) {
        try {
          geoData = JSON.parse(mapRes.text);
        } catch {}
      }

      if (!geoData) {
        try {
          const res = await fetch(ORIGINAL_MAP);
          if (res.ok) geoData = await res.json();
        } catch {
          console.warn('Map GeoJSON unavailable, falling back to ranked bar chart.');
          setIsMapAvailable(false);
        }
      }

      setListings(parsedListings);
      setCalendar(parsedCalendar);
      setCleaningLog(logRes.text);
      setGeoJson(geoData);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error loading dataset:', err);
      setError(err?.message || 'Failed to load dataset files. Please retry or upload a clean CSV.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Derived scrape date constant from max(last_scraped) in loaded data
  const scrapeDate = useMemo(() => {
    let maxDate = '2026-09-20';
    for (let i = 0; i < listings.length; i++) {
      const d = listings[i].last_scraped;
      if (d && d > maxDate) {
        maxDate = d;
      }
    }
    return maxDate;
  }, [listings]);

  // Upload custom cleaned file
  const uploadCustomListings = async (file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: (field) => field !== 'id' && field !== 'listing_id',
        skipEmptyLines: true,
        complete: (results) => {
          const fields = results.meta.fields || [];
          const missingColumns = EXPECTED_LISTING_COLUMNS.filter((col) => !fields.includes(col));

          if (missingColumns.length > 0) {
            resolve({
              success: false,
              message: `Validation failed: File is missing required column(s): ${missingColumns.join(
                ', '
              )}. Retaining existing data.`,
            });
            return;
          }

          const cleanData = (results.data as any[])
            .filter((r) => r.id && r.neighbourhood_cleansed)
            .map((r) => ({ ...r, id: String(r.id) }));
          if (cleanData.length === 0) {
            resolve({
              success: false,
              message: 'Validation failed: File contains no valid listing records. Retaining existing data.',
            });
            return;
          }

          setListings(cleanData as Listing[]);
          setDetectedSource('User Upload');
          setLoadSource(`User uploaded: ${file.name} (${cleanData.length.toLocaleString()} rows)`);
          resolve({
            success: true,
            message: `Successfully loaded ${cleanData.length.toLocaleString()} listings from ${file.name}.`,
          });
        },
        error: (err: any) => {
          resolve({
            success: false,
            message: `CSV Parse Error: ${err.message}. Retaining existing data.`,
          });
        },
      });
    });
  };

  const downloadCleanedCsv = useCallback(() => {
    if (!listings || listings.length === 0) return;
    const csv = Papa.unparse(listings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dc_listings_clean_${scrapeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [listings, scrapeDate]);

  const downloadCompsCsv = useCallback(
    (comps: Listing[]) => {
      if (!comps || comps.length === 0) return;
      const csv = Papa.unparse(comps);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dc_similar_listings_${scrapeDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [scrapeDate]
  );

  return (
    <DataContext.Provider
      value={{
        listings,
        calendar,
        geoJson,
        cleaningLog,
        isLoading,
        error,
        loadSource,
        detectedSource,
        scrapeDate,
        isMapAvailable: isMapAvailable && geoJson !== null,
        aiGuardLogs,
        addAIGuardLog,
        retryLoad: loadAllData,
        uploadCustomListings,
        downloadCleanedCsv,
        downloadCompsCsv,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
