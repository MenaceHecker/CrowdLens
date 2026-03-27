export type EventStatus = "forming" | "active" | "cooling_down" | "resolved";
export type EventTrend = "new" | "growing" | "stable";
export type EventUrgencyLevel = "breaking" | "active" | "stale";

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
  incident_type: string;
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
  is_duplicate: boolean;
  duplicate_of: string | null;
  trust_score: number;
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
  is_active: boolean;
  urgency_level: EventUrgencyLevel;
}

export interface LatestReportPreview {
  id: string;
  text: string;
  created_at: string;
  media_url: string | null;
  trust_score: number;
}

export interface FeedItem {
  event: Event;
  latest_report_id: string | null;
  latest_report_preview: LatestReportPreview | null;
}

export interface MediaUploadUrlRequest {
  filename: string;
  content_type: string;
}

export interface MediaUploadUrlResponse {
  object_name: string;
  upload_url: string;
  view_url: string;
  content_type: string;
}

export interface CreateReportRequest {
  text: string;
  location: LatLng;
  occurred_at?: string | null;
  media_url?: string | null;
}

export interface UserProfile {
  user_id: string;
  created_at: string;
  updated_at: string;
  reputation_score: number;
  total_reports: number;
  unique_reports: number;
  duplicate_reports: number;
  low_quality_rejections: number;
  last_report_at: string | null;
}

export interface MeResponse {
  user_id: string;
  email: string | null;
  profile: UserProfile;
}
