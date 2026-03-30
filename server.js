const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const cors = require("cors");
const FormData = require("form-data");

const app = express();
app.use(cors());

// 📦 Upload config (memory)
const upload = multer({ storage: multer.memoryStorage() });

// 🛡️ RATE LIMIT
const rateLimit = new Map();

app.post("/order", upload.single("bukti"), async (req, res) => {
  try {
    // 🔐 LIMIT IP
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();
    const user = rateLimit.get(ip) || { count: 0, time: now };

    if (now - user.time < 60000) {
      user.count++;
      if (user.count > 3) {
        return res.status(429).json({ error: "Terlalu banyak request" });
      }
    } else {
      user.count = 1;
      user.time = now;
    }
    rateLimit.set(ip, user);

    // 📥 DATA
    const { nama, paket, telegram } = req.body;
    const file = req.file;

    if (!nama || !paket || !file) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;
    const FIREBASE_DB = process.env.FIREBASE_DB;

    if (!BOT_TOKEN || !CHAT_ID || !FIREBASE_DB) {
      return res.status(500).json({ error: "ENV belum diset" });
    }

    const idOrder = "INV-" + Math.floor(Math.random() * 999999);
    const waktu = new Date().toLocaleString("id-ID");

    // ⚡ AUTO APPROVE
    const status = "approved";

    // 📊 SIMPAN KE FIREBASE
    await fetch(`${FIREBASE_DB}/orders/${idOrder}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        paket,
        waktu,
        status
      })
    });

    // 📩 TELEGRAM ADMIN (TEXT)
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🔥 ORDER AUTO APPROVED

👤 Nama: ${nama}
📦 Paket: ${paket}
🆔 ID: ${idOrder}
🕒 ${waktu}`
      })
    });

    // 📸 TELEGRAM ADMIN (FOTO)
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("photo", file.buffer, file.originalname);
    formData.append("caption", `Bukti pembayaran ${nama} (${idOrder})`);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      body: formData
    });

    // 🤖 KIRIM AKSES KE USER
    if (telegram) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          chat_id: telegram,
          text: `✅ AKSES AKTIF

🆔 ID: ${idOrder}
📦 Paket: ${paket}

🔗 Link Akses:
https://t.me/Aldinugroho378

Terima kasih 🙏`
        })
      });
    }

    // ✅ RESPONSE
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🚀 START SERVER (WAJIB RAILWAY)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
