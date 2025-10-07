import "dotenv/config.js";
import express from "express";
import { upsertSubscriber, removeSubscriber } from "./db.js";
import { sendTelegram } from "./notifyTelegram.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || "";
const TG_TOKEN = process.env.TG_TOKEN;

function log(...args) { console.log("[WEBHOOK]", ...args); }

app.post("/tg/webhook", (req, res) => {
    if (WEBHOOK_SECRET && req.query.secret !== WEBHOOK_SECRET) {
        log("403 bad secret"); return res.status(403).send("Forbidden");
    }
    // ตอบ 200 ทันที
    res.json({ ok: true });

    (async () => {
        try {
            const update = req.body;
            const msg = update?.message || update?.edited_message;
            if (!msg) return;

            const chat_id = msg.chat?.id;
            const text = (msg.text || "").trim();

            log("update from", chat_id, "text:", text);

            if (msg.chat?.type === "private" && typeof chat_id !== "undefined") {
                // /start → สมัคร + ตอบกลับ
                if (text === "/start") {
                    await upsertSubscriber({
                        chat_id: String(chat_id),
                        first_name: msg.from?.first_name,
                        username: msg.from?.username,
                        language_code: msg.from?.language_code
                    });

                    const name = msg.from?.first_name || "";
                    const welcome =
                        `សួស្តី ${name} 👋  
អ្នកបានចុះឈ្មោះដើម្បីទទួលការជូនដំណឹងតម្លៃមាសប្រចាំថ្ងៃហើយ 💰\n  
បើចង់ឈប់ទទួលការជូនដំណឹងសូមផ្ញើ /stop មកខ្ញុំ។ \n
តម្លៃមាសនឹងត្រូវផ្ញើទៅអ្នករៀងរាល់ 30នាទីម្តង។`;
                    await sendTelegram({ token: TG_TOKEN, chatId: String(chat_id), text: welcome, parseMode: "Markdown" });
                    log("welcomed", chat_id);
                }

                // /stop → ยกเลิก + ลบจาก MongoDB + ตอบกลับ
                if (text === "/stop") {
                    const removed = await removeSubscriber(chat_id);
                    const reply = removed
                        ? "✅ បានបញ្ឈប់ការជូនដំណឹងរួចរាល់ — អរគុណ!\nប្រសិនបើចង់បន្តទទួលដំណឹងឡើងវិញ សូមបញ្ជូន /start 🙌"
                        : "ℹ️ មិនឃើញការចុះឈ្មោះរបស់អ្នកទេ។ បញ្ជូន /start ដើម្បីចាប់ផ្តើមទទួលការជូនដំណឹង។";
                    await sendTelegram({ token: TG_TOKEN, chatId: String(chat_id), text: reply });
                    log("stopped:", chat_id, "removed?", removed);
                }
            }
        } catch (e) {
            log("handler error:", e?.message || e);
        }
    })();
});

const PORT = process.env.PORT || 3000;
app.get("/", (_req, res) => res.send("Telegram webhook is alive."));
app.listen(PORT, () => console.log(`Webhook listening on :${PORT}`));
