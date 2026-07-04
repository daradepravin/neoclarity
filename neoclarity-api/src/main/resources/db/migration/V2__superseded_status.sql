-- V2: Allow SUPERSEDED status for recommendation dedupe
-- Older PENDING recommendations are superseded when a newer near-identical
-- recommendation arrives from the same agent (prevents pile-up across syncs).

ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_response_check;
ALTER TABLE recommendations ADD CONSTRAINT recommendations_response_check
    CHECK (response IN ('PENDING','APPROVED','DISMISSED','REMIND_LATER','SUPERSEDED'));
