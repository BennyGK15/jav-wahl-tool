-- AlterTable
ALTER TABLE `election` ADD COLUMN `abgeschlossen_am` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `einstellung` (
    `schluessel` VARCHAR(64) NOT NULL,
    `wert` JSON NOT NULL,
    `geaendert_am` DATETIME(3) NOT NULL,
    `geaendert_von` VARCHAR(64) NULL,

    PRIMARY KEY (`schluessel`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
