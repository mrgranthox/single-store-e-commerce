import { clsx } from "clsx";

export const cn = (...parts: Array<string | false | null | undefined>) => clsx(parts);
