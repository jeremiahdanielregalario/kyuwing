-- Maya and GoTyme as payment methods.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MAYA' AFTER 'GCASH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GOTYME' AFTER 'MAYA';
