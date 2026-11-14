-- Other names a player signs up with in the chat, recognised as their nickname.

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
