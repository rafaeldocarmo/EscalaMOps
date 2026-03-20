-- Ensure enum value exists in case it was applied manually already.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'SwapType'
      AND e.enumlabel = 'SHIFT_SWAP'
  ) THEN
    ALTER TYPE "SwapType" ADD VALUE 'SHIFT_SWAP';
  END IF;
END $$;

