-- A flat base fee a queue master can choose instead of splitting the court cost.
ALTER TABLE "GameDay" ADD COLUMN "flatBaseFee" INTEGER;
