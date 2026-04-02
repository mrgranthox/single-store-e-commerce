type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

export const Icon = ({ name, className = "", filled = false }: IconProps) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
  >
    {name}
  </span>
);
