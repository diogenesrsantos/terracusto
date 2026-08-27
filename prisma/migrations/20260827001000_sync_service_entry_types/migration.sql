-- Create entry types for analytical service/reimbursement accounts that do not
-- yet have a matching type. This includes user-created accounts such as 3.1.2.
INSERT INTO "EntryType" (
    "id", "name", "active", "defaultDebitAccountId", "defaultCreditAccountId", "createdAt", "updatedAt"
)
SELECT
    'entry-type-account-' || md5(account."id"),
    account."name",
    true,
    clients."id",
    account."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Account" AS account
JOIN "Account" AS parent ON parent."id" = account."parentId"
CROSS JOIN "Account" AS clients
WHERE parent."code" IN ('3.1', '3.2')
  AND account."analytic" = true
  AND account."active" = true
  AND clients."code" = '1.2'
  AND NOT EXISTS (
      SELECT 1 FROM "EntryType" AS entry_type
      WHERE entry_type."defaultCreditAccountId" = account."id"
         OR entry_type."name" = account."name"
  );
