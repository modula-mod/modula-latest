ALTER TABLE greenfield_reactions
  DROP CONSTRAINT IF EXISTS greenfield_reactions_reaction_type_check;

ALTER TABLE greenfield_comment_reactions
  DROP CONSTRAINT IF EXISTS greenfield_comment_reactions_reaction_type_check;

UPDATE greenfield_reactions
SET reaction_type = 'funny'
WHERE reaction_type = 'curious';

UPDATE greenfield_comment_reactions
SET reaction_type = 'funny'
WHERE reaction_type = 'curious';

ALTER TABLE greenfield_reactions
  ADD CONSTRAINT greenfield_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','celebrate','insightful','support','funny'));

ALTER TABLE greenfield_comment_reactions
  ADD CONSTRAINT greenfield_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','love','celebrate','insightful','support','funny'));

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','010') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
