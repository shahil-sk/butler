import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { CalendarEvent } from "../types";

interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;

  loadEvents: () => Promise<void>;
  createEvent: (
    title: string,
    description: string | null,
    startTime: number,
    endTime: number,
    isAllDay: boolean
  ) => Promise<void>;
  updateEvent: (
    id: string,
    title: string,
    description: string | null,
    startTime: number,
    endTime: number,
    isAllDay: boolean
  ) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  loadEvents: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<CalendarEvent[]>("list_events");
      set({ events: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load events from SQLite" });
    } finally {
      set({ loading: false });
    }
  },

  createEvent: async (title, description, startTime, endTime, isAllDay) => {
    set({ loading: true, error: null });
    try {
      await invoke("create_event", {
        title,
        description,
        startTime,
        endTime,
        isAllDay,
      });
      const list = await invoke<CalendarEvent[]>("list_events");
      set({ events: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create event" });
    } finally {
      set({ loading: false });
    }
  },

  updateEvent: async (id, title, description, startTime, endTime, isAllDay) => {
    try {
      await invoke("update_event", {
        id,
        title,
        description,
        startTime,
        endTime,
        isAllDay,
      });
      const list = await invoke<CalendarEvent[]>("list_events");
      set({ events: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update event" });
    }
  },

  deleteEvent: async (id) => {
    const previousEvents = get().events;
    set({
      events: previousEvents.filter((e) => e.id !== id),
    });

    try {
      await invoke("delete_event", { id });
    } catch (e: any) {
      console.error(e);
      set({ events: previousEvents, error: "Failed to delete event" });
    }
  },
}));
export default useCalendarStore;
