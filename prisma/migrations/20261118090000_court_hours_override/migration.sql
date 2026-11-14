-- Court-hours a queue master typed in, used for the fee split instead of the court plan's.
ALTER TABLE "GameDay" ADD COLUMN "courtHoursOverride" DOUBLE PRECISION;
