-- =========================================================
-- Basket App – komplett Supabase-schema
-- Kör detta skript EN gång i Supabase SQL Editor.
-- OBS: Scriptet droppar och återskapar alla tabeller.
-- =========================================================


-- =========================================================
-- 0. Rensa befintliga objekt (idempotent)
-- =========================================================

-- Drop tables first (CASCADE removes their triggers automatically)
DROP TABLE IF EXISTS coach_notes       CASCADE;
DROP TABLE IF EXISTS tactic_live_state CASCADE;
DROP TABLE IF EXISTS tactics           CASCADE;
DROP TABLE IF EXISTS attendance        CASCADE;
DROP TABLE IF EXISTS sessions          CASCADE;
DROP TABLE IF EXISTS players           CASCADE;
DROP TABLE IF EXISTS messages          CASCADE;
DROP TABLE IF EXISTS team_members      CASCADE;
DROP TABLE IF EXISTS teams             CASCADE;
DROP TABLE IF EXISTS profiles          CASCADE;

-- auth.users is never dropped here, so its trigger must be dropped explicitly
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();


-- =========================================================
-- 1. profiles  (kopplas till auth.users via trigger nedan)
-- =========================================================
CREATE TABLE profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL    DEFAULT '',
  role              TEXT        NOT NULL    DEFAULT 'player'
                                            CHECK (role IN ('admin','coach','assistant','parent','player')),
  club_name         TEXT,          -- föreningens namn  (admin)
  coach_invite_code TEXT        UNIQUE,     -- kod coacher registrerar sig med (admin)
  child_name        TEXT,          -- barnets namn i spelarlistan (parent)
  created_at        TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);


-- =========================================================
-- 2. teams
-- =========================================================
CREATE TABLE teams (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  age_group           TEXT        NOT NULL    DEFAULT '',
  coach_id            UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  admin_id            UUID        NOT NULL    REFERENCES profiles(id) ON DELETE RESTRICT,
  club_name           TEXT        NOT NULL    DEFAULT '',
  -- Denormaliserad lista med medlems-id:n (speglas i team_members nedan)
  member_ids          UUID[]      NOT NULL    DEFAULT '{}',
  invite_code         TEXT        NOT NULL    UNIQUE,  -- assistenter
  parent_invite_code  TEXT        NOT NULL    UNIQUE,  -- föräldrar
  player_invite_code  TEXT        NOT NULL    UNIQUE,  -- spelare
  created_at          TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

CREATE INDEX teams_admin_id_idx  ON teams (admin_id);
CREATE INDEX teams_coach_id_idx  ON teams (coach_id);


-- =========================================================
-- 3. team_members  (junction – strukturerade frågor / RLS)
-- =========================================================
CREATE TABLE team_members (
  team_id   UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx ON team_members (user_id);


-- =========================================================
-- 4. messages  (lagchatt + direktmeddelanden, med realtid)
-- =========================================================
CREATE TABLE messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name  TEXT        NOT NULL,
  -- NULL = lagchatt, annars mottagarens profil-id (DM)
  recipient_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  text         TEXT        NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by      UUID[]      NOT NULL DEFAULT '{}'
);

CREATE INDEX messages_team_id_idx ON messages (team_id);
CREATE INDEX messages_sent_at_idx ON messages (sent_at DESC);


-- =========================================================
-- 5. players  (spelarlista per lag, kopplad till närvaro)
-- =========================================================
CREATE TABLE players (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  number     INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX players_team_id_idx ON players (team_id);


-- =========================================================
-- 6. sessions  (kalender – träningar och matcher)
-- =========================================================
CREATE TABLE sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  title      TEXT        NOT NULL,
  type       TEXT        NOT NULL DEFAULT 'träning'
                                   CHECK (type IN ('träning','match')),
  time       TEXT        NOT NULL DEFAULT '17:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_team_id_idx ON sessions (team_id);
CREATE INDEX sessions_date_idx    ON sessions (date);


-- =========================================================
-- 7. attendance  (närvaro per session och spelare)
-- =========================================================
CREATE TABLE attendance (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('present','absent','sick')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, player_id)
);


-- =========================================================
-- 8. tactics  (taktiktavla – sparade snapshots med JSON)
-- =========================================================
CREATE TABLE tactics (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  players    JSONB       NOT NULL DEFAULT '[]',
  arrows     JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tactics_team_id_idx ON tactics (team_id);


-- =========================================================
-- 9. tactic_live_state  (realtidssynk av taktiktavlan)
-- =========================================================
CREATE TABLE tactic_live_state (
  team_id              UUID        PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  players              JSONB       NOT NULL DEFAULT '[]',
  arrows               JSONB       NOT NULL DEFAULT '[]',
  animation_playing    BOOLEAN     NOT NULL DEFAULT FALSE,
  -- ISO-8601 sträng – alla klienter parsar identiskt
  animation_start_time TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- vems uppdatering det är (används för att tysta eko)
  updated_by           UUID        REFERENCES profiles(id) ON DELETE SET NULL
);


-- =========================================================
-- 10. coach_notes  (anteckningar i den flytande knappen)
-- =========================================================
CREATE TABLE coach_notes (
  user_id    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- Triggers: updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_tactic_live_updated_at
  BEFORE UPDATE ON tactic_live_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_coach_notes_updated_at
  BEFORE UPDATE ON coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================================
-- Trigger: skapa profil automatiskt vid ny auth-användare
-- Metadata skickas via supabase.auth.signUp({ options.data })
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_invite_code TEXT;
BEGIN
  -- Generera en 6-tecken inbjudningskod för admins (server-side, garanterat unik)
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'player') = 'admin' THEN
    v_invite_code := upper(
      substring(
        encode(gen_random_bytes(4), 'hex')
        FROM 1 FOR 6
      )
    );
  END IF;

  INSERT INTO public.profiles (id, name, role, club_name, coach_invite_code, child_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',       ''), 'Okänd'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',       ''), 'player'),
    NULLIF(NEW.raw_user_meta_data->>'club_name',  ''),
    v_invite_code,
    NULLIF(NEW.raw_user_meta_data->>'child_name', '')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- Row Level Security (RLS)
-- =========================================================
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactic_live_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- profiles
--   Anon kan läsa (behövs för inbjudningskods-validering
--   innan sign-up).  Varje användare hanterar bara sin egen
--   rad.
-- ---------------------------------------------------------
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE TO authenticated
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------
-- teams
--   Anon kan läsa (inbjudningskods-validering).
--   Inloggad användare kan skapa lag.
--   Coach / admin kan uppdatera sitt eget lag.
-- ---------------------------------------------------------
CREATE POLICY "teams: public read"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "teams: insert by authenticated"
  ON teams FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "teams: update by coach or admin"
  ON teams FOR UPDATE TO authenticated
  USING      (auth.uid() = coach_id OR auth.uid() = admin_id)
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = admin_id);

CREATE POLICY "teams: delete by admin"
  ON teams FOR DELETE TO authenticated
  USING (auth.uid() = admin_id);

-- ---------------------------------------------------------
-- team_members
-- ---------------------------------------------------------
CREATE POLICY "team_members: read by authenticated"
  ON team_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "team_members: insert own"
  ON team_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "team_members: delete own or by coach"
  ON team_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
        AND (t.coach_id = auth.uid() OR t.admin_id = auth.uid())
    )
  );

-- ---------------------------------------------------------
-- messages
-- ---------------------------------------------------------
CREATE POLICY "messages: read by team members"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = messages.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "messages: insert by team members"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = messages.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "messages: update read_by by team members"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = messages.team_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = messages.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------
-- players
-- ---------------------------------------------------------
CREATE POLICY "players: read by team members"
  ON players FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = players.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "players: write by coach/assistant/admin"
  ON players FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = players.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = players.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  );

-- ---------------------------------------------------------
-- sessions
-- ---------------------------------------------------------
CREATE POLICY "sessions: read by team members"
  ON sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = sessions.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "sessions: write by coach/assistant/admin"
  ON sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = sessions.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = sessions.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  );

-- ---------------------------------------------------------
-- attendance
-- ---------------------------------------------------------
CREATE POLICY "attendance: read by team members"
  ON attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      WHERE s.id = attendance.session_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "attendance: write by coach/assistant/admin"
  ON attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      JOIN profiles p ON p.id = tm.user_id
      WHERE s.id = attendance.session_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      JOIN profiles p ON p.id = tm.user_id
      WHERE s.id = attendance.session_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  );

-- ---------------------------------------------------------
-- tactics
-- ---------------------------------------------------------
CREATE POLICY "tactics: read by team members"
  ON tactics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = tactics.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "tactics: write by coach/assistant/admin"
  ON tactics FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = tactics.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = tactics.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  );

-- ---------------------------------------------------------
-- tactic_live_state
-- ---------------------------------------------------------
CREATE POLICY "tactic_live_state: read by team members"
  ON tactic_live_state FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = tactic_live_state.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "tactic_live_state: write by coach/assistant/admin"
  ON tactic_live_state FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = tactic_live_state.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN profiles p ON p.id = tm.user_id
      WHERE tm.team_id = tactic_live_state.team_id
        AND tm.user_id = auth.uid()
        AND p.role IN ('coach','assistant','admin')
    )
  );

-- ---------------------------------------------------------
-- coach_notes  (varje användare ser bara sina egna)
-- ---------------------------------------------------------
CREATE POLICY "coach_notes: own only"
  ON coach_notes FOR ALL TO authenticated
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =========================================================
-- Realtid (Supabase Realtime)
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tactic_live_state;
ALTER PUBLICATION supabase_realtime ADD TABLE tactics;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
