export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    CompositeTypes: Record<never, never>;
    Enums: Record<never, never>;
    Functions: {
      daitch_mokotoff: { Args: { "": string }; Returns: string[] };
      dmetaphone: { Args: { "": string }; Returns: string };
      dmetaphone_alt: { Args: { "": string }; Returns: string };
      f_unaccent: { Args: { "": string }; Returns: string };
      search_perfumes_unaccent: {
        Args: { limit_count?: number; search_query: string };
        Returns: {
          brand_name: string;
          concentration: string;
          id: string;
          name: string;
          year: number;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      slugify: { Args: { text_input: string }; Returns: string };
      soundex: { Args: { "": string }; Returns: string };
      text_soundex: { Args: { "": string }; Returns: string };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Tables: {
      app_admins: {
        Insert: {
          created_at?: string | null;
          user_id: string;
        };
        Relationships: [];
        Row: {
          created_at: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          user_id?: string;
        };
      };
      brand_aliases: {
        Insert: {
          alias_norm: string;
          brand_id: string;
        };
        Relationships: [
          {
            columns: ["brand_id"];
            foreignKeyName: "brand_aliases_brand_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "brands";
          },
        ];
        Row: {
          alias_norm: string;
          brand_id: string;
        };
        Update: {
          alias_norm?: string;
          brand_id?: string;
        };
      };
      brand_aliases_etl: {
        Insert: {
          alias_name: string;
          brand_id?: string | null;
          created_at?: string | null;
          id?: string;
          normalized_name: string;
        };
        Relationships: [
          {
            columns: ["brand_id"];
            foreignKeyName: "brand_aliases_etl_brand_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "brands";
          },
        ];
        Row: {
          alias_name: string;
          brand_id: string | null;
          created_at: string | null;
          id: string;
          normalized_name: string;
        };
        Update: {
          alias_name?: string;
          brand_id?: string | null;
          created_at?: string | null;
          id?: string;
          normalized_name?: string;
        };
      };
      brands: {
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Relationships: [];
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      concentrations: {
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Relationships: [];
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      daily_challenges: {
        Insert: {
          challenge_date: string;
          challenge_number?: number;
          created_at?: string | null;
          grace_deadline_at_utc: string;
          id?: string;
          mode?: string | null;
          perfume_id: string;
          seed_hash: string;
          snapshot_metadata: Json;
          snapshot_schema_version?: number;
        };
        Relationships: [
          {
            columns: ["perfume_id"];
            foreignKeyName: "daily_challenges_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "daily_challenges_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "daily_challenges_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          challenge_date: string;
          challenge_number: number;
          created_at: string | null;
          grace_deadline_at_utc: string;
          id: string;
          mode: string | null;
          perfume_id: string;
          seed_hash: string;
          snapshot_metadata: Json;
          snapshot_schema_version: number;
        };
        Update: {
          challenge_date?: string;
          challenge_number?: number;
          created_at?: string | null;
          grace_deadline_at_utc?: string;
          id?: string;
          mode?: string | null;
          perfume_id?: string;
          seed_hash?: string;
          snapshot_metadata?: Json;
          snapshot_schema_version?: number;
        };
      };
      game_results: {
        Insert: {
          attempts: number;
          challenge_id?: string | null;
          completed_at?: string | null;
          id?: string;
          is_ranked?: boolean;
          player_id?: string | null;
          ranked_reason?: string | null;
          score: number;
          score_raw?: number;
          scoring_version?: number;
          session_id?: string | null;
          status?: string | null;
          time_seconds: number;
        };
        Relationships: [
          {
            columns: ["challenge_id"];
            foreignKeyName: "game_results_challenge_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "daily_challenges";
          },
          {
            columns: ["challenge_id"];
            foreignKeyName: "game_results_challenge_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "daily_challenges_public";
          },
          {
            columns: ["player_id"];
            foreignKeyName: "game_results_player_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
          {
            columns: ["session_id"];
            foreignKeyName: "game_results_session_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "game_sessions";
          },
        ];
        Row: {
          attempts: number;
          challenge_id: string | null;
          completed_at: string | null;
          id: string;
          is_ranked: boolean;
          player_id: string | null;
          ranked_reason: string | null;
          score: number;
          score_raw: number;
          scoring_version: number;
          session_id: string | null;
          status: string | null;
          time_seconds: number;
        };
        Update: {
          attempts?: number;
          challenge_id?: string | null;
          completed_at?: string | null;
          id?: string;
          is_ranked?: boolean;
          player_id?: string | null;
          ranked_reason?: string | null;
          score?: number;
          score_raw?: number;
          scoring_version?: number;
          session_id?: string | null;
          status?: string | null;
          time_seconds?: number;
        };
      };
      game_sessions: {
        Insert: {
          attempts_count?: number | null;
          challenge_id?: string | null;
          guesses?: Json | null;
          id?: string;
          last_guess?: string | null;
          last_nonce?: string | null;
          metadata?: Json | null;
          player_id?: string | null;
          start_time?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            columns: ["challenge_id"];
            foreignKeyName: "game_sessions_challenge_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "daily_challenges";
          },
          {
            columns: ["challenge_id"];
            foreignKeyName: "game_sessions_challenge_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "daily_challenges_public";
          },
          {
            columns: ["player_id"];
            foreignKeyName: "game_sessions_player_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
        ];
        Row: {
          attempts_count: number | null;
          challenge_id: string | null;
          guesses: Json | null;
          id: string;
          last_guess: string | null;
          last_nonce: string | null;
          metadata: Json | null;
          player_id: string | null;
          start_time: string | null;
          status: string | null;
        };
        Update: {
          attempts_count?: number | null;
          challenge_id?: string | null;
          guesses?: Json | null;
          id?: string;
          last_guess?: string | null;
          last_nonce?: string | null;
          metadata?: Json | null;
          player_id?: string | null;
          start_time?: string | null;
          status?: string | null;
        };
      };
      import_conflicts: {
        Insert: {
          conflict_type: string;
          details?: Json | null;
          id?: string;
          import_run_id: string;
          raw_row_id: string;
          resolved?: boolean | null;
        };
        Relationships: [
          {
            columns: ["import_run_id"];
            foreignKeyName: "import_conflicts_import_run_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "import_runs";
          },
          {
            columns: ["raw_row_id"];
            foreignKeyName: "import_conflicts_raw_row_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "raw_import_rows";
          },
        ];
        Row: {
          conflict_type: string;
          details: Json | null;
          id: string;
          import_run_id: string;
          raw_row_id: string;
          resolved: boolean | null;
        };
        Update: {
          conflict_type?: string;
          details?: Json | null;
          id?: string;
          import_run_id?: string;
          raw_row_id?: string;
          resolved?: boolean | null;
        };
      };
      import_runs: {
        Insert: {
          catalog_version: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
        Row: {
          catalog_version: string;
          created_at: string;
          id: string;
        };
        Update: {
          catalog_version?: string;
          created_at?: string;
          id?: string;
        };
      };
      manufacturers: {
        Insert: {
          id?: string;
          name: string;
        };
        Relationships: [];
        Row: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
      };
      notes: {
        Insert: {
          display_name: string;
          hints?: string[] | null;
          id?: string;
          name: string;
          slug: string;
        };
        Relationships: [];
        Row: {
          display_name: string;
          hints: string[] | null;
          id: string;
          name: string;
          slug: string;
        };
        Update: {
          display_name?: string;
          hints?: string[] | null;
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      perfume_asset_sources: {
        Insert: {
          id?: string;
          license_status?: string | null;
          original_filename?: string | null;
          perfume_id?: string | null;
          scraped_at?: string | null;
          source_type?: string;
          source_url: string;
          takedown_status?: string | null;
          version?: number;
        };
        Relationships: [
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          id: string;
          license_status: string | null;
          original_filename: string | null;
          perfume_id: string | null;
          scraped_at: string | null;
          source_type: string;
          source_url: string;
          takedown_status: string | null;
          version: number;
        };
        Update: {
          id?: string;
          license_status?: string | null;
          original_filename?: string | null;
          perfume_id?: string | null;
          scraped_at?: string | null;
          source_type?: string;
          source_url?: string;
          takedown_status?: string | null;
          version?: number;
        };
      };
      perfume_assets: {
        Insert: {
          asset_random_id: string;
          created_at?: string | null;
          image_key_step_1: string;
          image_key_step_2: string;
          image_key_step_3: string;
          image_key_step_4: string;
          image_key_step_5: string;
          image_key_step_6: string;
          perfume_id: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_assets_perfume_id_fkey";
            isOneToOne: true;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_assets_perfume_id_fkey";
            isOneToOne: true;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_assets_perfume_id_fkey";
            isOneToOne: true;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          asset_random_id: string;
          created_at: string | null;
          image_key_step_1: string;
          image_key_step_2: string;
          image_key_step_3: string;
          image_key_step_4: string;
          image_key_step_5: string;
          image_key_step_6: string;
          perfume_id: string;
          updated_at: string | null;
        };
        Update: {
          asset_random_id?: string;
          created_at?: string | null;
          image_key_step_1?: string;
          image_key_step_2?: string;
          image_key_step_3?: string;
          image_key_step_4?: string;
          image_key_step_5?: string;
          image_key_step_6?: string;
          perfume_id?: string;
          updated_at?: string | null;
        };
      };
      perfume_notes: {
        Insert: {
          note_id: string;
          perfume_id: string;
          qualifiers?: string[] | null;
          type: string;
        };
        Relationships: [
          {
            columns: ["note_id"];
            foreignKeyName: "perfume_notes_note_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "notes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_notes_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_notes_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_notes_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          note_id: string;
          perfume_id: string;
          qualifiers: string[] | null;
          type: string;
        };
        Update: {
          note_id?: string;
          perfume_id?: string;
          qualifiers?: string[] | null;
          type?: string;
        };
      };
      perfume_perfumers: {
        Insert: {
          perfume_id: string;
          perfumer_id: string;
        };
        Relationships: [
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_perfumers_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_perfumers_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_perfumers_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
          {
            columns: ["perfumer_id"];
            foreignKeyName: "perfume_perfumers_perfumer_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumers";
          },
        ];
        Row: {
          perfume_id: string;
          perfumer_id: string;
        };
        Update: {
          perfume_id?: string;
          perfumer_id?: string;
        };
      };
      perfume_revisions: {
        Insert: {
          changed_at?: string;
          diff_jsonb: Json;
          id?: string;
          import_run_id?: string | null;
          perfume_id: string;
        };
        Relationships: [
          {
            columns: ["import_run_id"];
            foreignKeyName: "perfume_revisions_import_run_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "import_runs";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_revisions_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_revisions_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_revisions_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          changed_at: string;
          diff_jsonb: Json;
          id: string;
          import_run_id: string | null;
          perfume_id: string;
        };
        Update: {
          changed_at?: string;
          diff_jsonb?: Json;
          id?: string;
          import_run_id?: string | null;
          perfume_id?: string;
        };
      };
      perfume_source_urls: {
        Insert: {
          id?: string;
          last_seen_at?: string;
          perfume_id: string;
          url: string;
        };
        Relationships: [
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_source_urls_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["perfume_id"];
            referencedRelation: "perfume_autocomplete_cache";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_source_urls_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes";
          },
          {
            columns: ["perfume_id"];
            foreignKeyName: "perfume_source_urls_perfume_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "perfumes_public";
          },
        ];
        Row: {
          id: string;
          last_seen_at: string;
          perfume_id: string;
          url: string;
        };
        Update: {
          id?: string;
          last_seen_at?: string;
          perfume_id?: string;
          url?: string;
        };
      };
      perfumers: {
        Insert: {
          id?: string;
          name: string;
        };
        Relationships: [];
        Row: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
      };
      perfumes: {
        Insert: {
          base_notes?: string[] | null;
          brand_id: string;
          concentration_id?: string | null;
          created_at?: string | null;
          fingerprint_loose?: string | null;
          fingerprint_strict?: string | null;
          games_played?: number;
          gender?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_linear?: boolean | null;
          is_uncertain?: boolean | null;
          manufacturer_id?: string | null;
          middle_notes?: string[] | null;
          name: string;
          perfumers?: string[] | null;
          release_year?: number | null;
          solve_rate?: number | null;
          source_record_slug: string;
          top_notes?: string[] | null;
          unique_slug?: string | null;
          xsolve_model_version?: number | null;
          xsolve_score?: number | null;
        };
        Relationships: [
          {
            columns: ["brand_id"];
            foreignKeyName: "perfumes_brand_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "brands";
          },
          {
            columns: ["concentration_id"];
            foreignKeyName: "perfumes_concentration_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "concentrations";
          },
          {
            columns: ["manufacturer_id"];
            foreignKeyName: "perfumes_manufacturer_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "manufacturers";
          },
        ];
        Row: {
          base_notes: string[] | null;
          brand_id: string;
          concentration_id: string | null;
          created_at: string | null;
          fingerprint_loose: string | null;
          fingerprint_strict: string | null;
          games_played: number;
          gender: string | null;
          id: string;
          is_active: boolean | null;
          is_linear: boolean | null;
          is_uncertain: boolean | null;
          manufacturer_id: string | null;
          middle_notes: string[] | null;
          name: string;
          perfumers: string[] | null;
          release_year: number | null;
          solve_rate: number | null;
          source_record_slug: string;
          top_notes: string[] | null;
          unique_slug: string | null;
          xsolve_model_version: number | null;
          xsolve_score: number | null;
        };
        Update: {
          base_notes?: string[] | null;
          brand_id?: string;
          concentration_id?: string | null;
          created_at?: string | null;
          fingerprint_loose?: string | null;
          fingerprint_strict?: string | null;
          games_played?: number;
          gender?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_linear?: boolean | null;
          is_uncertain?: boolean | null;
          manufacturer_id?: string | null;
          middle_notes?: string[] | null;
          name?: string;
          perfumers?: string[] | null;
          release_year?: number | null;
          solve_rate?: number | null;
          source_record_slug?: string;
          top_notes?: string[] | null;
          unique_slug?: string | null;
          xsolve_model_version?: number | null;
          xsolve_score?: number | null;
        };
      };
      player_auth_links: {
        Insert: {
          auth_user_id: string;
          linked_at?: string;
          player_id: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            columns: ["player_id"];
            foreignKeyName: "player_auth_links_player_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
        ];
        Row: {
          auth_user_id: string;
          linked_at: string;
          player_id: string;
          revoked_at: string | null;
        };
        Update: {
          auth_user_id?: string;
          linked_at?: string;
          player_id?: string;
          revoked_at?: string | null;
        };
      };
      player_profiles: {
        Insert: {
          created_at?: string | null;
          last_seen_at?: string | null;
          public_id?: string | null;
          stats?: Json | null;
          team_id?: string | null;
          user_id: string;
          username?: string | null;
        };
        Relationships: [
          {
            columns: ["team_id"];
            foreignKeyName: "player_profiles_team_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "teams";
          },
          {
            columns: ["user_id"];
            foreignKeyName: "player_profiles_user_id_fkey";
            isOneToOne: true;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
        ];
        Row: {
          created_at: string | null;
          last_seen_at: string | null;
          public_id: string | null;
          stats: Json | null;
          team_id: string | null;
          user_id: string;
          username: string | null;
        };
        Update: {
          created_at?: string | null;
          last_seen_at?: string | null;
          public_id?: string | null;
          stats?: Json | null;
          team_id?: string | null;
          user_id?: string;
          username?: string | null;
        };
      };
      player_streaks: {
        Insert: {
          best_streak?: number;
          current_streak?: number;
          joker_used_date?: string | null;
          jokers_remaining?: number;
          last_played_date?: string | null;
          player_id: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            columns: ["player_id"];
            foreignKeyName: "player_streaks_player_id_fkey";
            isOneToOne: true;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
        ];
        Row: {
          best_streak: number;
          current_streak: number;
          joker_used_date: string | null;
          jokers_remaining: number;
          last_played_date: string | null;
          player_id: string;
          updated_at: string | null;
        };
        Update: {
          best_streak?: number;
          current_streak?: number;
          joker_used_date?: string | null;
          jokers_remaining?: number;
          last_played_date?: string | null;
          player_id?: string;
          updated_at?: string | null;
        };
      };
      players: {
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
        };
        Relationships: [];
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
        };
      };
      raw_import_rows: {
        Insert: {
          brand_raw?: string | null;
          concentration_raw?: string | null;
          created_at?: string;
          fp_loose: string;
          fp_strict: string;
          id?: string;
          import_run_id: string;
          name_raw?: string | null;
          raw_json?: Json | null;
          release_year?: number | null;
        };
        Relationships: [
          {
            columns: ["import_run_id"];
            foreignKeyName: "raw_import_rows_import_run_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "import_runs";
          },
        ];
        Row: {
          brand_raw: string | null;
          concentration_raw: string | null;
          created_at: string;
          fp_loose: string;
          fp_strict: string;
          id: string;
          import_run_id: string;
          name_raw: string | null;
          raw_json: Json | null;
          release_year: number | null;
        };
        Update: {
          brand_raw?: string | null;
          concentration_raw?: string | null;
          created_at?: string;
          fp_loose?: string;
          fp_strict?: string;
          id?: string;
          import_run_id?: string;
          name_raw?: string | null;
          raw_json?: Json | null;
          release_year?: number | null;
        };
      };
      recovery_keys: {
        Insert: {
          created_at?: string;
          hash: string;
          id?: string;
          kdf?: string;
          key_id: string;
          last_used_at?: string | null;
          params: Json;
          player_id: string;
          revoked_at?: string | null;
          rotated_from?: string | null;
          salt: string;
        };
        Relationships: [
          {
            columns: ["player_id"];
            foreignKeyName: "recovery_keys_player_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
          {
            columns: ["rotated_from"];
            foreignKeyName: "recovery_keys_rotated_from_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "recovery_keys";
          },
        ];
        Row: {
          created_at: string;
          hash: string;
          id: string;
          kdf: string;
          key_id: string;
          last_used_at: string | null;
          params: Json;
          player_id: string;
          revoked_at: string | null;
          rotated_from: string | null;
          salt: string;
        };
        Update: {
          created_at?: string;
          hash?: string;
          id?: string;
          kdf?: string;
          key_id?: string;
          last_used_at?: string | null;
          params?: Json;
          player_id?: string;
          revoked_at?: string | null;
          rotated_from?: string | null;
          salt?: string;
        };
      };
      seasons: {
        Insert: {
          ends_at: string;
          id?: string;
          is_active?: boolean | null;
          name: string;
          starts_at: string;
        };
        Relationships: [];
        Row: {
          ends_at: string;
          id: string;
          is_active: boolean | null;
          name: string;
          starts_at: string;
        };
        Update: {
          ends_at?: string;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          starts_at?: string;
        };
      };
      streak_freezes: {
        Insert: {
          for_date: string;
          id?: string;
          player_id: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            columns: ["player_id"];
            foreignKeyName: "streak_freezes_player_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "players";
          },
        ];
        Row: {
          for_date: string;
          id: string;
          player_id: string;
          used_at: string | null;
        };
        Update: {
          for_date?: string;
          id?: string;
          player_id?: string;
          used_at?: string | null;
        };
      };
      teams: {
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Relationships: [];
        Row: {
          id: string;
          name: string;
          slug: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
      };
      "test-table": {
        Insert: {
          created_at?: string;
          id?: number;
        };
        Relationships: [];
        Row: {
          created_at: string;
          id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
        };
      };
    };
    Views: {
      daily_challenges_public: {
        Insert: {
          challenge_date?: string | null;
          grace_deadline_at_utc?: string | null;
          id?: string | null;
          mode?: string | null;
          snapshot_metadata?: Json | null;
        };
        Relationships: [];
        Row: {
          challenge_date: string | null;
          grace_deadline_at_utc: string | null;
          id: string | null;
          mode: string | null;
          snapshot_metadata: Json | null;
        };
        Update: {
          challenge_date?: string | null;
          grace_deadline_at_utc?: string | null;
          id?: string | null;
          mode?: string | null;
          snapshot_metadata?: Json | null;
        };
      };
      perfume_autocomplete_cache: {
        Relationships: [];
        Row: {
          brand_name: string | null;
          name: string | null;
          perfume_id: string | null;
          release_year: number | null;
          ui_key: string | null;
        };
      };
      perfumes_public: {
        Relationships: [
          {
            columns: ["brand_id"];
            foreignKeyName: "perfumes_brand_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "brands";
          },
          {
            columns: ["concentration_id"];
            foreignKeyName: "perfumes_concentration_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "concentrations";
          },
          {
            columns: ["manufacturer_id"];
            foreignKeyName: "perfumes_manufacturer_id_fkey";
            isOneToOne: false;
            referencedColumns: ["id"];
            referencedRelation: "manufacturers";
          },
        ];
        Row: {
          base_notes: string[] | null;
          brand_id: string | null;
          brand_name: string | null;
          concentration_id: string | null;
          concentration_name: string | null;
          games_played: number | null;
          gender: string | null;
          id: string | null;
          is_linear: boolean | null;
          is_uncertain: boolean | null;
          manufacturer_id: string | null;
          middle_notes: string[] | null;
          name: string | null;
          release_year: number | null;
          solve_rate: number | null;
          top_notes: string[] | null;
          unique_slug: string | null;
        };
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
