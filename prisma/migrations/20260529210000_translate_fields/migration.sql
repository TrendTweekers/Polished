-- AlterTable: per-field translation toggles
ALTER TABLE "Settings"
  ADD COLUMN "translateTitles" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "translateDescriptions" BOOLEAN NOT NULL DEFAULT true;
