-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'INVESTMENT';

-- CreateTable
CREATE TABLE "InvestmentBox" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" SERIAL NOT NULL,
    "box_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "InvestmentType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "InvestmentBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
