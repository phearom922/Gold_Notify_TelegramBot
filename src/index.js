import "dotenv/config.js";
import { fetchXauUsd } from "./fetchGold.js";
import { sendTelegram } from "./notifyTelegram.js";
import { getLastPrice, setLastPrice, usingRedis } from "./storage.js";
import { listChatIds, closeDb } from "./db.js";

const TG_TOKEN = process.env.TG_TOKEN;
const THRESHOLD_USD = Number(process.env.THRESHOLD_USD || 0);
const LOCAL_TZ = process.env.LOCAL_TZ || "Asia/Phnom_Penh";

function fmtUSD(n, digits = 2) {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
function normalizeToDate(ts) {
    if (!ts) return new Date();
    if (typeof ts === "number") return new Date(ts < 1e12 ? ts * 1000 : ts);
    return new Date(ts);
}
function formatInTz(date, timeZone) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const g = t => p.find(x => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

async function run() {
    const spot = await fetchXauUsd();
    const cur = spot.priceUsdPerOz;

    let shouldNotify = true, deltaAbs = null, last = null;
    if (usingRedis && THRESHOLD_USD > 0) {
        last = await getLastPrice();
        if (last != null) {
            deltaAbs = Math.abs(cur - last);
            shouldNotify = deltaAbs >= THRESHOLD_USD;
        }
    }

    const isUp = spot.changeUsd > 0;
    const isDown = spot.changeUsd < 0;
    const arrow = isUp ? "🟢🔺" : isDown ? "🔻🔴" : "🟢"; // เลือกไอคอนตามต้องการ
    const sign = spot.changeUsd >= 0 ? "+" : "";
    const d = normalizeToDate(spot.timestamp);
    const tsLocal = formatInTz(d, LOCAL_TZ);

    let msg = `${arrow} *Gold Price Update (Global)*\n`;
    msg += `Spot XAU/USD: \`${fmtUSD(cur)}\`\n`;
    msg += `24h Change: \`${sign}${spot.changeUsd.toFixed(2)} (${sign}${spot.changePct.toFixed(2)}%)\`\n`;
    if (spot.high && spot.low) msg += `Range: \`${fmtUSD(spot.low)} - ${fmtUSD(spot.high)}\`\n`;
    msg += `Updated: ${tsLocal} (Local)\n\n`;
    msg += isUp
        ? "📈 តម្លៃមាសលើពិភពលោក កើនឡើង ក្នុងរយៈពេល 24 ម៉ោងចុងក្រោយនេះ។\n"
        : isDown
            ? "📉 តម្លៃមាសលើពិភពលោក បានធ្លាក់ចុះ ក្នុងរយៈពេល 24 ម៉ោងចុងក្រោយនេះ។\n"
            : "⏸ តម្លៃមាសលើពិភពលោក មានស្ថិរភាព ប្រៀបធៀបនឹងម្សិលមិញ។\n";
    msg += `#gold #XAUUSD`;

    if (!shouldNotify) {
        console.log("Skip (below threshold).");
        return;
    }

    const targets = await listChatIds();
    if (targets.length === 0) {
        console.log("No subscribers yet.");
        return;
    }

    for (const chatId of targets) {
        try {
            await sendTelegram({ token: TG_TOKEN, chatId, text: msg, parseMode: "Markdown" });
            console.log("Sent to", chatId);
        } catch (e) {
            console.error("Send failed for", chatId, e?.message || e);
        }
    }

    if (usingRedis) await setLastPrice(cur);
}

async function main() {
    try {
        await run();
    } finally {
        await closeDb();           // ✅ ปิด DB
    }
}

main()
    .then(() => process.exit(0)) // ✅ ออกจากโปรเซสอย่างชัดเจน
    .catch(e => {
        console.error("Job failed:", e);
        closeDb().finally(() => process.exit(1));
    });
