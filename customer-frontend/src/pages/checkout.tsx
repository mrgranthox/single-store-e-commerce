import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckoutHeader, CheckoutStepBar, CheckoutFooter, StoreBrandLink, StorefrontMain, StorefrontShell } from "@/components/layout";
import { STORE_NAME_FULL } from "@/lib/brand";
import { mockImages } from "@/lib/data/mock-images";
import { CheckoutOrderSummary } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useCustomerStore } from "@/lib/store/customer-store";

const SUMMARY_ITEMS = [
  {
    name: "Artisan Trench Coat",
    variant: "Sand / Medium",
    qty: 1,
    price: 450.0,
    image: mockImages.checkoutA,
  },
  {
    name: "Monolith Loafers",
    variant: "Mahogany / 42",
    qty: 1,
    price: 320.0,
    image: mockImages.checkoutB,
  },
];

/* ─────────────────────────────────────────────
   CART PAGE — matches cart_review/code.html
───────────────────────────────────────────── */
export const CartPage = () => {
  const cart = useCustomerStore((s) => s.cart);
  const updateQuantity = useCustomerStore((s) => s.updateQuantity);
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= 250 ? 0 : 45;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  if (cart.length === 0) {
    return (
      <StorefrontShell>
        <StorefrontMain className="text-on-surface">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary hover:underline underline-offset-4 mb-8"
          >
            <Icon name="arrow_back" className="text-lg" />
            Back to shop
          </Link>
          <div className="flex flex-col items-center justify-center text-center py-16 sm:py-24 px-4">
            <Icon name="shopping_bag" className="text-5xl sm:text-6xl text-outline mb-6" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-on-background mb-3">Your bag is empty</h1>
            <p className="text-on-surface-variant text-sm sm:text-base max-w-md mb-8 leading-relaxed">
              Discover pieces from our edit — shipping is complimentary over $250.
            </p>
            <Link
              to="/shop"
              className="bg-secondary text-on-secondary px-8 py-3.5 rounded-xl font-label font-bold text-sm uppercase tracking-widest hover:opacity-95 transition-opacity"
            >
              Continue shopping
            </Link>
          </div>
        </StorefrontMain>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <StorefrontMain className="text-on-surface antialiased min-w-0">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-sm font-label font-bold uppercase tracking-widest text-secondary hover:underline underline-offset-4 mb-6"
        >
          <Icon name="arrow_back" className="text-lg" />
          Back to shop
        </Link>
        <CheckoutStepBar current={1} />
        <header className="mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-extrabold tracking-tight text-on-background mb-2">Your bag</h1>
          <p className="text-on-surface-variant font-body max-w-xl text-sm sm:text-base leading-relaxed">
            Review items before checkout. Taxes and shipping are estimated at the next step.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 xl:gap-20 items-start">
          {/* Items */}
          <div className="lg:col-span-7 space-y-6 md:space-y-12">
            {cart.map((item) => (
              <div key={item.variantId} className="flex flex-row gap-4 sm:gap-6 md:gap-8 group">
                <div className="w-24 sm:w-28 md:w-48 shrink-0 aspect-[4/5] bg-surface-container-low overflow-hidden rounded-lg">
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={item.imageUrl}
                    alt={item.name}
                  />
                </div>
                <div className="flex flex-col flex-grow min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1 md:mb-2">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-secondary block">Item</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.variantId, 0)}
                      className="text-outline hover:text-error transition-colors shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Icon name="close" className="text-sm" />
                    </button>
                  </div>
                  <h3 className="text-base sm:text-lg md:text-2xl font-bold tracking-tight text-on-surface mb-1 line-clamp-2">
                    {item.name}
                  </h3>
                  <div className="mt-auto flex justify-between items-end gap-2 pt-3">
                    <div className="flex items-center bg-surface-container-high rounded-lg p-0.5 sm:p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-on-surface hover:text-secondary transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Icon name="remove" />
                      </button>
                      <span className="w-8 sm:w-10 text-center text-sm sm:text-base font-bold text-on-surface tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-on-surface hover:text-secondary transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Icon name="add" />
                      </button>
                    </div>
                    <span className="text-base sm:text-lg md:text-xl font-bold text-on-surface tabular-nums shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container-low rounded-xl p-8 lg:p-12 sticky top-32">
              <h2 className="text-3xl font-bold tracking-tight text-on-surface mb-8">Summary</h2>
              <div className="space-y-6 mb-10 pb-10 border-b border-outline-variant/20">
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="font-body">Subtotal</span>
                  <span className="font-bold text-on-surface">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="font-body">Shipping</span>
                  <span className="font-bold text-on-surface">{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between items-center text-on-surface-variant">
                  <span className="font-body">Estimated Tax</span>
                  <span className="font-bold text-on-surface">${tax.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-10">
                <span className="text-xl font-bold tracking-tight">Total</span>
                <span className="text-3xl font-extrabold tracking-tighter text-primary">${total.toFixed(2)}</span>
              </div>
              <div className="mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-outline block mb-3">Add Coupon</label>
                <div className="flex gap-2">
                  <input
                    className="flex-grow bg-surface-container-high border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none"
                    placeholder="CODE2024"
                    type="text"
                  />
                  <button className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
                    Apply
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/checkout/shipping")}
                className="w-full bg-secondary text-on-secondary py-4 sm:py-4 rounded-xl font-label font-bold text-sm sm:text-base uppercase tracking-wide hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
              >
                Proceed to checkout
                <Icon name="arrow_forward" />
              </button>
              <Link
                to="/shop"
                className="mt-4 w-full flex items-center justify-center py-3.5 rounded-xl border-2 border-outline-variant/25 text-on-surface font-label font-bold text-sm uppercase tracking-wide hover:border-secondary/40 hover:text-secondary transition-colors"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </StorefrontMain>
    </StorefrontShell>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT SHIPPING — matches checkout_shipping/code.html
───────────────────────────────────────────── */
const shippingSchema = z.object({
  fullName: z.string().min(2, "Name required"),
  address: z.string().min(5, "Address required"),
  city: z.string().min(2, "City required"),
  zip: z.string().min(3, "Zip required"),
  phone: z.string().min(7, "Phone required"),
});

export const CheckoutShippingPage = () => {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState<"standard" | "express">("standard");
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(shippingSchema),
  });

  return (
    <div className="bg-background font-body text-on-background antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-28 md:pb-20 lg:flex lg:gap-16 w-full min-w-0 overflow-x-hidden">
        <div className="lg:flex-1">
          <CheckoutStepBar current={2} />
          <section className="space-y-12">
            <div>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">Shipping Details</h1>
              <p className="text-on-surface-variant">Enter your destination to see available delivery options.</p>
            </div>
            <form
              onSubmit={handleSubmit(() => navigate("/checkout/payment"))}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8"
            >
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Full Name</label>
                <input {...register("fullName")} className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder="Julianne Moore" type="text" />
                {errors.fullName && <p className="text-xs text-error">{errors.fullName.message}</p>}
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Address</label>
                <input {...register("address")} className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder="Street, area, landmark" type="text" />
                {errors.address && <p className="text-xs text-error">{errors.address.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">City</label>
                <input {...register("city")} className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder="New York" type="text" />
                {errors.city && <p className="text-xs text-error">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Zip Code</label>
                <input {...register("zip")} className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder="10001" type="text" />
                {errors.zip && <p className="text-xs text-error">{errors.zip.message}</p>}
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Phone</label>
                <input {...register("phone")} className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder="+1 (555) 000-0000" type="tel" />
                {errors.phone && <p className="text-xs text-error">{errors.phone.message}</p>}
              </div>

              {/* Shipping Methods */}
              <div className="md:col-span-2 pt-8">
                <h2 className="font-headline text-xl font-bold tracking-tight mb-6">Delivery Method</h2>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: "standard", icon: "local_shipping", title: "Standard Delivery", sub: "3-5 business days", price: "Free" },
                    { id: "express", icon: "rocket_launch", title: "Express Shipping", sub: "Next day delivery", price: "$24.00" },
                  ].map((method) => (
                    <label
                      key={method.id}
                      className={`group cursor-pointer relative flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl transition-all shadow-sm border-2 ${
                        selectedMethod === method.id ? "border-secondary" : "border-transparent hover:border-secondary/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        value={method.id}
                        checked={selectedMethod === (method.id as "standard" | "express")}
                        onChange={() => setSelectedMethod(method.id as "standard" | "express")}
                        className="hidden"
                      />
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center">
                          <Icon name={method.icon} className="text-secondary" />
                        </div>
                        <div>
                          <p className="font-bold">{method.title}</p>
                          <p className="text-sm text-on-surface-variant">{method.sub}</p>
                        </div>
                      </div>
                      <span className="font-bold text-secondary">{method.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 pt-8 flex flex-col sm:flex-row justify-stretch sm:justify-end gap-3">
                <button
                  type="submit"
                  className="bg-secondary text-on-secondary px-8 sm:px-12 py-4 rounded-md font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full sm:w-auto"
                >
                  Proceed to Payment
                  <Icon name="arrow_forward" className="text-base" />
                </button>
              </div>
            </form>
          </section>
        </div>
        <CheckoutOrderSummary
          items={SUMMARY_ITEMS}
          subtotal={770}
          shipping="Calculated in next step"
          tax={61.6}
          total={831.6}
        />
      </main>
      {/* Mobile step nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20 shadow-[0_-10px_40px_rgba(11,28,48,0.06)]">
        {[
          { icon: "shopping_cart", label: "Cart", active: false },
          { icon: "local_shipping", label: "Ship", active: true },
          { icon: "payments", label: "Pay", active: false },
          { icon: "fact_check", label: "Review", active: false },
        ].map(({ icon, label, active }) => (
          <div key={label} className={`flex flex-col items-center justify-center font-inter text-[10px] uppercase tracking-widest font-bold ${active ? "text-secondary" : "text-slate-400 opacity-60"}`}>
            <Icon name={icon} filled={active} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT PAYMENT — matches checkout_payment/code.html
───────────────────────────────────────────── */
export const CheckoutPaymentPage = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"paystack_card" | "paystack_mobile_money">("paystack_card");
  const [billingSame, setBillingSame] = useState(true);
  const [mmNetwork, setMmNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");

  return (
    <div className="bg-surface text-on-surface antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-32 md:pb-20 min-h-screen w-full min-w-0 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <div className="lg:col-span-7 xl:col-span-8">
            <section className="mb-12">
              <h1 className="text-4xl md:text-5xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Finalize Payment</h1>
              <p className="text-on-surface-variant text-lg">Pay with card or mobile money. All payments are processed securely by Paystack.</p>
            </section>
            <CheckoutStepBar current={3} />

            <div className="space-y-10">
              {/* Method Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`relative flex items-center p-6 cursor-pointer rounded-xl transition-all shadow-sm ${method === "paystack_card" ? "bg-surface-container-lowest ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"}`}>
                  <input type="radio" name="payment_method" value="paystack_card" checked={method === "paystack_card"} onChange={() => setMethod("paystack_card")} className="hidden" />
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-bold text-on-surface">Card</span>
                    <span className="text-xs text-on-surface-variant">Visa &amp; Mastercard</span>
                    <span className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">Paystack</span>
                  </div>
                  <Icon name="credit_card" className={`ml-auto shrink-0 ${method === "paystack_card" ? "text-secondary" : "text-on-surface-variant"}`} />
                </label>
                <label className={`relative flex items-center p-6 cursor-pointer rounded-xl transition-all ${method === "paystack_mobile_money" ? "bg-surface-container-lowest ring-2 ring-secondary" : "bg-surface-container-low hover:bg-surface-container"}`}>
                  <input type="radio" name="payment_method" value="paystack_mobile_money" checked={method === "paystack_mobile_money"} onChange={() => setMethod("paystack_mobile_money")} className="hidden" />
                  <div className="flex flex-col gap-1 min-w-0 pr-2">
                    <span className="font-bold text-on-surface">Mobile money</span>
                    <span className="text-xs text-on-surface-variant">MTN · Telecel · AirtelTigo</span>
                    <span className="text-[10px] font-label uppercase tracking-widest text-outline mt-1">Paystack</span>
                  </div>
                  <Icon name="smartphone" className={`ml-auto shrink-0 ${method === "paystack_mobile_money" ? "text-secondary" : "text-on-surface-variant"}`} />
                </label>
              </div>

              {/* Card Form */}
              {method === "paystack_card" && (
                <div className="bg-surface-container-low p-8 md:p-10 rounded-xl space-y-6">
                  {[
                    { label: "Cardholder Name", placeholder: "ALEXANDER VOGUE", type: "text" },
                    { label: "Card Number", placeholder: "0000 0000 0000 0000", type: "text" },
                  ].map(({ label, placeholder, type }) => (
                    <div key={label} className="space-y-2">
                      <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
                      <input className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder={placeholder} type={type} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-6">
                    {[
                      { label: "Expiry Date", placeholder: "MM / YY" },
                      { label: "CVV", placeholder: "123" },
                    ].map(({ label, placeholder }) => (
                      <div key={label} className="space-y-2">
                        <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">{label}</label>
                        <input className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none" placeholder={placeholder} type="text" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {method === "paystack_mobile_money" && (
                <div className="bg-surface-container-low p-8 md:p-10 rounded-xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Mobile network</label>
                    <select
                      value={mmNetwork}
                      onChange={(e) => setMmNetwork(e.target.value as typeof mmNetwork)}
                      className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none font-body text-on-surface"
                    >
                      <option value="mtn">MTN</option>
                      <option value="telecel">Telecel</option>
                      <option value="airteltigo">AirtelTigo</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant">Mobile money number</label>
                    <input
                      className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 focus:ring-2 focus:ring-secondary focus:bg-surface-container-lowest transition-all outline-none"
                      placeholder="0XX XXX XXXX"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    You will confirm payment on your phone. Charges appear as Paystack / {STORE_NAME_FULL}.
                  </p>
                </div>
              )}

              {/* Billing Toggle */}
              <div className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                <div className="flex flex-col">
                  <span className="font-bold text-on-surface">Billing Address</span>
                  <span className="text-sm text-on-surface-variant">Same as shipping address</span>
                </div>
                <button
                  onClick={() => setBillingSame(!billingSame)}
                  className={`w-12 h-6 rounded-full relative flex items-center px-1 transition-colors ${billingSame ? "bg-secondary" : "bg-surface-container-high"}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-all ${billingSame ? "ml-auto" : ""}`} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-col md:flex-row items-center gap-6 pt-6">
                <button
                  type="button"
                  onClick={() => navigate("/checkout/review")}
                  className="w-full md:w-auto px-10 py-4 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-bold rounded-md shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  <span>Continue to review</span>
                  <Icon name="arrow_forward" className="text-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/checkout/shipping")}
                  className="text-on-surface-variant font-medium hover:text-secondary transition-colors underline decoration-outline-variant/30 underline-offset-8"
                >
                  Return to Shipping
                </button>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-32 bg-surface-container-low rounded-xl overflow-hidden">
              <div className="p-8 space-y-8">
                <h2 className="text-xl font-bold font-headline tracking-tight">Order Summary</h2>
                <div className="space-y-6">
                  {SUMMARY_ITEMS.map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-20 h-24 bg-surface-container-high overflow-hidden rounded-lg flex-shrink-0">
                        <img className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" src={item.image} alt={item.name} />
                      </div>
                      <div className="flex flex-col justify-between py-1">
                        <div>
                          <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                          <p className="text-xs text-on-surface-variant">{item.variant}</p>
                        </div>
                        <p className="font-bold text-sm">${item.price.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3 border-t border-outline-variant/20 pt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Subtotal</span>
                    <span>$770.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Shipping</span>
                    <span className="text-secondary font-medium">Free</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Tax</span>
                    <span>$61.60</span>
                  </div>
                  <div className="flex justify-between pt-4 font-extrabold text-lg">
                    <span>Total</span>
                    <span>$831.60</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20">
        {[
          { icon: "shopping_cart", label: "Cart" },
          { icon: "local_shipping", label: "Ship" },
          { icon: "payments", label: "Pay", active: true },
          { icon: "fact_check", label: "Review" },
        ].map(({ icon, label, active }) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center font-inter text-[9px] uppercase tracking-widest font-bold ${
              active ? "text-secondary" : "text-slate-400 opacity-60"
            }`}
          >
            <Icon name={icon} filled={Boolean(active)} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   CHECKOUT REVIEW — final confirmation before submit
───────────────────────────────────────────── */
export const CheckoutReviewPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-surface text-on-surface antialiased">
      <CheckoutHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-20 pb-28 md:pb-20 lg:flex lg:gap-16 w-full min-w-0 overflow-x-hidden">
        <div className="lg:flex-1">
          <CheckoutStepBar current={4} />
          <section className="space-y-8">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Review your order</h1>
              <p className="text-on-surface-variant text-sm sm:text-base">
                Confirm items, shipping, and payment before placing your order.
              </p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Ship to</h2>
              <p className="text-sm leading-relaxed">
                Julianne Sterling
                <br />
                1248 North Highland Ave, Los Angeles, CA 90038
                <br />
                United States
              </p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Delivery</h2>
              <p className="text-sm">Premium Express (2–3 business days) — Free</p>
            </div>
            <div className="space-y-4 p-5 sm:p-6 bg-surface-container-low rounded-xl border border-outline-variant/20">
              <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-outline">Payment</h2>
              <p className="text-sm">Visa ending in 4242 — Paystack</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate("/checkout/success")}
                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-bold rounded-md shadow-lg flex items-center justify-center gap-2"
              >
                <Icon name="lock" className="text-sm" />
                Place order
              </button>
              <button
                type="button"
                onClick={() => navigate("/checkout/payment")}
                className="w-full sm:w-auto text-on-surface-variant font-medium hover:text-secondary underline underline-offset-8 py-3"
              >
                Edit payment
              </button>
            </div>
          </section>
        </div>
        <CheckoutOrderSummary
          items={SUMMARY_ITEMS}
          subtotal={770}
          shipping="Free"
          tax={61.6}
          total={831.6}
        />
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end min-h-[4.25rem] px-1 py-2 safe-area-pb bg-white/80 backdrop-blur-xl border-t border-slate-200/20">
        {[
          { icon: "shopping_cart", label: "Cart" },
          { icon: "local_shipping", label: "Ship" },
          { icon: "payments", label: "Pay" },
          { icon: "fact_check", label: "Review", active: true },
        ].map(({ icon, label, active }) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center font-inter text-[9px] uppercase tracking-widest font-bold ${
              active ? "text-secondary" : "text-slate-400 opacity-60"
            }`}
          >
            <Icon name={icon} filled={Boolean(active)} className="mb-1" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
      <CheckoutFooter />
    </div>
  );
};

/* ─────────────────────────────────────────────
   ORDER SUCCESS — matches order_success/code.html
───────────────────────────────────────────── */
export const OrderSuccessPage = () => (
  <div className="bg-surface font-body text-on-surface antialiased">
    <nav className="bg-slate-50 sticky top-0 z-50 border-b border-slate-200/80" aria-label="Order confirmation">
      <div className="flex items-center w-full px-6 py-4 max-w-7xl mx-auto">
        <StoreBrandLink to="/" wordmarkClassName="text-slate-900" />
      </div>
    </nav>
    <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 lg:py-24">
      <div className="flex flex-col lg:flex-row gap-16 items-start">
        <div className="w-full lg:w-3/5 space-y-10">
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase font-label">
              <Icon name="check_circle" filled className="text-sm" />
              Order Confirmed
            </div>
            <h1 className="text-5xl md:text-6xl font-headline font-extrabold tracking-tight text-on-background leading-tight">
              Thank you for <br />your curation.
            </h1>
            <p className="text-lg text-outline leading-relaxed max-w-lg">
              Your order has been received and is being prepared with artisan care at our workshop. We'll notify you once it's on its way.
            </p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low p-8 rounded-xl space-y-2">
              <p className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">Order Number</p>
              <p className="text-2xl font-headline font-bold text-on-background">#TC-82944012</p>
            </div>
            <div className="bg-surface-container-low p-8 rounded-xl space-y-2">
              <p className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">Estimated Arrival</p>
              <p className="text-2xl font-headline font-bold text-on-background">Oct 24 — Oct 26</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link to="/account/orders" className="bg-gradient-to-r from-secondary to-secondary-container text-on-secondary px-8 py-4 rounded-md font-bold tracking-tight text-center hover:opacity-90 transition-opacity">
              Track Your Order
            </Link>
            <Link to="/shop" className="bg-surface-container-high text-on-surface px-8 py-4 rounded-md font-bold tracking-tight text-center hover:bg-surface-variant transition-colors">
              Continue Shopping
            </Link>
          </div>
          <div className="pt-12 space-y-6">
            <h3 className="text-xs font-label uppercase tracking-widest text-on-primary-container font-bold">Shipping Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-1">
                <p className="font-bold text-on-background">Delivery Address</p>
                <p className="text-outline">Julianne Sterling<br />1248 North Highland Ave<br />Los Angeles, CA 90038<br />United States</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-on-background">Shipping Method</p>
                <p className="text-outline">Premium Express (2-3 Business Days)<br />Fully insured and tracked</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-2/5 sticky top-32">
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_20px_40px_-5px_rgba(11,28,48,0.06)] space-y-8">
            <h2 className="text-xl font-headline font-bold text-on-background">Order Summary</h2>
            <div className="space-y-6">
              {[
                { name: "Artisan Wool Overcoat", variant: "Midnight Navy / Size 40", price: 850.0, qty: 1, image: mockImages.checkoutOrderA },
                { name: "Essential Fold Wallet", variant: "Tan Vachetta", price: 120.0, qty: 1, image: mockImages.checkoutOrderB },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-20 h-24 bg-surface-container rounded-lg overflow-hidden flex-shrink-0">
                    <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                  </div>
                  <div className="flex-grow flex flex-col justify-center">
                    <p className="font-bold text-on-background">{item.name}</p>
                    <p className="text-sm text-outline">{item.variant}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-label text-outline">Qty: {item.qty}</span>
                      <span className="font-bold text-on-background">${item.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-6 space-y-3 border-t border-outline-variant/20">
              <div className="flex justify-between text-sm"><span className="text-outline">Subtotal</span><span className="text-on-background">$970.00</span></div>
              <div className="flex justify-between text-sm"><span className="text-outline">Shipping</span><span className="text-secondary font-medium">Free</span></div>
              <div className="flex justify-between text-sm"><span className="text-outline">Tax</span><span className="text-on-background">$77.60</span></div>
              <div className="flex justify-between pt-4">
                <span className="font-headline font-bold text-lg">Total</span>
                <span className="font-headline font-extrabold text-lg text-secondary">$1,047.60</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl flex items-start gap-3">
              <Icon name="verified" className="text-secondary" />
              <div className="text-xs leading-relaxed text-on-surface-variant">
                <strong>Quality guaranteed.</strong> Every order from {STORE_NAME_FULL} is checked before it leaves our warehouse.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <footer className="bg-surface-dim mt-24 py-8 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-on-surface-variant text-sm">© 2024 {STORE_NAME_FULL}. All rights reserved.</p>
        <div className="flex gap-8">
          <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/privacy-policy">Privacy</Link>
          <Link className="text-xs font-bold uppercase tracking-widest text-on-surface hover:text-secondary transition-colors" to="/pages/terms">Terms</Link>
        </div>
      </div>
    </footer>
  </div>
);

/* ─────────────────────────────────────────────
   GUEST TRACKING PAGE
───────────────────────────────────────────── */
export const GuestTrackingPage = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <StorefrontShell>
      <StorefrontMain maxWidth={false} className="max-w-xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-headline font-extrabold tracking-tighter mb-3">Track Order</h1>
          <p className="text-on-surface-variant text-sm sm:text-base">Enter your order number and email to see your shipment status.</p>
        </header>
        {!submitted ? (
          <form
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block">Order Number</label>
              <input required className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="TC-88291" type="text" />
            </div>
            <div className="space-y-2">
              <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block">Email Address</label>
              <input required className="w-full bg-surface-container-high border-none px-4 py-4 rounded-lg focus:ring-2 focus:ring-secondary transition-all outline-none" placeholder="name@example.com" type="email" />
            </div>
            <button type="submit" className="w-full bg-secondary text-on-secondary py-4 rounded-md font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
              Track Order
            </button>
          </form>
        ) : (
          <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
            <div className="flex items-center gap-3">
              <Icon name="check_circle" filled className="text-secondary text-2xl" />
              <div>
                <p className="font-headline font-bold">Order #TC-88291</p>
                <p className="text-sm text-on-surface-variant">Placed on November 14, 2023</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: "Order Placed", done: true },
                { label: "Processing", done: true },
                { label: "Shipped", done: false },
                { label: "Delivered", done: false },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? "bg-secondary text-white" : "bg-surface-container-high text-outline"}`}>
                    {done ? <Icon name="check" className="text-sm" /> : <div className="w-2 h-2 bg-outline rounded-full" />}
                  </div>
                  <span className={`text-sm font-medium ${done ? "text-on-surface" : "text-outline"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </StorefrontMain>
    </StorefrontShell>
  );
};
