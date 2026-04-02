import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SupportLayout, Footer, TopNavBar, BottomNavBar } from "@/components/layout";
import { Icon } from "@/components/Icon";
import { faqItems, tickets } from "@/lib/data/customer-mock";
import { SUPPORT_SENDER_LABEL } from "@/lib/brand";

/* ─────────────────────────────────────────────
   SUPPORT CENTER — Help/FAQ
───────────────────────────────────────────── */
export const SupportCenterPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const filtered = faqItems.filter(
    (f) =>
      query === "" ||
      f.question.toLowerCase().includes(query.toLowerCase()) ||
      f.answer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-surface text-on-background font-body">
      <TopNavBar />
      <main className="pt-[calc(5rem+env(safe-area-inset-top,0px))] md:pt-24 pb-24 md:pb-20 max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        <header className="text-center mb-10 md:mb-16">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4 block">Help Center</span>
          <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter mb-4 px-1">How can we help you?</h1>
          <p className="text-on-surface-variant max-w-xl mx-auto">
            Find answers to your questions or contact our team.
          </p>
          <div className="relative mt-8 max-w-lg mx-auto">
            <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-outline" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-surface-container-high border-none rounded-full py-4 pl-14 pr-6 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none"
              placeholder="Search for answers..."
              type="text"
            />
          </div>
        </header>

        {/* Quick Topics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { icon: "local_shipping", label: "Shipping", to: "#" },
            { icon: "assignment_return", label: "Returns", to: "#" },
            { icon: "payments", label: "Payments", to: "#" },
            { icon: "support_agent", label: "Contact Us", to: "/contact" },
          ].map(({ icon, label, to }) => (
            <Link
              key={label}
              to={to}
              className="flex flex-col items-center gap-3 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:border-secondary/30 hover:shadow-[0_10px_30px_rgba(11,28,48,0.06)] transition-all"
            >
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                <Icon name={icon} />
              </div>
              <span className="font-label text-xs uppercase tracking-widest font-bold">{label}</span>
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="font-headline text-3xl font-bold tracking-tight mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {filtered.map((item, i) => (
              <div
                key={i}
                className={`bg-surface-container-lowest rounded-xl border overflow-hidden transition-all ${openFaq === i ? "border-secondary/30 shadow-[0_10px_30px_rgba(0,81,213,0.06)]" : "border-outline-variant/20"}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-headline font-bold">{item.question}</span>
                  <Icon name={openFaq === i ? "expand_less" : "expand_more"} className="text-secondary flex-shrink-0" />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="text-on-surface-variant leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Still Need Help */}
        <div className="bg-primary-container rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-white font-headline font-bold text-2xl mb-2">Still need help?</h3>
            <p className="text-white/80">Our concierge team is available Monday–Friday, 9am–6pm EST.</p>
          </div>
          <div className="flex gap-4">
            <Link to="/contact" className="bg-white text-primary-container px-6 py-3 rounded-md font-bold hover:opacity-90 transition-opacity whitespace-nowrap">
              Contact Us
            </Link>
            <Link to="/account/support/new" className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 transition-opacity whitespace-nowrap">
              Open a Ticket
            </Link>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNavBar />
    </div>
  );
};

/** Catalog route `/help` — same UI as support hub, FAQ-forward framing. */
export const HelpFaqPage = SupportCenterPage;

/* ─────────────────────────────────────────────
   CREATE TICKET
───────────────────────────────────────────── */
export const CreateTicketPage = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <SupportLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Open a Support Ticket</h1>
        <p className="text-on-surface-variant">Describe your issue and we'll get back to you within 24 hours.</p>
      </header>
      {!submitted ? (
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          className="max-w-2xl space-y-6"
        >
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Subject</label>
            <input required className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="Briefly describe your issue" type="text" />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Category</label>
            <select className="w-full bg-surface-container-high border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-secondary transition-all outline-none">
              <option>Order Issue</option>
              <option>Shipping & Delivery</option>
              <option>Returns & Refunds</option>
              <option>Product Question</option>
              <option>Payment Issue</option>
              <option>Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Order Number (if applicable)</label>
            <input className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="TC-88291" type="text" />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Message</label>
            <textarea required className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none resize-none" rows={6} placeholder="Please describe your issue in detail..." />
          </div>
          <button type="submit" className="bg-secondary text-on-secondary px-8 py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
            Submit Ticket
          </button>
        </form>
      ) : (
        <div className="max-w-2xl text-center py-20 space-y-6">
          <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto">
            <Icon name="check_circle" filled className="text-4xl text-secondary" />
          </div>
          <h2 className="font-headline text-2xl font-bold">Ticket Submitted</h2>
          <p className="text-on-surface-variant">
            We've received your request and will reply within 24 hours. You can track the status in My Tickets.
          </p>
          <Link to="/account/support" className="inline-block bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
            View My Tickets
          </Link>
        </div>
      )}
    </SupportLayout>
  );
};

/* ─────────────────────────────────────────────
   TICKETS LIST
───────────────────────────────────────────── */
export const TicketsListPage = () => (
  <SupportLayout>
    <header className="mb-12">
      <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">My Tickets</h1>
      <p className="text-on-surface-variant">Track all your active support requests.</p>
    </header>
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          to={`/support/ticket/${ticket.id}`}
          className="flex flex-col md:flex-row items-start md:items-center gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)] transition-shadow group"
        >
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticket.status === "open" ? "bg-error/10 text-error" : ticket.status === "resolved" ? "bg-secondary/10 text-secondary" : "bg-surface-container-high text-on-surface-variant"}`}>
                {ticket.status}
              </span>
              <span className="text-xs text-outline">{ticket.createdAt}</span>
            </div>
            <h3 className="font-headline font-bold">{ticket.subject}</h3>
            <p className="text-sm text-on-surface-variant mt-1">Last reply: {ticket.lastReply}</p>
          </div>
          <Icon name="chevron_right" className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      ))}
      <Link to="/account/support/new" className="flex items-center gap-3 p-6 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant/30 hover:border-secondary/30 transition-colors">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
          <Icon name="add" className="text-secondary" />
        </div>
        <span className="font-label font-bold text-sm uppercase tracking-widest text-on-surface-variant">Open New Ticket</span>
      </Link>
    </div>
  </SupportLayout>
);

/* ─────────────────────────────────────────────
   TICKET DETAIL
───────────────────────────────────────────── */
export const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const ticket = tickets.find((t) => t.id === ticketId) ?? tickets[0];

  return (
    <SupportLayout>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/account/support">Tickets</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">{ticket.id}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background">{ticket.subject}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticket.status === "open" ? "bg-error/10 text-error" : "bg-secondary/10 text-secondary"}`}>
            {ticket.status}
          </span>
          <span className="text-xs text-outline">Opened {ticket.createdAt}</span>
        </div>
      </header>

      <div className="max-w-2xl space-y-4 mb-8">
        {ticket.messages.map((msg, i) => (
          <div
            key={i}
            className={`p-6 rounded-2xl ${msg.sender === "customer" ? "bg-secondary/5 border border-secondary/10 ml-auto" : "bg-surface-container-lowest border border-outline-variant/20"} max-w-[85%] ${msg.sender === "customer" ? "ml-auto" : ""}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] uppercase tracking-widest font-bold ${msg.sender === "customer" ? "text-secondary" : "text-on-surface-variant"}`}>
                {msg.sender === "customer" ? "You" : SUPPORT_SENDER_LABEL}
              </span>
              <span className="text-xs text-outline">{msg.time}</span>
            </div>
            <p className="text-sm leading-relaxed">{msg.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "resolved" && (
        <div className="max-w-2xl space-y-4">
          <textarea className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none resize-none" rows={4} placeholder="Add a reply..." />
          <button className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">Send Reply</button>
        </div>
      )}
    </SupportLayout>
  );
};

/* ─────────────────────────────────────────────
   ISSUE REPORTING (bug / site issue)
───────────────────────────────────────────── */
export const IssueReportingPage = () => (
  <div className="bg-surface text-on-background font-body">
    <TopNavBar />
    <main className="pt-24 pb-20 max-w-xl mx-auto px-6">
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter mb-2">Report an Issue</h1>
        <p className="text-on-surface-variant">Encountered a problem with our website? Let us know.</p>
      </header>
      <form className="space-y-6">
        <div className="space-y-2">
          <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Issue Type</label>
          <select className="w-full bg-surface-container-high border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-secondary outline-none">
            <option>Website Bug</option>
            <option>Payment Problem</option>
            <option>Missing Order</option>
            <option>Account Access Issue</option>
            <option>Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Page or URL</label>
          <input className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary outline-none" placeholder="https://teescollection.com/..." type="url" />
        </div>
        <div className="space-y-2">
          <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Description</label>
          <textarea className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary outline-none resize-none" rows={5} placeholder="Describe what happened..." />
        </div>
        <button type="submit" className="w-full bg-secondary text-on-secondary py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90">Submit Report</button>
      </form>
    </main>
    <Footer />
  </div>
);
