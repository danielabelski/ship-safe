-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "selectedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IntelligenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "engagement" INTEGER,
    "score" INTEGER NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'watch',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "riskTypes" JSONB NOT NULL DEFAULT '[]',
    "affectedAreas" JSONB NOT NULL DEFAULT '[]',
    "recommendedActions" JSONB NOT NULL DEFAULT '[]',
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntelligenceRun_userId_createdAt_idx" ON "IntelligenceRun"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IntelligenceRun_status_createdAt_idx" ON "IntelligenceRun"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceItem_userId_url_key" ON "IntelligenceItem"("userId", "url");

-- CreateIndex
CREATE INDEX "IntelligenceItem_userId_createdAt_idx" ON "IntelligenceItem"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "IntelligenceItem_userId_score_idx" ON "IntelligenceItem"("userId", "score");

-- CreateIndex
CREATE INDEX "IntelligenceItem_runId_idx" ON "IntelligenceItem"("runId");

-- AddForeignKey
ALTER TABLE "IntelligenceRun" ADD CONSTRAINT "IntelligenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceItem" ADD CONSTRAINT "IntelligenceItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceItem" ADD CONSTRAINT "IntelligenceItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntelligenceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
