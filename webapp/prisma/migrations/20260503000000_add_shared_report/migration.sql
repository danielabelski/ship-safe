-- CreateTable
CREATE TABLE "SharedReport" (
    "token"     TEXT NOT NULL,
    "score"     INTEGER,
    "grade"     TEXT,
    "repo"      TEXT,
    "findings"  INTEGER NOT NULL DEFAULT 0,
    "report"    JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedReport_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "SharedReport_expiresAt_idx" ON "SharedReport"("expiresAt");
