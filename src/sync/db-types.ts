// Hand-authored to match supabase/migrations/0001_init.sql.
// Regenerate against a linked project with: npm run db:types
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar: string | null;
  updated_at: string;
  deleted: boolean;
}

export interface SettingRow {
  user_id: string;
  key: string;
  payload: Json;
  updated_at: string;
  deleted: boolean;
}

export interface HabitRow {
  user_id: string;
  slug: string;
  name: string;
  icon: string | null;
  active: boolean;
  sort: number;
  updated_at: string;
  deleted: boolean;
}

export type EntryEntity = 'goals' | 'habit_entries' | 'health' | 'mood';

export interface EntryRow {
  user_id: string;
  entity: EntryEntity;
  date_key: string;
  payload: Json;
  updated_at: string;
  deleted: boolean;
}

type TableDef<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, Partial<ProfileRow> & { id: string }>;
      settings: TableDef<SettingRow, Partial<SettingRow> & { user_id: string; key: string }>;
      habits: TableDef<HabitRow, Partial<HabitRow> & { user_id: string; slug: string; name: string }>;
      entries: TableDef<EntryRow, Partial<EntryRow> & { user_id: string; entity: EntryEntity; date_key: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
