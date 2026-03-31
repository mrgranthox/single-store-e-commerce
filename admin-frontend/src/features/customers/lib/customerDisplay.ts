export const displayCustomerName = (c: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}) => {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return n || c.email || "Customer";
};

export const formatMinorCurrency = (amountCents: number, currency = "GHS") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.length === 3 ? currency : "GHS"
  }).format(amountCents / 100);
