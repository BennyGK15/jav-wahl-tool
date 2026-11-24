-- AlterTable
ALTER TABLE `deadline_rule` ADD COLUMN `verfahren` ENUM('regulaer', 'wahlversammlung') NOT NULL DEFAULT 'regulaer',
    MODIFY `anchor` ENUM('wahltag', 'wahlausschreiben', 'amtszeitende') NOT NULL,
    MODIFY `unit` ENUM('arbeitstage', 'wochen', 'monate') NOT NULL;

-- AlterTable
ALTER TABLE `election` ADD COLUMN `amtszeit_ende` DATE NULL,
    ADD COLUMN `wahlberechtigte_schaetzung` INTEGER NOT NULL DEFAULT 0;
