-- CreateTable
CREATE TABLE "supplier_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_members_userId_idx" ON "supplier_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_members_userId_supplierId_key" ON "supplier_members"("userId", "supplierId");

-- AddForeignKey
ALTER TABLE "supplier_members" ADD CONSTRAINT "supplier_members_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

