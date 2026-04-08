-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_box_id_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_category_id_fkey";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "InvestmentBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
