-- AlterEnum
ALTER TYPE "SubType" ADD VALUE 'YIELD';

-- AlterTable
ALTER TABLE "BudgetConfig" ADD COLUMN     "initial_balance" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "InvestmentBox" ADD COLUMN     "initial_balance" DECIMAL(10,2);
