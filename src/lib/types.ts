export type Language = { code: string; name: string; flag: string };

export type Video = {
  id: string;
  channel_id: string;
  language_code: string;
  title: string;
  channel_name: string;
  duration_seconds: number;
  published_at: string | null;
  thumbnail_url: string;
  view_count: number;
  level: number;
};

export type Profile = {
  user_id: string;
  language_code: string;
  current_level: number;
  total_seconds_watched: number;
  daily_goal_minutes: number;
};
