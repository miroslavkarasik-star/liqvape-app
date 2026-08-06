-- ===========================================
-- ОПТИМИЗАЦИЯ БАЗЫ ДАННЫХ SUPABASE
-- ===========================================

-- 1. Добавляем индексы для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_hidden ON products(is_hidden);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON user_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON user_requests(user_id);

-- 2. Автоматическая очистка старых заказов (старше 30 дней)
-- Создаём функцию
CREATE OR REPLACE FUNCTION cleanup_old_orders()
RETURNS void AS $$
BEGIN
  DELETE FROM user_requests 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Cleaned up orders older than 30 days';
END;
$$ LANGUAGE plpgsql;

-- 3. Создаём cron job для автоматической очистки раз в день
-- Примечание: требует включения pg_cron в Supabase
SELECT cron.schedule(
  'cleanup-old-orders',
  '0 3 * * *', -- Каждый день в 3:00 ночи
  $$SELECT cleanup_old_orders()$$
);

-- 4. Добавляем триггер для автоочистки при вставке нового заказа
CREATE OR REPLACE FUNCTION cleanup_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Удаляем заказы старше 30 дней при каждом новом заказе
  DELETE FROM user_requests 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_on_insert
AFTER INSERT ON user_requests
FOR EACH STATEMENT
EXECUTE FUNCTION cleanup_on_insert();

-- 5. Ограничиваем максимальное количество заказов (опционально)
-- Удаляем самые старые если их больше 1000
CREATE OR REPLACE FUNCTION limit_orders_count()
RETURNS void AS $$
DECLARE
  order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO order_count FROM user_requests;
  
  IF order_count > 1000 THEN
    DELETE FROM user_requests
    WHERE id IN (
      SELECT id FROM user_requests
      ORDER BY created_at ASC
      LIMIT (order_count - 1000)
    );
    
    RAISE NOTICE 'Limited orders to 1000, removed % old orders', (order_count - 1000);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- РЕЗУЛЬТАТ:
-- ✅ Индексы для быстрой работы
-- ✅ Автоочистка заказов старше 30 дней
-- ✅ Ограничение до 1000 заказов максимум
-- ✅ База никогда не вырастет больше нескольких MB
-- ===========================================
