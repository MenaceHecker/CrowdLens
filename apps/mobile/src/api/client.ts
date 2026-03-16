import { API_BASE } from "./config";
import { CreateReportRequest, Event, FeedItem, Report } from "../types/api";

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

/**
 * Dev only convenience action.
 * This assumes the worker is reachable from the device.
 * If there are network issues with this endpoint on mobile,
 * keep using terminal curl for worker processing
 */
export async function processNextJob(): Promise<{ ok: boolean; ran: boolean; reason?: string; job_id?: string }> {
  const workerBase =
    process.env.EXPO_PUBLIC_WORKER_BASE || API_BASE.replace(":8000", ":8001");

  const response = await fetch(`${workerBase}/jobs/run-once`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Worker ${response.status}: ${text}`);
  }

  return response.json();
}