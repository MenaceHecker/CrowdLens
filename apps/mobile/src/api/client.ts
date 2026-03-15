import { CreateReportRequest, Event, FeedItem, Report } from "../types/api";

const API_BASE = "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function getFeed(): Promise<FeedItem[]> {
  return apiFetch<FeedItem[]>("/feed");
}

export async function getEvent(eventId: string): Promise<Event> {
  return apiFetch<Event>(`/events/${eventId}`);
}

export async function getEventReports(eventId: string): Promise<Report[]> {
  return apiFetch<Report[]>(`/events/${eventId}/reports`);
}

export async function createReport(payload: CreateReportRequest): Promise<Report> {
  return apiFetch<Report>("/reports", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}