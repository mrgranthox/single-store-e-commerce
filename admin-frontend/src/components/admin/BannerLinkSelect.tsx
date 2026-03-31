import clsx from "clsx";

import { StitchFieldLabel, stitchSelectClass } from "@/components/stitch";
import type { BannerListItem } from "@/features/content/api/admin-content.api";

export const BannerLinkSelect = ({
  label,
  value,
  onChange,
  banners,
  disabled,
  loading,
  hint
}: {
  label: string;
  value: string;
  onChange: (bannerId: string) => void;
  banners: BannerListItem[];
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
}) => (
  <label className="block">
    <StitchFieldLabel>{label}</StitchFieldLabel>
    <select
      className={clsx(stitchSelectClass, (disabled || loading) && "cursor-not-allowed opacity-80")}
      value={value}
      disabled={disabled || loading}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">None</option>
      {banners.map((b) => (
        <option key={b.id} value={b.id}>
          {(b.title || "Untitled").slice(0, 56)} — {b.placement}
        </option>
      ))}
    </select>
    {hint ? <span className="mt-1 block text-[11px] font-normal text-[#737685]">{hint}</span> : null}
    {loading ? <span className="mt-1 block text-[11px] font-normal text-[#737685]/80">Loading banners…</span> : null}
  </label>
);
