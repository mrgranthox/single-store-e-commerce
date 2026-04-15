import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footer, TopNavBar, BottomNavBar } from "@/components/layout";
import { Icon } from "@/components/Icon";
import { formatIsoDate, ticketStatusBadgeClass } from "@/lib/account/account-ui";
import { customerBackendApi } from "@/lib/api/customer-backend-api";
import { CommerceApiError } from "@/lib/api/commerce-fetch";
import { SUPPORT_SENDER_LABEL } from "@/lib/brand";
import { neutralFieldClass } from "@/lib/form-field-styles";
import { useCustomerStore } from "@/lib/store/customer-store";

const SupportPageShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh flex flex-col bg-surface text-on-background font-body">
    <TopNavBar />
    <main className="flex-1 pt-[calc(5rem+env(safe-area-inset-top,0px))] md:pt-24 pb-24 md:pb-20 max-w-4xl mx-auto px-4 sm:px-6 md:px-8 w-full min-w-0">
      {children}
    </main>
    <Footer />
    <BottomNavBar />
  </div>
);

const parseHelpFaqs = (payload: unknown): Array<{ question: string; answer: string }> => {
  if (!payload || typeof payload !== "object") return [];
  const entity = (payload as { entity?: { content?: unknown } }).entity;
  const content = entity?.content;
  if (!content || typeof content !== "object") return [];
  const c = content as Record<string, unknown>;
  const raw = Array.isArray(c.faqs) ? c.faqs : Array.isArray(c.faq) ? c.faq : null;
  if (!raw) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      const question = typeof o.question === "string" ? o.question : typeof o.title === "string" ? o.title : null;
      const answer = typeof o.answer === "string" ? o.answer : typeof o.body === "string" ? o.body : null;
      return question && answer ? { question, answer } : null;
    })
    .filter(Boolean) as Array<{ question: string; answer: string }>;
};

/* ─────────────────────────────────────────────
   SUPPORT CENTER — Help/FAQ
───────────────────────────────────────────── */
export const SupportCenterPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const { data: helpPayload, isPending, error } = useQuery({
    queryKey: ["storefront", "help"],
    queryFn: async () => {
      const res = await customerBackendApi.getHelpPage();
      return res.data;
    }
  });

  const faqItems = useMemo(() => parseHelpFaqs(helpPayload), [helpPayload]);

  const filtered = faqItems.filter(
    (f) =>
      query === "" ||
      f.question.toLowerCase().includes(query.toLowerCase()) ||
      f.answer.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SupportPageShell>
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
              className={`w-full rounded-full py-4 pl-14 pr-6 transition-colors ${neutralFieldClass}`}
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
          {isPending ? <p className="text-on-surface-variant text-sm mb-4">Loading help content…</p> : null}
          {error ? (
            <p className="text-error text-sm mb-4">
              {error instanceof CommerceApiError ? error.message : "Help content is unavailable."}
            </p>
          ) : null}
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
            <Link to="/support/new" className="bg-secondary text-on-secondary px-6 py-3 rounded-md font-bold hover:opacity-90 transition-opacity whitespace-nowrap">
              Open a Ticket
            </Link>
          </div>
        </div>
    </SupportPageShell>
  );
};

/** Catalog route `/help` — same UI as support hub, FAQ-forward framing. */
export const HelpFaqPage = SupportCenterPage;

/* ─────────────────────────────────────────────
   CREATE TICKET
───────────────────────────────────────────── */
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CreateTicketPage = () => {
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const [submitted, setSubmitted] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("Order Issue");
  const [orderRef, setOrderRef] = useState("");
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const bodyText = [`Category: ${category}`, subject.trim() ? `Subject: ${subject.trim()}` : null, message.trim()]
        .filter(Boolean)
        .join("\n\n");
      if (isAuthenticated) {
        const orderId = uuidRe.test(orderRef.trim()) ? orderRef.trim() : undefined;
        await customerBackendApi.createSupportTicket({
          orderId,
          priority: "MEDIUM",
          message: bodyText
        });
        return;
      }
      await customerBackendApi.postPublicSupportContact({
        name: guestName.trim() || undefined,
        email: guestEmail.trim() || undefined,
        subject: subject.trim() || `${category} — support request`,
        message: bodyText,
        captchaToken: undefined
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      setFormError(err instanceof CommerceApiError ? err.message : "Could not submit ticket.");
    }
  });

  return (
    <SupportPageShell>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">Open a Support Ticket</h1>
        <p className="text-on-surface-variant">Describe your issue and we'll get back to you within 24 hours.</p>
      </header>
      {!submitted ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (!isAuthenticated && !guestEmail.trim()) {
              setFormError("Email is required for guest requests.");
              return;
            }
            mutation.mutate();
          }}
          className="max-w-2xl space-y-6"
        >
          {!isAuthenticated ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Your name</label>
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Email</label>
                <input
                  required={!isAuthenticated}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
                  type="email"
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Subject</label>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              placeholder="Briefly describe your issue"
              type="text"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full rounded-lg py-3 px-4 ${neutralFieldClass}`}
            >
              <option>Order Issue</option>
              <option>Shipping & Delivery</option>
              <option>Returns & Refunds</option>
              <option>Product Question</option>
              <option>Payment Issue</option>
              <option>Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
              Order ID (UUID, if linking an account order)
            </label>
            <input
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value)}
              className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
              placeholder="Optional"
              type="text"
            />
          </div>
          <div className="space-y-2">
            <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Message</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`}
              rows={6}
              placeholder="Please describe your issue in detail..."
            />
          </div>
          {formError ? <p className="text-error text-sm">{formError}</p> : null}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-secondary text-on-secondary px-8 py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {mutation.isPending ? "Submitting…" : "Submit Ticket"}
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
          <Link
            to={isAuthenticated ? "/support/tickets" : "/support"}
            className="inline-block bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90"
          >
            {isAuthenticated ? "View My Tickets" : "Back to Help"}
          </Link>
        </div>
      )}
    </SupportPageShell>
  );
};

/* ─────────────────────────────────────────────
   TICKETS LIST
───────────────────────────────────────────── */
export const TicketsListPage = () => {
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);

  const { data, isPending, error } = useQuery({
    queryKey: ["support", "tickets"],
    queryFn: async () => {
      const res = await customerBackendApi.listSupportTickets({ page: 1, page_size: 50 });
      return (res.data as { items?: unknown[] }).items ?? [];
    },
    enabled: isAuthenticated
  });

  const items = (data ?? []) as Array<{
    id: string;
    subject: string | null;
    status: string;
    createdAt: string;
    lastMessageAt: string;
  }>;

  if (!isAuthenticated) {
    return (
      <SupportPageShell>
        <header className="mb-12">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">My Tickets</h1>
          <p className="text-on-surface-variant mb-6">Sign in to view tickets linked to your account.</p>
          <Link to="/login" className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90">
            Sign in
          </Link>
        </header>
      </SupportPageShell>
    );
  }

  return (
    <SupportPageShell>
      <header className="mb-12">
        <h1 className="text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-2">My Tickets</h1>
        <p className="text-on-surface-variant">Track all your active support requests.</p>
      </header>
      {isPending ? <p className="text-on-surface-variant mb-4">Loading…</p> : null}
      {error ? (
        <p className="text-error text-sm mb-4">{error instanceof CommerceApiError ? error.message : "Could not load tickets."}</p>
      ) : null}
      <div className="space-y-4">
        {items.map((ticket) => (
          <Link
            key={ticket.id}
            to={`/support/ticket/${ticket.id}`}
            className="flex flex-col md:flex-row items-start md:items-center gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:shadow-[0_20px_40px_rgba(11,28,48,0.06)] transition-shadow group"
          >
            <div className="flex-grow">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticketStatusBadgeClass(ticket.status)}`}>
                  {ticket.status}
                </span>
                <span className="text-xs text-outline">{formatIsoDate(ticket.createdAt)}</span>
              </div>
              <h3 className="font-headline font-bold">{ticket.subject || "Support ticket"}</h3>
              <p className="text-sm text-on-surface-variant mt-1">Last activity: {formatIsoDate(ticket.lastMessageAt)}</p>
            </div>
            <Icon name="chevron_right" className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
        {!isPending && !error && items.length === 0 ? (
          <p className="text-on-surface-variant text-sm">No tickets yet.</p>
        ) : null}
        <Link
          to="/support/new"
          className="flex items-center gap-3 p-6 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant/30 hover:border-secondary/30 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
            <Icon name="add" className="text-secondary" />
          </div>
          <span className="font-label font-bold text-sm uppercase tracking-widest text-on-surface-variant">Open New Ticket</span>
        </Link>
      </div>
    </SupportPageShell>
  );
};

/* ─────────────────────────────────────────────
   TICKET DETAIL
───────────────────────────────────────────── */
export const TicketDetailPage = () => {
  const { ticketId } = useParams();
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["support", "ticket", ticketId],
    queryFn: async () => {
      const res = await customerBackendApi.getSupportTicket(ticketId!);
      return res.data as {
        entity: {
          id: string;
          subject: string | null;
          status: string;
          createdAt: string;
          messages: Array<{ id: string; authorType: string; body: string; createdAt: string }>;
          allowedActions?: { canReply?: boolean };
        };
      };
    },
    enabled: Boolean(ticketId) && isAuthenticated
  });

  const ticket = data?.entity;

  const replyMutation = useMutation({
    mutationFn: async () => {
      await customerBackendApi.postSupportTicketMessage(ticketId!, { body: reply.trim() });
    },
    onSuccess: async () => {
      setReply("");
      await queryClient.invalidateQueries({ queryKey: ["support", "ticket", ticketId] });
    }
  });

  if (!isAuthenticated) {
    return (
      <SupportPageShell>
        <p className="text-on-surface-variant mb-4">Sign in to view this ticket.</p>
        <Link to="/login" className="text-secondary font-bold hover:underline">
          Sign in
        </Link>
      </SupportPageShell>
    );
  }

  if (!ticketId) return null;

  if (!isPending && (error || !ticket)) {
    return (
      <SupportPageShell>
        <p className="text-on-surface-variant">Ticket not found.</p>
        <Link to="/support/tickets" className="text-secondary font-bold text-sm mt-4 inline-block hover:underline">
          Back to tickets
        </Link>
      </SupportPageShell>
    );
  }

  if (isPending || !ticket) {
    return (
      <SupportPageShell>
        <p className="text-on-surface-variant">Loading ticket…</p>
      </SupportPageShell>
    );
  }

  return (
    <SupportPageShell>
      <nav className="flex items-center gap-2 text-xs font-label tracking-widest uppercase text-outline mb-10">
        <Link className="hover:text-secondary transition-colors" to="/support/tickets">Tickets</Link>
        <Icon name="chevron_right" className="text-[10px]" />
        <span className="text-on-surface">{ticket.id}</span>
      </nav>
      <header className="mb-8">
        <h1 className="text-3xl font-headline font-extrabold tracking-tighter text-on-background">{ticket.subject || "Support ticket"}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded ${ticketStatusBadgeClass(ticket.status)}`}>
            {ticket.status}
          </span>
          <span className="text-xs text-outline">Opened {formatIsoDate(ticket.createdAt)}</span>
        </div>
      </header>

      <div className="max-w-2xl space-y-4 mb-8">
        {ticket.messages.map((msg) => {
          const isCustomer = msg.authorType === "CUSTOMER";
          return (
            <div
              key={msg.id}
              className={`p-6 rounded-2xl ${
                isCustomer ? "bg-secondary/5 border border-secondary/10 ml-auto" : "bg-surface-container-lowest border border-outline-variant/20"
              } max-w-[85%] ${isCustomer ? "ml-auto" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] uppercase tracking-widest font-bold ${isCustomer ? "text-secondary" : "text-on-surface-variant"}`}>
                  {isCustomer ? "You" : SUPPORT_SENDER_LABEL}
                </span>
                <span className="text-xs text-outline">{formatIsoDate(msg.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed">{msg.body}</p>
            </div>
          );
        })}
      </div>

      {ticket.allowedActions?.canReply ? (
        <div className="max-w-2xl space-y-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={`w-full resize-none rounded-lg px-4 py-4 ${neutralFieldClass}`}
            rows={4}
            placeholder="Add a reply..."
          />
          {replyMutation.isError ? (
            <p className="text-error text-sm">
              {replyMutation.error instanceof CommerceApiError ? replyMutation.error.message : "Could not send reply."}
            </p>
          ) : null}
          <button
            type="button"
            disabled={replyMutation.isPending || !reply.trim()}
            onClick={() => replyMutation.mutate()}
            className="bg-secondary text-on-secondary px-8 py-3 rounded-md font-bold hover:opacity-90 disabled:opacity-60"
          >
            {replyMutation.isPending ? "Sending…" : "Send Reply"}
          </button>
        </div>
      ) : null}
    </SupportPageShell>
  );
};

/* ─────────────────────────────────────────────
   ISSUE REPORTING (bug / site issue)
───────────────────────────────────────────── */
export const IssueReportingPage = () => {
  const [issueType, setIssueType] = useState("Website Bug");
  const [pageUrl, setPageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated);

  const mutation = useMutation({
    mutationFn: async () => {
      const message = [`Issue type: ${issueType}`, pageUrl.trim() ? `Page: ${pageUrl.trim()}` : null, description.trim()]
        .filter(Boolean)
        .join("\n\n");
      if (isAuthenticated) {
        await customerBackendApi.createSupportTicket({
          priority: "MEDIUM",
          message
        });
        return;
      }
      await customerBackendApi.postPublicSupportContact({
        email: guestEmail.trim() || undefined,
        subject: `Site issue — ${issueType}`,
        message,
        captchaToken: undefined
      });
    },
    onSuccess: () => setDone(true),
    onError: (err) => setFormError(err instanceof CommerceApiError ? err.message : "Submit failed.")
  });

  return (
    <SupportPageShell>
      <div className="max-w-xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-headline font-extrabold tracking-tighter mb-2">Report an Issue</h1>
          <p className="text-on-surface-variant">Encountered a problem with our website? Let us know.</p>
        </header>
        {!done ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!isAuthenticated && !guestEmail.trim()) {
                setFormError("Email is required.");
                return;
              }
              mutation.mutate();
            }}
          >
            {!isAuthenticated ? (
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Email</label>
                <input
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
                  type="email"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className={`w-full rounded-lg py-3 px-4 ${neutralFieldClass}`}
              >
                <option>Website Bug</option>
                <option>Payment Problem</option>
                <option>Missing Order</option>
                <option>Account Access Issue</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Page or URL</label>
              <input
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className={`w-full rounded-lg px-4 py-3 ${neutralFieldClass}`}
                placeholder="https://…"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className={`w-full resize-none rounded-lg px-4 py-3 ${neutralFieldClass}`}
                rows={5}
                placeholder="Describe what happened..."
              />
            </div>
            {formError ? <p className="text-error text-sm">{formError}</p> : null}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-secondary text-on-secondary py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-60"
            >
              {mutation.isPending ? "Submitting…" : "Submit Report"}
            </button>
          </form>
        ) : (
          <p className="text-on-surface-variant">Thanks — we received your report.</p>
        )}
      </div>
    </SupportPageShell>
  );
};
