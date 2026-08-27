-- Ensure every existing accounting competence has an explicit operational period.
INSERT INTO "AccountingPeriod" ("id", "workId", "competence", "status")
SELECT
    'period-' || md5(entry."workId" || ':' || entry."competence"::TEXT),
    entry."workId",
    entry."competence",
    'OPEN'::"PeriodStatus"
FROM "AccountingEntry" AS entry
LEFT JOIN "AccountingPeriod" AS period
    ON period."workId" = entry."workId" AND period."competence" = entry."competence"
WHERE period."id" IS NULL
GROUP BY entry."workId", entry."competence";
