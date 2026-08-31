CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,

  owner_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  org_id UUID NOT NULL
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  role_id INTEGER NOT NULL
    CHECK (role_id IN (1, 2, 3)), -- 1 = OWNER | 2 = EDITOR | 3 = VIEWER

  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  accepted_at TIMESTAMPTZ,

  invite_token TEXT UNIQUE,

  invite_status INTEGER NOT NULL DEFAULT 1
    CHECK (invite_status IN (1, 2, 3)), -- 1 = PENDING | 2 = ACCEPTED | 3 = EXPIRED

  invite_expires_at TIMESTAMPTZ
);