CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`loyalty_program` text
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`chain_id` text NOT NULL,
	`region_id` text,
	`store_id` text,
	`price_cents` integer NOT NULL,
	`member_price_cents` integer,
	`is_promo` integer NOT NULL,
	`promo_type` text NOT NULL,
	`promo_qty` integer,
	`promo_price_cents` integer,
	`promo_free_qty` integer,
	`promo_member_only` integer DEFAULT false NOT NULL,
	`valid_from` text,
	`valid_to` text,
	`observed_at` integer NOT NULL,
	`source` text NOT NULL,
	`pamphlet_id` text,
	`created_by` text,
	`status` text DEFAULT 'live' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chain_id`) REFERENCES `chains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prices_product_chain_idx` ON `prices` (`product_id`,`chain_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `prices_valid_to_idx` ON `prices` (`valid_to`);--> statement-breakpoint
CREATE TABLE `product_types` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`default_size_unit` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_types_category_idx` ON `product_types` (`category_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`product_type_id` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`size_value` integer NOT NULL,
	`size_unit` text NOT NULL,
	`pack_count` integer DEFAULT 1 NOT NULL,
	`sold_by_weight` integer DEFAULT false NOT NULL,
	`is_store_brand` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`product_type_id`) REFERENCES `product_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`product_type_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`chain_id` text NOT NULL,
	`name` text NOT NULL,
	`region_id` text NOT NULL,
	`suburb` text,
	`lat` integer,
	`lng` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`chain_id`) REFERENCES `chains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `stores_region_chain_idx` ON `stores` (`region_id`,`chain_id`);--> statement-breakpoint
CREATE TABLE `user_loyalty_cards` (
	`user_id` text NOT NULL,
	`program` text NOT NULL,
	PRIMARY KEY(`user_id`, `program`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_stores` (
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `store_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `list_items` ADD `product_type_id` text;--> statement-breakpoint
ALTER TABLE `list_items` ADD `product_id` text;