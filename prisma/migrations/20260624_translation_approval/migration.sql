-- Human approval gate: a translation must be approved before it can be published.
ALTER TABLE "ProductTranslation"
  ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
