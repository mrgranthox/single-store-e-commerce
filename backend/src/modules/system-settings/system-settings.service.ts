import { prisma } from "../../config/prisma";

export const listSystemSettings = async () => {
  const items = await prisma.systemSetting.findMany({
    orderBy: {
      key: "asc"
    }
  });

  return {
    items
  };
};

type SettingsMutationInput = {
  actorAdminUserId: string;
  settings: Array<{
    key: string;
    value: unknown;
  }>;
};

export const updateSystemSettings = async (input: SettingsMutationInput) => {
  const changed = await prisma.$transaction(async (transaction) => {
    const beforeEntries = await transaction.systemSetting.findMany({
      where: {
        key: {
          in: input.settings.map((setting) => setting.key)
        }
      }
    });
    const beforeByKey = new Map(beforeEntries.map((entry) => [entry.key, entry.value]));

    for (const setting of input.settings) {
      await transaction.systemSetting.upsert({
        where: {
          key: setting.key
        },
        update: {
          value: setting.value as never
        },
        create: {
          key: setting.key,
          value: setting.value as never
        }
      });
    }

    const afterEntries = await transaction.systemSetting.findMany({
      where: {
        key: {
          in: input.settings.map((setting) => setting.key)
        }
      }
    });

    const changes = afterEntries.map((entry) => ({
      key: entry.key,
      before: beforeByKey.has(entry.key) ? beforeByKey.get(entry.key) : null,
      after: entry.value
    }));

    await Promise.all([
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "system.settings",
          actionCode: "system_settings.updated",
          entityType: "SYSTEM_SETTING",
          entityId: null,
          note: `Updated ${changes.length} system setting(s).`,
          before: beforeEntries.map((entry) => ({ key: entry.key, value: entry.value })),
          after: changes
        }
      }),
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "system_settings.updated",
          entityType: "SYSTEM_SETTING",
          entityId: null,
          note: `Updated ${changes.length} system setting(s).`,
          metadata: {
            changes
          }
        }
      })
    ]);

    return changes;
  });

  return {
    ...(await listSystemSettings()),
    meta: {
      changed: changed.length
    }
  };
};

export const listSystemSettingsByPrefix = async (prefix: string) => {
  const items = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: prefix
      }
    },
    orderBy: {
      key: "asc"
    }
  });

  return {
    items
  };
};

export const updateSystemSettingsByPrefix = async (input: {
  actorAdminUserId: string;
  prefix: string;
  settings: Array<{
    key: string;
    value: unknown;
  }>;
}) => {
  const normalized = input.settings.map((setting) => ({
    key: setting.key.startsWith(input.prefix) ? setting.key : `${input.prefix}${setting.key}`,
    value: setting.value
  }));

  const changed = await prisma.$transaction(async (transaction) => {
    const beforeEntries = await transaction.systemSetting.findMany({
      where: {
        key: {
          in: normalized.map((setting) => setting.key)
        }
      }
    });
    const beforeByKey = new Map(beforeEntries.map((entry) => [entry.key, entry.value]));

    for (const setting of normalized) {
      await transaction.systemSetting.upsert({
        where: {
          key: setting.key
        },
        update: {
          value: setting.value as never
        },
        create: {
          key: setting.key,
          value: setting.value as never
        }
      });
    }

    const afterEntries = await transaction.systemSetting.findMany({
      where: {
        key: {
          in: normalized.map((setting) => setting.key)
        }
      }
    });

    const changes = afterEntries.map((entry) => ({
      key: entry.key,
      before: beforeByKey.has(entry.key) ? beforeByKey.get(entry.key) : null,
      after: entry.value
    }));

    await Promise.all([
      transaction.adminActionLog.create({
        data: {
          adminUserId: input.actorAdminUserId,
          screen: "system.settings",
          actionCode: "system_settings.prefix_updated",
          entityType: "SYSTEM_SETTING",
          entityId: input.prefix,
          note: `Updated ${changes.length} setting(s) under ${input.prefix}.`,
          before: beforeEntries.map((entry) => ({ key: entry.key, value: entry.value })),
          after: changes
        }
      }),
      transaction.auditLog.create({
        data: {
          actorType: "ADMIN",
          actorAdminUserId: input.actorAdminUserId,
          actionCode: "system_settings.prefix_updated",
          entityType: "SYSTEM_SETTING",
          entityId: input.prefix,
          note: `Updated ${changes.length} setting(s) under ${input.prefix}.`,
          metadata: {
            prefix: input.prefix,
            changes
          }
        }
      })
    ]);

    return changes;
  });

  return {
    ...(await listSystemSettingsByPrefix(input.prefix)),
    meta: {
      changed: changed.length
    }
  };
};
