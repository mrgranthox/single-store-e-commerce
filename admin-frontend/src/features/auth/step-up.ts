import { createAdminStepUp } from "@/features/auth/auth.api";
import { useStepUpStore } from "@/lib/step-up/step-up.store";

export const requestAdminStepUpToken = async (input: {
  accessToken: string;
  email: string | null;
}) => {
  if (!input.email) {
    throw new Error("Your admin email is unavailable for step-up verification.");
  }

  let password: string;
  try {
    password = await useStepUpStore.getState().requestPassword();
  } catch {
    throw new Error("Step-up verification was cancelled.");
  }

  const response = await createAdminStepUp(input.accessToken, {
    email: input.email,
    password
  });

  return response.data.token;
};
