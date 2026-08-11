-- Phase 7I-F5B: expand social reactions for final product acceptance.
-- Existing restrained reactions stay valid; F5 social surfaces also need Love,
-- Laugh and Fire without remapping user intent at write time.

ALTER TABLE greenfield_reactions
  DROP CONSTRAINT IF EXISTS greenfield_reactions_reaction_type_check;
ALTER TABLE greenfield_reactions
  ADD CONSTRAINT greenfield_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','laugh','fire','celebrate','insightful','support','curious'));

ALTER TABLE greenfield_comment_reactions
  DROP CONSTRAINT IF EXISTS greenfield_comment_reactions_reaction_type_check;
ALTER TABLE greenfield_comment_reactions
  ADD CONSTRAINT greenfield_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','laugh','fire','celebrate','insightful','support','curious'));

INSERT INTO schema_metadata (key,value)
VALUES ('schema_version','035')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
