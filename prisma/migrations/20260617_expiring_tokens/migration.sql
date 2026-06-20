-- Expiring offline token metadata
ALTER TABLE "Store"
  ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refreshToken" TEXT,
  ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);
