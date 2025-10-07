// src/fetchMetal.js
// รวมทั้ง Gold (XAU) และ Silver (XAG) ใช้ Metals.Dev ตัวเดียวกัน

const API_KEY = process.env.METALS_API_KEY;
const BASE = "https://api.metals.dev/v1/metal/spot";
// docs: /v1/metal/spot?metal=gold&currency=USD&api_key=...

export async function fetchMetal(symbol = "XAU") {
    if (!API_KEY) throw new Error("METALS_API_KEY is required");

    const metalName = symbol === "XAG" ? "silver" : "gold";
    const url = `${BASE}?metal=${metalName}&currency=USD&api_key=${encodeURIComponent(API_KEY)}`;

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
        name: metalName === "gold" ? "Gold" : "Silver",
        symbol,
        priceUsdPerOz: price,
        bid: r.bid,
        ask: r.ask,
        high: r.high,
        low: r.low,
        changeUsd: change,
        changePct,
        timestamp: data.timestamp,
        raw: data,
    };
}
