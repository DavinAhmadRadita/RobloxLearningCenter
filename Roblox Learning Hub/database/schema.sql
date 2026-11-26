CREATE DATABASE IF NOT EXISTS roblox_learning_center
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE roblox_learning_center;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NULL,
  role ENUM('admin','moderator','learner') NOT NULL DEFAULT 'learner',
  email_verified TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pending_registrations (
  session_id VARCHAR(128) PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pending_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  level ENUM('Pemula','Menengah','Lanjutan') NOT NULL,
  video_url VARCHAR(2048) NOT NULL,
  description VARCHAR(300) NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_modules_creator FOREIGN KEY (created_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_module_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  watched_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  video_duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  progress_percentage TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_user_module (user_id, module_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_module FOREIGN KEY (module_id)
    REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Forum tables (also created and migrated automatically by backend/server.js)
CREATE TABLE IF NOT EXISTS forum_topics (
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
  CONSTRAINT fk_forum_topic_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS forum_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  topic_id BIGINT NOT NULL,
  author_id INT NULL,
  author_username VARCHAR(50) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_avatar VARCHAR(255) NULL,
  parent_id BIGINT NULL,
  body TEXT NOT NULL,
  legacy_likes INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_forum_comments_topic (topic_id, created_at),
  CONSTRAINT fk_forum_comment_topic FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_forum_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_forum_comment_parent FOREIGN KEY (parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
