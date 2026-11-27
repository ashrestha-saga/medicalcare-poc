import { shopIndexUrl } from "@/lib/shop/shopUrl";

export const oxidEndpoints = {
  authorize: (base: string) => shopIndexUrl(base, "oauthauthorize"),
  token: (base: string) => shopIndexUrl(base, "oauthtoken", "token"),
  me: (base: string) => shopIndexUrl(base, "oauthme", "getProfile"),
  revoke: (base: string) => shopIndexUrl(base, "oauthrevoke", "revoke"),
  articles: (base: string) => shopIndexUrl(base, "articleapi", "getArticles"),
  recommendations: (base: string) => shopIndexUrl(base, "recommendationsapi", "getRecommendations"),
  validatePin: (base: string) => shopIndexUrl(base, "checkoutapi", "validatepin"),
  addToCart: (base: string) => shopIndexUrl(base, "checkoutapi", "addtocart"),
  getCart: (base: string) => shopIndexUrl(base, "checkoutapi", "getcart"),
  updateCart: (base: string) => shopIndexUrl(base, "checkoutapi", "updatecart"),
  submitOrder: (base: string) => shopIndexUrl(base, "checkoutapi", "submitorder"),
  getOrders: (base: string) => shopIndexUrl(base, "orderapi", "getOrders"),
};
