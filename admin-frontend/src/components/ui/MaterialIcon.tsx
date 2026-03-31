import clsx from "clsx";

/** Google Material Symbols Outlined — load font in index.html. */
export const MaterialIcon = ({
  name,
  className,
  filled = false
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) => (
  <span
    className={clsx("material-symbols-outlined select-none", className)}
    style={
      filled
        ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
        : undefined
    }
    aria-hidden
  >
    {name}
  </span>
);
