"use server";

import { prisma } from "@/lib/prisma";

let ensured = false;

/**
 * Temporary persistence layer for on-call settings.
 *
 * This project currently has Prisma migration drift against the shared DB,
 * which makes `prisma migrate dev` unsafe. To still persist team-specific
 * on-call settings, we create a small dedicated table on-demand using raw SQL.
 *
 * When the migration history is reconciled, this should be replaced by a
 * proper Prisma model + migration.
 */
export async function ensureOnCallSettingsTable(): Promise<void> {
  if (ensured) return;

  // NOTE: Postgres only. The project datasource is PostgreSQL.
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS team_on_call_settings (
        team_id TEXT PRIMARY KEY,
        participant_team_level_ids TEXT[] NOT NULL,
        rotation_interval_days INTEGER NOT NULL,
      rotation_interval_days_by_shift JSONB NOT NULL DEFAULT '{}'::jsonb,
        rotation_interval_days_by_level JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

  // Backward-compatible: if table exists from older runs, add the new column.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE team_on_call_settings
    ADD COLUMN IF NOT EXISTS rotation_interval_days_by_shift JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE team_on_call_settings
    ADD COLUMN IF NOT EXISTS rotation_interval_days_by_level JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
  } catch (e) {
    throw e;
  }

  // Lightweight trigger to maintain updated_at (best-effort).
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'team_on_call_settings_set_updated_at'
        ) THEN
          CREATE OR REPLACE FUNCTION team_on_call_settings__touch_updated_at()
          RETURNS TRIGGER AS $func$
          BEGIN
            NEW.updated_at = now();
            RETURN NEW;
          END;
          $func$ LANGUAGE plpgsql;

          CREATE TRIGGER team_on_call_settings_set_updated_at
          BEFORE UPDATE ON team_on_call_settings
          FOR EACH ROW
          EXECUTE FUNCTION team_on_call_settings__touch_updated_at();
        END IF;
      END
      $$;
    `);
  } catch (e) {
    throw e;
  }

  ensured = true;
}

