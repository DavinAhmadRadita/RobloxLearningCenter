require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = Number(process.env.PORT || 8000);
const DB_PORT = Number(process.env.DB_PORT || 3307);
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "roblox_learning_center";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "change-this-local-development-secret";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const mailer =
  process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    })
    : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false }));
const sessionStore = new MySQLStore({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 7 * 24 * 60 * 60 * 1000,
  createDatabaseTable: true,
  schema: { tableName: "user_sessions" },
});

app.use(
  session({
    name: "rlc.sid",
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false },
  }),
);

let pool;
const normalize = (value) => String(value || "").trim();
function youtubeVideoId(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      [
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
      ].includes(host)
    ) {
      id = url.searchParams.get("v") || "";
      if (!id) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live", "v"].includes(parts[0]))
          id = parts[1] || "";
      }
    }
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : "";
  } catch (_) {
    return "";
  }
}
const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  displayName: row.display_name || row.username,
  role: row.role,
});
function requireAuth(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  next();
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NULL,
    role ENUM('admin','moderator','learner') NOT NULL DEFAULT 'learner',
    email_verified TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_user (user_id),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_history_user (user_id),
    CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`INSERT INTO password_history (user_id, password_hash)
    SELECT u.id, u.password_hash FROM users u
    WHERE NOT EXISTS (SELECT 1 FROM password_history h WHERE h.user_id = u.id)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS pending_registrations (
    session_id VARCHAR(128) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NULL,
    otp_code VARCHAR(6) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pending_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const [otpAttemptColumn] = await pool.query(
    "SHOW COLUMNS FROM pending_registrations LIKE 'otp_attempts'",
  );
  if (!otpAttemptColumn.length) {
    await pool.query(
      "ALTER TABLE pending_registrations ADD COLUMN otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0",
    );
  }

  const [cols] = await pool.query(
    "SHOW COLUMNS FROM users LIKE 'email_verified'",
  );
  if (!cols.length) {
    await pool.query(
      "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1",
    );
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    level ENUM('Pemula','Menengah','Lanjutan') NOT NULL,
    video_url VARCHAR(2048) NOT NULL,
    description VARCHAR(300) NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_modules_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS user_module_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    watched_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    watched_segments LONGTEXT NULL,
    video_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    progress_percentage TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_user_module (user_id, module_id),
    CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_progress_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const [progressColumns] = await pool.execute(
    "SHOW COLUMNS FROM user_module_progress LIKE 'watched_segments'",
  );
  if (!progressColumns.length) {
    await pool.execute(
      "ALTER TABLE user_module_progress ADD COLUMN watched_segments LONGTEXT NULL AFTER watched_seconds",
    );
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS forum_topics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NULL,
    author_id INT NULL,
    author_username VARCHAR(50) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_avatar VARCHAR(255) NULL,
    category VARCHAR(40) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    image_data LONGTEXT NULL,
    legacy_likes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_forum_topics_created (created_at),
    CONSTRAINT fk_forum_topic_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS forum_comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    topic_id BIGINT NOT NULL,
    author_id INT NOT NULL,
    author_username VARCHAR(50) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_avatar VARCHAR(255) NULL,
    parent_id BIGINT NULL,
    body TEXT NOT NULL,
    legacy_likes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_forum_comments_topic (topic_id, created_at),
    CONSTRAINT fk_forum_comment_topic FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_comment_parent FOREIGN KEY (parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const ensureForumColumn = async (table, column, definition) => {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [
      column,
    ]);
    if (!rows.length) {
      await pool.query(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
      );
    }
  };

  const topicColumns = [
    ["owner_id", "INT NULL"],
    ["author_id", "INT NULL"],
    ["author_username", "VARCHAR(50) NOT NULL DEFAULT ''"],
    ["author_name", "VARCHAR(100) NOT NULL DEFAULT ''"],
    ["author_avatar", "VARCHAR(255) NULL"],
    ["category", "VARCHAR(40) NOT NULL DEFAULT 'diskusi'"],
    ["title", "VARCHAR(100) NOT NULL DEFAULT ''"],
    ["body", "TEXT NULL"],
    ["image_data", "LONGTEXT NULL"],
    ["legacy_likes", "INT UNSIGNED NOT NULL DEFAULT 0"],
    ["created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    [
      "updated_at",
      "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ],
  ];
  for (const [column, definition] of topicColumns) {
    await ensureForumColumn("forum_topics", column, definition);
  }
  await pool.query("ALTER TABLE forum_topics MODIFY COLUMN owner_id INT NULL");

  const commentColumns = [
    ["owner_id", "INT NULL"],
    ["topic_id", "BIGINT NULL"],
    ["author_id", "INT NULL"],
    ["author_username", "VARCHAR(50) NOT NULL DEFAULT ''"],
    ["author_name", "VARCHAR(100) NOT NULL DEFAULT ''"],
    ["author_avatar", "VARCHAR(255) NULL"],
    ["parent_id", "BIGINT NULL"],
    ["body", "TEXT NULL"],
    ["legacy_likes", "INT UNSIGNED NOT NULL DEFAULT 0"],
    ["created_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [column, definition] of commentColumns) {
    await ensureForumColumn("forum_comments", column, definition);
  }

  // Preserve author information from earlier Forum schemas when available.
  const [legacyTopicAuthorColumn] = await pool.query(
    "SHOW COLUMNS FROM forum_topics LIKE 'author'",
  );
  if (legacyTopicAuthorColumn.length) {
    await pool.query(
      "UPDATE forum_topics SET author_name = author WHERE author_name = '' AND author IS NOT NULL",
    );
  }
  const [legacyCommentAuthorColumn] = await pool.query(
    "SHOW COLUMNS FROM forum_comments LIKE 'author'",
  );
  if (legacyCommentAuthorColumn.length) {
    await pool.query(
      "UPDATE forum_comments SET author_name = author WHERE author_name = '' AND author IS NOT NULL",
    );
  }

  await pool.query(`UPDATE forum_topics t
    JOIN users u ON (u.id = t.author_id OR
      (t.author_username = '' AND (LOWER(u.username) COLLATE utf8mb4_unicode_ci = LOWER(t.author_name) COLLATE utf8mb4_unicode_ci OR LOWER(COALESCE(u.display_name, '')) COLLATE utf8mb4_unicode_ci = LOWER(t.author_name) COLLATE utf8mb4_unicode_ci)))
    SET t.author_id = COALESCE(t.author_id, u.id),
        t.author_username = CASE WHEN t.author_username = '' THEN u.username ELSE t.author_username END,
        t.author_name = CASE WHEN t.author_name = '' THEN COALESCE(NULLIF(u.display_name, ''), u.username) ELSE t.author_name END
    WHERE t.author_id IS NULL OR t.author_username = '' OR t.author_name = ''`);
  await pool.query(`UPDATE forum_comments c
    JOIN users u ON (u.id = c.author_id OR
      (c.author_username = '' AND (LOWER(u.username) COLLATE utf8mb4_unicode_ci = LOWER(c.author_name) COLLATE utf8mb4_unicode_ci OR LOWER(COALESCE(u.display_name, '')) COLLATE utf8mb4_unicode_ci = LOWER(c.author_name) COLLATE utf8mb4_unicode_ci)))
    SET c.author_id = COALESCE(c.author_id, u.id),
        c.author_username = CASE WHEN c.author_username = '' THEN u.username ELSE c.author_username END,
        c.author_name = CASE WHEN c.author_name = '' THEN COALESCE(NULLIF(u.display_name, ''), u.username) ELSE c.author_name END
    WHERE c.author_id IS NULL OR c.author_username = '' OR c.author_name = ''`);

  await pool.query(
    `UPDATE forum_topics SET owner_id = author_id WHERE owner_id IS NULL AND author_id IS NOT NULL`,
  );
  await pool.query(
    `UPDATE forum_comments SET owner_id = author_id WHERE owner_id IS NULL AND author_id IS NOT NULL`,
  );

  await pool.query(`CREATE TABLE IF NOT EXISTS forum_topic_likes (
    topic_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (topic_id, user_id),
    CONSTRAINT fk_forum_topic_like_topic FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_topic_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await pool.query(`CREATE TABLE IF NOT EXISTS forum_comment_likes (
    comment_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    CONSTRAINT fk_forum_comment_like_comment FOREIGN KEY (comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_comment_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const [forumTopicLegacyLikes] = await pool.query(
    "SHOW COLUMNS FROM forum_topics LIKE 'legacy_likes'",
  );
  if (!forumTopicLegacyLikes.length)
    await pool.query(
      "ALTER TABLE forum_topics ADD COLUMN legacy_likes INT UNSIGNED NOT NULL DEFAULT 0",
    );
  const [forumCommentLegacyLikes] = await pool.query(
    "SHOW COLUMNS FROM forum_comments LIKE 'legacy_likes'",
  );
  if (!forumCommentLegacyLikes.length)
    await pool.query(
      "ALTER TABLE forum_comments ADD COLUMN legacy_likes INT UNSIGNED NOT NULL DEFAULT 0",
    );

  await pool.query(`CREATE TABLE IF NOT EXISTS forum_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    content_key CHAR(64) NOT NULL,
    content_type ENUM('topic','comment') NOT NULL,
    topic_id VARCHAR(80) NOT NULL,
    topic_title VARCHAR(150) NOT NULL,
    content_author VARCHAR(100) NOT NULL,
    content_text TEXT NOT NULL,
    reporter_id INT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_forum_reporter_content (content_key, reporter_id),
    INDEX idx_forum_report_content (content_key),
    CONSTRAINT fk_forum_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const demos = [
    ["admin_demo", "admin.demo@rlc.local", "admin123", "Admin Demo", "admin"],
    [
      "mod_demo",
      "moderator.demo@rlc.local",
      "mod12345",
      "Moderator Demo",
      "moderator",
    ],
    [
      "learner_demo",
      "learner.demo@rlc.local",
      "learner123",
      "Learner Demo",
      "learner",
    ],
  ];
  for (const [username, email, password, displayName, role] of demos) {
    const [found] = await pool.execute(
      "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
      [username, email],
    );
    if (!found.length) {
      const hash = await bcrypt.hash(password, 12);
      await pool.execute(
        "INSERT INTO users (username,email,password_hash,display_name,role,email_verified) VALUES (?,?,?,?,?,1)",
        [username, email, hash, displayName, role],
      );
    }
  }
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: DB_NAME });
  } catch {
    res.status(503).json({ ok: false, error: "Database belum dapat diakses." });
  }
});

app.post("/api/auth/check-username", async (req, res) => {
  try {
    const username = normalize(req.body.username);
    if (!/^[a-z0-9_]{3,50}$/.test(username))
      return res.json({
        available: false,
        message:
          "Username wajib 3–50 karakter dan hanya menggunakan huruf kecil, angka, atau underscore.",
      });
    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1",
      [username],
    );
    res.json({
      available: rows.length === 0,
      message: rows.length ? "Username sudah digunakan." : "Username tersedia!",
    });
  } catch {
    res.status(500).json({ error: "Tidak dapat memeriksa username." });
  }
});

app.post("/api/auth/check-email", async (req, res) => {
  try {
    const rawEmail = String(req.body.email || "").trim();
    if (rawEmail !== rawEmail.toLowerCase()) {
      return res.status(400).json({
        available: false,
        message: "Email harus menggunakan huruf kecil.",
      });
    }
    const email = normalize(rawEmail);
    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
      [email],
    );
    res.json({
      available: rows.length === 0,
      message: rows.length ? "Email sudah digunakan." : "",
    });
  } catch {
    res.status(500).json({ error: "Tidak dapat memeriksa email." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!mailer)
      return res
        .status(503)
        .json({
          error:
            "Pengiriman OTP belum dikonfigurasi. Isi EMAIL_USER dan EMAIL_APP_PASSWORD di .env.",
        });
    const username = normalize(req.body.username);
    const rawEmail = String(req.body.email || "").trim();
    if (rawEmail !== rawEmail.toLowerCase())
      return res
        .status(400)
        .json({ error: "Email harus menggunakan huruf kecil." });
    const email = normalize(rawEmail);
    const password = String(req.body.password || "");
    if (!/^[a-z0-9_]{3,50}$/.test(username))
      return res
        .status(400)
        .json({
          error:
            "Username wajib 3–50 karakter dan hanya menggunakan huruf kecil, angka, atau underscore.",
        });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Alamat email tidak valid." });
    if (password.length < 8 || password.length > 32)
      return res
        .status(400)
        .json({ error: "Password harus terdiri dari 8–32 karakter." });
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?) LIMIT 1",
      [username, email],
    );
    if (existing.length)
      return res
        .status(409)
        .json({ error: "Username atau email sudah digunakan." });

    const otp = String(crypto.randomInt(100000, 1000000));
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      `INSERT INTO pending_registrations
        (session_id, username, email, password_hash, display_name, otp_code, expires_at, otp_attempts)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(3), INTERVAL 5 MINUTE), 0)
       ON DUPLICATE KEY UPDATE username=VALUES(username), email=VALUES(email),
        password_hash=VALUES(password_hash), display_name=VALUES(display_name),
        otp_code=VALUES(otp_code), expires_at=VALUES(expires_at), otp_attempts=0,
        created_at=CURRENT_TIMESTAMP`,
      [req.sessionID, username, email, passwordHash, username, otp],
    );
    await mailer.sendMail({
      from: `"Roblox Learning Center" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verifikasi Email - Roblox Learning Center",
      text: `Kode verifikasi email kamu adalah ${otp}. Kode berlaku selama 5 menit. Jika kamu tidak merasa mendaftar, abaikan email ini.`,
      html: `<div style="font-family:Arial,sans-serif;color:#172033"><h2>Verifikasi Email</h2><p>Gunakan kode berikut untuk menyelesaikan pendaftaran Roblox Learning Center:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#eef4ff;border-radius:10px;display:inline-block">${otp}</div><p>Kode berlaku selama <b>5 menit</b> dan hanya dapat digunakan sekali.</p><p>Jika kamu tidak merasa mendaftar, abaikan email ini.</p></div>`,
    });
    req.session.pendingRegistration = true;
    req.session.save((sessionError) => {
      if (sessionError)
        return res
          .status(500)
          .json({
            error: "Sesi registrasi gagal disimpan. Silakan coba lagi.",
          });
      res.json({
        ok: true,
        message:
          "Kode OTP telah dikirim ke email kamu. Kode berlaku selama 5 menit.",
        email,
      });
    });
  } catch (err) {
    console.error("Registration OTP send failed:", err.message);
    res
      .status(500)
      .json({
        error: "OTP gagal dikirim. Periksa konfigurasi Gmail atau coba lagi.",
      });
  }
});

app.post("/api/auth/verify-email", async (req, res) => {
  try {
    const code = String(req.body.code || "").trim();
    if (!/^\d{6}$/.test(code))
      return res.status(400).json({ error: "Masukkan kode OTP 6 digit." });
    const [pendingRows] = await pool.execute(
      "SELECT username, email, password_hash, display_name, otp_code, otp_attempts FROM pending_registrations WHERE session_id = ? AND expires_at > NOW(3) LIMIT 1",
      [req.sessionID],
    );
    if (!pendingRows.length) {
      await pool.execute(
        "DELETE FROM pending_registrations WHERE session_id = ?",
        [req.sessionID],
      );
      return res
        .status(400)
        .json({
          error:
            "Kode OTP kedaluwarsa atau sesi registrasi tidak ditemukan. Silakan daftar ulang.",
        });
    }
    const pending = pendingRows[0];
    if (pending.otp_attempts >= 5) {
      await pool.execute(
        "DELETE FROM pending_registrations WHERE session_id = ?",
        [req.sessionID],
      );
      return res
        .status(429)
        .json({ error: "Batas percobaan OTP tercapai. Silakan daftar ulang." });
    }
    if (code !== pending.otp_code) {
      const nextAttempts = Number(pending.otp_attempts) + 1;
      if (nextAttempts >= 5) {
        await pool.execute(
          "DELETE FROM pending_registrations WHERE session_id = ?",
          [req.sessionID],
        );
        return res
          .status(429)
          .json({
            error:
              "Kode OTP salah. Batas percobaan tercapai, silakan daftar ulang.",
          });
      }
      await pool.execute(
        "UPDATE pending_registrations SET otp_attempts=? WHERE session_id=?",
        [nextAttempts, req.sessionID],
      );
      return res
        .status(400)
        .json({
          error: `Kode OTP salah. Sisa percobaan: ${5 - nextAttempts}.`,
        });
    }
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?) LIMIT 1",
      [pending.username, pending.email],
    );
    if (existing.length)
      return res
        .status(409)
        .json({
          error: "Username atau email sudah digunakan. Silakan daftar ulang.",
        });
    await pool.execute(
      "INSERT INTO users (username,email,password_hash,display_name,role,email_verified) VALUES (?,?,?,?, 'learner', 1)",
      [
        pending.username,
        pending.email,
        pending.password_hash,
        pending.display_name,
      ],
    );
    await pool.execute(
      "DELETE FROM pending_registrations WHERE session_id = ?",
      [req.sessionID],
    );
    delete req.session.pendingRegistration;
    req.session.save((sessionError) => {
      if (sessionError)
        return res
          .status(500)
          .json({
            error:
              "Akun berhasil dibuat, tetapi sesi perlu diperbarui. Silakan login.",
          });
      res.json({ ok: true, message: "Email terverifikasi. Silakan login." });
    });
  } catch (err) {
    console.error("Email OTP verification failed:", err.message);
    res.status(500).json({ error: "Verifikasi gagal. Silakan coba lagi." });
  }
});

app.post("/api/auth/resend-otp", async (req, res) => {
  try {
    if (!mailer)
      return res
        .status(503)
        .json({
          error:
            "Pengiriman OTP belum dikonfigurasi. Isi EMAIL_USER dan EMAIL_APP_PASSWORD di .env.",
        });
    const [pendingRows] = await pool.execute(
      "SELECT email FROM pending_registrations WHERE session_id=? AND expires_at > NOW(3) LIMIT 1",
      [req.sessionID],
    );
    if (!pendingRows.length)
      return res
        .status(400)
        .json({
          error:
            "Data registrasi tidak ditemukan atau sudah kedaluwarsa. Silakan daftar ulang.",
        });
    const otp = String(crypto.randomInt(100000, 1000000));
    await pool.execute(
      "UPDATE pending_registrations SET otp_code=?, expires_at=DATE_ADD(NOW(3), INTERVAL 5 MINUTE), otp_attempts=0 WHERE session_id=?",
      [otp, req.sessionID],
    );
    await mailer.sendMail({
      from: `"Roblox Learning Center" <${process.env.EMAIL_USER}>`,
      to: pendingRows[0].email,
      subject: "Kode OTP Baru - Roblox Learning Center",
      text: `Kode OTP baru kamu adalah ${otp}. Kode berlaku selama 5 menit.`,
      html: `<div style="font-family:Arial,sans-serif;color:#172033"><h2>Kode OTP Baru</h2><p>Gunakan kode berikut untuk verifikasi email:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#eef4ff;border-radius:10px;display:inline-block">${otp}</div><p>Kode berlaku selama <b>5 menit</b>.</p></div>`,
    });
    res.json({
      ok: true,
      message:
        "Kode OTP baru telah dikirim ke email kamu. Kode berlaku selama 5 menit.",
    });
  } catch (err) {
    console.error("Resend OTP failed:", err.message);
    res
      .status(500)
      .json({
        error:
          "Tidak dapat mengirim ulang OTP. Periksa konfigurasi Gmail atau coba lagi.",
      });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const identity = normalize(req.body.identity);
    const password = String(req.body.password || "");
    if (!identity || !password)
      return res
        .status(400)
        .json({ error: "Username/email dan password wajib diisi." });
    const [rows] = await pool.execute(
      "SELECT id,username,email,password_hash,display_name,role,email_verified FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?) LIMIT 1",
      [identity, identity],
    );
    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res
        .status(401)
        .json({ error: "Username/email atau password salah." });
    }
    const user = publicUser(rows[0]);
    req.session.regenerate((sessionError) => {
      if (sessionError)
        return res
          .status(500)
          .json({ error: "Tidak dapat membuat sesi login." });
      req.session.user = user;
      if (req.body.remember) {
        req.session.cookie.maxAge = 7 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.expires = false;
      }
      req.session.save((saveError) => {
        if (saveError)
          return res
            .status(500)
            .json({ error: "Tidak dapat menyimpan sesi login." });
        res.json({ ok: true, user });
      });
    });
  } catch {
    res.status(500).json({ error: "Login gagal. Periksa koneksi database." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) =>
  res.json({ user: req.session.user }),
);
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("rlc.sid");
    res.json({ ok: true });
  });
});

function forumMinutesAgo(value) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
}
app.get("/api/forum/topics", async (req, res) => {
  try {
    const viewerId = req.session.user?.id || 0;
    const [topicRows] = await pool.execute(
      `SELECT t.id, t.author_id AS authorId, t.author_username AS authorUsername,
              t.author_name AS author, t.author_avatar AS avatar, t.category,
              t.title, t.body, t.image_data AS image, t.created_at AS createdAt,
              (t.legacy_likes + (SELECT COUNT(*) FROM forum_topic_likes l WHERE l.topic_id=t.id)) AS likes,
              EXISTS(SELECT 1 FROM forum_topic_likes l WHERE l.topic_id=t.id AND l.user_id=?) AS liked
       FROM forum_topics t ORDER BY t.created_at DESC, t.id DESC`,
      [viewerId],
    );
    const [commentRows] = await pool.execute(
      `SELECT c.id, c.topic_id AS topicId, c.author_id AS authorId,
              c.author_username AS authorUsername, c.author_name AS author,
              c.author_avatar AS avatar, c.parent_id AS parentId, c.body AS text,
              c.created_at AS createdAt,
              (c.legacy_likes + (SELECT COUNT(*) FROM forum_comment_likes l WHERE l.comment_id=c.id)) AS likes,
              EXISTS(SELECT 1 FROM forum_comment_likes l WHERE l.comment_id=c.id AND l.user_id=?) AS liked
       FROM forum_comments c ORDER BY c.created_at ASC, c.id ASC`,
      [viewerId],
    );
    const commentsByTopic = new Map();
    for (const row of commentRows) {
      const key = String(row.topicId);
      if (!commentsByTopic.has(key)) commentsByTopic.set(key, []);
      commentsByTopic.get(key).push({
        id: row.id,
        authorId: row.authorId,
        authorUsername: row.authorUsername,
        ownerKey: row.authorUsername,
        author: row.author,
        avatar: row.avatar || "avatar-01",
        parentId: row.parentId,
        text: row.text,
        likes: Number(row.likes || 0),
        liked: Boolean(row.liked),
        minutes: forumMinutesAgo(row.createdAt),
      });
    }
    res.json({
      topics: topicRows.map((row) => ({
        id: row.id,
        authorId: row.authorId,
        authorUsername: row.authorUsername,
        ownerKey: row.authorUsername,
        author: row.author,
        avatar: row.avatar || "avatar-01",
        category: row.category,
        title: row.title,
        body: row.body,
        image: row.image || "",
        createdAt: row.createdAt,
        minutes: forumMinutesAgo(row.createdAt),
        likes: Number(row.likes || 0),
        liked: Boolean(row.liked),
        comments: commentsByTopic.get(String(row.id)) || [],
      })),
    });
  } catch (error) {
    console.error("Load forum topics failed:", error.message);
    res.status(500).json({ error: "Tidak dapat memuat forum dari database." });
  }
});

app.post("/api/forum/topics", requireAuth, async (req, res) => {
  try {
    const category = normalize(req.body.category);
    const title = normalize(req.body.title);
    const body = normalize(req.body.body);
    const image = String(req.body.image || "");
    const authorName =
      normalize(req.body.authorName) ||
      req.session.user.displayName ||
      req.session.user.username;
    const avatar = normalize(req.body.avatar) || "avatar-01";
    if (
      ![
        "Diskusi",
        "Tips & Tutorial",
        "Showcase",
        "Pertanyaan / Bantuan & Error",
      ].includes(category) ||
      !title ||
      title.length > 100 ||
      !body ||
      body.length > 2000 ||
      image.length > 7 * 1024 * 1024
    ) {
      return res
        .status(400)
        .json({ error: "Data topik tidak valid atau lampiran terlalu besar." });
    }
    const [result] = await pool.execute(
      `INSERT INTO forum_topics (owner_id, author_id, author_username, author_name, author_avatar, category, title, body, image_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.id,
        req.session.user.id,
        req.session.user.username,
        authorName,
        avatar,
        category,
        title,
        body,
        image || null,
      ],
    );
    res
      .status(201)
      .json({
        ok: true,
        id: result.insertId,
        message: "Topik berhasil dibuat.",
      });
  } catch (error) {
    console.error("Create forum topic failed:", error.message);
    res.status(500).json({ error: "Topik gagal disimpan ke database." });
  }
});

app.post("/api/forum/topics/:id/comments", requireAuth, async (req, res) => {
  try {
    const topicId = String(req.params.id);
    const body = normalize(req.body.text);
    const parentId = req.body.parentId ? Number(req.body.parentId) : null;
    if (!/^[0-9]+$/.test(topicId) || !body || body.length > 1000)
      return res.status(400).json({ error: "Komentar tidak valid." });
    const [[topic]] = await pool.execute(
      "SELECT id FROM forum_topics WHERE id=?",
      [topicId],
    );
    if (!topic)
      return res.status(404).json({ error: "Topik tidak ditemukan." });
    if (parentId) {
      const [[parent]] = await pool.execute(
        "SELECT id FROM forum_comments WHERE id=? AND topic_id=?",
        [parentId, topicId],
      );
      if (!parent)
        return res
          .status(400)
          .json({ error: "Komentar tujuan balasan tidak valid." });
    }
    const [result] = await pool.execute(
      `INSERT INTO forum_comments (owner_id, topic_id, author_id, author_username, author_name, author_avatar, parent_id, body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.id,
        topicId,
        req.session.user.id,
        req.session.user.username,
        normalize(req.body.authorName) ||
        req.session.user.displayName ||
        req.session.user.username,
        normalize(req.body.avatar) || "avatar-01",
        parentId,
        body,
      ],
    );
    res
      .status(201)
      .json({
        ok: true,
        id: result.insertId,
        message: "Komentar ditambahkan.",
      });
  } catch (error) {
    console.error("Create forum comment failed:", error.message);
    res.status(500).json({ error: "Komentar gagal disimpan." });
  }
});

app.post("/api/forum/topics/:id/like", requireAuth, async (req, res) => {
  try {
    const topicId = String(req.params.id);
    const [[topic]] = await pool.execute(
      "SELECT id FROM forum_topics WHERE id=?",
      [topicId],
    );
    if (!topic)
      return res.status(404).json({ error: "Topik tidak ditemukan." });
    const [[existing]] = await pool.execute(
      "SELECT 1 AS found FROM forum_topic_likes WHERE topic_id=? AND user_id=?",
      [topicId, req.session.user.id],
    );
    if (existing)
      await pool.execute(
        "DELETE FROM forum_topic_likes WHERE topic_id=? AND user_id=?",
        [topicId, req.session.user.id],
      );
    else
      await pool.execute(
        "INSERT INTO forum_topic_likes (topic_id,user_id) VALUES (?,?)",
        [topicId, req.session.user.id],
      );
    const [[count]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM forum_topic_likes WHERE topic_id=?",
      [topicId],
    );
    res.json({ liked: !existing, likes: Number(count.total) });
  } catch (error) {
    console.error("Toggle topic like failed:", error.message);
    res.status(500).json({ error: "Like topik gagal diperbarui." });
  }
});

app.post("/api/forum/comments/:id/like", requireAuth, async (req, res) => {
  try {
    const commentId = String(req.params.id);
    const [[comment]] = await pool.execute(
      "SELECT id FROM forum_comments WHERE id=?",
      [commentId],
    );
    if (!comment)
      return res.status(404).json({ error: "Komentar tidak ditemukan." });
    const [[existing]] = await pool.execute(
      "SELECT 1 AS found FROM forum_comment_likes WHERE comment_id=? AND user_id=?",
      [commentId, req.session.user.id],
    );
    if (existing)
      await pool.execute(
        "DELETE FROM forum_comment_likes WHERE comment_id=? AND user_id=?",
        [commentId, req.session.user.id],
      );
    else
      await pool.execute(
        "INSERT INTO forum_comment_likes (comment_id,user_id) VALUES (?,?)",
        [commentId, req.session.user.id],
      );
    const [[count]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM forum_comment_likes WHERE comment_id=?",
      [commentId],
    );
    res.json({ liked: !existing, likes: Number(count.total) });
  } catch (error) {
    console.error("Toggle comment like failed:", error.message);
    res.status(500).json({ error: "Like komentar gagal diperbarui." });
  }
});

app.delete("/api/forum/topics/:id", requireAuth, async (req, res) => {
  try {
    const [[topic]] = await pool.execute(
      "SELECT author_id FROM forum_topics WHERE id=?",
      [req.params.id],
    );
    if (!topic)
      return res.status(404).json({ error: "Topik tidak ditemukan." });
    if (
      Number(topic.author_id) !== Number(req.session.user.id) &&
      !["admin", "moderator"].includes(
        String(req.session.user.role).toLowerCase(),
      )
    )
      return res
        .status(403)
        .json({ error: "Kamu tidak memiliki izin menghapus topik ini." });
    await pool.execute("DELETE FROM forum_topics WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete forum topic failed:", error.message);
    res.status(500).json({ error: "Topik gagal dihapus." });
  }
});

app.delete("/api/forum/comments/:id", requireAuth, async (req, res) => {
  try {
    const [[comment]] = await pool.execute(
      "SELECT author_id FROM forum_comments WHERE id=?",
      [req.params.id],
    );
    if (!comment)
      return res.status(404).json({ error: "Komentar tidak ditemukan." });
    if (
      Number(comment.author_id) !== Number(req.session.user.id) &&
      !["admin", "moderator"].includes(
        String(req.session.user.role).toLowerCase(),
      )
    )
      return res
        .status(403)
        .json({ error: "Kamu tidak memiliki izin menghapus komentar ini." });
    await pool.execute("DELETE FROM forum_comments WHERE id=?", [
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete forum comment failed:", error.message);
    res.status(500).json({ error: "Komentar gagal dihapus." });
  }
});

app.post("/api/forum/migrate-local", requireAuth, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[count]] = await connection.query(
      "SELECT COUNT(*) AS total FROM forum_topics",
    );
    if (Number(count.total) > 0) {
      await connection.rollback();
      return res.json({
        migrated: false,
        message: "Database forum sudah berisi topik; migrasi lokal dilewati.",
      });
    }
    const topics = Array.isArray(req.body.topics)
      ? req.body.topics.slice(0, 200)
      : [];
    let migrated = 0;
    for (const topic of topics) {
      const title = normalize(topic.title).slice(0, 100);
      const body = normalize(topic.body).slice(0, 2000);
      if (!title || !body) continue;
      const [authorRows] = await connection.execute(
        "SELECT id, username FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1",
        [normalize(topic.authorUsername || topic.ownerKey || topic.author)],
      );
      const author = authorRows[0] || req.session.user;
      const [insert] = await connection.execute(
        `INSERT INTO forum_topics (owner_id, author_id, author_username, author_name, author_avatar, category, title, body, image_data, legacy_likes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          author.id,
          author.id,
          author.username,
          normalize(topic.author).slice(0, 100) || author.username,
          normalize(topic.avatar) || "avatar-01",
          normalize(topic.category) || "Diskusi",
          title,
          body,
          String(topic.image || "").slice(0, 7 * 1024 * 1024) || null,
          Math.max(0, Number(topic.likes) || 0),
        ],
      );
      const topicId = insert.insertId;
      for (const comment of (Array.isArray(topic.comments)
        ? topic.comments
        : []
      ).slice(0, 500)) {
        const commentText = normalize(comment.text).slice(0, 1000);
        if (!commentText) continue;
        const [commentAuthors] = await connection.execute(
          "SELECT id, username FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1",
          [
            normalize(
              comment.authorUsername || comment.ownerKey || comment.author,
            ),
          ],
        );
        const commentAuthor = commentAuthors[0] || req.session.user;
        await connection.execute(
          `INSERT INTO forum_comments (owner_id, topic_id, author_id, author_username, author_name, author_avatar, body, legacy_likes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commentAuthor.id,
            topicId,
            commentAuthor.id,
            commentAuthor.username,
            normalize(comment.author).slice(0, 100) || commentAuthor.username,
            normalize(comment.avatar) || "avatar-01",
            commentText,
            Math.max(0, Number(comment.likes) || 0),
          ],
        );
      }
      migrated++;
    }
    await connection.commit();
    res.json({
      migrated: true,
      count: migrated,
      message: `${migrated} topik lokal berhasil dimigrasikan.`,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Migrate local forum failed:", error.message);
    res.status(500).json({ error: "Migrasi data forum lokal gagal." });
  } finally {
    connection.release();
  }
});

app.post("/api/forum/reports", requireAuth, async (req, res) => {
  try {
    const type = String(req.body.type || "");
    const topicId = normalize(req.body.topicId).slice(0, 80);
    const title = normalize(req.body.topicTitle).slice(0, 150);
    const author = normalize(req.body.contentAuthor).slice(0, 100);
    const content = normalize(req.body.contentText).slice(0, 5000);
    const reason = normalize(req.body.reason).slice(0, 500);
    if (
      !["topic", "comment"].includes(type) ||
      !topicId ||
      !title ||
      !author ||
      !content ||
      !reason
    ) {
      return res
        .status(400)
        .json({ error: "Data dan alasan laporan wajib diisi." });
    }
    const contentKey = crypto
      .createHash("sha256")
      .update(
        [
          type,
          topicId,
          req.body.commentIndex ?? "",
          title,
          author,
          content,
        ].join("\n"),
      )
      .digest("hex");
    const [existing] = await pool.execute(
      "SELECT id FROM forum_reports WHERE content_key = ? AND reporter_id = ? LIMIT 1",
      [contentKey, req.session.user.id],
    );
    if (existing.length)
      return res
        .status(409)
        .json({ error: "Kamu sudah melaporkan konten ini." });
    await pool.execute(
      `INSERT INTO forum_reports
       (content_key, content_type, topic_id, topic_title, content_author, content_text, reporter_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contentKey,
        type,
        topicId,
        title,
        author,
        content,
        req.session.user.id,
        reason,
      ],
    );
    const [[countRow]] = await pool.execute(
      "SELECT COUNT(DISTINCT reporter_id) AS reporter_count FROM forum_reports WHERE content_key = ?",
      [contentKey],
    );
    res.status(201).json({
      ok: true,
      reporterCount: Number(countRow.reporter_count || 0),
      thresholdReached: Number(countRow.reporter_count || 0) >= 5,
      message:
        Number(countRow.reporter_count || 0) >= 5
          ? "Laporan mencapai 5 pengguna berbeda dan sudah masuk Report Logs."
          : "Laporan berhasil dikirim.",
    });
  } catch (error) {
    console.error("Create forum report failed:", error.message);
    res.status(500).json({ error: "Laporan gagal disimpan. Coba lagi." });
  }
});

app.get("/api/forum/reports", requireAuth, async (req, res) => {
  try {
    if (
      !["admin", "moderator"].includes(
        String(req.session.user.role || "").toLowerCase(),
      )
    )
      return res
        .status(403)
        .json({ error: "Akses hanya untuk Admin dan Moderator." });
    const [rows] = await pool.execute(
      `SELECT fr.content_key AS contentKey, fr.content_type AS contentType,
              fr.topic_id AS topicId, fr.topic_title AS topicTitle,
              fr.content_author AS contentAuthor, fr.content_text AS contentText,
              COUNT(DISTINCT fr.reporter_id) AS reporterCount,
              MAX(fr.created_at) AS latestReportAt
       FROM forum_reports fr
       GROUP BY fr.content_key, fr.content_type, fr.topic_id, fr.topic_title, fr.content_author, fr.content_text
       HAVING COUNT(DISTINCT fr.reporter_id) >= 5
       ORDER BY latestReportAt DESC`,
    );
    res.json({ reports: rows });
  } catch (error) {
    console.error("Get forum reports failed:", error.message);
    res.status(500).json({ error: "Tidak dapat memuat Report Logs." });
  }
});

app.get("/api/forum/reports/:contentKey", requireAuth, async (req, res) => {
  try {
    if (
      !["admin", "moderator"].includes(
        String(req.session.user.role || "").toLowerCase(),
      )
    )
      return res
        .status(403)
        .json({ error: "Akses hanya untuk Admin dan Moderator." });
    const key = String(req.params.contentKey || "");
    if (!/^[a-f0-9]{64}$/.test(key))
      return res.status(400).json({ error: "ID laporan tidak valid." });
    const [rows] = await pool.execute(
      `SELECT fr.content_type AS contentType, fr.topic_title AS topicTitle,
              fr.content_author AS contentAuthor, fr.content_text AS contentText,
              u.username AS reporterUsername, fr.reason, fr.created_at AS reportedAt
       FROM forum_reports fr JOIN users u ON u.id = fr.reporter_id
       WHERE fr.content_key = ? ORDER BY fr.created_at ASC`,
      [key],
    );
    if (rows.length < 5)
      return res
        .status(404)
        .json({ error: "Laporan belum mencapai ambang 5 pelapor." });
    res.json({ reports: rows });
  } catch (error) {
    console.error("Get forum report detail failed:", error.message);
    res.status(500).json({ error: "Tidak dapat memuat detail laporan." });
  }
});

app.get("/api/modules", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, level, video_url AS videoUrl, description, created_at AS createdAt
       FROM modules ORDER BY created_at DESC, id DESC`,
    );
    res.json({ modules: rows });
  } catch (err) {
    console.error("Module list failed:", err.message);
    res.status(500).json({ error: "Daftar modul gagal dimuat." });
  }
});

app.post("/api/modules", requireAdmin, async (req, res) => {
  try {
    const title = normalize(req.body.title);
    const level = normalize(req.body.level);
    const description = normalize(req.body.description);
    const videoUrl = normalize(req.body.videoUrl);
    if (
      !title ||
      !["Pemula", "Menengah", "Lanjutan"].includes(level) ||
      !description ||
      description.length > 300
    ) {
      return res
        .status(400)
        .json({ error: "Data modul tidak lengkap atau tidak valid." });
    }
    const videoId = youtubeVideoId(videoUrl);
    if (!videoId)
      return res
        .status(400)
        .json({ error: "Masukkan link video YouTube yang valid." });
    const [existingVideos] = await pool.execute(
      "SELECT id, video_url FROM modules",
    );
    if (
      existingVideos.some((row) => youtubeVideoId(row.video_url) === videoId)
    ) {
      return res
        .status(409)
        .json({ error: "Video ini sudah digunakan pada modul lain." });
    }
    const [result] = await pool.execute(
      "INSERT INTO modules (title, level, video_url, description, created_by) VALUES (?, ?, ?, ?, ?)",
      [title, level, videoUrl, description, req.session.user.id],
    );
    const [rows] = await pool.execute(
      "SELECT id, title, level, video_url AS videoUrl, description, created_at AS createdAt FROM modules WHERE id = ?",
      [result.insertId],
    );
    res.status(201).json({ module: rows[0] });
  } catch (err) {
    console.error("Create module failed:", err.message);
    res.status(500).json({ error: "Modul gagal disimpan ke database." });
  }
});

app.put("/api/modules/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const title = normalize(req.body.title);
    const level = normalize(req.body.level);
    const description = normalize(req.body.description);
    const videoUrl = normalize(req.body.videoUrl);
    if (!Number.isInteger(id) || id < 1)
      return res.status(400).json({ error: "ID modul tidak valid." });
    if (
      !title ||
      !["Pemula", "Menengah", "Lanjutan"].includes(level) ||
      !description ||
      description.length > 300
    ) {
      return res
        .status(400)
        .json({ error: "Data modul tidak lengkap atau tidak valid." });
    }
    const videoId = youtubeVideoId(videoUrl);
    if (!videoId)
      return res
        .status(400)
        .json({ error: "Masukkan link video YouTube yang valid." });
    const [existingVideos] = await pool.execute(
      "SELECT id, video_url FROM modules WHERE id <> ?",
      [id],
    );
    if (
      existingVideos.some((row) => youtubeVideoId(row.video_url) === videoId)
    ) {
      return res
        .status(409)
        .json({ error: "Video ini sudah digunakan pada modul lain." });
    }
    const [result] = await pool.execute(
      "UPDATE modules SET title=?, level=?, video_url=?, description=? WHERE id=?",
      [title, level, videoUrl, description, id],
    );
    if (!result.affectedRows)
      return res.status(404).json({ error: "Modul tidak ditemukan." });
    const [rows] = await pool.execute(
      "SELECT id, title, level, video_url AS videoUrl, description, created_at AS createdAt FROM modules WHERE id=?",
      [id],
    );
    res.json({ module: rows[0] });
  } catch (err) {
    console.error("Update module failed:", err.message);
    res.status(500).json({ error: "Perubahan modul gagal disimpan." });
  }
});

app.delete("/api/modules/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1)
      return res.status(400).json({ error: "ID modul tidak valid." });
    const [result] = await pool.execute("DELETE FROM modules WHERE id=?", [id]);
    if (!result.affectedRows)
      return res.status(404).json({ error: "Modul tidak ditemukan." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete module failed:", err.message);
    res.status(500).json({ error: "Modul gagal dihapus." });
  }
});

app.get("/api/modules/progress", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT module_id AS moduleId, progress_percentage AS progressPercentage,
              watched_seconds AS watchedSeconds, watched_segments AS watchedSegments,
              video_duration_seconds AS videoDurationSeconds,
              status, updated_at AS updatedAt, completed_at AS completedAt
              FROM user_module_progress WHERE user_id=?`,
      [req.session.user.id],
    );
    res.json({ progress: rows });
  } catch (err) {
    console.error("Module progress read failed:", err.message);
    res.status(500).json({ error: "Progress modul gagal dimuat." });
  }
});

app.put("/api/modules/:id/progress", requireAuth, async (req, res) => {
  try {
    const moduleId = Number(req.params.id);
    const duration = Math.max(0, Math.floor(Number(req.body.duration) || 0));
    const incomingSegments = Array.isArray(req.body.watchedSegments)
      ? req.body.watchedSegments
      : [];
    if (!Number.isInteger(moduleId) || moduleId < 1)
      return res.status(400).json({ error: "ID modul tidak valid." });
    const [found] = await pool.execute("SELECT id FROM modules WHERE id=?", [
      moduleId,
    ]);
    if (!found.length)
      return res.status(404).json({ error: "Modul tidak ditemukan." });

    const [existingRows] = await pool.execute(
      "SELECT watched_segments, watched_seconds, video_duration_seconds, status FROM user_module_progress WHERE user_id=? AND module_id=?",
      [req.session.user.id, moduleId],
    );
    let existingSegments = [];
    try {
      existingSegments = JSON.parse(existingRows[0]?.watched_segments || "[]");
      if (!Array.isArray(existingSegments)) existingSegments = [];
    } catch (_) {
      existingSegments = [];
    }

    const maxDuration = Math.max(
      duration,
      Number(existingRows[0]?.video_duration_seconds || 0),
    );
    const ranges = [...existingSegments, ...incomingSegments]
      .filter((range) => Array.isArray(range) && range.length >= 2)
      .map(([start, end]) => [
        Math.max(
          0,
          Math.min(maxDuration || Number.MAX_SAFE_INTEGER, Number(start) || 0),
        ),
        Math.max(
          0,
          Math.min(maxDuration || Number.MAX_SAFE_INTEGER, Number(end) || 0),
        ),
      ])
      .filter(
        ([start, end]) =>
          Number.isFinite(start) && Number.isFinite(end) && end > start,
      )
      .sort((a, b) => a[0] - b[0]);

    const merged = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1] + 0.25)
        last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    const uniqueWatchedSeconds = Math.min(
      maxDuration || Number.MAX_SAFE_INTEGER,
      Math.floor(merged.reduce((sum, [a, b]) => sum + (b - a), 0)),
    );
    const completed =
      maxDuration > 0 && uniqueWatchedSeconds >= maxDuration - 2;
    const percentage = completed
      ? 100
      : maxDuration > 0
        ? Math.min(99, Math.floor((uniqueWatchedSeconds / maxDuration) * 100))
        : 0;
    const status = completed
      ? "completed"
      : uniqueWatchedSeconds > 0
        ? "in_progress"
        : "not_started";

    await pool.execute(
      `INSERT INTO user_module_progress
      (user_id, module_id, watched_seconds, watched_segments, video_duration_seconds, progress_percentage, status, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${completed ? "CURRENT_TIMESTAMP" : "NULL"})
      ON DUPLICATE KEY UPDATE
      watched_seconds=VALUES(watched_seconds),
      watched_segments=VALUES(watched_segments),
      video_duration_seconds=GREATEST(video_duration_seconds, VALUES(video_duration_seconds)),
      progress_percentage=GREATEST(progress_percentage, VALUES(progress_percentage)),
      status=IF(status='completed' OR VALUES(status)='completed','completed',VALUES(status)),
      completed_at=IF(completed_at IS NULL AND VALUES(status)='completed',CURRENT_TIMESTAMP,completed_at)`,
      [
        req.session.user.id,
        moduleId,
        uniqueWatchedSeconds,
        JSON.stringify(merged),
        maxDuration,
        percentage,
        status,
      ],
    );

    const [rows] = await pool.execute(
      `SELECT module_id AS moduleId, progress_percentage AS progressPercentage,
              watched_seconds AS watchedSeconds, watched_segments AS watchedSegments,
              video_duration_seconds AS videoDurationSeconds,
              status, updated_at AS updatedAt, completed_at AS completedAt
      FROM user_module_progress WHERE user_id=? AND module_id=?`,
      [req.session.user.id, moduleId],
    );
    res.json({ progress: rows[0] });
  } catch (err) {
    console.error("Module progress save failed:", err.message);
    res.status(500).json({ error: "Progress gagal disimpan." });
  }
});

app.get("/api/admin/ping", requireAuth, (req, res) => {
  if (req.session.user.role !== "admin")
    return res.status(403).json({ error: "Akses khusus admin." });
  res.json({ ok: true, message: "Admin access granted." });
});

function requireAdmin(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  if (String(req.session.user.role).toLowerCase() !== "admin")
    return res.status(403).json({ error: "Fitur ini khusus Admin." });
  next();
}

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const search = normalize(req.query.username);
    const params = [];
    let where = "";
    if (search) {
      where = "WHERE username LIKE ?";
      params.push(`%${search}%`);
    }
    const [rows] = await pool.execute(
      `SELECT id, username, email, COALESCE(NULLIF(display_name,''), username) AS display_name, role, created_at FROM users ${where} ORDER BY FIELD(role,'admin','moderator','learner'), LOWER(username) LIMIT 200`,
      params,
    );
    const [counts] = await pool.query(
      "SELECT COUNT(*) AS total, SUM(role='admin') AS admins, SUM(role='moderator') AS moderators, SUM(role='learner') AS learners FROM users",
    );
    res.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        joinedAt: row.created_at,
      })),
      counts: counts[0],
    });
  } catch (err) {
    console.error("Admin user list failed:", err.message);
    res.status(500).json({ error: "Daftar pengguna gagal dimuat." });
  }
});

app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = normalize(req.body.role).toLowerCase();
    if (!Number.isInteger(id) || id < 1)
      return res.status(400).json({ error: "ID pengguna tidak valid." });
    if (!["admin", "moderator", "learner"].includes(role))
      return res.status(400).json({ error: "Role tidak valid." });
    if (Number(req.session.user.id) === id)
      return res.status(400).json({
        error:
          "Role akun yang sedang digunakan tidak dapat diubah dari sesi ini.",
      });
    const [found] = await pool.execute(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    if (!found.length)
      return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    await pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);
    res.json({
      ok: true,
      message: "Role pengguna berhasil diperbarui.",
      id,
      role,
    });
  } catch (err) {
    console.error("Admin role update failed:", err.message);
    res.status(500).json({ error: "Role gagal diperbarui." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = normalize(req.body.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res
        .status(400)
        .json({ error: "Masukkan alamat email yang valid." });
    const [users] = await pool.execute(
      "SELECT id, email FROM users WHERE LOWER(email)=? LIMIT 1",
      [email],
    );
    if (!users.length)
      return res.status(404).json({ error: "Email tidak terdaftar." });
    if (!mailer)
      return res
        .status(503)
        .json({
          error:
            "Pengiriman email belum dikonfigurasi. Isi EMAIL_USER dan EMAIL_APP_PASSWORD di .env.",
        });
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    await pool.execute(
      "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL",
      [users[0].id],
    );
    await pool.execute(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))",
      [users[0].id, tokenHash],
    );
    const link = `${APP_BASE_URL}/reset-password.html?token=${rawToken}`;
    await mailer.sendMail({
      from: `"Roblox Learning Center" <${process.env.EMAIL_USER}>`,
      to: users[0].email,
      subject: "Reset Password - Roblox Learning Center",
      text: `Gunakan link berikut untuk mengatur ulang password (berlaku 15 menit): ${link}`,
      html: `<div style="font-family:Arial,sans-serif"><h2>Reset Password</h2><p>Kami menerima permintaan untuk mengatur ulang password akun Roblox Learning Center kamu.</p><p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#1677f8;color:#fff;text-decoration:none;border-radius:8px">Reset Password</a></p><p>Link berlaku selama 15 menit dan hanya dapat digunakan sekali.</p><p>Jika kamu tidak meminta reset password, abaikan email ini.</p></div>`,
    });
    res.json({
      ok: true,
      message: "Link reset password telah dikirim ke email kamu.",
    });
  } catch (err) {
    console.error("Forgot password failed:", err.message);
    res
      .status(500)
      .json({ error: "Email reset password gagal dikirim. Coba lagi nanti." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (!/^[a-f0-9]{64}$/i.test(token))
      return res
        .status(400)
        .json({
          error: "Link reset password tidak valid atau sudah kedaluwarsa.",
        });
    if (password.length < 8 || password.length > 32)
      return res
        .status(400)
        .json({ error: "Password harus terdiri dari 8–32 karakter." });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT t.id AS token_id, t.user_id, u.password_hash
      FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at > NOW() LIMIT 1 FOR UPDATE`,
      [tokenHash],
    );
    if (!rows.length) {
      await connection.rollback();
      return res
        .status(400)
        .json({
          error: "Link reset password tidak valid atau sudah kedaluwarsa.",
        });
    }
    const user = rows[0];
    const [history] = await connection.execute(
      "SELECT password_hash FROM password_history WHERE user_id=?",
      [user.user_id],
    );
    const hashesToCheck = [{ password_hash: user.password_hash }, ...history];
    for (const old of hashesToCheck) {
      if (await bcrypt.compare(password, old.password_hash)) {
        await connection.rollback();
        return res
          .status(409)
          .json({
            error:
              "Password sudah pernah digunakan. Gunakan password yang berbeda.",
          });
      }
    }
    const newHash = await bcrypt.hash(password, 12);
    await connection.execute("UPDATE users SET password_hash=? WHERE id=?", [
      newHash,
      user.user_id,
    ]);
    await connection.execute(
      "INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)",
      [user.user_id, newHash],
    );
    await connection.execute(
      "UPDATE password_reset_tokens SET used_at=NOW() WHERE id=?",
      [user.token_id],
    );
    await connection.commit();
    res.json({
      ok: true,
      message: "Password berhasil diperbarui. Silakan login kembali.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Reset password failed:", err.message);
    res.status(500).json({ error: "Password gagal diperbarui. Coba lagi." });
  } finally {
    connection.release();
  }
});

const FRONTEND_DIR = path.join(__dirname, "..");
app.use("/backend", (req, res) => res.sendStatus(404));
app.use(express.static(FRONTEND_DIR, { index: "dashboard.html" }));
app.get("/", (req, res) =>
  res.sendFile(path.join(FRONTEND_DIR, "dashboard.html")),
);

async function start() {
  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });
  await pool.query("SELECT 1");
  await ensureSchema();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Roblox Learning Center berjalan di http://localhost:${PORT}`);
    console.log(`Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);
  });
}
start().catch((err) => {
  console.error("Backend gagal dijalankan:", err.message);
  console.error(
    "Pastikan MySQL berjalan, port DB benar, dan file .env sudah diisi.",
  );
  process.exit(1);
});
