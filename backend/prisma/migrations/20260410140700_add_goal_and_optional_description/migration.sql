-- AlterTable
ALTER TABLE "InvestmentBox" ADD COLUMN     "goal" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "description" DROP NOT NULL;
