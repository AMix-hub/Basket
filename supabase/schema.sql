-- =========================================================
-- Basket-PI: Supabase schema for real-time tactic board sync
-- Run this script once in the Supabase SQL editor.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Saved tactics (named snapshots)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tactics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  team_id     TEXT        NOT NULL,
  players     JSONB       NOT NULL DEFAULT '[]',
  arrows      JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tactics_team_id_idx ON tactics (team_id);

-- ---------------------------------------------------------
-- 2. Live board state (one row per team, upserted on change)
--    Used for real-time collaboration and animation sync.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tactic_live_state (
  team_id              TEXT        PRIMARY KEY,
  players              JSONB       NOT NULL DEFAULT '[]',
  arrows               JSONB       NOT NULL DEFAULT '[]',
  animation_playing    BOOLEAN     NOT NULL DEFAULT FALSE,
  -- ISO-8601 string stored as text so all clients can parse it identically
  animation_start_time TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           TEXT        -- user id of last writer (used to suppress echo)
);

-- ---------------------------------------------------------
-- 3. Row Level Security
--    The app uses its own localStorage-based auth, not Supabase Auth.
--    We therefore use permissive policies and rely on the application
--    layer to enforce team_id isolation.
--
--    To tighten security in a production deployment, replace these
--    policies with JWT-based checks once Supabase Auth (or a custom
--    JWT provider) is wired in.  For example:
--      USING (auth.uid()::text = updated_by)
-- ---------------------------------------------------------
ALTER TABLE tactics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactic_live_state  ENABLE ROW LEVEL SECURITY;

-- Allow anonymous clients to read/write rows (application enforces team_id)
CREATE POLICY "anon full access on tactics"
  ON tactics FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon full access on tactic_live_state"
  ON tactic_live_state FOR ALL TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------
-- 4. Enable Realtime on the live-state table
-- ---------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE tactic_live_state;
ALTER PUBLICATION supabase_realtime ADD TABLE tactics;
