import { env } from "../../config/env";
import { getPublicSupportCaptchaConfiguration } from "../security/captcha.service";

type ClientSurface = "customer" | "mobile" | "admin";

const buildCommonConfig = () => ({
  version: "0.1.0",
  api: {
    baseUrl: env.APP_BASE_URL,
    restBasePath: "/api",
    versionedBasePath: "/api/v1"
  },
  auth: {
    provider: env.CLERK_PUBLISHABLE_KEY ? "clerk" : "backend",
    clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY ?? null,
    accessTokenHeader: "Authorization",
    accessTokenPrefix: "Bearer"
  },
  payments: {
    provider: env.PAYMENT_PROVIDER,
    defaultCurrency: env.PAYSTACK_DEFAULT_CURRENCY,
    allowedChannels: env.paystackAllowedChannels
  },
  storage: {
    provider: env.STORAGE_PROVIDER,
    signedUploadsOnly: env.CLOUDINARY_SIGNED_UPLOADS_ONLY,
    productMedia: {
      allowedFormats: env.cloudinaryAllowedImageFormats,
      maxBytes: env.CLOUDINARY_MAX_IMAGE_BYTES
    },
    bannerMedia: {
      allowedFormats: [...env.cloudinaryAllowedImageFormats, ...env.cloudinaryAllowedVideoFormats],
      maxBytes: env.CLOUDINARY_MAX_VIDEO_BYTES
    },
    supportAttachments: {
      allowedFormats: env.cloudinaryAllowedDocumentFormats,
      maxBytes: env.CLOUDINARY_MAX_DOCUMENT_BYTES
    }
  }
});

const buildSupportConfig = () => ({
  publicConfigPath: "/api/support/public-config",
  contactPath: "/api/support/contact",
  productInquiryPathTemplate: "/api/products/:productSlug/questions",
  abuseChallenge: getPublicSupportCaptchaConfiguration()
});

export const getClientConfig = (surface: ClientSurface) => {
  const common = buildCommonConfig();

  switch (surface) {
    case "customer":
      return {
        surface,
        ...common,
        routes: {
          auth: {
            register: "/api/auth/register",
            login: "/api/auth/login",
            refresh: "/api/auth/refresh",
            forgotPassword: "/api/auth/forgot-password",
            resetPassword: "/api/auth/reset-password",
            verifyEmail: "/api/auth/verify-email",
            resendVerification: "/api/auth/resend-verification",
            session: "/api/auth/session",
            logout: "/api/auth/logout"
          },
          checkout: {
            eligibility: "/api/checkout/eligibility",
            validate: "/api/checkout/validate",
            createOrder: "/api/checkout/create-order",
            initializePayment: "/api/checkout/initialize-payment"
          },
          support: buildSupportConfig()
        }
      };
    case "mobile":
      return {
        surface,
        ...common,
        routes: {
          auth: {
            register: "/api/mobile/auth/register",
            login: "/api/mobile/auth/login",
            refresh: "/api/mobile/auth/refresh",
            forgotPassword: "/api/mobile/auth/forgot-password",
            resetPassword: "/api/mobile/auth/reset-password",
            verifyEmail: "/api/mobile/auth/verify-email",
            resendVerification: "/api/mobile/auth/resend-verification",
            session: "/api/mobile/auth/session",
            logout: "/api/mobile/auth/logout"
          },
          checkout: {
            bootstrap: "/api/mobile/checkout",
            success: "/api/mobile/checkout/success/:orderNumber"
          },
          support: buildSupportConfig()
        }
      };
    case "admin":
      return {
        surface,
        ...common,
        routes: {
          auth: {
            login: "/api/admin/auth/login",
            refresh: "/api/admin/auth/refresh",
            forgotPassword: "/api/admin/auth/forgot-password",
            resetPassword: "/api/admin/auth/reset-password",
            me: "/api/admin/auth/me",
            sessions: "/api/admin/auth/sessions",
            logout: "/api/admin/auth/logout"
          },
          reports: {
            overview: "/api/admin/reports/overview",
            sales: "/api/admin/reports/sales",
            inventory: "/api/admin/reports/inventory",
            customers: "/api/admin/reports/customers",
            support: "/api/admin/reports/support",
            postPurchase: "/api/admin/reports/post-purchase",
            marketing: "/api/admin/reports/marketing"
          },
          media: {
            catalogUploadIntent: "/api/admin/catalog/products/:productId/media/upload-intents",
            contentUploadIntent: "/api/admin/content/media/upload-intents"
          }
        }
      };
  }
};
