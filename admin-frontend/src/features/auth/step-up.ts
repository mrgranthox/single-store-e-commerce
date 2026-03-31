import { createAdminStepUp } from "@/features/auth/auth.api";

export const requestAdminStepUpToken = async (input: {
  accessToken: string;
  email: string | null;
}) => {
  if (!input.email) {
    throw new Error("Your admin email is unavailable for step-up verification.");
  }

  const password = window.prompt("Re-enter your admin password to continue.");
  if (!password) {
    throw new Error("Step-up verification was cancelled.");
  }

  const response = await createAdminStepUp(input.accessToken, {
    email: input.email,
    password
  });

  return response.data.token;
};
