-- Phase 7C-C: ensure every Greenfield account has a social actor/profile bridge.

UPDATE actors a
SET account_id = g.account_id,
    updated_at = NOW()
FROM profiles p
JOIN greenfield_accounts g ON lower(g.primary_handle) = lower(p.handle)
WHERE p.actor_id = a.id
  AND a.account_id IS NULL;

INSERT INTO actors (id, account_id, kind, created_at, updated_at, deleted_at, version)
SELECT
  'actor-' || g.account_id,
  g.account_id,
  'person',
  g.created_at,
  NOW(),
  NULL,
  1
FROM greenfield_accounts g
WHERE NOT EXISTS (
  SELECT 1 FROM actors a WHERE a.account_id = g.account_id
);

INSERT INTO profiles (
  id,
  actor_id,
  handle,
  display_name,
  kind,
  bio,
  avatar_url,
  cover_url,
  cover_colour,
  pronouns,
  location_label,
  location_visibility,
  website_label,
  website_url,
  website_domain,
  website_visibility,
  focus_status_id,
  focus_status_label,
  focus_status_message,
  focus_status_updated_at,
  visibility,
  module_count,
  featured_module_ids,
  identity_claims,
  joined_at,
  created_at,
  updated_at,
  deleted_at,
  version
)
SELECT
  'profile-' || g.account_id,
  a.id,
  g.primary_handle,
  g.primary_handle,
  'person',
  '',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'available',
  'Available',
  'Ready in Modula',
  NOW(),
  'public',
  0,
  '[]'::jsonb,
  '[]'::jsonb,
  g.created_at,
  g.created_at,
  NOW(),
  NULL,
  1
FROM greenfield_accounts g
JOIN actors a ON a.account_id = g.account_id
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.actor_id = a.id
)
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE lower(p.handle) = lower(g.primary_handle) AND p.deleted_at IS NULL
  );

INSERT INTO greenfield_appearance_preferences (
  account_id,
  mode,
  variant,
  surface,
  accent_id,
  custom_accent,
  text_scale,
  bold_text,
  reduce_motion,
  reduce_transparency,
  increase_contrast,
  version,
  updated_at
)
SELECT
  g.account_id,
  'system',
  'standard',
  'native',
  'modula',
  NULL,
  1.00,
  FALSE,
  FALSE,
  FALSE,
  FALSE,
  1,
  NOW()
FROM greenfield_accounts g
ON CONFLICT (account_id) DO NOTHING;

INSERT INTO notification_preferences (
  id,
  actor_id,
  follow_enabled,
  like_enabled,
  reaction_enabled,
  repost_enabled,
  quote_enabled,
  reply_enabled,
  comment_enabled,
  mention_enabled,
  module_event_enabled,
  extension_enabled,
  bundle_style,
  created_at,
  updated_at,
  version
)
SELECT
  'notification-preferences-' || a.account_id,
  a.id,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  FALSE,
  FALSE,
  'focus',
  NOW(),
  NOW(),
  1
FROM actors a
WHERE a.account_id IS NOT NULL
ON CONFLICT (actor_id) DO NOTHING;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '014')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
