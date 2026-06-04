import { create } from "zustand";
import { SearchService } from "./service";
import type { SearchResult, RecentItem } from "@/shared/types";

interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  recentItems: RecentItem[];
  isSearching: boolean;

  setIsOpen: (isOpen: boolean) => void;
  setQuery: (query: string) => void;
  loadRecentItems: () => Promise<void>;
  executeSearch: (query: string) => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  query: "",
  results: [],
  recentItems: [],
  isSearching: false,

  setIsOpen: (isOpen) => set({ isOpen }),
  
  setQuery: (query) => {
    set({ query });
    void get().executeSearch(query);
  },

  loadRecentItems: async () => {
    const items = await SearchService.getRecentItems(10);
    set({ recentItems: items });
  },

  executeSearch: async (query) => {
    if (!query.trim()) {
      set({ results: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    
    // Quick type detection logic (@task, @note, etc)
    const filters: { type?: string[] } = {};
    let cleanQuery = query;

    const typeMatch = query.match(/@(task|note|project|goal|event|journal|document)/i);
    if (typeMatch) {
      filters.type = [typeMatch[1].toLowerCase()];
      cleanQuery = query.replace(/@\w+/i, "").trim();
    }

    try {
      const results = await SearchService.search(cleanQuery, filters);
      set({ results, isSearching: false });
    } catch (e) {
      console.error("Search failed", e);
      set({ results: [], isSearching: false });
    }
  }
}));
