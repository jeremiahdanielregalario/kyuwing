-- The 13-level ladder: E is flat (E- and E+ fold into E), and the border levels
-- DE, CD, BC and AB are retired, each rounding down to the top of the bracket below.
-- Postgres cannot drop enum values, so the type is rebuilt and the column converted in place.

ALTER TYPE "SkillLevel" RENAME TO "SkillLevel_old";

CREATE TYPE "SkillLevel" AS ENUM ('E', 'D_MINUS', 'D', 'D_PLUS', 'C_MINUS', 'C', 'C_PLUS', 'B_MINUS', 'B', 'B_PLUS', 'A_MINUS', 'A', 'A_PLUS', 'X');

ALTER TABLE "Player" ALTER COLUMN "level" TYPE "SkillLevel" USING (
  CASE "level"::text
    WHEN 'E_MINUS' THEN 'E'
    WHEN 'E_PLUS' THEN 'E'
    WHEN 'DE' THEN 'E'
    WHEN 'CD' THEN 'D_PLUS'
    WHEN 'BC' THEN 'C_PLUS'
    WHEN 'AB' THEN 'B_PLUS'
    ELSE "level"::text
  END
)::"SkillLevel";

DROP TYPE "SkillLevel_old";
