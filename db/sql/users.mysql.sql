-- Users table (application authentication)

CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `org_id` int unsigned NOT NULL COMMENT '組織ID（orgs.id）',
  `parent_id` int unsigned DEFAULT NULL COMMENT '親ユーザーID（roleがadmin,ownerの場合はNULL）',
  `role_id` int unsigned NOT NULL COMMENT '役割ID（roles.id）',
  `email` varchar(128) NOT NULL COMMENT 'メールアドレス',
  `password` varchar(256) NOT NULL COMMENT 'パスワード（bcrypt hash）',
  `name` varchar(64) DEFAULT NULL COMMENT '法人名',
  `last_name` varchar(64) NOT NULL COMMENT '姓',
  `first_name` varchar(64) NOT NULL COMMENT '名',
  `postal_code` varchar(16) NOT NULL COMMENT '郵便番号',
  `address` varchar(256) NOT NULL COMMENT '住所',
  `gender` enum('male','female','other') DEFAULT 'male' COMMENT '性別（male：男性、female：女性、other：その他）',
  `birthday` date NOT NULL COMMENT '生年月日',
  `note` text NOT NULL COMMENT '備考',
  `last_login_at` datetime DEFAULT NULL COMMENT '最終ログイン日時',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  `deleted_at` datetime DEFAULT NULL COMMENT '削除日時',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `fk_users_org` (`org_id`),
  CONSTRAINT `fk_users_org` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ユーザー';
