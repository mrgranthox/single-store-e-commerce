import { TopNavBar, Footer, BottomNavBar } from "@/components/layout";
import { Icon } from "@/components/Icon";
import { STORE_EMAIL_PRIVACY, STORE_EMAIL_SUPPORT, STORE_NAME_FULL } from "@/lib/brand";

const PolicyLayout = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-surface text-on-background font-body">
    <TopNavBar />
    <main className="pt-[calc(5rem+env(safe-area-inset-top,0px))] md:pt-24 pb-24 md:pb-20 max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
      <header className="mb-8 md:mb-12">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter mb-3">{title}</h1>
        <p className="text-xs text-outline font-label uppercase tracking-widest">Last updated: January 1, 2024</p>
      </header>
      <div className="prose max-w-none">{children}</div>
    </main>
    <Footer />
    <BottomNavBar />
  </div>
);

const ProseSection = ({ title, text }: { title: string; text: string }) => (
  <div className="mb-8">
    <h2 className="font-headline font-bold text-xl mb-3">{title}</h2>
    <p className="text-on-surface-variant leading-relaxed">{text}</p>
  </div>
);

/* ─────────────────────────────────────────────
   CONTACT PAGE
───────────────────────────────────────────── */
export const ContactPage = () => (
  <div className="bg-surface text-on-background font-body">
    <TopNavBar />
    <main className="pt-[calc(5rem+env(safe-area-inset-top,0px))] md:pt-24 pb-24 md:pb-20 max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
      <header className="mb-10 md:mb-16 text-center">
        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4 block">Get in Touch</span>
        <h1 className="font-headline text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tighter mb-4">Contact Us</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto">
          Our concierge team is here to help. We typically respond within 2-3 business hours.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Contact Form */}
        <div>
          <h2 className="font-headline font-bold text-2xl mb-8">Send a Message</h2>
          <form className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {["First Name", "Last Name"].map((label) => (
                <div key={label} className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">{label}</label>
                  <input className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" type="text" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Email</label>
              <input className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" type="email" />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Subject</label>
              <select className="w-full bg-surface-container-high border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-secondary outline-none">
                <option>Order Support</option>
                <option>Returns & Refunds</option>
                <option>Product Question</option>
                <option>Styling Advice</option>
                <option>Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Message</label>
              <textarea className="w-full bg-surface-container-high border-none px-4 py-3 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none resize-none" rows={5} placeholder="How can we help?" />
            </div>
            <button type="submit" className="w-full bg-secondary text-on-secondary py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
              Send Message
            </button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="space-y-8">
          <h2 className="font-headline font-bold text-2xl mb-8">Other Ways to Reach Us</h2>
          {[
            { icon: "mail", title: "Email", desc: STORE_EMAIL_SUPPORT, sub: "Response within 2-3 hours" },
            { icon: "chat", title: "Live Chat", desc: "Chat with an expert", sub: "Monday–Friday, 9am–6pm EST" },
            { icon: "phone", title: "Phone", desc: "+1 (800) 284-3627", sub: "Monday–Friday, 10am–5pm EST" },
          ].map(({ icon, title, desc, sub }) => (
            <div key={title} className="flex items-start gap-5 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary flex-shrink-0">
                <Icon name={icon} />
              </div>
              <div>
                <p className="font-headline font-bold">{title}</p>
                <p className="text-on-surface font-medium">{desc}</p>
                <p className="text-sm text-on-surface-variant">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
    <Footer />
    <BottomNavBar />
  </div>
);

/* ─────────────────────────────────────────────
   ABOUT PAGE
───────────────────────────────────────────── */
export const AboutPage = () => (
  <div className="bg-surface text-on-background font-body">
    <TopNavBar />
    <main className="pt-[calc(4rem+env(safe-area-inset-top,0px))] md:pt-20">
      {/* Hero */}
      <section className="relative min-h-[50dvh] md:h-[600px] md:min-h-0 overflow-hidden bg-primary-container">
        <img
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_hcc82H9gNhpAxZ-TofQGXOkMdTid-d1NhkQkUWjMdSjkkQgD5iKD1pIPRDfARutQlOC-dlMWGA29z-U5SYtKE7ZOkl1x4B3r0f633Ng7miUjoOpR7YlyxIiJ6fyE7p2tF-dIvnjJYZVDiBiCEvNqjjRWOeaVTcPqSBhmdx6yTeRRoDmK4dCmI2GaRAHtAj3z8Znc6IdK01gVgRT3BfvWxttpLmHdptUbURhMGhZFVkhKmWcXbB6Yl_1ihTgTEW5wetOGYVngXNpv"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-primary-container/85 md:from-primary-container/80 via-transparent to-transparent" />
        <div className="relative min-h-[50dvh] md:min-h-0 md:h-full max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col justify-end md:justify-center py-12 md:py-0">
          <span className="font-label text-tertiary-fixed tracking-[0.3em] uppercase text-xs mb-4 font-bold block">Our Story</span>
          <h1 className="font-headline text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter max-w-2xl leading-tight">
            Tees you will live in.
          </h1>
        </div>
      </section>

      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-24 pb-24 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16 md:mb-24">
          <div>
            <span className="text-secondary font-bold text-[10px] uppercase tracking-widest block mb-4">Founded 2019</span>
            <h2 className="font-headline text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-6">A mission built on craft.</h2>
            <div className="space-y-4 text-on-surface-variant leading-relaxed">
              <p>{STORE_NAME_FULL} started with a simple idea: great tees should feel as good as they look — honest fabrics, fair fits, and prices that make sense.</p>
              <p>Today we curate graphic and everyday staples from trusted makers, with checkout powered by Paystack (Visa, Mastercard, and mobile money on MTN, Telecel, and AirtelTigo).</p>
            </div>
          </div>
          <div className="aspect-[4/3] bg-surface-container-low rounded-2xl overflow-hidden">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2851r1etCiu6QgEnhSIdFq9P380onbxdDw158-z5_uEoScdRnO5GKnnkYVwdtLgYvas6d5wc5M_PNYI5oRvAuzc9k8vS7VwLAKgi3BQOERzOaA7yChJhX2u-Hne8o8tbnLjzT-0-tBErjLnyguxVK86Xvp3u4ERGPFIAxWuKOGo4l-aHo39hSncPabdxCZc3JbA-m_v4CCq5U8k_Verjh1bIMd2Ttiu32R7Dn4439Z1Uj2akfhsCjvtsgpALo4h"
              alt="Craftsmanship"
            />
          </div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            { icon: "eco", title: "Sustainability", desc: "Every supplier is vetted against our 40-point sustainability framework. Zero single-use plastics in all packaging." },
            { icon: "handshake", title: "Authenticity", desc: "We visit every workshop personally. Every product on our platform has been touched and tested by our editorial team." },
            { icon: "diamond", title: "Quality", desc: `We only stock pieces we would wear ourselves. Nothing lands on ${STORE_NAME_FULL} without passing our quality check.` },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-surface-container-lowest p-6 sm:p-8 md:p-10 rounded-2xl border border-outline-variant/20">
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary mb-6">
                <Icon name={icon} />
              </div>
              <h3 className="font-headline font-bold text-xl mb-3">{title}</h3>
              <p className="text-on-surface-variant leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
    <Footer />
    <BottomNavBar />
  </div>
);

/* ─────────────────────────────────────────────
   SHIPPING POLICY
───────────────────────────────────────────── */
export const ShippingPolicyPage = () => (
  <PolicyLayout title="Shipping Policy">
    <ProseSection title="Delivery Timeframes" text="Standard delivery takes 3-5 business days within the United States. Express shipping delivers next business day for orders placed before 12pm EST. International orders typically take 7-14 business days and may be subject to customs delays." />
    <ProseSection title="Shipping Costs" text="We offer free standard shipping on all orders over $250. For orders below this threshold, standard shipping is $12.00. Express shipping is $24.00 regardless of order size." />
    <ProseSection title="International Shipping" text={`We ship to many countries worldwide. International orders may incur customs duties and taxes, which are the responsibility of the recipient. ${STORE_NAME_FULL} is not responsible for customs delays.`} />
    <ProseSection title="Order Tracking" text="Once your order has been dispatched, you will receive a confirmation email with a tracking link. You can also track your orders in your account dashboard." />
    <ProseSection title="Packaging" text={`All ${STORE_NAME_FULL} orders ship in minimal, recyclable packaging. We avoid single-use plastics wherever possible.`} />
  </PolicyLayout>
);

/* ─────────────────────────────────────────────
   RETURNS POLICY
───────────────────────────────────────────── */
export const ReturnsPolicyPage = () => (
  <PolicyLayout title="Returns & Exchanges">
    <ProseSection title="Return Window" text="We accept returns within 30 days of delivery. Items must be unworn, unwashed, and in their original condition with all tags attached. Sale items are final sale and cannot be returned." />
    <ProseSection title="How to Return" text="To start a return, log in to your account and navigate to Orders. Select the order and click 'Request Return'. You will receive a prepaid return label via email within 1 business day." />
    <ProseSection title="Refund Processing" text="Once we receive and inspect your return, we will process your refund within 2-3 business days. Refunds are issued to the original payment method and typically appear within 5-7 business days." />
    <ProseSection title="Exchanges" text="We currently do not offer direct exchanges. To exchange an item, please return the original item and place a new order for your desired item." />
    <ProseSection title="Damaged or Defective Items" text="If you receive a damaged or defective item, please contact us within 7 days of delivery with photos. We will arrange for a replacement or full refund at our expense." />
  </PolicyLayout>
);

/* ─────────────────────────────────────────────
   PRIVACY POLICY
───────────────────────────────────────────── */
export const PrivacyPolicyPage = () => (
  <PolicyLayout title="Privacy Policy">
    <ProseSection title="Information We Collect" text="We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, postal address, payment information, and order history." />
    <ProseSection title="How We Use Your Information" text="We use the information we collect to process transactions, send order confirmations and updates, provide customer support, and send promotional communications (with your consent)." />
    <ProseSection title="Information Sharing" text="We do not sell or rent your personal information to third parties. We may share your information with service providers who assist us in operating our website and conducting our business, subject to confidentiality agreements." />
    <ProseSection title="Cookie Policy" text="We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie settings through your browser preferences." />
    <ProseSection title="Data Security" text="We implement industry-standard security measures to protect your personal information. Card and mobile-money payments are processed by Paystack, a PCI-DSS compliant provider." />
    <ProseSection title="Your Rights" text={`You have the right to access, correct, or delete your personal information at any time. Contact us at ${STORE_EMAIL_PRIVACY} to exercise these rights.`} />
  </PolicyLayout>
);

/* ─────────────────────────────────────────────
   TERMS & CONDITIONS
───────────────────────────────────────────── */
export const TermsPage = () => (
  <PolicyLayout title="Terms & Conditions">
    <ProseSection title="Acceptance of Terms" text={`By accessing and using the ${STORE_NAME_FULL} website, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our website.`} />
    <ProseSection title="Use of the Website" text="You agree to use this website only for lawful purposes and in a manner that does not infringe the rights of others or restrict their use of this website." />
    <ProseSection title="Product Descriptions" text="We make every effort to ensure that product descriptions are accurate. However, we do not warrant that product descriptions or other content is accurate, complete, or error-free." />
    <ProseSection title="Pricing" text="All prices are listed in USD and are subject to change without notice. We reserve the right to modify or discontinue products at any time." />
    <ProseSection title="Intellectual Property" text={`All content on this website, including text, images, graphics, and logos, is the property of ${STORE_NAME_FULL} and protected by copyright laws. Unauthorized use is strictly prohibited.`} />
    <ProseSection title="Limitation of Liability" text={`${STORE_NAME_FULL} shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our products or services.`} />
  </PolicyLayout>
);
