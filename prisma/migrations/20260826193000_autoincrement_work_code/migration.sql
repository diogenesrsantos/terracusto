-- CreateSequence
CREATE SEQUENCE "Work_code_seq";

-- Add and populate the new numeric code without losing existing works.
ALTER TABLE "Work" ADD COLUMN "newCode" INTEGER;

WITH numbered AS (
    SELECT "id", row_number() OVER (ORDER BY "createdAt", "id")::INTEGER AS "code"
    FROM "Work"
)
UPDATE "Work" AS work
SET "newCode" = numbered."code"
FROM numbered
WHERE work."id" = numbered."id";

ALTER TABLE "Work"
ALTER COLUMN "newCode" SET DEFAULT nextval('"Work_code_seq"');

SELECT setval(
    '"Work_code_seq"',
    COALESCE((SELECT MAX("newCode") FROM "Work"), 1),
    EXISTS(SELECT 1 FROM "Work")
);

ALTER TABLE "Work" ALTER COLUMN "newCode" SET NOT NULL;

-- Replace the former free-text code.
DROP INDEX "Work_code_key";
ALTER TABLE "Work" DROP COLUMN "code";
ALTER TABLE "Work" RENAME COLUMN "newCode" TO "code";
ALTER SEQUENCE "Work_code_seq" OWNED BY "Work"."code";

-- CreateIndex
CREATE UNIQUE INDEX "Work_code_key" ON "Work"("code");
