import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
          fullName: null,
          roles: ["super_admin"],
          permissions: ["settings.write", "settings.read"]
        }
      })
    );
  });
};

const setupCommonRoutes = async (page: Page, onPatch?: (headers: Record<string, string>) => void) => {
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() === "PATCH") {
      onPatch?.(route.request().headers());
      await route.fulfill({
        json: {
          success: true,
          data: {
            items: []
          }
        }
      });
      return;
    }

    await route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            {
              id: "setting-1",
              storeId: null,
              key: "checkout.feature_flag",
              value: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }
      }
    });
  });

  await page.route("**/api/admin/admin-action-logs**", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: { items: [] },
        meta: { total: 0, page: 1, pageSize: 5 }
      }
    });
  });

  await page.route("**/api/admin/dashboard/system-health", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "ready",
          checks: {
            workers: { ok: true },
            migrations: { ok: true }
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

test.beforeEach(async ({ page }) => {
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
          permissions: ["settings.write", "settings.read"],
          session: {
            sessionId: "session-1",
            sessionType: "admin",
            deviceLabel: "Desktop Chrome",
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            revokedAt: null
          }
        }
      }
    });
  });
});

test("system settings save sends a step-up token", async ({ page }) => {
  let observedStepUpHeader = "";
  await setupCommonRoutes(page, (headers) => {
    observedStepUpHeader = headers["x-admin-step-up-token"] ?? "";
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept("correct horse battery staple");
  });

  await page.goto("/admin/system/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByText("All setting keys").click();
  await expect(page.getByText("checkout.feature_flag")).toBeVisible();
  await page.getByText("checkout.feature_flag").click();
  await page.locator("textarea").fill("true");
  await page.getByRole("button", { name: "Save" }).click();

  await expect.poll(() => observedStepUpHeader).toBe("step-up-token");
});

test("@a11y system settings page has no serious accessibility violations", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.goto("/admin/system/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  expect(results.violations).toEqual([]);
});
