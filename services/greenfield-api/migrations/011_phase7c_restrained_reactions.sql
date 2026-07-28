-- Phase 7C: Founder Alpha restrained reaction set.
-- Canonical reactions: Like, Celebrate, Insightful, Support, Curious.

UPDATE greenfield_reactions
SET reaction_type = CASE
  WHEN reaction_type = 'love' THEN 'support'
  WHEN reaction_type = 'funny' THEN 'curious'
  ELSE reaction_type
END
WHERE reaction_type IN ('love', 'funny');

UPDATE greenfield_comment_reactions
SET reaction_type = CASE
  WHEN reaction_type = 'love' THEN 'support'
  WHEN reaction_type = 'funny' THEN 'curious'
  ELSE reaction_type
END
WHERE reaction_type IN ('love', 'funny');

ALTER TABLE greenfield_reactions
  DROP CONSTRAINT IF EXISTS greenfield_reactions_reaction_type_check;
ALTER TABLE greenfield_reactions
  ADD CONSTRAINT greenfield_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','celebrate','insightful','support','curious'));

ALTER TABLE greenfield_comment_reactions
  DROP CONSTRAINT IF EXISTS greenfield_comment_reactions_reaction_type_check;
ALTER TABLE greenfield_comment_reactions
  ADD CONSTRAINT greenfield_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','celebrate','insightful','support','curious'));

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','011') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
