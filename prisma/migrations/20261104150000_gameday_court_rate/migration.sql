-- Optional per-game-day court rate (pesos per court per hour) for split-cost fees.
ALTER TABLE "GameDay" ADD COLUMN "courtRatePerHour" INTEGER;
