import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `pb-3 text-sm transition-colors ${
    isActive ? "border-b-2 border-[#1653cc] font-bold text-[#1653cc]" : "font-medium text-slate-500 hover:text-[#181b25]"
  }`;

export const CustomerWorkspaceNav = ({ customerId }: { customerId: string }) => {
  const base = `/admin/customers/${customerId}`;
  return (
    <div className="mt-8 flex flex-wrap gap-6 border-b border-[#c3c6d6]/30">
      <NavLink to={base} end className={tabClass}>
        Overview
      </NavLink>
      <NavLink to={`${base}/activity`} className={tabClass}>
        Activity
      </NavLink>
      <NavLink to={`${base}/orders`} className={tabClass}>
        Orders
      </NavLink>
      <NavLink to={`${base}/support`} className={tabClass}>
        Support
      </NavLink>
      <NavLink to={`${base}/reviews`} className={tabClass}>
        Reviews
      </NavLink>
      <NavLink to={`${base}/risk`} className={tabClass}>
        Risk
      </NavLink>
      <NavLink to={`${base}/actions`} className={tabClass}>
        Actions
      </NavLink>
    </div>
  );
};
