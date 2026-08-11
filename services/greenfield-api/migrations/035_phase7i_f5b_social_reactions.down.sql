ALTER TABLE greenfield_reactions
  DROP CONSTRAINT IF EXISTS greenfield_reactions_reaction_type_check;

UPDATE greenfield_reactions
SET reaction_type = CASE
  WHEN reaction_type = 'love' THEN 'support'
  WHEN reaction_type = 'laugh' THEN 'curious'
  WHEN reaction_type = 'fire' THEN 'celebrate'
  ELSE reaction_type
END
WHERE reaction_type IN ('love', 'laugh', 'fire');

ALTER TABLE greenfield_reactions
  ADD CONSTRAINT greenfield_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','celebrate','insightful','support','curious'));

ALTER TABLE greenfield_comment_reactions
  DROP CONSTRAINT IF EXISTS greenfield_comment_reactions_reaction_type_check;

UPDATE greenfield_comment_reactions
SET reaction_type = CASE
  WHEN reaction_type = 'love' THEN 'support'
  WHEN reaction_type = 'laugh' THEN 'curious'
  WHEN reaction_type = 'fire' THEN 'celebrate'
  ELSE reaction_type
END
WHERE reaction_type IN ('love', 'laugh', 'fire');

ALTER TABLE greenfield_comment_reactions
  ADD CONSTRAINT greenfield_comment_reactions_reaction_type_check
  CHECK (reaction_type IN ('like','celebrate','insightful','support','curious'));

UPDATE schema_metadata
SET value = '034', updated_at = NOW()
WHERE key = 'schema_version';
