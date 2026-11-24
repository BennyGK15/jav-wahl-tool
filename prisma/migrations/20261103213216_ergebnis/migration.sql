/*
  Warnings:

  - A unique constraint covering the columns `[election_id,candidate_id]` on the table `result_entry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `nomination` ADD COLUMN `listenstimmen` INTEGER NULL;

-- AlterTable
ALTER TABLE `result` ADD COLUMN `los_reihenfolge` JSON NULL,
    ADD COLUMN `vorkommnisse` TEXT NULL;

-- AlterTable
ALTER TABLE `result_entry` ADD COLUMN `rang` INTEGER NULL,
    MODIFY `stimmen` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `result_entry_election_id_candidate_id_key` ON `result_entry`(`election_id`, `candidate_id`);
