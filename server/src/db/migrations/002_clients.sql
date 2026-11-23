CREATE TABLE IF NOT EXISTS `clients` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `company_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `contact_name` VARCHAR(120) NULL,
  `email` VARCHAR(190) NULL,
  `phone` VARCHAR(40) NULL,
  `whatsapp` VARCHAR(40) NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(80) NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clients_company_id_id` (`company_id`, `id`),
  KEY `idx_clients_company_name` (`company_id`, `name`),
  KEY `idx_clients_company_phone` (`company_id`, `phone`),
  KEY `idx_clients_company_active` (`company_id`, `is_active`),
  KEY `idx_clients_company_created_by` (`company_id`, `created_by`),
  CONSTRAINT `fk_clients_company`
    FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_clients_created_by`
    FOREIGN KEY (`company_id`, `created_by`) REFERENCES `users` (`company_id`, `id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
