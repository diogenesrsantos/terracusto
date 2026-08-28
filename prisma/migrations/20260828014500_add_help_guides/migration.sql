CREATE TABLE "HelpGuide" (
    "id" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpGuide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpStep" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HelpStepImage" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpStepImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelpGuide_pageKey_key" ON "HelpGuide"("pageKey");
CREATE UNIQUE INDEX "HelpStep_guideId_position_key" ON "HelpStep"("guideId", "position");
CREATE UNIQUE INDEX "HelpStepImage_stepId_position_key" ON "HelpStepImage"("stepId", "position");

ALTER TABLE "HelpStep" ADD CONSTRAINT "HelpStep_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "HelpGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpStepImage" ADD CONSTRAINT "HelpStepImage_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "HelpStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "name")
VALUES ('help-manage', 'help.manage', 'Gerenciar manuais de ajuda')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT "Role"."id", "Permission"."id"
FROM "Role", "Permission"
WHERE "Role"."code" = 'ADMIN' AND "Permission"."code" = 'help.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
