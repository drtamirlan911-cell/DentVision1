-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "Patient"("userId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
