/**
 * SQLite 连接 + 建表（用 Node 内置 node:sqlite，零编译）
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data', 'app.db')
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      order_no INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id),
      order_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,                 -- quiz | code | typing | recite | flash | boss
      difficulty INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL DEFAULT '{}',  -- JSON
      pass_score INTEGER NOT NULL DEFAULT 60,
      xp_base INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      stem TEXT NOT NULL,
      options TEXT NOT NULL,              -- JSON 数组
      answer INTEGER NOT NULL,            -- 正确项下标
      explain TEXT NOT NULL DEFAULT '',   -- 答案 HTML
      star INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS level_questions (
      level_id INTEGER NOT NULL REFERENCES levels(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      order_no INTEGER NOT NULL,
      PRIMARY KEY (level_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      coins INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_play_date TEXT
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      level_id INTEGER NOT NULL REFERENCES levels(id),
      score INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      accuracy INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      desc TEXT NOT NULL DEFAULT '',
      xp_reward INTEGER NOT NULL DEFAULT 0,
      condition TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id),
      achievement_id INTEGER NOT NULL REFERENCES achievements(id),
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS wrong_book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      wrong_count INTEGER NOT NULL DEFAULT 1,
      last_wrong_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS user_daily (
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      code TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, date, code)
    );

    CREATE TABLE IF NOT EXISTS xp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,                 -- YYYY-MM-DD（本地日）
      amount INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS week_settlements (
      week_start TEXT PRIMARY KEY,          -- 该周的周一
      week_end TEXT NOT NULL,               -- 该周的周日
      settled_at TEXT NOT NULL DEFAULT (datetime('now')),
      top_json TEXT NOT NULL DEFAULT '[]',  -- 前三名快照
      players INTEGER NOT NULL DEFAULT 0    -- 该周参与者数
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 记忆引擎：题目级复习状态（与游戏进度解耦，不动 attempts/levels）
    CREATE TABLE IF NOT EXISTS review_items (
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      state INTEGER NOT NULL DEFAULT 1,        -- 1初步理解 2短期记住 3待巩固 4稳定掌握
      interval_idx INTEGER NOT NULL DEFAULT 0, -- 指向 REVIEW_INTERVALS 下标
      due_date TEXT NOT NULL,                  -- YYYY-MM-DD，到期复习
      ok_streak INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,       -- 遗忘次数
      reviews INTEGER NOT NULL DEFAULT 0,      -- 累计提取次数
      last_review_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      result INTEGER NOT NULL,                 -- 1 对 / 0 错
      self_rating TEXT NOT NULL DEFAULT '',    -- forgot|hard|good|easy
      covered INTEGER NOT NULL DEFAULT 1,      -- 自评是否覆盖关键点
      delayed INTEGER NOT NULL DEFAULT 0,      -- 距上次提取是否 >=1 天（延迟复测）
      interval_days INTEGER NOT NULL DEFAULT 0,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_review_due ON review_items(user_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_review_logs ON review_logs(user_id, question_id, at);

    -- 无提示提取训练：白纸复现（mode=recall）与讲得清（mode=explain）
    CREATE TABLE IF NOT EXISTS recall_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      mode TEXT NOT NULL DEFAULT 'recall',    -- recall=白纸复现 | explain=费曼关
      score INTEGER NOT NULL,                 -- 0-100
      hits INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      typed_len INTEGER NOT NULL DEFAULT 0,   -- 去标点后的字数（看有没有认真写）
      duration_ms INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '[]',      -- JSON：逐要点命中 / 维度反馈
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recall_user ON recall_attempts(user_id, mode, question_id, at);

    -- 场景题（第 4 档「用得上」）：按场景 code 记录选型作答
    CREATE TABLE IF NOT EXISTS scene_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      scene_code TEXT NOT NULL,
      score INTEGER NOT NULL,                 -- 0-100
      hits INTEGER NOT NULL DEFAULT 0,        -- 命中的关键点数
      total INTEGER NOT NULL DEFAULT 0,
      typed_len INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      detail TEXT NOT NULL DEFAULT '[]',      -- JSON：逐关键点命中 / 踩坑
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_scene_user ON scene_attempts(user_id, scene_code, at);

    -- 打比方素材库：把你自己的比喻沉淀下来，面试时直接能用
    CREATE TABLE IF NOT EXISTS metaphors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER,                    -- 可选：来自哪道题
      topic TEXT NOT NULL,                    -- 知识点（如「闭包」「事件循环」）
      body TEXT NOT NULL,                     -- 你的比喻
      source TEXT NOT NULL DEFAULT 'manual',  -- manual=手写 | explain=讲清关顺手存下
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 平台设置（AI 配置等，value 为 JSON）
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metaphor_user ON metaphors(user_id, created_at);

    CREATE TABLE IF NOT EXISTS nightmare_best (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      best_score INTEGER NOT NULL DEFAULT 0,
      best_stars INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_levels_chapter ON levels(chapter_id, order_no);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, level_id);
    CREATE INDEX IF NOT EXISTS idx_xp_log_date_user ON xp_log(date, user_id);
  `)

  // ---- 轻量迁移：老库补列 / 补索引 ----
  const cols = db.prepare('PRAGMA table_info(wrong_book)').all().map(c => c.name)
  if (!cols.includes('last_choice')) {
    db.exec('ALTER TABLE wrong_book ADD COLUMN last_choice INTEGER')
  }

  // 复现要点：从答案文本自动抽取后缓存在这里，避免每次请求重复计算
  const qcols = db.prepare('PRAGMA table_info(questions)').all().map(c => c.name)
  if (!qcols.includes('points')) {
    db.exec("ALTER TABLE questions ADD COLUMN points TEXT NOT NULL DEFAULT '[]'")
  }

  // 提取训练记录：老库补「模式」列（recall / explain）
  const rcols = db.prepare('PRAGMA table_info(recall_attempts)').all().map(c => c.name)
  if (rcols.length && !rcols.includes('mode')) {
    db.exec("ALTER TABLE recall_attempts ADD COLUMN mode TEXT NOT NULL DEFAULT 'recall'")
  }

  // 场景错题闭环：未达标场景的下一次回炉时间（间隔复习）
  const scols = db.prepare('PRAGMA table_info(scene_attempts)').all().map(c => c.name)
  if (scols.length && !scols.includes('next_at')) {
    db.exec('ALTER TABLE scene_attempts ADD COLUMN next_at TEXT')
  }
}

if (process.argv[1] && process.argv[1].endsWith('db.js')) {
  initSchema()
  console.log('建表完成：', DB_PATH)
}
