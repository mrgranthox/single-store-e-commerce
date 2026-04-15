import { commerceFetchJson } from "@/lib/api/commerce-fetch";
import { setAuthTokens } from "@/lib/api/commerce-session";

export type CustomerLoginPayload = {
  email: string;
  password: string;
};

export type CustomerRegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  marketingOptIn: boolean;
  acceptTerms: true;
  phoneNumber?: string;
};

export const customerAuthApi = {
  register: async (body: CustomerRegisterPayload) => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/register", {
      method: "POST",
      json: body,
      auth: false
    });
    return data;
  },

  login: async (body: CustomerLoginPayload) => {
    const { data } = await commerceFetchJson<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; status: string };
    }>("/api/auth/login", {
      method: "POST",
      json: body,
      auth: false
    });
    setAuthTokens(data.accessToken, data.refreshToken);
    return data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await commerceFetchJson<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      json: { refreshToken },
      auth: false
    });
    setAuthTokens(data.accessToken, data.refreshToken);
    return data;
  },

  session: async () => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/session", { method: "GET" });
    return data;
  },

  logout: async () => {
    await commerceFetchJson<unknown>("/api/auth/logout", { method: "POST", json: {} });
  },

  forgotPassword: async (email: string) => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/forgot-password", {
      method: "POST",
      json: { email },
      auth: false
    });
    return data;
  },

  resetPassword: async (token: string, newPassword: string) => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/reset-password", {
      method: "POST",
      json: { token, newPassword },
      auth: false
    });
    return data;
  },

  verifyEmail: async (token: string) => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/verify-email", {
      method: "POST",
      json: { token },
      auth: false
    });
    return data;
  },

  resendVerification: async (email: string) => {
    const { data } = await commerceFetchJson<unknown>("/api/auth/resend-verification", {
      method: "POST",
      json: { email },
      auth: false
    });
    return data;
  }
};
