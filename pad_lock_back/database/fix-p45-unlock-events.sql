WITH parsed AS (
  SELECT
    id,
    "rawPayload"->>'eventSourceCode' AS source_code,
    NULLIF(
      split_part(
        trim(both '()' FROM "rawPayload"->>'raw'),
        ',',
        13
      ),
      ''
    )::integer AS verification
  FROM lock_events
  WHERE type = 'unlock_rejected'
    AND "rawPayload"->>'kind' = 'p45_report'
)
UPDATE lock_events event
SET type = 'unlocked'
FROM parsed
WHERE event.id = parsed.id
  AND (
    (
      parsed.source_code IN ('1', '6')
      AND (
        parsed.verification BETWEEN 1 AND 10
        OR parsed.verification = 98
      )
    )
    OR (
      parsed.source_code IN ('4', '7')
      AND parsed.verification = 1
    )
  );

UPDATE lock_events
SET type = 'other'
WHERE type = 'unlock_rejected'
  AND "rawPayload"->>'kind' = 'p45_report'
  AND "rawPayload"->>'eventSourceCode' IN ('3', '8');
