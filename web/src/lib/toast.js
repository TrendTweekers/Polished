// Use App Bridge's native toast when embedded; fall back to console otherwise.
export function showToast(message, { error = false } = {}) {
  if (typeof window !== "undefined" && window.shopify?.toast) {
    window.shopify.toast.show(message, { isError: error, duration: 4000 });
  } else if (error) {
    console.error(message);
  } else {
    console.log(message);
  }
}
