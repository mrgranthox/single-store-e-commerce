import { expect, test, type Page } from "@playwright/test";

const seedAdminSession = async (page: Page) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem(
      "ecommerce-admin-auth-session",
      JSON.stringify({
        accessToken: "admin-access-token",
        refreshToken: "admin-refresh-token",
        actor: {
          id: "admin-1",
          email: "ops@example.com",
          fullName: "Operations Admin",
          roles: ["super_admin"],
          permissions: [
            "notifications.read",
            "notifications.write",
            "system.webhooks.read",
            "system.webhooks.retry",
            "integrations.webhooks.write",
            "admin.users.read",
            "admin.users.create"
          ]
        }
      })
    );
  });
};

const setupBootstrap = async (page: Page) => {
  await seedAdminSession(page);

  await page.route("**/api/admin/auth/me", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          admin: {
            id: "admin-1",
            email: "ops@example.com",
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          roles: [{ id: "role-1", code: "super_admin", name: "Super Admin" }],
          permissions: [
            "notifications.read",
            "notifications.write",
            "system.webhooks.read",
            "system.webhooks.retry",
            "integrations.webhooks.write",
            "admin.users.read",
            "admin.users.create"
          ],
          session: {
            sessionId: "session-1",
            sessionType: "admin",
            deviceLabel: "Desktop Chrome",
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            revokedAt: null
          },
          security: {
            totalSessions: 1,
            activeSessions: 1
          }
        }
      }
    });
  });

  await page.route("**/api/admin/auth/step-up", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          token: "step-up-token",
          expiresInMinutes: 10
        }
      }
    });
  });
};

test("manual notification creation sends a step-up token", async ({ page }) => {
  await setupBootstrap(page);

  let observedStepUpHeader = "";

  await page.route("**/api/admin/notifications?*", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: { items: [] },
        meta: { page: 1, limit: 20, totalItems: 0, totalPages: 1 }
      }
    });
  });

  await page.route("**/api/admin/notifications", async (route) => {
    observedStepUpHeader = route.request().headers()["x-admin-step-up-token"] ?? "";
    await route.fulfill({
      json: {
        success: true,
        data: {
          entity: {
            id: "notification-1",
            type: "ADMIN_INVITATION",
            channel: "EMAIL",
            status: "QUEUED",
            recipientUser: null,
            recipientEmail: "invitee@example.com",
            recipientType: "ADMIN",
            payload: { message: "Hello" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deliveries: []
          }
        }
      }
    });
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept("correct horse battery staple");
  });

  await page.goto("/admin/system/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Notifications workspace" })).toBeVisible();
  await page.getByPlaceholder("e.g. Scheduled maintenance this Sunday").fill("Test subject");
  await page.getByPlaceholder("The opening paragraph customers read first.").fill("Test body for notification.");
  await page.getByPlaceholder("recipient@example.com").fill("invitee@example.com");
  await page.getByRole("button", { name: "Queue notification" }).click();

  await expect.poll(() => observedStepUpHeader).toBe("step-up-token");
});

test("webhook replay sends a step-up token", async ({ page }) => {
  await setupBootstrap(page);

  let observedStepUpHeader = "";

  await page.route("**/api/admin/integrations/health", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          webhookEvents: {
            byStatus: [{ status: "FAILED", count: 1 }],
            failuresLast24Hours: 1
          }
        }
      }
    });
  });

  await page.route("**/api/admin/webhooks?*", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: "webhook-1",
              provider: "paystack",
              eventType: "charge.success",
              status: "FAILED",
              receivedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              latestAttempt: {
                attemptNo: 1,
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString()
              }
            }
          ]
        },
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
      }
    });
  });

  await page.route("**/api/admin/webhooks/webhook-1/retry", async (route) => {
    observedStepUpHeader = route.request().headers()["x-admin-step-up-token"] ?? "";
    await route.fulfill({ json: { success: true, data: { ok: true } } });
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept("correct horse battery staple");
  });

  await page.goto("/admin/system/webhooks");
  await expect(page.getByRole("heading", { level: 1, name: "Webhooks monitoring" })).toBeVisible();
  await page.getByRole("button", { name: "Replay" }).click();

  await expect.poll(() => observedStepUpHeader).toBe("step-up-token");
});

test("admin user creation sends a step-up token", async ({ page }) => {
  await setupBootstrap(page);

  let observedStepUpHeader = "";

  await page.route("**/api/admin/admin-users?*", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          items: [],
          availableRoles: [{ id: "role-1", code: "super_admin", name: "Super Admin" }]
        },
        meta: { page: 1, totalPages: 1 }
      }
    });
  });

  await page.route("**/api/admin/admin-users", async (route) => {
    observedStepUpHeader = route.request().headers()["x-admin-step-up-token"] ?? "";
    await route.fulfill({
      json: {
        success: true,
        data: {
          entity: {
            id: "admin-user-2",
            email: "new-admin@example.com",
            fullName: "New Admin",
            status: "ACTIVE",
            roles: [{ id: "role-1", code: "super_admin", name: "Super Admin" }],
            sessions: [],
            createdAt: new Date().toISOString()
          }
        }
      }
    });
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept("correct horse battery staple");
  });

  await page.goto("/admin/system/admin-users");
  await expect(page.getByRole("heading", { level: 1, name: "Admin users" })).toBeVisible();
  await page.getByPlaceholder("Clerk admin user id").fill("clerk-admin-2");
  await page.getByPlaceholder("Email override (optional)").fill("new-admin@example.com");
  await page.getByLabel("Super Admin").check();
  await page.getByRole("button", { name: "Create admin user" }).click();

  await expect.poll(() => observedStepUpHeader).toBe("step-up-token");
});
