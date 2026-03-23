import { API_BASE } from "./config";
import {
  CreateReportRequest,
  Event,
  FeedItem,
  MediaUploadUrlRequest,
  MediaUploadUrlResponse,
  Report,
} from "../types/api";
import { getIdToken } from "../auth";
import { MeResponse } from "../types/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getIdToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
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
    body: JSON.stringify(payload),
  });
}

export async function getMediaUploadUrl(
  payload: MediaUploadUrlRequest
): Promise<MediaUploadUrlResponse> {
  return apiFetch<MediaUploadUrlResponse>("/media/upload-url", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function processNextJob(): Promise<{ ok: boolean; ran: boolean; reason?: string; job_id?: string }> {
  throw new Error("Disabled in production mode");
}

export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
}