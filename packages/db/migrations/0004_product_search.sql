-- Full-text product search (D10). Drizzle doesn't model virtual tables, so this is custom SQL.
-- Triggers keep the index in step with `products`; the product type name is indexed too, so
-- searching "bread" finds "Albany Superior White".
CREATE VIRTUAL TABLE `products_fts` USING fts5(
  `product_id` UNINDEXED,
  `name`,
  `brand`,
  `type_name`,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `products_fts_insert` AFTER INSERT ON `products` BEGIN
  INSERT INTO `products_fts` (`product_id`, `name`, `brand`, `type_name`)
  VALUES (new.id, new.name, coalesce(new.brand, ''),
    (SELECT `name` FROM `product_types` WHERE `id` = new.product_type_id));
END;
--> statement-breakpoint
CREATE TRIGGER `products_fts_update` AFTER UPDATE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE `product_id` = old.id;
  INSERT INTO `products_fts` (`product_id`, `name`, `brand`, `type_name`)
  VALUES (new.id, new.name, coalesce(new.brand, ''),
    (SELECT `name` FROM `product_types` WHERE `id` = new.product_type_id));
END;
--> statement-breakpoint
CREATE TRIGGER `products_fts_delete` AFTER DELETE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE `product_id` = old.id;
END;
