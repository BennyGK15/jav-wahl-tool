-- AlterTable
ALTER TABLE `election` ADD COLUMN `nachfrist_bekanntgemacht_am` DATE NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `failed_login_at` DATETIME(3) NULL,
    ADD COLUMN `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `two_factor_enabled` BOOLEAN NULL DEFAULT false;

-- CreateTable
CREATE TABLE `two_factor` (
    `id` VARCHAR(64) NOT NULL,
    `secret` TEXT NOT NULL,
    `backup_codes` TEXT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `verified` BOOLEAN NULL DEFAULT true,
    `failed_verification_count` INTEGER NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,

    INDEX `two_factor_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `two_factor` ADD CONSTRAINT `two_factor_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
