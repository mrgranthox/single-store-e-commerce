const isLoopbackAddress = (value?: string | null) => {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/^::ffff:/, "").trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
};

export const canUseDevAuthBypass = (input: {
  allowBypass: boolean;
  nodeEnv: string;
  ipAddress?: string | null;
}) => {
  if (!input.allowBypass) {
    return false;
  }

  if (input.nodeEnv === "test") {
    return true;
  }

  return input.nodeEnv === "development" && isLoopbackAddress(input.ipAddress);
};
