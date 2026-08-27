-- CreateTable
CREATE TABLE "JobFunction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFunction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobFunction_name_key" ON "JobFunction"("name");

-- Preserve distinct free-text functions already assigned to people.
INSERT INTO "JobFunction" ("id", "name", "active", "createdAt", "updatedAt")
SELECT 'legacy-' || md5(trim("roleTitle")), trim("roleTitle"), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Person"
WHERE "roleTitle" IS NOT NULL AND trim("roleTitle") <> ''
GROUP BY trim("roleTitle");

-- AlterTable
ALTER TABLE "Person" ADD COLUMN "jobFunctionId" TEXT;

UPDATE "Person" AS person
SET "jobFunctionId" = job_function."id"
FROM "JobFunction" AS job_function
WHERE job_function."name" = trim(person."roleTitle");

ALTER TABLE "Person" DROP COLUMN "roleTitle";

-- CreateIndex
CREATE INDEX "Person_jobFunctionId_idx" ON "Person"("jobFunctionId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_jobFunctionId_fkey"
FOREIGN KEY ("jobFunctionId") REFERENCES "JobFunction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
