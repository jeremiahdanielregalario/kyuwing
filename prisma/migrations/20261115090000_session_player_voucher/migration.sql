-- Voucher: a discount in pesos taken off a player's fee, like the finance sheet's Voucher column.

-- AlterTable
ALTER TABLE "SessionPlayer" ADD COLUMN "voucher" INTEGER NOT NULL DEFAULT 0;
