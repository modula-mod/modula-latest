-- Phase 6S VPS repair: converge denormalized counters and account defaults.
-- This is intentionally data-only because 006 may already be applied on preview.

INSERT INTO greenfield_reactions (reaction_id, actor_id, post_id, reaction_type, created_at, updated_at)
SELECT 'reaction-' || id, actor_id, post_id, 'like', created_at, updated_at
FROM post_likes
WHERE deleted_at IS NULL
ON CONFLICT (actor_id, post_id) DO NOTHING;

UPDATE posts p
SET
  like_count = counts.like_count,
  reaction_count = counts.reaction_count,
  repost_count = counts.repost_count,
  quote_count = counts.quote_count,
  reply_count = counts.comment_count,
  updated_at = NOW()
FROM (
  SELECT
    p.id,
    COALESCE((SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id AND l.deleted_at IS NULL), 0)::integer AS like_count,
    COALESCE((SELECT COUNT(*) FROM greenfield_reactions r WHERE r.post_id = p.id), 0)::integer AS reaction_count,
    COALESCE((SELECT COUNT(*) FROM post_reposts rp WHERE rp.post_id = p.id AND rp.deleted_at IS NULL), 0)::integer AS repost_count,
    COALESCE((SELECT COUNT(*) FROM greenfield_quote_posts q WHERE q.quoted_post_id = p.id), 0)::integer AS quote_count,
    COALESCE((SELECT COUNT(*) FROM greenfield_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL), 0)::integer AS comment_count
  FROM posts p
) counts
WHERE p.id = counts.id;

INSERT INTO greenfield_appearance_preferences (
  account_id, mode, variant, surface, accent_id, custom_accent, text_scale,
  bold_text, reduce_motion, reduce_transparency, increase_contrast, version, updated_at
)
SELECT
  account_id, 'system', 'standard', 'native', 'modula', NULL, 1.00,
  FALSE, FALSE, FALSE, FALSE, 1, NOW()
FROM greenfield_accounts
ON CONFLICT (account_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','007') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
