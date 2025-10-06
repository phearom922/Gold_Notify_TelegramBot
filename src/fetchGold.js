const API_KEY = process.env.METALS_API_KEY;
const BASE = "https://api.metals.dev/v1/metal/spot"; // docs: /v1/metal/spot?metal=gold&currency=USD&api_key=...
// returns: { status, timestamp, currency:"USD", unit:"toz", metal:"gold", rate:{ price, bid, ask, high, low, change, change_percent } }

export async function fetchXauUsd() {
    if (!API_KEY) throw new Error("METALS_API_KEY is required");

    const url = `${BASE}?metal=gold&currency=USD&api_key=${encodeURIComponent(API_KEY)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Metals.dev HTTP ${res.status}`);
    const data = await res.json();

    if (data?.status !== "success") {
        throw new Error(`Metals.dev error: ${data?.error_message || "unknown"}`);
    }

    const r = data?.rate || {};
    const price = Number(r.price);
    const change = Number(r.change ?? 0);
    const changePct = Number(r.change_percent ?? 0);

    if (!Number.isFinite(price)) throw new Error("Invalid price from Metals.dev");

    return {
        priceUsdPerOz: price,           // XAU/USD spot (USD per toz)
        bid: r.bid, ask: r.ask, high: r.high, low: r.low,
        changeUsd: change,
        changePct,
        timestamp: data.timestamp,
        raw: data
    };
}
