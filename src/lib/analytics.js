
export function trackEvent(event, payload = {}) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];

  window.dataLayer.push({
    event,
    ...payload
  });
}

export function trackProductView(product) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });

  trackEvent("view_item", {
    ecommerce: {
      currency: "IDR",
      value: Number(product.price),
      items: [{
        item_id: String(product.id),
        item_name: product.name,
        item_category: product.category,
        price: Number(product.price),
        quantity: 1
      }]
    }
  });
}

export function trackDemoPlay(product) {
  trackEvent("product_demo_play", {
    product_id: String(product.id),
    demo_type: "youtube"
  });
}

export function trackCheckoutClick(product) {
  trackEvent("checkout_click", {
    product_id: String(product.id),
    checkout_provider: "mayar",
    currency: "IDR",
    value: Number(product.price)
  });
}
