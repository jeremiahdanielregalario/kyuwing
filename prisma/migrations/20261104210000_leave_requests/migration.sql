-- Players ask to leave from the public live link; the queue master confirms or declines.
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "gameDayId" TEXT NOT NULL,
    "sessionPlayerId" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_gameDayId_status_idx" ON "LeaveRequest"("gameDayId", "status");
CREATE INDEX "LeaveRequest_sessionPlayerId_idx" ON "LeaveRequest"("sessionPlayerId");

ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_gameDayId_fkey" FOREIGN KEY ("gameDayId") REFERENCES "GameDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_sessionPlayerId_fkey" FOREIGN KEY ("sessionPlayerId") REFERENCES "SessionPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
