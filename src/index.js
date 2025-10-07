import "dotenv/config.js";
import { fetchMetal } from "./fetchMetal.js";
import { sendTelegram } from "./notifyTelegram.js";
import { listChatIds, closeDb } from "./db.js";
import { getLastPrice, setLastPrice, usingRedis } from "./storage.js";

const TG_TOKEN = process.env.TG_TOKEN;
const THRESHOLD_USD = Number(process.env.THRESHOLD_USD || 0);
const LOCAL_TZ = process.env.LOCAL_TZ || "Asia/Phnom_Penh";

/* ---------- utils ---------- */
function fmtUSD(n, digits = 2) {
    return `$${n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}
function normalizeToDate(ts) {
    if (!ts) return new Date();
    if (typeof ts === "number") return new Date(ts < 1e12 ? ts * 1000 : ts);
    return new Date(ts);
}
function formatInTz(date, timeZone) {
    const p = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);
    const g = (t) => p.find((x) => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}
function makeArrow(changeUsd) {
    if (changeUsd > 0) return "🟢🔺";
    if (changeUsd < 0) return "🔻🔴";
    return "🟡";
}
function trendKh(changeUsd, labelKm) {
    if (changeUsd > 0) return `📈 តម្លៃ${labelKm}លើពិភពលោក កើនឡើង ក្នុងរយៈពេល 24 ម៉ោងចុងក្រោយនេះ។`;
    if (changeUsd < 0) return `📉 តម្លៃ${labelKm}លើពិភពលោក បានធ្លាក់ចុះ ក្នុងរយៈពេល 24 ម៉ោងចុងក្រោយនេះ។`;
    return `📊 តម្លៃ${labelKm}លើពិភពលោក មានស្ថិរភាព។`;
}

function formatMetalBlock(m) {
    const arrow = makeArrow(m.changeUsd);
    const sign = m.changeUsd >= 0 ? "+" : "";
    const d = normalizeToDate(m.timestamp);
    const tsLocal = formatInTz(d, LOCAL_TZ);

    const isGold = m.symbol === "XAU";
    const khLabel = isGold ? "មាស" : "ប្រាក់";
    const tag = isGold ? "#gold #XAUUSD" : "#silver #XAGUSD";

    let out = `${arrow} *${m.name} Price Update (Global)*\n`;
    out += `Spot ${m.symbol}/USD: \`${fmtUSD(m.priceUsdPerOz)}\`\n`;
    out += `24h Change: \`${sign}${m.changeUsd.toFixed(2)} (${sign}${m.changePct.toFixed(2)}%)\`\n`;
    out += `Range: \`${fmtUSD(m.low)} - ${fmtUSD(m.high)}\`\n`;
    out += `Updated: ${tsLocal} (Local)\n\n`;
    out += `${trendKh(m.changeUsd, khLabel)}\n${tag}`;
    return out;
}

/* ---------- main job ---------- */
async function run() {
    const [gold, silver] = await Promise.all([
        fetchMetal("XAU"),
        fetchMetal("XAG"),
    ]);

    const goldBlock = formatMetalBlock(gold);
    const divider = "\n\n------------------------------------------\n\n";
    const silverBlock = formatMetalBlock(silver);
    const message = goldBlock + divider + silverBlock;

    const targets = await listChatIds();
    if (targets.length === 0) {
        console.log("No subscribers yet.");
        return;
    }

    for (const chatId of targets) {
        try {
            await sendTelegram({
                token: TG_TOKEN,
                chatId,
                text: message,
                parseMode: "Markdown",
            });
            console.log("Sent to", chatId);
        } catch (e) {
            console.error("Send failed for", chatId, e?.message || e);
        }
    }
}

/* ---------- bootstrap (cron-safe) ---------- */
async function main() {
    try {
        await run();
    } finally {
        await closeDb();
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("Job failed:", e);
        closeDb().finally(() => process.exit(1));
    });
