-- Shop order cart price breakdown captured at submit (net / VAT / shipping / total).
ALTER TABLE `OrderRequest` ADD COLUMN `priceBreakdownJson` TEXT NULL;
