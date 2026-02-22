export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_admins: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brand_aliases: {
        Row: {
          alias_norm: string
          brand_id: string
        }
        Insert: {
          alias_norm: string
          brand_id: string
        }
        Update: {
          alias_norm?: string
          brand_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_aliases_etl: {
        Row: {
          alias_name: string
          brand_id: string | null
          created_at: string | null
          id: string
          normalized_name: string
        }
        Insert: {
          alias_name: string
          brand_id?: string | null
          created_at?: string | null
          id?: string
          normalized_name: string
        }
        Update: {
          alias_name?: string
          brand_id?: string | null
          created_at?: string | null
          id?: string
          normalized_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_aliases_etl_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      concentrations: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          challenge_date: string
          challenge_number: number
          created_at: string | null
          grace_deadline_at_utc: string
          id: string
          mode: string | null
          perfume_id: string
          seed_hash: string
          snapshot_metadata: Json
          snapshot_schema_version: number
        }
        Insert: {
          challenge_date: string
          challenge_number?: number
          created_at?: string | null
          grace_deadline_at_utc: string
          id?: string
          mode?: string | null
          perfume_id: string
          seed_hash: string
          snapshot_metadata: Json
          snapshot_schema_version?: number
        }
        Update: {
          challenge_date?: string
          challenge_number?: number
          created_at?: string | null
          grace_deadline_at_utc?: string
          id?: string
          mode?: string | null
          perfume_id?: string
          seed_hash?: string
          snapshot_metadata?: Json
          snapshot_schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "daily_challenges_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_challenges_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      game_results: {
        Row: {
          attempts: number
          challenge_id: string | null
          completed_at: string | null
          id: string
          is_ranked: boolean
          player_id: string | null
          ranked_reason: string | null
          score: number
          score_raw: number
          scoring_version: number
          session_id: string | null
          status: string | null
          time_seconds: number
        }
        Insert: {
          attempts: number
          challenge_id?: string | null
          completed_at?: string | null
          id?: string
          is_ranked?: boolean
          player_id?: string | null
          ranked_reason?: string | null
          score: number
          score_raw?: number
          scoring_version?: number
          session_id?: string | null
          status?: string | null
          time_seconds: number
        }
        Update: {
          attempts?: number
          challenge_id?: string | null
          completed_at?: string | null
          id?: string
          is_ranked?: boolean
          player_id?: string | null
          ranked_reason?: string | null
          score?: number
          score_raw?: number
          scoring_version?: number
          session_id?: string | null
          status?: string | null
          time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          attempts_count: number | null
          challenge_id: string | null
          guesses: Json | null
          id: string
          last_guess: string | null
          last_nonce: string | null
          metadata: Json | null
          player_id: string | null
          start_time: string | null
          status: string | null
        }
        Insert: {
          attempts_count?: number | null
          challenge_id?: string | null
          guesses?: Json | null
          id?: string
          last_guess?: string | null
          last_nonce?: string | null
          metadata?: Json | null
          player_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Update: {
          attempts_count?: number | null
          challenge_id?: string | null
          guesses?: Json | null
          id?: string
          last_guess?: string | null
          last_nonce?: string | null
          metadata?: Json | null
          player_id?: string | null
          start_time?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      import_conflicts: {
        Row: {
          conflict_type: string
          details: Json | null
          id: string
          import_run_id: string
          raw_row_id: string
          resolved: boolean | null
        }
        Insert: {
          conflict_type: string
          details?: Json | null
          id?: string
          import_run_id: string
          raw_row_id: string
          resolved?: boolean | null
        }
        Update: {
          conflict_type?: string
          details?: Json | null
          id?: string
          import_run_id?: string
          raw_row_id?: string
          resolved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "import_conflicts_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_conflicts_raw_row_id_fkey"
            columns: ["raw_row_id"]
            isOneToOne: false
            referencedRelation: "raw_import_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          catalog_version: string
          created_at: string
          id: string
        }
        Insert: {
          catalog_version: string
          created_at?: string
          id?: string
        }
        Update: {
          catalog_version?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      manufacturers: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          display_name: string
          hints: string[] | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          display_name: string
          hints?: string[] | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          display_name?: string
          hints?: string[] | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      perfume_asset_sources: {
        Row: {
          id: string
          license_status: string | null
          original_filename: string | null
          perfume_id: string | null
          scraped_at: string | null
          source_type: string
          source_url: string
          takedown_status: string | null
          version: number
        }
        Insert: {
          id?: string
          license_status?: string | null
          original_filename?: string | null
          perfume_id?: string | null
          scraped_at?: string | null
          source_type?: string
          source_url: string
          takedown_status?: string | null
          version?: number
        }
        Update: {
          id?: string
          license_status?: string | null
          original_filename?: string | null
          perfume_id?: string | null
          scraped_at?: string | null
          source_type?: string
          source_url?: string
          takedown_status?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_asset_sources_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_assets: {
        Row: {
          asset_random_id: string
          created_at: string | null
          image_key_step_1: string
          image_key_step_2: string
          image_key_step_3: string
          image_key_step_4: string
          image_key_step_5: string
          image_key_step_6: string
          perfume_id: string
          updated_at: string | null
        }
        Insert: {
          asset_random_id: string
          created_at?: string | null
          image_key_step_1: string
          image_key_step_2: string
          image_key_step_3: string
          image_key_step_4: string
          image_key_step_5: string
          image_key_step_6: string
          perfume_id: string
          updated_at?: string | null
        }
        Update: {
          asset_random_id?: string
          created_at?: string | null
          image_key_step_1?: string
          image_key_step_2?: string
          image_key_step_3?: string
          image_key_step_4?: string
          image_key_step_5?: string
          image_key_step_6?: string
          perfume_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfume_assets_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: true
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_assets_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: true
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_assets_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: true
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_notes: {
        Row: {
          note_id: string
          perfume_id: string
          qualifiers: string[] | null
          type: string
        }
        Insert: {
          note_id: string
          perfume_id: string
          qualifiers?: string[] | null
          type: string
        }
        Update: {
          note_id?: string
          perfume_id?: string
          qualifiers?: string[] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_notes_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_notes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_notes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_notes_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_perfumers: {
        Row: {
          perfume_id: string
          perfumer_id: string
        }
        Insert: {
          perfume_id: string
          perfumer_id: string
        }
        Update: {
          perfume_id?: string
          perfumer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_perfumers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_perfumers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_perfumers_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_perfumers_perfumer_id_fkey"
            columns: ["perfumer_id"]
            isOneToOne: false
            referencedRelation: "perfumers"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_revisions: {
        Row: {
          changed_at: string
          diff_jsonb: Json
          id: string
          import_run_id: string | null
          perfume_id: string
        }
        Insert: {
          changed_at?: string
          diff_jsonb: Json
          id?: string
          import_run_id?: string | null
          perfume_id: string
        }
        Update: {
          changed_at?: string
          diff_jsonb?: Json
          id?: string
          import_run_id?: string | null
          perfume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_revisions_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_revisions_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_revisions_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_revisions_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_source_urls: {
        Row: {
          id: string
          last_seen_at: string
          perfume_id: string
          url: string
        }
        Insert: {
          id?: string
          last_seen_at?: string
          perfume_id: string
          url: string
        }
        Update: {
          id?: string
          last_seen_at?: string
          perfume_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_source_urls_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfume_autocomplete_cache"
            referencedColumns: ["perfume_id"]
          },
          {
            foreignKeyName: "perfume_source_urls_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_source_urls_perfume_id_fkey"
            columns: ["perfume_id"]
            isOneToOne: false
            referencedRelation: "perfumes_public"
            referencedColumns: ["id"]
          },
        ]
      }
      perfumers: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      perfumes: {
        Row: {
          base_notes: string[] | null
          brand_id: string
          concentration_id: string | null
          created_at: string | null
          fingerprint_loose: string | null
          fingerprint_strict: string | null
          games_played: number
          gender: string | null
          id: string
          is_active: boolean | null
          is_linear: boolean | null
          is_uncertain: boolean | null
          manufacturer_id: string | null
          middle_notes: string[] | null
          name: string
          perfumers: string[] | null
          release_year: number | null
          solve_rate: number | null
          source_record_slug: string
          top_notes: string[] | null
          unique_slug: string | null
          xsolve_model_version: number | null
          xsolve_score: number | null
        }
        Insert: {
          base_notes?: string[] | null
          brand_id: string
          concentration_id?: string | null
          created_at?: string | null
          fingerprint_loose?: string | null
          fingerprint_strict?: string | null
          games_played?: number
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_linear?: boolean | null
          is_uncertain?: boolean | null
          manufacturer_id?: string | null
          middle_notes?: string[] | null
          name: string
          perfumers?: string[] | null
          release_year?: number | null
          solve_rate?: number | null
          source_record_slug: string
          top_notes?: string[] | null
          unique_slug?: string | null
          xsolve_model_version?: number | null
          xsolve_score?: number | null
        }
        Update: {
          base_notes?: string[] | null
          brand_id?: string
          concentration_id?: string | null
          created_at?: string | null
          fingerprint_loose?: string | null
          fingerprint_strict?: string | null
          games_played?: number
          gender?: string | null
          id?: string
          is_active?: boolean | null
          is_linear?: boolean | null
          is_uncertain?: boolean | null
          manufacturer_id?: string | null
          middle_notes?: string[] | null
          name?: string
          perfumers?: string[] | null
          release_year?: number | null
          solve_rate?: number | null
          source_record_slug?: string
          top_notes?: string[] | null
          unique_slug?: string | null
          xsolve_model_version?: number | null
          xsolve_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perfumes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfumes_concentration_id_fkey"
            columns: ["concentration_id"]
            isOneToOne: false
            referencedRelation: "concentrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfumes_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      player_auth_links: {
        Row: {
          auth_user_id: string
          linked_at: string
          player_id: string
          revoked_at: string | null
        }
        Insert: {
          auth_user_id: string
          linked_at?: string
          player_id: string
          revoked_at?: string | null
        }
        Update: {
          auth_user_id?: string
          linked_at?: string
          player_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_auth_links_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          created_at: string | null
          last_seen_at: string | null
          public_id: string | null
          stats: Json | null
          team_id: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          last_seen_at?: string | null
          public_id?: string | null
          stats?: Json | null
          team_id?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          last_seen_at?: string | null
          public_id?: string | null
          stats?: Json | null
          team_id?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_streaks: {
        Row: {
          best_streak: number
          current_streak: number
          joker_used_date: string | null
          jokers_remaining: number
          last_played_date: string | null
          player_id: string
          updated_at: string | null
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          joker_used_date?: string | null
          jokers_remaining?: number
          last_played_date?: string | null
          player_id: string
          updated_at?: string | null
        }
        Update: {
          best_streak?: number
          current_streak?: number
          joker_used_date?: string | null
          jokers_remaining?: number
          last_played_date?: string | null
          player_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_streaks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      raw_import_rows: {
        Row: {
          brand_raw: string | null
          concentration_raw: string | null
          created_at: string
          fp_loose: string
          fp_strict: string
          id: string
          import_run_id: string
          name_raw: string | null
          raw_json: Json | null
          release_year: number | null
        }
        Insert: {
          brand_raw?: string | null
          concentration_raw?: string | null
          created_at?: string
          fp_loose: string
          fp_strict: string
          id?: string
          import_run_id: string
          name_raw?: string | null
          raw_json?: Json | null
          release_year?: number | null
        }
        Update: {
          brand_raw?: string | null
          concentration_raw?: string | null
          created_at?: string
          fp_loose?: string
          fp_strict?: string
          id?: string
          import_run_id?: string
          name_raw?: string | null
          raw_json?: Json | null
          release_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_import_rows_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_keys: {
        Row: {
          created_at: string
          hash: string
          id: string
          kdf: string
          key_id: string
          last_used_at: string | null
          params: Json
          player_id: string
          revoked_at: string | null
          rotated_from: string | null
          salt: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          kdf?: string
          key_id: string
          last_used_at?: string | null
          params: Json
          player_id: string
          revoked_at?: string | null
          rotated_from?: string | null
          salt: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          kdf?: string
          key_id?: string
          last_used_at?: string | null
          params?: Json
          player_id?: string
          revoked_at?: string | null
          rotated_from?: string | null
          salt?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_keys_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_keys_rotated_from_fkey"
            columns: ["rotated_from"]
            isOneToOne: false
            referencedRelation: "recovery_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          ends_at: string
          id: string
          is_active: boolean | null
          name: string
          starts_at: string
        }
        Insert: {
          ends_at: string
          id?: string
          is_active?: boolean | null
          name: string
          starts_at: string
        }
        Update: {
          ends_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          for_date: string
          id: string
          player_id: string
          used_at: string | null
        }
        Insert: {
          for_date: string
          id?: string
          player_id: string
          used_at?: string | null
        }
        Update: {
          for_date?: string
          id?: string
          player_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streak_freezes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      "test-table": {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          id: string
          ip_address: unknown
          last_active_at: string | null
          revoked_at: string | null
          session_token_hash: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          last_active_at?: string | null
          revoked_at?: string | null
          session_token_hash?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          last_active_at?: string | null
          revoked_at?: string | null
          session_token_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_challenges_public: {
        Row: {
          challenge_date: string | null
          grace_deadline_at_utc: string | null
          id: string | null
          mode: string | null
          snapshot_metadata: Json | null
        }
        Insert: {
          challenge_date?: string | null
          grace_deadline_at_utc?: string | null
          id?: string | null
          mode?: string | null
          snapshot_metadata?: Json | null
        }
        Update: {
          challenge_date?: string | null
          grace_deadline_at_utc?: string | null
          id?: string | null
          mode?: string | null
          snapshot_metadata?: Json | null
        }
        Relationships: []
      }
      perfume_autocomplete_cache: {
        Row: {
          brand_name: string | null
          brand_name_concat: string | null
          brand_norm: string | null
          brand_phonetic: string | null
          concentration_name: string | null
          concentration_rank: number | null
          name: string | null
          name_brand_concat: string | null
          name_length: number | null
          name_norm: string | null
          name_phonetic: string | null
          perfume_id: string | null
          release_year: number | null
        }
        Relationships: []
      }
      perfumes_public: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          concentration_id: string | null
          concentration_name: string | null
          games_played: number | null
          gender: string | null
          id: string | null
          is_linear: boolean | null
          is_uncertain: boolean | null
          manufacturer_id: string | null
          name: string | null
          release_year: number | null
          solve_rate: number | null
          unique_slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfumes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfumes_concentration_id_fkey"
            columns: ["concentration_id"]
            isOneToOne: false
            referencedRelation: "concentrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfumes_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      debug_autocomplete_data: {
        Args: never
        Returns: {
          concat_norm: string
          matches_pattern: boolean
          name_norm: string
          perfume: string
        }[]
      }
      delete_auth_session: { Args: { session_id: string }; Returns: undefined }
      extensions_dmetaphone: { Args: { "": string }; Returns: string }
      extensions_f_unaccent: { Args: { "": string }; Returns: string }
      f_unaccent: { Args: { "": string }; Returns: string }
      normalize_search_text: { Args: { input_text: string }; Returns: string }
      refresh_autocomplete_cache: {
        Args: never
        Returns: {
          refresh_duration_ms: number
          rows_refreshed: number
        }[]
      }
      search_perfumes_unaccent_v2: {
        Args: { limit_count?: number; search_query: string }
        Returns: {
          brand_name: string
          concentration: string
          id: string
          name: string
          year: number
        }[]
      }
      slugify: { Args: { text_input: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
