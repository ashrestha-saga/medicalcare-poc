-- Add Betriebsstätte / partner depot as dispatch starting point (mockup: betriebsstaette).
ALTER TABLE `OrgMembership` MODIFY `dispatchOrigin` ENUM('home', 'organisation', 'partner_site') NOT NULL DEFAULT 'organisation';
