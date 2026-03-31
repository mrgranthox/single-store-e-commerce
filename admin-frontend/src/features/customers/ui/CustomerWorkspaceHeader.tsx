import { Link } from "react-router-dom";

export const CustomerWorkspaceHeader = ({
  customerId,
  customerName,
  tabLabel
}: {
  customerId: string;
  customerName: string;
  tabLabel: string;
}) => (
  <div className="mb-8">
    <nav className="mb-2 flex flex-wrap items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
      <Link to="/admin/customers" className="hover:text-[#1653cc]">
        Customers
      </Link>
      <span className="mx-2 text-[#c3c6d6]">/</span>
      <Link to={`/admin/customers/${customerId}`} className="max-w-[200px] truncate hover:text-[#1653cc]">
        {customerName}
      </Link>
      <span className="mx-2 text-[#c3c6d6]">/</span>
      <span className="font-bold text-[#1653cc]">{tabLabel}</span>
    </nav>
    <h2 className="font-headline text-2xl font-bold tracking-tight text-[#181b25]">
      <span className="break-words">{customerName}</span>{" "}
      <span className="mx-2 font-light text-slate-400">→</span>{" "}
      <span className="font-medium text-[#1653cc]">{tabLabel}</span>
    </h2>
  </div>
);
