-- CreateTable
CREATE TABLE "BoardOp" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT,
    "pressedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardOp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardOp_gameDayId_appliedAt_idx" ON "BoardOp"("gameDayId", "appliedAt");

-- AddForeignKey
ALTER TABLE "BoardOp" ADD CONSTRAINT "BoardOp_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
