-- Rebuilds product search with a `size_text` column, so "Sunfoil 2L", "iwisa 10kg" and
-- "maize meal 10 kg" match on pack size. Replaces the index from 0004.
DROP TRIGGER `products_fts_insert`;
--> statement-breakpoint
DROP TRIGGER `products_fts_update`;
--> statement-breakpoint
DROP TRIGGER `products_fts_delete`;
--> statement-breakpoint
DROP TABLE `products_fts`;
--> statement-breakpoint
CREATE VIRTUAL TABLE `products_fts` USING fts5(
  `product_id` UNINDEXED,
  `name`,
  `brand`,
  `type_name`,
  `size_text`,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `products_fts_insert` AFTER INSERT ON `products` BEGIN
  INSERT INTO `products_fts` (`product_id`, `name`, `brand`, `type_name`, `size_text`)
  VALUES (new.id, new.name, coalesce(new.brand, ''), (SELECT `name` FROM `product_types` WHERE `id` = new.product_type_id),
    CASE
      WHEN new.sold_by_weight THEN 'per kg'
      WHEN new.size_unit = 'g' AND new.size_value >= 1000
        THEN printf('%gkg %g kg %dg', new.size_value / 1000.0, new.size_value / 1000.0, new.size_value)
      WHEN new.size_unit = 'g' THEN printf('%dg %d g', new.size_value, new.size_value)
      WHEN new.size_unit = 'ml' AND new.size_value >= 1000
        THEN printf('%gl %g l %dml', new.size_value / 1000.0, new.size_value / 1000.0, new.size_value)
      WHEN new.size_unit = 'ml' THEN printf('%dml %d ml', new.size_value, new.size_value)
      ELSE printf('%d each', new.size_value)
    END || CASE WHEN new.pack_count > 1 THEN printf(' %dx %d pack', new.pack_count, new.pack_count) ELSE '' END);
END;
--> statement-breakpoint
CREATE TRIGGER `products_fts_update` AFTER UPDATE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE `product_id` = old.id;
  INSERT INTO `products_fts` (`product_id`, `name`, `brand`, `type_name`, `size_text`)
  VALUES (new.id, new.name, coalesce(new.brand, ''), (SELECT `name` FROM `product_types` WHERE `id` = new.product_type_id),
    CASE
      WHEN new.sold_by_weight THEN 'per kg'
      WHEN new.size_unit = 'g' AND new.size_value >= 1000
        THEN printf('%gkg %g kg %dg', new.size_value / 1000.0, new.size_value / 1000.0, new.size_value)
      WHEN new.size_unit = 'g' THEN printf('%dg %d g', new.size_value, new.size_value)
      WHEN new.size_unit = 'ml' AND new.size_value >= 1000
        THEN printf('%gl %g l %dml', new.size_value / 1000.0, new.size_value / 1000.0, new.size_value)
      WHEN new.size_unit = 'ml' THEN printf('%dml %d ml', new.size_value, new.size_value)
      ELSE printf('%d each', new.size_value)
    END || CASE WHEN new.pack_count > 1 THEN printf(' %dx %d pack', new.pack_count, new.pack_count) ELSE '' END);
END;
--> statement-breakpoint
CREATE TRIGGER `products_fts_delete` AFTER DELETE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE `product_id` = old.id;
END;
--> statement-breakpoint
INSERT INTO `products_fts` (`product_id`, `name`, `brand`, `type_name`, `size_text`)
SELECT p.id, p.name, coalesce(p.brand, ''), (SELECT `name` FROM `product_types` WHERE `id` = p.product_type_id),
  CASE
      WHEN p.sold_by_weight THEN 'per kg'
      WHEN p.size_unit = 'g' AND p.size_value >= 1000
        THEN printf('%gkg %g kg %dg', p.size_value / 1000.0, p.size_value / 1000.0, p.size_value)
      WHEN p.size_unit = 'g' THEN printf('%dg %d g', p.size_value, p.size_value)
      WHEN p.size_unit = 'ml' AND p.size_value >= 1000
        THEN printf('%gl %g l %dml', p.size_value / 1000.0, p.size_value / 1000.0, p.size_value)
      WHEN p.size_unit = 'ml' THEN printf('%dml %d ml', p.size_value, p.size_value)
      ELSE printf('%d each', p.size_value)
    END || CASE WHEN p.pack_count > 1 THEN printf(' %dx %d pack', p.pack_count, p.pack_count) ELSE '' END
FROM `products` p;
