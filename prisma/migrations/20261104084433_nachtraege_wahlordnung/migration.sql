-- AlterTable
ALTER TABLE `election` ADD COLUMN `anfechtung_am` DATE NULL,
    ADD COLUMN `anfechtung_erledigt_am` DATE NULL;

-- AlterTable
ALTER TABLE `voter` ADD COLUMN `funktion` VARCHAR(120) NULL;
