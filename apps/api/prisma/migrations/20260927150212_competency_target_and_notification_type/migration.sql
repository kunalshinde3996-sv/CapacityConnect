-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ENROLMENT_CONFIRMED', 'NEW_ASSESSMENT', 'DEADLINE_SOON', 'ACCOUNT_APPROVED', 'ACCOUNT_REJECTED', 'VERIFICATION_RESULT', 'GENERAL');

-- AlterTable
ALTER TABLE "Competency" ADD COLUMN     "targetLevel" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

