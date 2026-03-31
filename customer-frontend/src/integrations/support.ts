type SupportContactInput = {
  backendBaseUrl: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  captchaToken?: string | null;
};

type ProductInquiryInput = {
  backendBaseUrl: string;
  productSlug: string;
  name: string;
  email: string;
  message: string;
  captchaToken?: string | null;
};

const readApiEnvelope = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        data?: T;
        message?: string;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? `Request failed with status ${response.status}`);
  }

  if (payload?.success !== true || payload.data === undefined) {
    throw new Error("Response did not match the expected success contract.");
  }

  return payload.data;
};

export const submitSupportContact = async (input: SupportContactInput) => {
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

  return readApiEnvelope(response);
};

export const submitProductInquiry = async (input: ProductInquiryInput) => {
  const response = await fetch(
    new URL(`/api/products/${encodeURIComponent(input.productSlug)}/questions`, input.backendBaseUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        message: input.message,
        captchaToken: input.captchaToken ?? undefined
      })
    }
  );

  return readApiEnvelope(response);
};
