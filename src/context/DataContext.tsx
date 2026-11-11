import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  isMapAvailable: boolean;
  aiGuardLogs: AIGuardLogEntry[];
  addAIGuardLog: (entry: Omit<AIGuardLogEntry, 'id' | 'timestamp'>) => void;
  retryLoad: () => void;
  uploadCustomListings: (file: File) => Promise<{ success: boolean; message: string }>;
  downloadCleanedCsv: () => void;
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

  const fetchWithFallback = async (primaryUrl: string, mirrorUrl: string, localUrl: string) => {
    try {
      const res = await fetch(primaryUrl);
      if (res.ok) return await res.text();
    } catch {
      // primary failed, try mirror
    }

    try {
      const res = await fetch(mirrorUrl);
      if (res.ok) return await res.text();
    } catch {
      // mirror failed, try local
    }

    const res = await fetch(localUrl);
    if (!res.ok) throw new Error(`Could not load file from any source: ${primaryUrl}`);
    return await res.text();
  };

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Listings CSV
      const listingsText = await fetchWithFallback(
        LISTINGS,
        `${MIRROR}dc_listings_clean.csv`,
        LOCAL_DATA.LISTINGS
      );

      const parsedListings = await new Promise<Listing[]>((resolve, reject) => {
        Papa.parse(listingsText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const cleanData = (results.data as any[]).filter((r) => r.id && r.neighbourhood_cleansed);
            resolve(cleanData as Listing[]);
          },
          error: (err: any) => reject(err),
        });
      });

      // 2. Fetch Calendar CSV
      const calendarText = await fetchWithFallback(
        CALENDAR,
        `${MIRROR}dc_calendar_monthly.csv`,
        LOCAL_DATA.CALENDAR
      );

      const parsedCalendar = await new Promise<CalendarEntry[]>((resolve, reject) => {
        Papa.parse(calendarText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            resolve(results.data as CalendarEntry[]);
          },
          error: (err: any) => reject(err),
        });
      });

      // 3. Fetch Cleaning Log
      let logText = '';
      try {
        logText = await fetchWithFallback(
          LOG,
          `${MIRROR}cleaning_log.md`,
          LOCAL_DATA.LOG
        );
      } catch {
        logText = '# Data Cleaning Log\n\nCleaned dataset from Inside Airbnb, Washington DC, scraped 2026-09-20.';
      }

      // 4. Fetch GeoJSON Map
      let geoData: any = null;
      try {
        const geoText = await fetchWithFallback(
          MAP,
          `${MIRROR}dc_neighbourhoods.json`,
          LOCAL_DATA.MAP
        );
        geoData = JSON.parse(geoText);
      } catch {
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
      setCleaningLog(logText);
      setGeoJson(geoData);
      setLoadSource('bundled');
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

  // Upload custom cleaned file
  const uploadCustomListings = async (file: File): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
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

          const cleanData = (results.data as any[]).filter((r) => r.id && r.neighbourhood_cleansed);
          if (cleanData.length === 0) {
            resolve({
              success: false,
              message: 'Validation failed: File contains no valid listing records. Retaining existing data.',
            });
            return;
          }

          setListings(cleanData as Listing[]);
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
    link.setAttribute('download', 'dc_listings_clean.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [listings]);

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
        isMapAvailable: isMapAvailable && geoJson !== null,
        aiGuardLogs,
        addAIGuardLog,
        retryLoad: loadAllData,
        uploadCustomListings,
        downloadCleanedCsv,
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
