-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'YOUTUBE', 'EMAIL', 'BLOG');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'READY', 'SCHEDULED', 'DONE');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('TEXT', 'IMAGE');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferenceKind" AS ENUM ('TEXT', 'URL', 'ASSET');

-- CreateEnum
CREATE TYPE "ReferencePurpose" AS ENUM ('WRITING_STYLE', 'KNOWLEDGE', 'VISUAL_STYLE');

-- CreateEnum
CREATE TYPE "PublicationSource" AS ENUM ('MARKETOS', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('GENERATION_REQUESTED', 'GENERATION_COMPLETED', 'GENERATION_FAILED', 'GENERATION_CANCELLED', 'CONTENT_SAVED', 'CONTENT_EDITED', 'CONTENT_SCHEDULED', 'ASSET_SAVED', 'CONNECTION_CONNECTED', 'CONNECTION_DISCONNECTED', 'PUBLICATION_REQUESTED', 'PUBLICATION_SUCCEEDED', 'PUBLICATION_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandBrief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "keyMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "samplePosts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visualStyle" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BrandBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationId" TEXT,
    "campaignId" TEXT,
    "channel" "Channel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "briefSnapshot" JSONB NOT NULL,
    "personalizationSnapshot" JSONB,
    "model" TEXT NOT NULL,
    "kind" "GenerationKind" NOT NULL DEFAULT 'TEXT',
    "requestedOutputs" INTEGER NOT NULL DEFAULT 1,
    "completedOutputs" INTEGER NOT NULL DEFAULT 0,
    "quotaUnits" INTEGER NOT NULL DEFAULT 1,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "targetAudience" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "budget" DECIMAL(18,2),
    "currency" VARCHAR(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "contentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("contentId","assetId")
);

-- CreateTable
CREATE TABLE "MarketingTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "campaignId" TEXT,
    "contentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MarketingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "credentialRef" TEXT,
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "contentId" TEXT,
    "connectionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "source" "PublicationSource" NOT NULL DEFAULT 'MARKETOS',
    "payloadSnapshot" JSONB NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationMetric" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "impressions" BIGINT,
    "reach" BIGINT,
    "clicks" BIGINT,
    "likes" BIGINT,
    "comments" BIGINT,
    "shares" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationProfile" (
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'vi',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Saigon',
    "preferredChannels" "Channel"[] DEFAULT ARRAY[]::"Channel"[],
    "preferredTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredTones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "writingGuidelines" TEXT,
    "visualPreferences" TEXT,
    "avoidWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personalizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "behaviorTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PersonalizationProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PersonalReference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "assetId" TEXT,
    "kind" "ReferenceKind" NOT NULL,
    "purpose" "ReferencePurpose" NOT NULL DEFAULT 'KNOWLEDGE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "contentText" TEXT,
    "sourceUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PersonalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "projectId" TEXT,
    "generationId" TEXT,
    "contentId" TEXT,
    "publicationId" TEXT,
    "connectionId" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviorProfile" (
    "userId" TEXT NOT NULL,
    "signals" JSONB NOT NULL DEFAULT '{}',
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowEnd" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehaviorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "Project_ownerId_deletedAt_createdAt_idx" ON "Project"("ownerId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandBrief_projectId_key" ON "BrandBrief"("projectId");

-- CreateIndex
CREATE INDEX "ContentItem_projectId_status_createdAt_idx" ON "ContentItem"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContentItem_projectId_scheduledAt_idx" ON "ContentItem"("projectId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContentItem_generationId_idx" ON "ContentItem"("generationId");

-- CreateIndex
CREATE INDEX "ContentItem_campaignId_status_idx" ON "ContentItem"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Generation_userId_kind_createdAt_idx" ON "Generation"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_projectId_createdAt_idx" ON "Generation"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Generation_userId_requestId_key" ON "Generation"("userId", "requestId");

-- CreateIndex
CREATE INDEX "Campaign_projectId_status_createdAt_idx" ON "Campaign"("projectId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_projectId_kind_createdAt_idx" ON "Asset"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_generationId_idx" ON "Asset"("generationId");

-- CreateIndex
CREATE INDEX "ContentAsset_assetId_idx" ON "ContentAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_contentId_position_key" ON "ContentAsset"("contentId", "position");

-- CreateIndex
CREATE INDEX "MarketingTask_projectId_status_dueAt_idx" ON "MarketingTask"("projectId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "MarketingTask_campaignId_idx" ON "MarketingTask"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingTask_contentId_idx" ON "MarketingTask"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_projectId_channel_externalAccountId_key" ON "ChannelConnection"("projectId", "channel", "externalAccountId");

-- CreateIndex
CREATE INDEX "Publication_connectionId_status_scheduledAt_idx" ON "Publication"("connectionId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Publication_contentId_idx" ON "Publication"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_connectionId_requestId_key" ON "Publication"("connectionId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_connectionId_externalPostId_key" ON "Publication"("connectionId", "externalPostId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationMetric_publicationId_measuredAt_key" ON "PublicationMetric"("publicationId", "measuredAt");

-- CreateIndex
CREATE INDEX "PersonalReference_userId_projectId_enabled_idx" ON "PersonalReference"("userId", "projectId", "enabled");

-- CreateIndex
CREATE INDEX "PersonalReference_projectId_idx" ON "PersonalReference"("projectId");

-- CreateIndex
CREATE INDEX "PersonalReference_assetId_idx" ON "PersonalReference"("assetId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_occurredAt_idx" ON "UserActivity"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_type_occurredAt_idx" ON "UserActivity"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "UserActivity_projectId_occurredAt_idx" ON "UserActivity"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "UserActivity_generationId_idx" ON "UserActivity"("generationId");

-- CreateIndex
CREATE INDEX "UserActivity_contentId_idx" ON "UserActivity"("contentId");

-- CreateIndex
CREATE INDEX "UserActivity_publicationId_idx" ON "UserActivity"("publicationId");

-- CreateIndex
CREATE INDEX "UserActivity_connectionId_idx" ON "UserActivity"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivity_userId_eventId_key" ON "UserActivity"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandBrief" ADD CONSTRAINT "BrandBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingTask" ADD CONSTRAINT "MarketingTask_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "PublicationMetric_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationProfile" ADD CONSTRAINT "PersonalizationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalReference" ADD CONSTRAINT "PersonalReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalReference" ADD CONSTRAINT "PersonalReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalReference" ADD CONSTRAINT "PersonalReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviorProfile" ADD CONSTRAINT "BehaviorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business invariants
ALTER TABLE "ContentItem" ADD CONSTRAINT "content_schedule_valid" CHECK (
  ("status" = 'SCHEDULED' AND "scheduledAt" IS NOT NULL)
  OR ("status" IN ('DRAFT', 'READY') AND "scheduledAt" IS NULL)
  OR "status" = 'DONE'
);

ALTER TABLE "Generation" ADD CONSTRAINT "generation_usage_valid" CHECK (
  ("tokensIn" IS NULL OR "tokensIn" >= 0)
  AND ("tokensOut" IS NULL OR "tokensOut" >= 0)
  AND (("status" = 'PENDING' AND "completedAt" IS NULL)
    OR ("status" <> 'PENDING' AND "completedAt" IS NOT NULL))
);

ALTER TABLE "Generation" ADD CONSTRAINT "generation_outputs_valid" CHECK (
  "requestedOutputs" > 0 AND "completedOutputs" >= 0
  AND "completedOutputs" <= "requestedOutputs" AND "quotaUnits" > 0
  AND ("status" <> 'SUCCEEDED' OR "completedOutputs" = "requestedOutputs")
);
ALTER TABLE "Campaign" ADD CONSTRAINT "campaign_plan_valid" CHECK (
  ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" <= "endsAt")
  AND (("budget" IS NULL AND "currency" IS NULL)
    OR ("budget" IS NOT NULL AND "currency" IS NOT NULL AND "budget" >= 0))
);
ALTER TABLE "Asset" ADD CONSTRAINT "asset_size_valid" CHECK (
  "byteSize" >= 0 AND ("width" IS NULL OR "width" > 0)
  AND ("height" IS NULL OR "height" > 0)
  AND ("kind" <> 'IMAGE' OR ("width" IS NOT NULL AND "height" IS NOT NULL))
);
ALTER TABLE "ContentAsset" ADD CONSTRAINT "asset_position_valid" CHECK ("position" >= 0);
ALTER TABLE "MarketingTask" ADD CONSTRAINT "task_completion_valid" CHECK (
  ("status" = 'DONE' AND "completedAt" IS NOT NULL)
  OR ("status" <> 'DONE' AND "completedAt" IS NULL)
);
ALTER TABLE "Publication" ADD CONSTRAINT "publication_result_valid" CHECK (
  "status" <> 'PUBLISHED' OR ("publishedAt" IS NOT NULL AND "externalPostId" IS NOT NULL)
);
ALTER TABLE "PublicationMetric" ADD CONSTRAINT "metric_counters_valid" CHECK (
  ("impressions" IS NULL OR "impressions" >= 0) AND ("reach" IS NULL OR "reach" >= 0)
  AND ("clicks" IS NULL OR "clicks" >= 0) AND ("likes" IS NULL OR "likes" >= 0)
  AND ("comments" IS NULL OR "comments" >= 0) AND ("shares" IS NULL OR "shares" >= 0)
);

ALTER TABLE "PersonalizationProfile" ADD CONSTRAINT "personalization_version_valid"
  CHECK ("version" > 0);
ALTER TABLE "PersonalReference" ADD CONSTRAINT "reference_source_valid" CHECK (
  "version" > 0 AND (
    ("kind" = 'TEXT' AND "contentText" IS NOT NULL AND "sourceUrl" IS NULL AND "assetId" IS NULL)
    OR ("kind" = 'URL' AND "sourceUrl" IS NOT NULL AND "assetId" IS NULL)
    OR ("kind" = 'ASSET' AND "assetId" IS NOT NULL AND "sourceUrl" IS NULL)
  )
);
ALTER TABLE "BehaviorProfile" ADD CONSTRAINT "behavior_window_valid" CHECK (
  "sampleCount" >= 0 AND "version" > 0 AND "windowStart" < "windowEnd"
  AND "windowEnd" <= "computedAt"
);
ALTER TABLE "Publication" ADD CONSTRAINT "imported_publication_valid" CHECK (
  "source" <> 'IMPORTED' OR ("status" = 'PUBLISHED' AND "externalPostId" IS NOT NULL)
);
