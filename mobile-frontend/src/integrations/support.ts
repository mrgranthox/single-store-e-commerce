type MobileSupportInput = {
  backendBaseUrl: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  captchaToken?: string | null;
};

export const submitMobileSupportContact = async (input: MobileSupportInput) => {
  const response = await fetch(new URL("/api/support/contact", input.backendBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      captchaToken: input.captchaToken ?? undefined
    })
  });

  return response.json();
};
