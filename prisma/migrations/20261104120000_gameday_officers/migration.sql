-- Officers on duty for a game day, shown on the session report.
ALTER TABLE "GameDay" ADD COLUMN "queueMasterName" TEXT;
ALTER TABLE "GameDay" ADD COLUMN "financeMemberName" TEXT;
