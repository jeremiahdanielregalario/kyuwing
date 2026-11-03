-- Split ALUMNI into INACTIVE and ALUMNI as separate categories.
-- INACTIVE = temporarily inactive members
-- ALUMNI = graduated/permanently inactive members
ALTER TYPE "PlayerCategory" ADD VALUE IF NOT EXISTS 'INACTIVE';
