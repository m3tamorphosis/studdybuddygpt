import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
        };
        Update: {
          email?: string | null;
        };
      };
      pdf_documents: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          content_hash: string;
          extracted_text: string | null;
          storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          file_name: string;
          content_hash: string;
          extracted_text?: string | null;
          storage_path?: string | null;
        };
        Update: {
          file_name?: string;
          extracted_text?: string | null;
          storage_path?: string | null;
          updated_at?: string;
        };
      };
      study_artifacts: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          artifact_type: string;
          payload: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          document_id: string;
          artifact_type: string;
          payload: Record<string, unknown>;
        };
        Update: {
          payload?: Record<string, unknown>;
          updated_at?: string;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          question_count: number;
          score: number;
          total_questions: number;
          answers: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          document_id?: string | null;
          question_count: number;
          score: number;
          total_questions: number;
          answers?: Record<string, unknown> | null;
        };
        Update: {
          score?: number;
          total_questions?: number;
          answers?: Record<string, unknown> | null;
        };
      };
    };
  };
};

let browserClient: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return browserClient;
}

export function getSupabaseStorageBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "studybuddy-pdfs";
}

export type { Database };
