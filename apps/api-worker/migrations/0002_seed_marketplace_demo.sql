INSERT OR IGNORE INTO users (id, telegram_id, username, first_name, language_code, risk_status)
VALUES ('user_demo_seller', '900000001', 'drop_hunter', 'Drop', 'en', 'normal');

INSERT OR IGNORE INTO inventory_items (id, owner_user_id, item_type, name, rarity, status, transferable, soulbound, expires_at)
VALUES ('item_demo_fomo_box', 'user_demo_seller', 'box', 'FOMO Box', 'rare', 'listed', 1, 0, datetime('now', '+1 day'));

INSERT OR IGNORE INTO marketplace_listings (id, seller_user_id, inventory_item_id, price, currency, status, expires_at)
VALUES ('listing_demo_fomo_box', 'user_demo_seller', 'item_demo_fomo_box', '12.5', 'POINT_TEST', 'active', datetime('now', '+1 day'));
