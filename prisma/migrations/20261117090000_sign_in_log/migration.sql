-- Sign-in log: when queue masters and the developer signed in and out.

-- CreateTable
CREATE TABLE "SignInLog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developer" BOOLEAN NOT NULL DEFAULT false,
    "device" TEXT,
    "signedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "signedOutAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "SignInLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignInLog_signedInAt_idx" ON "SignInLog"("signedInAt");
