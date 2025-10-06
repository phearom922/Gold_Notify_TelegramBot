const USE_REDIS = String(process.env.USE_REDIS || "false").toLowerCase() === "true";
const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = USE_REDIS && REST_URL && REST_TOKEN;

async function upstash(path) {
    const r = await fetch(`${REST_URL}${path}`, { headers: { Authorization: `Bearer ${REST_TOKEN}` } });
    if (!r.ok) throw new Error(`Upstash HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`Upstash error: ${j.error}`);
    return j.result;
}

export async function getLastPrice() {
    if (!hasRedis) return null;
    const res = await upstash(`/get/gold:lastUsdPerOz`);
    return res ? parseFloat(res) : null;
}

export async function setLastPrice(value, ttlSec = 7 * 24 * 3600) {
    if (!hasRedis) return false;
    const r = await fetch(`${REST_URL}/set/gold:lastUsdPerOz/${encodeURIComponent(String(value))}/EX/${ttlSec}`, {
        headers: { Authorization: `Bearer ${REST_TOKEN}` }
    });
    if (!r.ok) throw new Error(`Upstash HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`Upstash error: ${j.error}`);
    return j.result === "OK";
}

export const usingRedis = hasRedis;
