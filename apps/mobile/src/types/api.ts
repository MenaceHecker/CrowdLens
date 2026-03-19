export type EventStatus = "forming" | "active" | "cooling_down" | "resolved";
export type EventTrend = "new" | "growing" | "stable";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BriefingSourceStats {
  report_count: number;
  has_media: boolean;
}

export interface EventBriefing {
  title: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  recommended_actions: string[];
  tags: string[];
  source_stats: BriefingSourceStats;
}

export interface Report {
  id: string;
  user_id: string;
  text: string;
  location: LatLng;
  occurred_at: string | null;
  created_at: string;
  status: string;
  media_url: string | null;
  media_path: string | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
}

export interface Event {
  id: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  trend: EventTrend;
  minutes_since_last_report: number;
  is_recent: boolean;
  report_velocity_per_hour: number;
  ranking_score: number;
  cell_id: string;
  centroid: LatLng;
  report_ids: string[];
  report_count: number;
  unique_report_count: number;
  duplicate_report_count: number;
  confidence: number;
  severity: number;
  title: string;
  briefing: EventBriefing | null;
}

export interface FeedItem {
  event: Event;
  latest_report_id: string | null;
}

export interface CreateReportRequest {
  text: string;
  location: LatLng;
  occurred_at?: string | null;
  media_url?: string | null;
  media_path?: string | null;
}

export interface CreateUploadUrlRequest {
  filename: string;
  content_type: string;
}

export interface CreateUploadUrlResponse {
  object_path: string;
  upload_url: string;
  content_type: string;
}