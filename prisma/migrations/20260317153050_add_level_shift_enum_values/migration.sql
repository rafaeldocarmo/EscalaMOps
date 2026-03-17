-- Add missing enum values used by the schema.
-- Uses duplicate_object handling so it's safe to run even if already added.
DO $$
BEGIN
  BEGIN
    ALTER TYPE "Level" ADD VALUE 'ESPC';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "Level" ADD VALUE 'PRODUCAO';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE "Shift" ADD VALUE 'TC';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
