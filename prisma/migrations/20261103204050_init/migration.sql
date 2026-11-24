-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `image` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `username` VARCHAR(64) NULL,
    `display_username` VARCHAR(64) NULL,
    `role` VARCHAR(32) NULL DEFAULT 'mitglied',
    `banned` BOOLEAN NULL DEFAULT false,
    `ban_reason` TEXT NULL,
    `ban_expires` DATETIME(3) NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `user_email_key`(`email`),
    UNIQUE INDEX `user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session` (
    `id` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `impersonated_by` VARCHAR(64) NULL,

    UNIQUE INDEX `session_token_key`(`token`),
    INDEX `session_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account` (
    `id` VARCHAR(64) NOT NULL,
    `account_id` VARCHAR(255) NOT NULL,
    `provider_id` VARCHAR(64) NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NULL,
    `id_token` TEXT NULL,
    `access_token_expires_at` DATETIME(3) NULL,
    `refresh_token_expires_at` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `password` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `account_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verification` (
    `id` VARCHAR(64) NOT NULL,
    `identifier` VARCHAR(255) NOT NULL,
    `value` TEXT NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `verification_identifier_idx`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit` (
    `id` VARCHAR(64) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `count` INTEGER NOT NULL,
    `last_request` BIGINT NOT NULL,

    UNIQUE INDEX `rate_limit_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `election` (
    `id` VARCHAR(36) NOT NULL,
    `dienststelle` VARCHAR(255) NOT NULL,
    `verfahren` ENUM('regulaer', 'wahlversammlung') NOT NULL DEFAULT 'regulaer',
    `wahltag` DATE NOT NULL,
    `wahlausschreiben_am` DATE NULL,
    `status` ENUM('vorbereitung', 'eingeleitet', 'wahl', 'abgeschlossen') NOT NULL DEFAULT 'vorbereitung',
    `retention_until` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voter` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `lfd_nr` INTEGER NOT NULL,
    `nachname` VARCHAR(120) NOT NULL,
    `vorname` VARCHAR(120) NOT NULL,
    `organisationseinheit` VARCHAR(120) NULL,
    `geburtsdatum_enc` VARCHAR(255) NOT NULL,
    `in_ausbildung` BOOLEAN NOT NULL DEFAULT false,
    `ausbildungsende_enc` VARCHAR(255) NULL,
    `geschlecht` ENUM('w', 'm', 'd') NULL,
    `wahlberechtigt` BOOLEAN NOT NULL,
    `waehlbar` BOOLEAN NOT NULL,
    `voted_at` DATETIME(3) NULL,
    `voted_marked_by` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `voter_election_id_idx`(`election_id`),
    UNIQUE INDEX `voter_election_id_lfd_nr_key`(`election_id`, `lfd_nr`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `objection` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `voter_id` VARCHAR(36) NULL,
    `eingang_am` DATETIME(3) NOT NULL,
    `begruendung_enc` TEXT NULL,
    `entscheidung` ENUM('offen', 'stattgegeben', 'zurueckgewiesen') NOT NULL DEFAULT 'offen',
    `entschieden_am` DATETIME(3) NULL,
    `entschieden_von` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nomination` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `kennwort` VARCHAR(120) NULL,
    `einreicher_art` ENUM('beschaeftigte', 'gewerkschaft') NOT NULL,
    `gewerkschaft` VARCHAR(120) NULL,
    `eingang_am` DATETIME(3) NOT NULL,
    `status` ENUM('eingegangen', 'gueltig', 'ungueltig', 'zurueckgegeben') NOT NULL DEFAULT 'eingegangen',
    `pruefnotiz` TEXT NULL,
    `ordnungsnummer` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nomination_candidate` (
    `id` VARCHAR(36) NOT NULL,
    `nomination_id` VARCHAR(36) NOT NULL,
    `voter_id` VARCHAR(36) NOT NULL,
    `listenplatz` INTEGER NOT NULL,
    `zustimmung_liegt_vor` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `nomination_candidate_nomination_id_listenplatz_key`(`nomination_id`, `listenplatz`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nomination_supporter` (
    `id` VARCHAR(36) NOT NULL,
    `nomination_id` VARCHAR(36) NOT NULL,
    `voter_id` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `nomination_supporter_nomination_id_voter_id_key`(`nomination_id`, `voter_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deadline_rule` (
    `key` VARCHAR(64) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `anchor` ENUM('wahltag', 'wahlausschreiben') NOT NULL,
    `direction` ENUM('vor', 'nach') NOT NULL,
    `unit` ENUM('arbeitstage', 'monate') NOT NULL,
    `amount` INTEGER NOT NULL,
    `legal_basis` VARCHAR(120) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_by` VARCHAR(64) NULL,
    `verified_at` DATETIME(3) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deadline` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `rule_key` VARCHAR(64) NOT NULL,
    `datum` DATE NOT NULL,
    `uhrzeit` VARCHAR(5) NULL,
    `manuell_ueberschrieben` BOOLEAN NOT NULL DEFAULT false,
    `erledigt_am` DATETIME(3) NULL,
    `erledigt_von` VARCHAR(64) NULL,

    UNIQUE INDEX `deadline_election_id_rule_key_key`(`election_id`, `rule_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holiday` (
    `datum` DATE NOT NULL,
    `bezeichnung` VARCHAR(120) NOT NULL,
    `oertlich` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`datum`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_item` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `phase` ENUM('vorbereitung', 'wahltag', 'abschluss') NOT NULL,
    `sortierung` INTEGER NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `erledigt_am` DATETIME(3) NULL,
    `erledigt_von` VARCHAR(64) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `result` (
    `election_id` VARCHAR(36) NOT NULL,
    `stimmzettel_gesamt` INTEGER NOT NULL,
    `stimmzettel_gueltig` INTEGER NOT NULL,
    `stimmzettel_ungueltig` INTEGER NOT NULL,
    `festgestellt_am` DATETIME(3) NULL,
    `festgestellt_von` VARCHAR(64) NULL,

    PRIMARY KEY (`election_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `result_entry` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `candidate_id` VARCHAR(36) NOT NULL,
    `stimmen` INTEGER NOT NULL,
    `ergebnis` ENUM('gewaehlt', 'ersatz', 'nicht_gewaehlt') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document` (
    `id` VARCHAR(36) NOT NULL,
    `election_id` VARCHAR(36) NOT NULL,
    `typ` ENUM('wahlausschreiben', 'auslage_waehlerverzeichnis', 'wahlvorschlaege', 'nachfrist', 'wahlergebnis', 'niederschrift') NOT NULL,
    `version` INTEGER NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `freigegeben_am` DATETIME(3) NULL,
    `freigegeben_von` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(36) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(64) NULL,
    `action` VARCHAR(64) NOT NULL,
    `object_type` VARCHAR(64) NOT NULL,
    `object_id` VARCHAR(64) NULL,
    `fields` JSON NULL,
    `ip_hash` VARCHAR(64) NULL,

    INDEX `audit_log_at_idx`(`at`),
    INDEX `audit_log_object_type_object_id_idx`(`object_type`, `object_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voter` ADD CONSTRAINT `voter_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `objection` ADD CONSTRAINT `objection_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `objection` ADD CONSTRAINT `objection_voter_id_fkey` FOREIGN KEY (`voter_id`) REFERENCES `voter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nomination` ADD CONSTRAINT `nomination_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nomination_candidate` ADD CONSTRAINT `nomination_candidate_nomination_id_fkey` FOREIGN KEY (`nomination_id`) REFERENCES `nomination`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nomination_candidate` ADD CONSTRAINT `nomination_candidate_voter_id_fkey` FOREIGN KEY (`voter_id`) REFERENCES `voter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nomination_supporter` ADD CONSTRAINT `nomination_supporter_nomination_id_fkey` FOREIGN KEY (`nomination_id`) REFERENCES `nomination`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nomination_supporter` ADD CONSTRAINT `nomination_supporter_voter_id_fkey` FOREIGN KEY (`voter_id`) REFERENCES `voter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deadline` ADD CONSTRAINT `deadline_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_item` ADD CONSTRAINT `checklist_item_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `result` ADD CONSTRAINT `result_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `result_entry` ADD CONSTRAINT `result_entry_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `result_entry` ADD CONSTRAINT `result_entry_candidate_id_fkey` FOREIGN KEY (`candidate_id`) REFERENCES `nomination_candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document` ADD CONSTRAINT `document_election_id_fkey` FOREIGN KEY (`election_id`) REFERENCES `election`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
