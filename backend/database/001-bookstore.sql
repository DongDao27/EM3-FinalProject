

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;

/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;

/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;

/*!50503 SET NAMES utf8mb4 */;

/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;

/*!40103 SET TIME_ZONE='+00:00' */;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;

/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `cache` (

  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `expiration` int NOT NULL,

  PRIMARY KEY (`key`),

  KEY `cache_expiration_index` (`expiration`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `cache_locks` (

  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `expiration` int NOT NULL,

  PRIMARY KEY (`key`),

  KEY `cache_locks_expiration_index` (`expiration`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `cart_items` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `cart_id` bigint unsigned NOT NULL,

  `product_id` bigint unsigned NOT NULL,

  `quantity` tinyint unsigned NOT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `cart_items_cart_id_product_id_unique` (`cart_id`,`product_id`),

  KEY `cart_items_product_id_foreign` (`product_id`),

  CONSTRAINT `cart_items_cart_id_foreign` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,

  CONSTRAINT `cart_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `cart_items_quantity` CHECK ((`quantity` between 1 and 99))

) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `carts` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `user_id` bigint unsigned NOT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `carts_user_id_unique` (`user_id`),

  CONSTRAINT `carts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `categories` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,

  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,

  `sort_order` int NOT NULL DEFAULT '0',

  `is_active` tinyint(1) NOT NULL DEFAULT '1',

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `categories_slug_unique` (`slug`)

) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `failed_jobs` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,

  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,

  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `idempotency_keys` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `user_id` bigint unsigned NOT NULL,

  `operation` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,

  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `request_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,

  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'processing',

  `order_id` bigint unsigned DEFAULT NULL,

  `cached_response` json DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `idempotency_keys_user_id_operation_key_unique` (`user_id`,`operation`,`key`),

  KEY `idempotency_keys_order_id_foreign` (`order_id`),

  CONSTRAINT `idempotency_keys_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `idempotency_keys_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `idempotency_status` CHECK ((`status` in (_utf8mb4'processing',_utf8mb4'succeeded')))

) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `inventory_movements` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `product_id` bigint unsigned NOT NULL,

  `order_id` bigint unsigned DEFAULT NULL,

  `actor_id` bigint unsigned DEFAULT NULL,

  `kind` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,

  `delta_on_hand` int NOT NULL,

  `delta_reserved` int NOT NULL,

  `resulting_on_hand` int NOT NULL,

  `resulting_reserved` int NOT NULL,

  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,

  `business_key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `inventory_movements_business_key_unique` (`business_key`),

  KEY `inventory_movements_order_id_foreign` (`order_id`),

  KEY `inventory_movements_actor_id_foreign` (`actor_id`),

  KEY `inventory_movements_product_id_created_at_id_index` (`product_id`,`created_at`,`id`),

  CONSTRAINT `inventory_movements_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `inventory_movements_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `inventory_movements_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `movements_stock` CHECK (((`resulting_on_hand` >= 0) and (`resulting_reserved` >= 0) and (`resulting_reserved` <= `resulting_on_hand`)))

) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `job_batches` (

  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `total_jobs` int NOT NULL,

  `pending_jobs` int NOT NULL,

  `failed_jobs` int NOT NULL,

  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `options` mediumtext COLLATE utf8mb4_unicode_ci,

  `cancelled_at` int DEFAULT NULL,

  `created_at` int NOT NULL,

  `finished_at` int DEFAULT NULL,

  PRIMARY KEY (`id`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `jobs` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `attempts` tinyint unsigned NOT NULL,

  `reserved_at` int unsigned DEFAULT NULL,

  `available_at` int unsigned NOT NULL,

  `created_at` int unsigned NOT NULL,

  PRIMARY KEY (`id`),

  KEY `jobs_queue_index` (`queue`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `migrations` (

  `id` int unsigned NOT NULL AUTO_INCREMENT,

  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `batch` int NOT NULL,

  PRIMARY KEY (`id`)

) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `newsletter_subscriptions` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `email` varchar(254) COLLATE utf8mb4_unicode_ci NOT NULL,

  `consented_at` timestamp NOT NULL,

  `created_at` timestamp NULL DEFAULT NULL,

  `updated_at` timestamp NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `newsletter_subscriptions_email_unique` (`email`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `order_items` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `order_id` bigint unsigned NOT NULL,

  `product_id` bigint unsigned NOT NULL,

  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `list_unit_price` bigint unsigned NOT NULL,

  `charged_unit_price` bigint unsigned NOT NULL,

  `quantity` tinyint unsigned NOT NULL,

  `discount_line_total` bigint unsigned NOT NULL,

  `line_total` bigint unsigned NOT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  KEY `order_items_order_id_foreign` (`order_id`),

  KEY `order_items_product_id_foreign` (`product_id`),

  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `order_items_values` CHECK (((`quantity` between 1 and 99) and (`charged_unit_price` <= `list_unit_price`) and (`line_total` = (`charged_unit_price` * `quantity`)) and (`discount_line_total` = ((`list_unit_price` - `charged_unit_price`) * `quantity`))))

) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `order_status_histories` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `order_id` bigint unsigned NOT NULL,

  `actor_id` bigint unsigned DEFAULT NULL,

  `event` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `before` json NOT NULL,

  `after` json NOT NULL,

  `reason` text COLLATE utf8mb4_unicode_ci,

  `request_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  KEY `order_status_histories_actor_id_foreign` (`actor_id`),

  KEY `order_status_histories_order_id_created_at_index` (`order_id`,`created_at`),

  CONSTRAINT `order_status_histories_actor_id_foreign` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `order_status_histories_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `orders` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `order_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,

  `user_id` bigint unsigned NOT NULL,

  `quote_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `fulfillment_method` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,

  `recipient_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,

  `recipient_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,

  `address` json DEFAULT NULL,

  `items_subtotal` bigint unsigned NOT NULL,

  `discount_total` bigint unsigned NOT NULL,

  `shipping_fee` bigint unsigned NOT NULL,

  `payable_total` bigint unsigned NOT NULL,

  `lifecycle` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',

  `payment_status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',

  `fulfillment_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unprocessed',

  `expires_at` datetime(6) NOT NULL,

  `paid_at` datetime(6) DEFAULT NULL,

  `completed_at` datetime(6) DEFAULT NULL,

  `cancelled_at` datetime(6) DEFAULT NULL,

  `version` bigint unsigned NOT NULL DEFAULT '1',

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `orders_order_code_unique` (`order_code`),

  UNIQUE KEY `orders_quote_id_unique` (`quote_id`),

  KEY `orders_user_id_created_at_id_index` (`user_id`,`created_at`,`id`),

  KEY `orders_lifecycle_expires_at_index` (`lifecycle`,`expires_at`),

  KEY `orders_fulfillment_index` (`fulfillment_method`,`fulfillment_status`,`created_at`),

  CONSTRAINT `orders_quote_id_foreign` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `orders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `orders_fulfillment` CHECK ((`fulfillment_status` in (_utf8mb4'unprocessed',_utf8mb4'preparing',_utf8mb4'ready_for_pickup',_utf8mb4'shipping',_utf8mb4'fulfilled'))),

  CONSTRAINT `orders_lifecycle` CHECK ((`lifecycle` in (_utf8mb4'open',_utf8mb4'completed',_utf8mb4'cancelled',_utf8mb4'expired'))),

  CONSTRAINT `orders_method` CHECK ((((`fulfillment_method` = _utf8mb4'pickup') and (`address` is null) and (`shipping_fee` = 0)) or ((`fulfillment_method` = _utf8mb4'delivery') and (`address` is not null)))),

  CONSTRAINT `orders_payment` CHECK ((`payment_status` in (_utf8mb4'unpaid',_utf8mb4'pending',_utf8mb4'paid',_utf8mb4'reconciliation_required'))),

  CONSTRAINT `orders_totals` CHECK (((`discount_total` <= `items_subtotal`) and (`payable_total` = ((`items_subtotal` - `discount_total`) + `shipping_fee`)) and (`payable_total` <= 1000000000)))

) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `password_reset_tokens` (

  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `created_at` timestamp NULL DEFAULT NULL,

  PRIMARY KEY (`email`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `payment_attempts` (

  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `order_id` bigint unsigned NOT NULL,

  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,

  `provider_reference` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `requested_amount` bigint unsigned NOT NULL,

  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created',

  `expires_at` datetime(6) NOT NULL,

  `provider_transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `query_requested_at` datetime(6) DEFAULT NULL,

  `verified_at` datetime(6) DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `payment_attempts_provider_reference_unique` (`provider_reference`),

  KEY `payment_attempts_order_id_status_index` (`order_id`,`status`),

  KEY `payment_attempts_status_expires_at_index` (`status`,`expires_at`),

  CONSTRAINT `payment_attempts_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `attempts_status` CHECK ((`status` in (_utf8mb4'created',_utf8mb4'pending',_utf8mb4'succeeded',_utf8mb4'failed',_utf8mb4'cancelled',_utf8mb4'expired',_utf8mb4'unknown')))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `payment_events` (

  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,

  `provider_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `fingerprint` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,

  `signature_valid` tinyint(1) NOT NULL,

  `safe_payload` json NOT NULL,

  `disposition` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,

  `receipt_id` bigint unsigned DEFAULT NULL,

  `created_at` datetime(6) NOT NULL,

  `processed_at` datetime(6) DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `payment_events_fingerprint_unique` (`fingerprint`),

  KEY `payment_events_receipt_id_foreign` (`receipt_id`),

  CONSTRAINT `payment_events_receipt_id_foreign` FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `events_source` CHECK ((`source` in (_utf8mb4'ipn',_utf8mb4'query',_utf8mb4'return')))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `payment_receipts` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,

  `provider_transaction_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `order_id` bigint unsigned NOT NULL,

  `attempt_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `received_amount` bigint unsigned NOT NULL,

  `provider_paid_at` datetime(6) NOT NULL,

  `verified_at` datetime(6) NOT NULL,

  `allocation` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,

  `accepted_order_id` bigint unsigned GENERATED ALWAYS AS (if((`allocation` = _utf8mb4'accepted'),`order_id`,NULL)) STORED,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `payment_receipts_provider_provider_transaction_id_unique` (`provider`,`provider_transaction_id`),

  UNIQUE KEY `payment_receipts_accepted_order_id_unique` (`accepted_order_id`),

  KEY `payment_receipts_attempt_id_foreign` (`attempt_id`),

  KEY `payment_receipts_order_id_allocation_verified_at_index` (`order_id`,`allocation`,`verified_at`),

  CONSTRAINT `payment_receipts_attempt_id_foreign` FOREIGN KEY (`attempt_id`) REFERENCES `payment_attempts` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `payment_receipts_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `receipts_allocation` CHECK ((`allocation` in (_utf8mb4'accepted',_utf8mb4'duplicate',_utf8mb4'late',_utf8mb4'mismatch')))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `personal_access_tokens` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `tokenable_id` bigint unsigned NOT NULL,

  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,

  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,

  `abilities` text COLLATE utf8mb4_unicode_ci,

  `last_used_at` timestamp NULL DEFAULT NULL,

  `expires_at` timestamp NULL DEFAULT NULL,

  `created_at` timestamp NULL DEFAULT NULL,

  `updated_at` timestamp NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),

  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),

  KEY `personal_access_tokens_expires_at_index` (`expires_at`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `product_images` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `product_id` bigint unsigned NOT NULL,

  `storage_disk` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',

  `path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `mime` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `byte_size` int unsigned NOT NULL,

  `sort_order` int NOT NULL DEFAULT '0',

  `alt_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `product_images_path_unique` (`path`),

  KEY `product_images_product_id_foreign` (`product_id`),

  CONSTRAINT `product_images_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT

) ENGINE=InnoDB AUTO_INCREMENT=138 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `products` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `category_id` bigint unsigned NOT NULL,

  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `description` text COLLATE utf8mb4_unicode_ci,

  `grade` tinyint unsigned DEFAULT NULL,

  `list_price` bigint unsigned NOT NULL,

  `sale_price` bigint unsigned DEFAULT NULL,

  `stock_on_hand` int NOT NULL DEFAULT '0',

  `stock_reserved` int NOT NULL DEFAULT '0',

  `is_active` tinyint(1) NOT NULL DEFAULT '1',

  `is_hot` tinyint(1) NOT NULL DEFAULT '0',

  `is_bestseller` tinyint(1) NOT NULL DEFAULT '0',

  `catalog_version` bigint unsigned NOT NULL DEFAULT '1',

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `products_sku_unique` (`sku`),

  UNIQUE KEY `products_slug_unique` (`slug`),

  KEY `products_category_id_is_active_id_index` (`category_id`,`is_active`,`id`),

  KEY `products_is_hot_is_active_index` (`is_hot`,`is_active`),

  KEY `products_is_bestseller_is_active_index` (`is_bestseller`,`is_active`),

  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `products_grade` CHECK (((`grade` is null) or (`grade` between 1 and 12))),

  CONSTRAINT `products_sale` CHECK (((`sale_price` is null) or (`sale_price` <= `list_price`))),

  CONSTRAINT `products_stock` CHECK (((`stock_on_hand` >= 0) and (`stock_reserved` >= 0) and (`stock_reserved` <= `stock_on_hand`)))

) ENGINE=InnoDB AUTO_INCREMENT=138 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `quotes` (

  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `user_id` bigint unsigned NOT NULL,

  `cart_id` bigint unsigned NOT NULL,

  `cart_fingerprint` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,

  `payload` json NOT NULL,

  `items_subtotal` bigint unsigned NOT NULL,

  `discount_total` bigint unsigned NOT NULL,

  `shipping_fee` bigint unsigned NOT NULL,

  `payable_total` bigint unsigned NOT NULL,

  `pricing_version` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `expires_at` datetime(6) NOT NULL,

  `consumed_at` datetime(6) DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  KEY `quotes_cart_id_foreign` (`cart_id`),

  KEY `quotes_user_id_expires_at_index` (`user_id`,`expires_at`),

  CONSTRAINT `quotes_cart_id_foreign` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `quotes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `quotes_totals` CHECK (((`discount_total` <= `items_subtotal`) and (`payable_total` = ((`items_subtotal` - `discount_total`) + `shipping_fee`)) and (`payable_total` <= 1000000000)))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `reconciliation_cases` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `order_id` bigint unsigned NOT NULL,

  `receipt_id` bigint unsigned DEFAULT NULL,

  `reason` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',

  `resolution` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `resolved_by` bigint unsigned DEFAULT NULL,

  `resolved_at` datetime(6) DEFAULT NULL,

  `note` text COLLATE utf8mb4_unicode_ci,

  `version` bigint unsigned NOT NULL DEFAULT '1',

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  KEY `reconciliation_cases_order_id_foreign` (`order_id`),

  KEY `reconciliation_cases_receipt_id_foreign` (`receipt_id`),

  KEY `reconciliation_cases_resolved_by_foreign` (`resolved_by`),

  KEY `reconciliation_cases_status_created_at_index` (`status`,`created_at`),

  CONSTRAINT `reconciliation_cases_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `reconciliation_cases_receipt_id_foreign` FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `reconciliation_cases_resolved_by_foreign` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `cases_status` CHECK ((`status` in (_utf8mb4'open',_utf8mb4'resolved')))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `refunds` (

  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,

  `order_id` bigint unsigned NOT NULL,

  `receipt_id` bigint unsigned NOT NULL,

  `provider` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,

  `external_reference` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `amount` bigint unsigned NOT NULL,

  `merchandise_amount` bigint unsigned NOT NULL,

  `shipping_amount` bigint unsigned NOT NULL,

  `refunded_at` datetime(6) NOT NULL,

  `verified_by` bigint unsigned NOT NULL,

  `evidence_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `refunds_provider_external_reference_unique` (`provider`,`external_reference`),

  KEY `refunds_order_id_foreign` (`order_id`),

  KEY `refunds_receipt_id_foreign` (`receipt_id`),

  KEY `refunds_verified_by_foreign` (`verified_by`),

  CONSTRAINT `refunds_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `refunds_receipt_id_foreign` FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `refunds_verified_by_foreign` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `refunds_amount` CHECK (((`amount` > 0) and (`amount` = (`merchandise_amount` + `shipping_amount`))))

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `sessions` (

  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `user_id` bigint unsigned DEFAULT NULL,

  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `user_agent` text COLLATE utf8mb4_unicode_ci,

  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,

  `last_activity` int NOT NULL,

  PRIMARY KEY (`id`),

  KEY `sessions_user_id_index` (`user_id`),

  KEY `sessions_last_activity_index` (`last_activity`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `settings` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `value` json NOT NULL,

  `version` bigint unsigned NOT NULL DEFAULT '1',

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `settings_key_unique` (`key`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `stock_reservations` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `order_item_id` bigint unsigned NOT NULL,

  `product_id` bigint unsigned NOT NULL,

  `quantity` tinyint unsigned NOT NULL,

  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',

  `expires_at` datetime(6) NOT NULL,

  `released_at` datetime(6) DEFAULT NULL,

  `created_at` timestamp(6) NULL DEFAULT NULL,

  `updated_at` timestamp(6) NULL DEFAULT NULL,

  PRIMARY KEY (`id`),

  UNIQUE KEY `stock_reservations_order_item_id_unique` (`order_item_id`),

  KEY `stock_reservations_product_id_foreign` (`product_id`),

  KEY `stock_reservations_status_expires_at_index` (`status`,`expires_at`),

  CONSTRAINT `stock_reservations_order_item_id_foreign` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `stock_reservations_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,

  CONSTRAINT `reservations_values` CHECK (((`quantity` between 1 and 99) and (`status` in (_utf8mb4'active',_utf8mb4'consumed',_utf8mb4'released'))))

) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40101 SET @saved_cs_client     = @@character_set_client */;

/*!50503 SET character_set_client = utf8mb4 */;

CREATE TABLE `users` (

  `id` bigint unsigned NOT NULL AUTO_INCREMENT,

  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,

  `email` varchar(254) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `email_verified_at` timestamp NULL DEFAULT NULL,

  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `created_at` timestamp NULL DEFAULT NULL,

  `updated_at` timestamp NULL DEFAULT NULL,

  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'customer',

  `admin_slot` tinyint unsigned GENERATED ALWAYS AS (if((`role` = _utf8mb4'admin'),1,NULL)) STORED,

  PRIMARY KEY (`id`),

  UNIQUE KEY `users_email_unique` (`email`),

  UNIQUE KEY `users_phone_unique` (`phone`),

  UNIQUE KEY `users_admin_slot_unique` (`admin_slot`),

  CONSTRAINT `users_identity` CHECK (((`email` is not null) or (`phone` is not null))),

  CONSTRAINT `users_role` CHECK ((`role` in (_utf8mb4'customer',_utf8mb4'admin')))

) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*!40101 SET character_set_client = @saved_cs_client */;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;



/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;

/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;

/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;

/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;

/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
