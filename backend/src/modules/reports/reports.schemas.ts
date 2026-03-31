import { z } from "zod";

const optionalDateSchema = z.coerce.date().optional();

export const reportsDateRangeQuerySchema = z.object({
  from: optionalDateSchema,
  to: optionalDateSchema
});
