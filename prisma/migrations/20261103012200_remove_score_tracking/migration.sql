-- Remove score tracking. The association does not record scores, so matches
-- finish with a single "End game" action and the game day has no target score.
ALTER TABLE "GameDay" DROP COLUMN "targetScore";
ALTER TABLE "Match" DROP COLUMN "score1";
ALTER TABLE "Match" DROP COLUMN "score2";
