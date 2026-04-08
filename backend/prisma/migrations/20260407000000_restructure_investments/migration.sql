-- Rename InvestmentType enum to SubType
ALTER TYPE "InvestmentType" RENAME TO "SubType";

-- Drop InvestmentTransaction table
DROP TABLE "InvestmentTransaction";

-- Make category_id nullable on Transaction
ALTER TABLE "Transaction" ALTER COLUMN "category_id" DROP NOT NULL;

-- Add sub_type and box_id columns to Transaction
ALTER TABLE "Transaction" ADD COLUMN "sub_type" "SubType";
ALTER TABLE "Transaction" ADD COLUMN "box_id" INTEGER;

-- Add FK constraint from Transaction.box_id to InvestmentBox.id
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "InvestmentBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
