-- Add service_lead (Serviceleitung). Remap former operational admin → service_lead.
-- True admin remains the org superuser with full access (grants re-seeded by ensurePartnerRoleGrants).

ALTER TABLE `OrgMembership` MODIFY `appRole` ENUM('inspector', 'admin', 'service_lead', 'order', 'management') NOT NULL;
ALTER TABLE `UserInvitation` MODIFY `appRole` ENUM('inspector', 'admin', 'service_lead', 'order', 'management') NULL;

UPDATE `OrgMembership` SET `appRole` = 'service_lead' WHERE `appRole` = 'admin';
UPDATE `UserInvitation` SET `appRole` = 'service_lead' WHERE `appRole` = 'admin';

-- Move existing partner grant rows so service_lead keeps former admin capabilities.
UPDATE `RoleGrant`
SET `role` = 'service_lead'
WHERE `role` = 'admin'
  AND `kind` IN ('partner_console', 'partner_acting');
