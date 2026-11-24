-- AlterTable
ALTER TABLE `voter` ADD COLUMN `briefwahl_beantragt_am` DATETIME(3) NULL,
    ADD COLUMN `briefwahl_eingang_am` DATETIME(3) NULL,
    ADD COLUMN `briefwahl_versandt_am` DATETIME(3) NULL,
    ADD COLUMN `stimmabgabe_art` ENUM('urne', 'brief') NULL;
