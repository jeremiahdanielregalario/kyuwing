-- Non-affiliates are plus-ones from outside the association.
ALTER TYPE "PlayerCategory" ADD VALUE IF NOT EXISTS 'NON_AFFILIATE';
