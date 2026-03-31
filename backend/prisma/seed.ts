import { prisma } from "../src/config/prisma";
import { clerkClient } from "../src/config/clerk";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import {
  defaultRoleCatalog,
  permissionCatalog
} from "../src/modules/roles-permissions/rbac.constants";

const seedPermissions = async () => {
  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: {
        code: permission.code
      },
      update: {
        domain: permission.domain,
        description: permission.description
      },
      create: {
        code: permission.code,
        domain: permission.domain,
        description: permission.description
      }
    });
  }
};

const seedRoles = async () => {
  const permissions = await prisma.permission.findMany({
    where: {
      code: {
        in: permissionCatalog.map((permission) => permission.code)
      }
    }
  });

  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));

  for (const role of defaultRoleCatalog) {
    const upsertedRole = await prisma.role.upsert({
      where: {
        code: role.code
      },
      update: {
        name: role.name
      },
      create: {
        code: role.code,
        name: role.name
      }
    });

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: upsertedRole.id
      }
    });

    const permissionIds = role.permissions
      .map((permissionCode) => permissionByCode.get(permissionCode))
      .filter((permissionId): permissionId is string => Boolean(permissionId));

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: upsertedRole.id,
          permissionId
        })),
        skipDuplicates: true
      });
    }
  }
};

const seedRuntimeSettings = async () => {
  const settings = [
    {
      key: "platform.mode",
      value: { current: "single_store", futureReady: true }
    },
    {
      key: "payments.provider",
      value: { provider: env.PAYMENT_PROVIDER }
    },
    {
      key: "notifications.channel_defaults",
      value: { emailEnabled: true }
    },
    {
      key: "inventory.low_stock.default_reorder_level",
      value: { defaultReorderLevel: 5 }
    },
    {
      key: "checkout.guest_checkout_enabled",
      value: { enabled: true }
    },
    {
      key: "checkout.reservation_window_minutes",
      value: { value: 15 }
    }
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: {
        key: setting.key
      },
      update: {
        value: setting.value
      },
      create: {
        key: setting.key,
        value: setting.value
      }
    });
  }
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const resolveClerkAdminUserIdForSeed = async (input: {
  email: string;
  password?: string;
  explicitClerkUserId?: string;
}): Promise<string> => {
  const password = input.password?.trim();

  if (password) {
    if (!env.CLERK_SECRET_KEY?.trim()) {
      throw new Error("SEED_DEFAULT_ADMIN_PASSWORD is set but CLERK_SECRET_KEY is missing.");
    }

    const normalizedEmail = normalizeEmail(input.email);
    const existingList = await clerkClient.users.getUserList({
      emailAddress: [normalizedEmail],
      limit: 1
    });
    const existing = existingList.data[0];
    const skipPasswordChecks = env.NODE_ENV !== "production";

    if (existing) {
      await clerkClient.users.updateUser(existing.id, {
        password,
        skipPasswordChecks
      });
      return existing.id;
    }

    const phone = env.SEED_DEFAULT_ADMIN_PHONE?.trim();
    const created = await clerkClient.users.createUser({
      emailAddress: [normalizedEmail],
      ...(phone ? { phoneNumber: [phone] } : {}),
      password,
      firstName: "Super",
      lastName: "Admin",
      legalAcceptedAt: new Date(),
      skipPasswordChecks
    });
    return created.id;
  }

  const clerkUserId = input.explicitClerkUserId?.trim();
  if (!clerkUserId) {
    logger.info(
      "Skipping default admin seed: set SEED_DEFAULT_ADMIN_PASSWORD (Clerk creates/updates user) or SEED_DEFAULT_ADMIN_CLERK_USER_ID with SEED_DEFAULT_ADMIN_EMAIL."
    );
    return "";
  }

  return clerkUserId;
};

const seedDefaultAdminUser = async () => {
  const emailRaw = env.SEED_DEFAULT_ADMIN_EMAIL?.trim();
  if (!emailRaw) {
    logger.info("Skipping default admin seed because SEED_DEFAULT_ADMIN_EMAIL is not set.");
    return;
  }

  const clerkAdminUserId = await resolveClerkAdminUserIdForSeed({
    email: emailRaw,
    password: env.SEED_DEFAULT_ADMIN_PASSWORD,
    explicitClerkUserId: env.SEED_DEFAULT_ADMIN_CLERK_USER_ID
  });

  if (!clerkAdminUserId) {
    return;
  }

  const email = normalizeEmail(emailRaw);

  const role = await prisma.role.findUnique({
    where: {
      code: env.SEED_DEFAULT_ADMIN_ROLE
    }
  });

  if (!role) {
    throw new Error(`Seed role "${env.SEED_DEFAULT_ADMIN_ROLE}" does not exist.`);
  }

  await prisma.adminUser.deleteMany({
    where: {
      email,
      clerkAdminUserId: { not: clerkAdminUserId }
    }
  });

  const adminUser = await prisma.adminUser.upsert({
    where: {
      clerkAdminUserId
    },
    update: {
      email
    },
    create: {
      clerkAdminUserId,
      email
    }
  });

  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: {
        adminUserId: adminUser.id,
        roleId: role.id
      }
    },
    update: {},
    create: {
      adminUserId: adminUser.id,
      roleId: role.id
    }
  });
};

const main = async () => {
  await seedPermissions();
  await seedRoles();
  await seedRuntimeSettings();
  await seedDefaultAdminUser();
};

void main()
  .then(async () => {
    logger.info("Seed completed.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logger.error({ error }, "Seed failed.");
    await prisma.$disconnect();
    process.exit(1);
  });
