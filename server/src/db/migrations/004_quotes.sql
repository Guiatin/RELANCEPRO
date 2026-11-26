CREATE TABLE IF NOT EXISTS `quotes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT UNSIGNED NOT NULL,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `number` VARCHAR(40) NULL,
  `status` ENUM('draft','sent','accepted','refused','converted') NOT NULL DEFAULT 'draft',
  `issue_date` DATE NULL,
  `valid_until` DATE NULL,
  `subtotal` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `discount_total` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `tax_total` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `total` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `terms` TEXT NULL,
  `client_reference` VARCHAR(100) NULL,
  `client_snapshot` JSON NULL,
  `issuer_snapshot` JSON NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `sent_at` DATETIME NULL,
  `accepted_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quotes_company_id_id` (`company_id`, `id`),
  UNIQUE KEY `uq_quotes_company_number` (`company_id`, `number`),
  KEY `idx_quotes_company_status` (`company_id`, `status`),
  KEY `idx_quotes_company_valid_until` (`company_id`, `valid_until`),
  KEY `idx_quotes_company_client` (`company_id`, `client_id`),
  KEY `idx_quotes_company_reference` (`company_id`, `client_reference`),
  CONSTRAINT `fk_quotes_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_quotes_client`
    FOREIGN KEY (`company_id`, `client_id`) REFERENCES `clients` (`company_id`, `id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_quotes_created_by`
    FOREIGN KEY (`company_id`, `created_by`) REFERENCES `users` (`company_id`, `id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quote_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT UNSIGNED NOT NULL,
  `quote_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NULL,
  `position` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(20) NULL,
  `unit_price` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `discount_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_exemption_code` ENUM('legal','export','special_regime','other') NULL,
  `tax_exemption_reason` VARCHAR(150) NULL,
  `line_subtotal` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `line_discount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `line_tax` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `line_total` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_quote_items_company_quote_position` (`company_id`, `quote_id`, `position`),
  CONSTRAINT `fk_quote_items_quote`
    FOREIGN KEY (`company_id`, `quote_id`) REFERENCES `quotes` (`company_id`, `id`)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_quote_items_product`
    FOREIGN KEY (`company_id`, `product_id`) REFERENCES `products` (`company_id`, `id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `document_sequences` (
  `company_id` BIGINT UNSIGNED NOT NULL,
  `doc_type` ENUM('quote','invoice') NOT NULL,
  `period` SMALLINT UNSIGNED NOT NULL,
  `last_value` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`company_id`, `doc_type`, `period`),
  CONSTRAINT `fk_document_sequences_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
