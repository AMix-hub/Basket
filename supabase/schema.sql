-- =========================================================
-- Sport-IQ – komplett Supabase-schema  (v2)
-- Kör detta skript EN gång i Supabase SQL Editor.
-- OBS: Scriptet droppar och återskapar alla tabeller.
-- =========================================================


-- =========================================================
-- 0. Rensa befintliga objekt (idempotent)
-- =========================================================
DROP TABLE IF EXISTS dev_item_comments   CASCADE;
DROP TABLE IF EXISTS dev_items           CASCADE;
DROP TABLE IF EXISTS coach_chat          CASCADE;
DROP TABLE IF EXISTS player_notes        CASCADE;
DROP TABLE IF EXISTS rsvps               CASCADE;
DROP TABLE IF EXISTS player_groups       CASCADE;
DROP TABLE IF EXISTS custom_season_plans CASCADE;
DROP TABLE IF EXISTS team_exercises      CASCADE;
DROP TABLE IF EXISTS session_notes       CASCADE;
DROP TABLE IF EXISTS training_free_periods CASCADE;
DROP TABLE IF EXISTS halls               CASCADE;
DROP TABLE IF EXISTS coach_notes         CASCADE;
DROP TABLE IF EXISTS tactic_live_state   CASCADE;
DROP TABLE IF EXISTS tactics             CASCADE;
DROP TABLE IF EXISTS attendance          CASCADE;
DROP TABLE IF EXISTS sessions            CASCADE;
DROP TABLE IF EXISTS players             CASCADE;
DROP TABLE IF EXISTS messages            CASCADE;
DROP TABLE IF EXISTS team_members        CASCADE;
DROP TABLE IF EXISTS teams               CASCADE;
DROP TABLE IF EXISTS profiles            CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created    ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();


-- =========================================================
-- 1. profiles
-- =========================================================
CREATE TABLE profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL DEFAULT '',
  email             TEXT        NOT NULL DEFAULT '',
  role              TEXT        NOT NULL DEFAULT 'player'
                                          CHECK (role IN ('admin','co_admin','coach','assistant','parent','player')),
  roles             TEXT[]      NOT NULL DEFAULT ARRAY['player'],
  -- admin_id: points to the root admin for co-admins and club members; null for root admins
  admin_id          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  sport             TEXT        NOT NULL DEFAULT 'basket',
  club_name         TEXT,
  club_logo_url     TEXT,
  club_website_url  TEXT,
  coach_invite_code TEXT        UNIQUE,
  child_name        TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX profiles_admin_id_idx ON profiles (admin_id);


-- =========================================================
-- 2. teams
-- =========================================================
CREATE TABLE teams (
  id                  UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT   NOT NULL,
  age_group           TEXT   NOT NULL DEFAULT '',
  coach_id            UUID   REFERENCES profiles(id) ON DELETE SET NULL,
  admin_id            UUID   NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  club_name           TEXT   NOT NULL DEFAULT '',
  club_logo_url       TEXT,
  sport               TEXT   NOT NULL DEFAULT 'basket',
  member_ids          UUID[] NOT NULL DEFAULT '{}',
  invite_code         TEXT   NOT NULL UNIQUE,
  parent_invite_code  TEXT   NOT NULL UNIQUE,
  player_invite_code  TEXT   NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX teams_admin_id_idx ON teams (admin_id);
CREATE INDEX teams_coach_id_idx ON teams (coach_id);


-- =========================================================
-- 3. team_members
-- =========================================================
CREATE TABLE team_members (
  team_id   UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX team_members_user_id_idx ON team_members (user_id);


-- =========================================================
-- 4. messages
-- =========================================================
CREATE TABLE messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name  TEXT        NOT NULL DEFAULT '',
  recipient_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  text         TEXT        NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by      UUID[]      NOT NULL DEFAULT '{}'
);

CREATE INDEX messages_team_id_idx ON messages (team_id);
CREATE INDEX messages_sent_at_idx ON messages (sent_at DESC);


-- =========================================================
-- 5. coach_chat  (global channel for coaches/admins)
-- =========================================================
CREATE TABLE coach_chat (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT        NOT NULL DEFAULT '',
  text        TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX coach_chat_sent_at_idx ON coach_chat (sent_at ASC);


-- =========================================================
-- 6. halls
-- =========================================================
CREATE TABLE halls (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX halls_admin_id_idx ON halls (admin_id);


-- =========================================================
-- 7. training_free_periods
-- =========================================================
CREATE TABLE training_free_periods (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE  NOT NULL,
  end_date   DATE  NOT NULL,
  label      TEXT  NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX training_free_periods_admin_id_idx ON training_free_periods (admin_id);


-- =========================================================
-- 8. players
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
-- 9. player_groups
-- =========================================================
CREATE TABLE player_groups (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID   NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT   NOT NULL,
  player_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX player_groups_team_id_idx ON player_groups (team_id);


-- =========================================================
-- 10. sessions
-- =========================================================
CREATE TABLE sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  title            TEXT        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'träning'
                                         CHECK (type IN ('träning','match')),
  time             TEXT        NOT NULL DEFAULT '17:00',
  duration         INTEGER,               -- minutes
  hall_id          UUID        REFERENCES halls(id) ON DELETE SET NULL,
  location         TEXT,                  -- free-text location override
  coach_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  coach_name       TEXT,
  -- match-specific
  opponent         TEXT,
  home_or_away     TEXT        CHECK (home_or_away IN ('home','away')),
  result           TEXT,
  -- recurring
  recurring        BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence_rule  TEXT,
  cancelled        BOOLEAN     NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_team_id_idx ON sessions (team_id);
CREATE INDEX sessions_date_idx    ON sessions (date);


-- =========================================================
-- 11. rsvps
-- =========================================================
CREATE TABLE rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_id    UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL CHECK (status IN ('coming','not_coming','maybe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, user_id)
);

CREATE INDEX rsvps_session_id_idx ON rsvps (session_id);
CREATE INDEX rsvps_team_id_idx    ON rsvps (team_id);


-- =========================================================
-- 12. attendance
-- =========================================================
CREATE TABLE attendance (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('present','absent','sick')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, player_id)
);


-- =========================================================
-- 13. session_notes
-- =========================================================
CREATE TABLE session_notes (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_id      UUID  NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  content      TEXT  NOT NULL DEFAULT '',
  sub_activities JSONB NOT NULL DEFAULT '[]',
  updated_by   UUID  REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX session_notes_session_id_idx ON session_notes (session_id);


-- =========================================================
-- 14. player_notes
-- =========================================================
CREATE TABLE player_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID        NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  player_id  UUID        NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  coach_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX player_notes_team_id_player_id_idx ON player_notes (team_id, player_id);
CREATE INDEX player_notes_created_at_idx        ON player_notes (created_at DESC);


-- =========================================================
-- 15. tactics
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
-- 16. tactic_live_state
-- =========================================================
CREATE TABLE tactic_live_state (
  team_id              UUID    PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  players              JSONB   NOT NULL DEFAULT '[]',
  arrows               JSONB   NOT NULL DEFAULT '[]',
  animation_playing    BOOLEAN NOT NULL DEFAULT FALSE,
  animation_start_time TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by           UUID    REFERENCES profiles(id) ON DELETE SET NULL
);


-- =========================================================
-- 17. team_exercises
-- =========================================================
CREATE TABLE team_exercises (
  id          UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID   NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title       TEXT   NOT NULL,
  description TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_by  UUID   REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX team_exercises_team_id_idx ON team_exercises (team_id);


-- =========================================================
-- 18. custom_season_plans
-- =========================================================
CREATE TABLE custom_season_plans (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID  NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT  NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_by UUID  REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX custom_season_plans_team_id_idx ON custom_season_plans (team_id);


-- =========================================================
-- 19. coach_notes
-- =========================================================
CREATE TABLE coach_notes (
  user_id    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 20. dev_items
-- =========================================================
CREATE TABLE dev_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','in_progress','done')),
  priority    TEXT        NOT NULL DEFAULT 'medium'
                                    CHECK (priority IN ('low','medium','high')),
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 21. dev_item_comments
-- =========================================================
CREATE TABLE dev_item_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES dev_items(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX dev_item_comments_item_id_idx ON dev_item_comments (item_id);


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

CREATE TRIGGER trg_rsvps_updated_at
  BEFORE UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_session_notes_updated_at
  BEFORE UPDATE ON session_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_custom_season_plans_updated_at
  BEFORE UPDATE ON custom_season_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dev_items_updated_at
  BEFORE UPDATE ON dev_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================================================
-- Trigger: skapa profil automatiskt vid ny auth-användare
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role        TEXT;
  v_invite_code TEXT;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'player');

  IF v_role = 'admin' THEN
    v_invite_code := upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));
  END IF;

  INSERT INTO public.profiles (
    id, name, email, role, roles, admin_id, sport,
    club_name, coach_invite_code, child_name
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',       ''), 'Okänd'),
    COALESCE(NEW.email, ''),
    v_role,
    ARRAY[v_role],
    NULLIF(NEW.raw_user_meta_data->>'admin_id', '')::UUID,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'sport',      ''), 'basket'),
    NULLIF(NEW.raw_user_meta_data->>'club_name',  ''),
    v_invite_code,
    NULLIF(NEW.raw_user_meta_data->>'child_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profil kunde inte skapas för %. Fel: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =========================================================
-- Row Level Security (RLS)
-- =========================================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_chat           ENABLE ROW LEVEL SECURITY;
ALTER TABLE halls                ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_free_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE players              ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps                ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactic_live_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_exercises       ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_season_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_item_comments    ENABLE ROW LEVEL SECURITY;


-- profiles
CREATE POLICY "profiles: public read"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles: insert own"    ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own or admin"
  ON profiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','co_admin')
        AND profiles.admin_id = (CASE WHEN p.admin_id IS NOT NULL THEN p.admin_id ELSE p.id END)
    )
  );


-- teams
CREATE POLICY "teams: public read"           ON teams FOR SELECT USING (true);
CREATE POLICY "teams: insert by authenticated" ON teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "teams: update by coach or admin"
  ON teams FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = admin_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND teams.admin_id = COALESCE(p.admin_id, p.id)));
CREATE POLICY "teams: delete by admin"
  ON teams FOR DELETE TO authenticated
  USING (auth.uid() = admin_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND teams.admin_id = COALESCE(p.admin_id, p.id)));


-- team_members
CREATE POLICY "team_members: read by authenticated" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members: insert"
  ON team_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id
               AND (t.coach_id = auth.uid() OR t.admin_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND (SELECT admin_id FROM teams WHERE id = team_id) = COALESCE(p.admin_id, p.id))
  );
CREATE POLICY "team_members: delete"
  ON team_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id
               AND (t.coach_id = auth.uid() OR t.admin_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND (SELECT admin_id FROM teams WHERE id = team_id) = COALESCE(p.admin_id, p.id))
  );


-- messages
CREATE POLICY "messages: read by team members"
  ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = messages.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "messages: insert by team members"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = messages.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "messages: update by team members"
  ON messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = messages.team_id AND tm.user_id = auth.uid()));


-- coach_chat
CREATE POLICY "coach_chat: read by coaches/admins"
  ON coach_chat FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('coach','assistant','admin','co_admin')));
CREATE POLICY "coach_chat: insert by coaches/admins"
  ON coach_chat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('coach','assistant','admin','co_admin')));


-- halls
CREATE POLICY "halls: read by authenticated"  ON halls FOR SELECT TO authenticated USING (true);
CREATE POLICY "halls: write by admin"
  ON halls FOR ALL TO authenticated
  USING (auth.uid() = admin_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND halls.admin_id = COALESCE(p.admin_id, p.id)))
  WITH CHECK (admin_id = COALESCE((SELECT COALESCE(admin_id, id) FROM profiles WHERE id = auth.uid()), auth.uid()));


-- training_free_periods
CREATE POLICY "training_free_periods: read by authenticated" ON training_free_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_free_periods: write by admin"
  ON training_free_periods FOR ALL TO authenticated
  USING (auth.uid() = admin_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')
               AND training_free_periods.admin_id = COALESCE(p.admin_id, p.id)))
  WITH CHECK (admin_id = COALESCE((SELECT COALESCE(admin_id, id) FROM profiles WHERE id = auth.uid()), auth.uid()));


-- players
CREATE POLICY "players: read by team members"
  ON players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = players.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "players: write by coach/admin"
  ON players FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = players.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = players.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- player_groups
CREATE POLICY "player_groups: read by team members"
  ON player_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = player_groups.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "player_groups: write by coach/admin"
  ON player_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = player_groups.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = player_groups.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- sessions
CREATE POLICY "sessions: read by team members"
  ON sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = sessions.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "sessions: write by coach/admin"
  ON sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = sessions.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = sessions.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- rsvps
CREATE POLICY "rsvps: read by team members"
  ON rsvps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = rsvps.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "rsvps: write own"
  ON rsvps FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- attendance
CREATE POLICY "attendance: read by authenticated" ON attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance: write by coach/admin or own"
  ON attendance FOR ALL TO authenticated
  USING (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      JOIN profiles p ON p.id = tm.user_id
      WHERE s.id = attendance.session_id AND tm.user_id = auth.uid()
      AND p.role IN ('coach','assistant','admin','co_admin')
    )
  )
  WITH CHECK (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN team_members tm ON tm.team_id = s.team_id
      JOIN profiles p ON p.id = tm.user_id
      WHERE s.id = attendance.session_id AND tm.user_id = auth.uid()
      AND p.role IN ('coach','assistant','admin','co_admin')
    )
  );


-- session_notes
CREATE POLICY "session_notes: read by authenticated"  ON session_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "session_notes: write by coach/admin"
  ON session_notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- player_notes
CREATE POLICY "player_notes: read by coach/admin or own player"
  ON player_notes FOR SELECT TO authenticated
  USING (
    auth.uid() = player_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
               AND p.role IN ('coach','assistant','admin','co_admin'))
  );
CREATE POLICY "player_notes: insert by coach/admin"
  ON player_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = coach_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                AND p.role IN ('coach','assistant','admin','co_admin')));
CREATE POLICY "player_notes: update/delete own"
  ON player_notes FOR UPDATE TO authenticated
  USING (auth.uid() = coach_id);
CREATE POLICY "player_notes: delete own"
  ON player_notes FOR DELETE TO authenticated
  USING (auth.uid() = coach_id);


-- tactics
CREATE POLICY "tactics: read by team members"
  ON tactics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = tactics.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "tactics: write by coach/admin"
  ON tactics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = tactics.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = tactics.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- tactic_live_state
CREATE POLICY "tactic_live_state: public read"   ON tactic_live_state FOR SELECT USING (true);
CREATE POLICY "tactic_live_state: write by coach/admin"
  ON tactic_live_state FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = tactic_live_state.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = tactic_live_state.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- team_exercises
CREATE POLICY "team_exercises: read by team members"
  ON team_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_exercises.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "team_exercises: write by coach/admin"
  ON team_exercises FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = team_exercises.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = team_exercises.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- custom_season_plans
CREATE POLICY "custom_season_plans: read by team members"
  ON custom_season_plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = custom_season_plans.team_id AND tm.user_id = auth.uid()));
CREATE POLICY "custom_season_plans: write by coach/admin"
  ON custom_season_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                 WHERE tm.team_id = custom_season_plans.team_id AND tm.user_id = auth.uid()
                 AND p.role IN ('coach','assistant','admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members tm JOIN profiles p ON p.id = tm.user_id
                      WHERE tm.team_id = custom_season_plans.team_id AND tm.user_id = auth.uid()
                      AND p.role IN ('coach','assistant','admin','co_admin')));


-- coach_notes
CREATE POLICY "coach_notes: own only"
  ON coach_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- dev_items
CREATE POLICY "dev_items: admin only"
  ON dev_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')));


-- dev_item_comments
CREATE POLICY "dev_item_comments: admin read"
  ON dev_item_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')));
CREATE POLICY "dev_item_comments: admin insert own"
  ON dev_item_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','co_admin')));
CREATE POLICY "dev_item_comments: delete own"
  ON dev_item_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);


-- =========================================================
-- Supabase Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE coach_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE tactic_live_state;
ALTER PUBLICATION supabase_realtime ADD TABLE tactics;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE rsvps;


-- =========================================================
-- Storage buckets
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('club-logos', 'club-logos', true),
  ('avatars',    'avatars',    true)
ON CONFLICT (id) DO NOTHING;

-- Club logos: admins can upload their own club logo
CREATE POLICY "club-logos: public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'club-logos');
CREATE POLICY "club-logos: admin upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-logos'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()
                AND p.role IN ('admin','co_admin')));
CREATE POLICY "club-logos: admin update/delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'club-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars: authenticated users can manage their own
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars: own upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars: own delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
