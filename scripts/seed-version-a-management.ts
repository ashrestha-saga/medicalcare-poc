import { prisma } from "../src/lib/prisma";
import {
  ensurePartnerRoleGrants,
  invalidateRoleGrantCache,
} from "../src/services/roles/roleGrantsService";
import { hashPassword } from "../src/lib/password";

async function main() {
  await ensurePartnerRoleGrants(prisma);
  invalidateRoleGrantCache();
  const mgmt = await prisma.roleGrant.count({ where: { role: "management" } });
  console.log("management grants", mgmt);

  const org = await prisma.organisation.findFirst({ where: { code: "MSR" } });
  if (!org) {
    console.log("no MSR org");
    return;
  }
  const email = "s.richter@msr.example";
  const passwordHash = await hashPassword("demo");
  let user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "user-partner-msr-richter",
        email,
        name: "S. Richter",
        jobTitle: "Geschäftsführung",
        accountKind: "partner",
        passwordHash,
        active: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { jobTitle: "Geschäftsführung", passwordHash, name: "S. Richter" },
    });
  }
  await prisma.orgMembership.upsert({
    where: { organisationId_userId: { organisationId: org.id, userId: user.id } },
    create: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      organisationId: org.id,
      userId: user.id,
      appRole: "management",
      validFrom: new Date("2021-01-01"),
    },
    update: { appRole: "management" },
  });
  console.log("richter ready", user.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
