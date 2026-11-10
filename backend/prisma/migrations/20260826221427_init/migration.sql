-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `reset_token` VARCHAR(191) NULL,
    `reset_token_expiry` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_reset_token_key`(`reset_token`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UmkmProfile` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `business_name` VARCHAR(191) NOT NULL,
    `business_type` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `monthly_revenue_est` DOUBLE NULL,
    `employee_count` INTEGER NULL,
    `onboarding_done` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `UmkmProfile_user_id_key`(`user_id`),
    INDEX `UmkmProfile_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    INDEX `RefreshToken_user_id_idx`(`user_id`),
    INDEX `RefreshToken_token_idx`(`token`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `coicop_code` VARCHAR(191) NULL,
    `type` ENUM('income', 'expense') NOT NULL,
    `parent_id` INTEGER NULL,
    `icon` VARCHAR(191) NULL,
    `color_hex` VARCHAR(191) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TransactionCategory_name_key`(`name`),
    UNIQUE INDEX `TransactionCategory_coicop_code_key`(`coicop_code`),
    INDEX `TransactionCategory_type_idx`(`type`),
    INDEX `TransactionCategory_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `category_id` INTEGER NOT NULL,
    `type` ENUM('income', 'expense') NOT NULL,
    `amount` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `transaction_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` ENUM('manual', 'voice', 'ai') NOT NULL,
    `is_anomaly` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Transaction_user_id_idx`(`user_id`),
    INDEX `Transaction_category_id_idx`(`category_id`),
    INDEX `Transaction_transaction_date_idx`(`transaction_date`),
    INDEX `Transaction_type_idx`(`type`),
    INDEX `Transaction_source_idx`(`source`),
    INDEX `Transaction_is_anomaly_idx`(`is_anomaly`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionItem` (
    `id` VARCHAR(191) NOT NULL,
    `transaction_id` VARCHAR(191) NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NULL,
    `unit_price` DOUBLE NOT NULL,
    `total_price` DOUBLE NOT NULL DEFAULT 0,
    `category_id` INTEGER NULL,
    `ai_confidence` DOUBLE NULL,
    `product_id` VARCHAR(191) NULL,

    INDEX `TransactionItem_transaction_id_idx`(`transaction_id`),
    INDEX `TransactionItem_category_id_idx`(`category_id`),
    INDEX `TransactionItem_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `unit` VARCHAR(191) NULL,
    `price` DOUBLE NULL,
    `min_stock` INTEGER NOT NULL DEFAULT 10,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_user_id_idx`(`user_id`),
    INDEX `Product_sku_idx`(`sku`),
    INDEX `Product_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockLog` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` ENUM('in', 'out', 'adjust') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `operator` VARCHAR(191) NOT NULL,
    `status` ENUM('completed', 'pending_audit') NOT NULL DEFAULT 'completed',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockLog_product_id_idx`(`product_id`),
    INDEX `StockLog_user_id_idx`(`user_id`),
    INDEX `StockLog_created_at_idx`(`created_at`),
    INDEX `StockLog_type_idx`(`type`),
    INDEX `StockLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Debt` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `total_debt` DOUBLE NOT NULL,
    `paid_amount` DOUBLE NOT NULL DEFAULT 0,
    `due_date` DATETIME(3) NOT NULL,
    `status` ENUM('pending', 'partial', 'paid', 'overdue') NOT NULL DEFAULT 'pending',
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Debt_user_id_idx`(`user_id`),
    INDEX `Debt_status_idx`(`status`),
    INDEX `Debt_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebtPayment` (
    `id` VARCHAR(191) NOT NULL,
    `debt_id` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,

    INDEX `DebtPayment_debt_id_idx`(`debt_id`),
    INDEX `DebtPayment_paid_at_idx`(`paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiChatSession` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `session_title` VARCHAR(191) NULL,
    `context_summary` VARCHAR(191) NULL,
    `message_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_active_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiChatSession_user_id_idx`(`user_id`),
    INDEX `AiChatSession_last_active_at_idx`(`last_active_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiMessage` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `token_used` INTEGER NULL,
    `model_used` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiMessage_session_id_idx`(`session_id`),
    INDEX `AiMessage_created_at_idx`(`created_at`),
    INDEX `AiMessage_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UmkmProfile` ADD CONSTRAINT `UmkmProfile_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionCategory` ADD CONSTRAINT `TransactionCategory_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `TransactionCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `TransactionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItem` ADD CONSTRAINT `TransactionItem_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `Transaction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItem` ADD CONSTRAINT `TransactionItem_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `TransactionCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionItem` ADD CONSTRAINT `TransactionItem_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockLog` ADD CONSTRAINT `StockLog_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockLog` ADD CONSTRAINT `StockLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Debt` ADD CONSTRAINT `Debt_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebtPayment` ADD CONSTRAINT `DebtPayment_debt_id_fkey` FOREIGN KEY (`debt_id`) REFERENCES `Debt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiChatSession` ADD CONSTRAINT `AiChatSession_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiMessage` ADD CONSTRAINT `AiMessage_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `AiChatSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
