-- Inbetween demo: datové schéma (PostgreSQL)
DROP TABLE IF EXISTS waitlist, outreach, questionnaires, thought_records, alerts, events, messages, tasks, checkins, clients CASCADE;

CREATE TABLE clients (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  salutation    TEXT NOT NULL,           -- oslovení v 5. pádě (Petro)
  therapist     TEXT NOT NULL,
  focus         TEXT NOT NULL,
  next_session  TEXT NOT NULL,
  plan          TEXT NOT NULL,
  waiting       BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_techniques TEXT[] NOT NULL DEFAULT '{}', -- techniky z knihovny (lib/techniques.ts), které smí parťák nabízet
  prep           TEXT,                     -- co chce klient probrat na příštím sezení
  share_thoughts BOOLEAN NOT NULL DEFAULT TRUE,  -- souhlasy klienta: co vidí psycholog
  share_scores   BOOLEAN NOT NULL DEFAULT TRUE,
  share_chat     BOOLEAN NOT NULL DEFAULT TRUE,
  reminders      JSONB NOT NULL DEFAULT '[]',
  solo           BOOLEAN NOT NULL DEFAULT FALSE  -- používá Inbetween zatím bez psychologa
);

CREATE TABLE checkins (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  mood        INT  NOT NULL CHECK (mood BETWEEN 1 AND 5),
  anxiety     INT  NOT NULL CHECK (anxiety BETWEEN 0 AND 10),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  hint        TEXT NOT NULL,
  week_done   INT  NOT NULL DEFAULT 0,
  week_goal   INT  NOT NULL,
  done_today  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE messages (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  text        TEXT NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE thought_records (
  id               SERIAL PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  situation        TEXT NOT NULL,
  thought          TEXT NOT NULL,
  emotion          TEXT NOT NULL,
  intensity_before INT  NOT NULL CHECK (intensity_before BETWEEN 0 AND 100),
  balanced         TEXT,
  intensity_after  INT  CHECK (intensity_after BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questionnaires (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('gad7','phq9')),
  score       INT  NOT NULL,
  item9       INT,                         -- PHQ-9 otázka 9 (myšlenky na smrt), hlídá se zvlášť
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outreach (
  id          SERIAL PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,               -- zpráva od psychologa (návrh od AI, odeslal psycholog)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE waitlist (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  weeks         INT  NOT NULL,
  gad7          INT  NOT NULL,
  phq9          INT  NOT NULL,
  item9         INT  NOT NULL DEFAULT 0,
  modules_done  INT  NOT NULL DEFAULT 0,
  note          TEXT,
  client_id     TEXT REFERENCES clients(id) ON DELETE CASCADE  -- uživatel z aplikace, který požádal o psychologa
);

CREATE INDEX ON checkins (client_id, created_at);
CREATE INDEX ON messages (client_id, created_at);
CREATE INDEX ON events (client_id, created_at);
CREATE INDEX ON alerts (client_id, created_at);
CREATE INDEX ON thought_records (client_id, created_at);
CREATE INDEX ON questionnaires (client_id, created_at);
CREATE INDEX ON outreach (client_id, created_at);
