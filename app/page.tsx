'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, Edit, Eye, EyeOff, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Все', 'Жидкости', 'Расходники', 'Снюс', 'POD-системы', 'Одноразки', 'Другое'];
const CATEGORY_ORDER: Record<string, number> = {
  'Жидкости': 1, 'Расходники': 2, 'Снюс': 3,
  'POD-системы': 4, 'Одноразки': 5, 'Другое': 6,
};
const LETTER_PRIORITY: Record<string, string[]> = {
  'Жидкости': ['R','D','C','A','B','E','P','G','S','F','H'],
  'Снюс': ['D','E','G','F'],
  'Одноразки': ['P','K','E'],
};
const getLetterPriority = (name: string, category: string): number => {
  const firstLetter = name.charAt(0).toUpperCase();
  const priorities = LETTER_PRIORITY[category];
  if (!priorities) return 999;
  const idx = priorities.indexOf(firstLetter);
  return idx === -1 ? 999 : idx;
};
const ADMIN_PASSWORD = 'K7m2Q9';
const MANAGER_USERNAME = 'LiqVape_2';
const CHANNEL_USERNAME = 'zslvape';
const CHANNEL_LINK = `https://t.me/${CHANNEL_USERNAME}`;

interface Variant { name: string; stock: number; price?: number; }
interface Product { 
  id: number; name: string; category: string; price: number; image: string | null; 
  variants: Variant[]; is_hidden: boolean; is_preorder: boolean;
}
interface CartItem { productId: number; productName: string; variant: string; price: number; quantity: number; }
interface Order { 
  id: string; user_id: string; username?: string; order_number: number; order_date: string; 
  items: CartItem[]; total_price: number; status: string; created_at: string;
}
interface SelectedVariant { name: string; quantity: number; }

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void; expand: () => void; close: () => void;
        openTelegramLink: (url: string) => void;
        HapticFeedback: { impactOccurred: (s: string) => void; notificationOccurred: (t: string) => void; };
        initDataUnsafe?: { user?: { id: number; username?: string; first_name?: string; last_name?: string; } };
      };
    };
  }
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number>(0);
  const [telegramUsername, setTelegramUsername] = useState<string>('');
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [showPreorderModal, setShowPreorderModal] = useState(false);
  const [selectedPreorderProduct, setSelectedPreorderProduct] = useState<Product | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'orders' | 'earnings'>('products');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'done'>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('Все');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [dailyEarnings, setDailyEarnings] = useState<{ date: string; total: number; count: number }[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const user = window.Telegram.WebApp.initDataUnsafe?.user;
      if (user) setTelegramUsername(user.username || user.first_name || '');
    }
  }, []);

  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('liqvape_seen_subscribe');
    if (!hasSeenPrompt) {
      setShowSubscribePrompt(true);
      localStorage.setItem('liqvape_seen_subscribe', 'true');
    }
  }, []);

  const handleSubscribe = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(CHANNEL_LINK);
    } else {
      window.open(CHANNEL_LINK, '_blank');
    }
    setTimeout(() => setShowSubscribePrompt(false), 1000);
  };

  const handleSkipSubscribe = () => setShowSubscribePrompt(false);

  const openChannel = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(CHANNEL_LINK);
    } else {
      window.open(CHANNEL_LINK, '_blank');
    }
  };

  useEffect(() => {
    let id = localStorage.getItem('liqvape_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('liqvape_user_id', id); }
    setUserId(id);
  }, []);

  useEffect(() => {
    const c = localStorage.getItem('liqvape_cart');
    if (c) { 
      try { 
        const parsed = JSON.parse(c);
        console.log('🛒 Loading cart from localStorage:', parsed);
        const fixed = parsed.map((item: any) => ({
          productId: Number(item.productId) || 0,
          productName: String(item.productName || ''),
          variant: String(item.variant || ''),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1
        })).filter(item => item.productId > 0);
        console.log('🛒 Fixed cart:', fixed);
        setCart(fixed);
      } catch(e) {
        console.error('Ошибка загрузки корзины:', e);
      }
    }
  }, []);
  useEffect(() => { 
    localStorage.setItem('liqvape_cart', JSON.stringify(cart));
    console.log('💾 Cart saved to localStorage:', cart);
  }, [cart]);

  const loadProducts = useCallback(async (includeHidden = false): Promise<Product[]> => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query;
    if (error) { console.error('Ошибка загрузки товаров:', error); return []; }
    let parsed: Product[] = [];
    if (data && data.length > 0) {
      parsed = data.map((p: any) => ({
        id: p.id, name: p.name, category: p.category || 'Другое',
        price: Number(p.price), image: p.image_url || null,
        variants: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.variants || p.flavors || []),
        is_hidden: p.is_hidden || false, is_preorder: p.is_preorder || false,
      }));
    }
    setProducts(parsed);
    return parsed;
  }, []);

  const loadUserOrders = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setUserOrders(data);
  }, [userId]);

  const loadAllOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) {
      setAllOrders(data);
      const byDate: Record<string, { total: number; count: number }> = {};
      data.forEach(o => {
        const date = o.order_date || o.created_at.split('T')[0];
        if (!byDate[date]) byDate[date] = { total: 0, count: 0 };
        byDate[date].total += o.total_price;
        byDate[date].count += 1;
      });
      const earnings = Object.entries(byDate)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setDailyEarnings(earnings);
    }
  }, []);

  useEffect(() => {
    loadProducts(isAdmin);
    if (isAdmin) loadAllOrders();
  }, [isAdmin, loadProducts, loadAllOrders]);

  // Real-time подписка
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' }, 
        (payload) => {
          console.log('Изменение товара:', payload);
          loadProducts(isAdmin);
          if (isAdmin) loadAllOrders();
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) setCart(prev => prev.filter(item => item.productId !== deletedId));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            if (updated) {
              const updatedVariantNames = (typeof updated.flavors === 'string' ? JSON.parse(updated.flavors) : (updated.variants || updated.flavors || [])).map((v: any) => v.name);
              setCart(prev => prev.filter(item => {
                if (item.productId !== updated.id) return true;
                return updatedVariantNames.includes(item.variant);
              }));
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadProducts, loadAllOrders]);

  // Polling каждые 30 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      loadProducts(isAdmin);
      if (isAdmin) loadAllOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, loadProducts, loadAllOrders]);

  useEffect(() => { if (userId) loadUserOrders(); }, [userId, loadUserOrders]);

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
    }
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getCartQuantity = (productId: number, variant: string) => {
    const item = cart.find(i => i.productId === productId && i.variant === variant);
    return item ? item.quantity : 0;
  };

  const getAvailableStock = useCallback((productId: number, variant: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const v = product.variants.find(x => x.name === variant);
    if (!v) return 0;
    return Math.max(0, v.stock - getCartQuantity(productId, variant));
  }, [products, cart]);

  const filteredProducts = products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    const c = selectedCategory === 'Все' || p.category === selectedCategory;
    return s && c;
  });

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aAvail = a.variants.reduce((s, v) => s + getAvailableStock(a.id, v.name), 0);
      const bAvail = b.variants.reduce((s, v) => s + getAvailableStock(b.id, v.name), 0);
      if (selectedCategory === 'Все') {
        const aCatOrder = CATEGORY_ORDER[a.category] || 99;
        const bCatOrder = CATEGORY_ORDER[b.category] || 99;
        if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder;
      }
      const aLetter = getLetterPriority(a.name, a.category);
      const bLetter = getLetterPriority(b.name, b.category);
      if (aLetter !== bLetter) return aLetter - bLetter;
      if (a.is_preorder && !b.is_preorder) return 1;
      if (!a.is_preorder && b.is_preorder) return -1;
      if (aAvail > 0 && bAvail === 0) return -1;
      if (aAvail === 0 && bAvail > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredProducts, getAvailableStock, selectedCategory]);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariants([]);
    setShowAllVariants(false);
  };

  const toggleVariantSelection = (variantName: string) => {
    setSelectedVariants(prev => {
      const exists = prev.find(v => v.name === variantName);
      if (exists) return prev.filter(v => v.name !== variantName);
      return [...prev, { name: variantName, quantity: 1 }];
    });
  };

  const updateVariantQuantity = (variantName: string, delta: number) => {
    if (!selectedProduct) return;
    setSelectedVariants(prev => prev.map(v => {
      if (v.name !== variantName) return v;
      const avail = getAvailableStock(selectedProduct.id, v.name);
      const newQty = v.quantity + delta;
      if (newQty < 1) return v;
      if (newQty > avail) { showNotification(`Максимум: ${avail} шт.`, 'error'); return v; }
      return { ...v, quantity: newQty };
    }));
  };

  const setVariantQuantity = (variantName: string, qty: number) => {
    if (!selectedProduct) return;
    const avail = getAvailableStock(selectedProduct.id, variantName);
    const finalQty = Math.max(1, Math.min(qty, avail));
    setSelectedVariants(prev => prev.map(v => v.name === variantName ? { ...v, quantity: finalQty } : v));
  };

  const addSelectedToCart = () => {
    if (!selectedProduct || selectedVariants.length === 0) {
      showNotification('Выберите хотя бы один вкус', 'error');
      return;
    }
    
    console.log('🛒 Adding to cart:', {
      productId: selectedProduct.id,
      productIdType: typeof selectedProduct.id,
      productIdNumber: Number(selectedProduct.id),
      productName: selectedProduct.name,
      variants: selectedVariants
    });
    
    // Проверяем что ID валидный
    if (!selectedProduct.id || isNaN(Number(selectedProduct.id))) {
      console.error('❌ Invalid product ID:', selectedProduct.id);
      showNotification('Ошибка: некорректный ID товара', 'error');
      return;
    }
    
    const issues: string[] = [];
    for (const sv of selectedVariants) {
      const avail = getAvailableStock(selectedProduct.id, sv.name);
      if (avail <= 0) issues.push(`${sv.name} — нет в наличии`);
      else if (sv.quantity > avail) issues.push(`${sv.name} — максимум ${avail} шт.`);
    }
    if (issues.length > 0) { showNotification(issues.join('; '), 'error'); return; }

    let newCart = [...cart];
    for (const sv of selectedVariants) {
      const v = selectedProduct.variants.find(x => x.name === sv.name);
      const price = v?.price || selectedProduct.price;
      const idx = newCart.findIndex(i => i.productId === selectedProduct.id && i.variant === sv.name);
      if (idx >= 0) {
        newCart[idx] = { ...newCart[idx], quantity: newCart[idx].quantity + sv.quantity, price };
      } else {
        newCart.push({ 
          productId: Number(selectedProduct.id), 
          productName: selectedProduct.name, 
          variant: sv.name, 
          price: Number(price), 
          quantity: Number(sv.quantity) 
        });
      }
    }
    setCart(newCart);
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    showNotification(`Добавлено: ${selectedProduct.name} (${selectedVariants.length} вкус.)`);
    setSelectedProduct(null);
    setSelectedVariants([]);
  };

  const removeFromCart = (i: number) => setCart(cart.filter((_, x) => x !== i));
  
  const updateCartQuantity = (i: number, d: number) => {
    const item = cart[i];
    const p = products.find(x => x.id === item.productId);
    const v = p?.variants.find(x => x.name === item.variant);
    const nq = item.quantity + d;
    if (v && nq > v.stock) { showNotification(`Максимум: ${v.stock} шт.`, 'error'); return; }
    if (nq <= 0) setCart(cart.filter((_, x) => x !== i));
    else { const nc = [...cart]; nc[i].quantity = nq; setCart(nc); }
  };

  const clearCart = () => { if (confirm('Очистить?')) { setCart([]); showNotification('Корзина очищена'); } };

  const checkout = async () => {
    if (cart.length === 0 || !userId) return;
    setIsCheckingOut(true);
    
    try {
      console.log('🛒 Checkout started');
      console.log('🛒 Cart items:', cart);
      console.log('🛒 Cart item types:', cart.map(i => ({ id: i.productId, idType: typeof i.productId, name: i.productName })));
      
      // 1. Получаем свежие данные напрямую из базы
      const { data: freshData, error: fetchError } = await supabase.from('products').select('*');
      if (fetchError) {
        console.error('Fetch error:', fetchError);
        showNotification('Ошибка загрузки: ' + fetchError.message, 'error');
        setIsCheckingOut(false);
        return;
      }
      
      const freshProducts: Product[] = (freshData || []).map((p: any) => ({
        id: p.id, name: p.name, category: p.category || 'Другое',
        price: Number(p.price), image: p.image_url || null,
        variants: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.variants || p.flavors || []),
        is_hidden: p.is_hidden || false, is_preorder: p.is_preorder || false,
      }));
      
      console.log('📦 Fresh products loaded:', freshProducts.map(p => ({
        id: p.id,
        idType: typeof p.id,
        idNumber: Number(p.id),
        name: p.name
      })));
      
      console.log('📦 Fresh products:', freshProducts.length);
      
      // 2. Собираем что нужно списать: productId -> variantName -> количество
      const toDeduct: Record<number, Record<string, number>> = {};
      const invalidItems: string[] = [];
      
      for (const item of cart) {
        // Нормализуем productId
        const productId = Number(item.productId);
        
        if (!productId || isNaN(productId) || productId <= 0) {
          console.error('❌ Invalid productId:', item.productId, 'from item:', item);
          invalidItems.push(`${item.productName} (${item.variant}) - ID: ${item.productId}`);
          continue;
        }
        
        if (!toDeduct[productId]) toDeduct[productId] = {};
        toDeduct[productId][item.variant] = (toDeduct[productId][item.variant] || 0) + Number(item.quantity);
      }
      
      if (invalidItems.length > 0) {
        console.error('❌ Invalid items:', invalidItems);
        showNotification('Ошибка: некорректные товары в корзине', 'error');
        setIsCheckingOut(false);
        return;
      }
      
      console.log('📊 To deduct:', toDeduct);
      
      // 3. Проверяем наличие и готовим обновления
      const validItems: CartItem[] = [];
      const updates: Array<{productId: number, variants: Variant[], totalStock: number}> = [];
      const issues: string[] = [];
      
      for (const [productIdStr, variantsMap] of Object.entries(toDeduct)) {
        const productId = Number(productIdStr);
        const product = freshProducts.find(p => Number(p.id) === productId);
        if (!product) { issues.push(`Товар ID ${productId} не найден`); continue; }
        
        // Глубокая копия variants
        const updatedVariants: Variant[] = JSON.parse(JSON.stringify(product.variants));
        let hasChanges = false;
        
        for (const [variantName, qtyNeeded] of Object.entries(variantsMap)) {
          const variant = updatedVariants.find((v: Variant) => v.name === variantName);
          if (!variant) { issues.push(`${product.name}: вкус "${variantName}" не найден`); continue; }
          
          console.log(`  ${variantName}: stock=${variant.stock}, need=${qtyNeeded}`);
          
          if (variant.stock < qtyNeeded) {
            issues.push(`${product.name} (${variantName}): нужно ${qtyNeeded}, есть ${variant.stock}`);
            if (variant.stock > 0) {
              const cartItem = cart.find(i => i.productId === productId && i.variant === variantName);
              if (cartItem) validItems.push({ ...cartItem, quantity: variant.stock });
              variant.stock = 0;
              hasChanges = true;
            }
          } else {
            const cartItem = cart.find(i => i.productId === productId && i.variant === variantName);
            if (cartItem) validItems.push({ ...cartItem, quantity: qtyNeeded });
            variant.stock -= qtyNeeded;
            hasChanges = true;
            console.log(`  ✅ Reduced to ${variant.stock}`);
          }
        }
        
        if (hasChanges) {
          const totalStock = updatedVariants.reduce((s: number, v: Variant) => s + v.stock, 0);
          updates.push({ productId, variants: updatedVariants, totalStock });
        }
      }
      
      if (validItems.length === 0) {
        showNotification('Нечего заказывать: ' + issues.join('; '), 'error');
        setIsCheckingOut(false);
        return;
      }
      
      if (issues.length > 0) {
        const msg = `Проблемы:\n${issues.map(i => '• ' + i).join('\n')}\n\nОформить что есть?`;
        if (!confirm(msg)) { setIsCheckingOut(false); return; }
      }
      
      // 4. Создаём заказ
      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase.from('orders').select('order_number').eq('order_date', today).order('order_number', { ascending: false }).limit(1);
      const nextNum = todayOrders && todayOrders.length > 0 ? todayOrders[0].order_number + 1 : 1;
      
      const { error: orderError } = await supabase.from('orders').insert({
        user_id: userId, username: telegramUsername || null, order_number: nextNum, 
        order_date: today, items: validItems, 
        total_price: validItems.reduce((s, i) => s + i.price * i.quantity, 0), 
        status: 'new',
      });
      
      if (orderError) {
        console.error('Order error:', orderError);
        showNotification('Ошибка заказа: ' + orderError.message, 'error');
        setIsCheckingOut(false);
        return;
      }
      console.log('✅ Order created #' + nextNum);
      
      // 5. Обновляем каждый товар в базе
      for (const update of updates) {
        console.log(`🔄 Updating product ${update.productId}...`);
        const flavorsJson = JSON.stringify(update.variants);
        
        const { error: updateError } = await supabase
          .from('products')
          .update({ flavors: flavorsJson, stock_quantity: update.totalStock })
          .eq('id', Number(update.productId));
        
        if (updateError) {
          console.error(`❌ Update error:`, updateError);
        } else {
          console.log(`✅ Updated product ${update.productId}`);
        }
      }
      
      // 6. Проверяем что обновилось
      const { data: verifyData } = await supabase
        .from('products')
        .select('id, flavors, stock_quantity')
        .in('id', updates.map(u => Number(u.productId)));
      console.log('🔍 Verification:', verifyData);
      
      // 7. Обновляем локальный стейт
      const finalProducts = freshProducts.map(p => {
        const update = updates.find(u => u.productId === p.id);
        return update ? { ...p, variants: update.variants } : p;
      });
      setProducts(finalProducts);
      
      // 8. Удаляем оформленные из корзины
      const validKeys = new Set(validItems.map(i => `${i.productId}_${i.variant}`));
      setCart(cart.filter(item => !validKeys.has(`${item.productId}_${item.variant}`)));
      
      setLastOrderNumber(nextNum);
      setShowOrderSuccess(true);
      setShowCart(false);
      await loadUserOrders();
      await loadAllOrders();
      showNotification(`Заказ #${nextNum} оформлен!`, 'success');
    } catch(e) {
      console.error('💥 Checkout error:', e);
      showNotification('Ошибка: ' + (e as Error).message, 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const contactManager = () => {
    const link = `https://t.me/${MANAGER_USERNAME}`;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else { window.open(link, '_blank'); }
  };

  const contactUser = (username?: string) => {
    if (!username) return;
    const link = `https://t.me/${username.replace('@', '')}`;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else { window.open(link, '_blank'); }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowAdminLogin(false); setShowAdminPanel(true);
      setAdminPassword(''); showNotification('Вход выполнен');
    } else { showNotification('Неверный пароль', 'error'); }
  };

  const openProductForm = (product?: Product) => {
    if (product) { setEditingProduct(product); setFormVariants([...product.variants]); }
    else { setEditingProduct({ name: '', price: 0, category: 'Другое', image: null, is_hidden: false, is_preorder: false }); setFormVariants([]); }
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct.price) { showNotification('Заполните название и цену', 'error'); return; }
    const data = {
      name: editingProduct.name, price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое', image_url: editingProduct.image || null,
      flavors: JSON.stringify(formVariants), 
      stock_quantity: formVariants.reduce((s, f) => s + f.stock, 0),
      is_hidden: editingProduct.is_hidden || false, is_preorder: editingProduct.is_preorder || false,
    };
    if (editingProduct.id) {
      await supabase.from('products').update(data).eq('id', editingProduct.id);
      showNotification('Товар обновлён');
    } else {
      await supabase.from('products').insert(data);
      showNotification('Товар добавлен');
    }
    setShowProductForm(false); setEditingProduct(null);
    await loadProducts(true); await loadAllOrders();
  };

  const toggleHidden = async (p: Product) => {
    const newHidden = !p.is_hidden;
    await supabase.from('products').update({ is_hidden: newHidden }).eq('id', p.id);
    setProducts(prev => prev.map(prod => prod.id === p.id ? { ...prod, is_hidden: newHidden } : prod));
    await loadProducts(true);
    showNotification(newHidden ? 'Товар скрыт' : 'Товар показан');
  };

  const togglePreorder = async (p: Product) => {
    const newPreorder = !p.is_preorder;
    await supabase.from('products').update({ is_preorder: newPreorder }).eq('id', p.id);
    await loadProducts(true);
    showNotification(newPreorder ? 'Предзаказ включён' : 'Предзаказ отключён');
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Удалить товар?')) return;
    await supabase.from('products').delete().eq('id', id);
    await loadProducts(true);
    showNotification('Товар удалён');
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    await loadAllOrders();
    showNotification('Статус обновлён');
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Удалить заказ?')) return;
    await supabase.from('orders').delete().eq('id', id);
    await loadAllOrders();
    showNotification('Заказ удалён');
  };

  const sortedVariants = useMemo(() => {
    if (!selectedProduct) return [];
    return [...selectedProduct.variants].sort((a, b) => {
      const aa = getAvailableStock(selectedProduct.id, a.name);
      const ba = getAvailableStock(selectedProduct.id, b.name);
      if (aa > 0 && ba === 0) return -1;
      if (aa === 0 && ba > 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [selectedProduct, getAvailableStock]);

  const visibleVariants = showAllVariants ? sortedVariants : sortedVariants.slice(0, 5);
  const hiddenVariantsCount = sortedVariants.length - 5;
  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalCartPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const filteredOrders = allOrders.filter(o => {
    if (orderFilter === 'new') return o.status === 'new';
    if (orderFilter === 'done') return o.status === 'done';
    return true;
  });

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white p-3 relative">
        <div className="lava-lamp"><div className="lava-blob lava-blob-1"></div><div className="lava-blob lava-blob-2"></div><div className="lava-blob lava-blob-3"></div><div className="lava-blob lava-blob-4"></div></div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Liq<span className="text-orange-500">Vape</span></h1>
                <p className="text-[10px] text-gray-500">Админ панель</p>
              </div>
            </div>
            <button onClick={() => { setShowAdminPanel(false); setIsAdmin(false); }} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5 mb-4">
            <button onClick={() => setAdminTab('products')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>Товары</button>
            <button onClick={() => setAdminTab('orders')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'orders' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>Заказы</button>
            <button onClick={() => setAdminTab('earnings')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'earnings' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}> Доход</button>
          </div>
          {adminTab === 'products' ? (
            <>
              <button onClick={() => openProductForm()} className="w-full py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 mb-3 flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Добавить товар</button>
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Поиск товаров..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="w-full glass-panel py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-500" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-custom">
                {CATEGORIES.filter(c => c !== 'Все').map((c) => (
                  <button key={c} onClick={() => setAdminCategory(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${adminCategory === c ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>{c}</button>
                ))}
              </div>
              <div className="space-y-2">
                {products.filter(p => {
                  const matchSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase());
                  const matchCategory = adminCategory === 'Все' || p.category === adminCategory;
                  return matchSearch && matchCategory;
                }).map(p => (
                  <div key={p.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <h3 className="font-bold text-sm">{p.name}</h3>
                          {p.is_hidden && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Скрыт</span>}
                          {p.is_preorder && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Предзаказ</span>}
                        </div>
                        <p className="text-[11px] text-gray-400">{p.price} BYN • {p.category} • {p.variants.reduce((s, f) => s + f.stock, 0)} шт.</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openProductForm(p)} className="flex-1 py-1.5 rounded-md bg-white/5 text-[10px] flex items-center justify-center gap-1"><Edit className="w-3 h-3" /> Изменить</button>
                      <button onClick={() => toggleHidden(p)} className={`flex-1 py-1.5 rounded-md text-[10px] flex items-center justify-center gap-1 ${p.is_hidden ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{p.is_hidden ? <><Eye className="w-3 h-3" /> Показать</> : <><EyeOff className="w-3 h-3" /> Скрыть</>}</button>
                      <button onClick={() => togglePreorder(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_preorder ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-400'}`}>Предзаказ</button>
                      <button onClick={() => deleteProduct(p.id)} className="w-8 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {products.filter(p => {
                  const matchSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase());
                  const matchCategory = adminCategory === 'Все' || p.category === adminCategory;
                  return matchSearch && matchCategory;
                }).length === 0 && (
                  <div className="glass-panel p-8 text-center text-gray-500"><Package className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">Товаров нет</p></div>
                )}
              </div>
            </>
          ) : adminTab === 'orders' ? (
            <>
              <div className="flex gap-1 mb-3">
                <button onClick={() => setOrderFilter('all')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'all' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Все ({allOrders.length})</button>
                <button onClick={() => setOrderFilter('new')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'new' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Новые ({allOrders.filter(o => o.status === 'new').length})</button>
                <button onClick={() => setOrderFilter('done')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'done' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Выданные ({allOrders.filter(o => o.status === 'done').length})</button>
              </div>
              <div className="space-y-2">
                {filteredOrders.map(o => (
                  <div key={o.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm">Заказ #{o.order_number}</h3>
                        <p className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        {o.username && (<div className="flex items-center gap-1 mt-1"><MessageCircle className="w-3 h-3 text-orange-400" /><span className="text-[11px] text-orange-400 font-medium">@{o.username}</span></div>)}
                      </div>
                      <span className="text-base font-bold gradient-text">{o.total_price} BYN</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mb-2 space-y-0.5">
                      {o.items.map((item, i) => (<p key={i} className="text-[11px] text-gray-300">• {item.productName} ({item.variant}) × {item.quantity}</p>))}
                    </div>
                    <div className="flex gap-1">
                      {o.username && (<button onClick={() => contactUser(o.username)} className="flex-1 py-1.5 rounded-md bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-medium flex items-center justify-center gap-1"><MessageCircle className="w-3 h-3" /> Написать</button>)}
                      <button onClick={() => updateOrderStatus(o.id, o.status === 'done' ? 'new' : 'done')} className={`flex-1 py-1.5 rounded-md text-[10px] font-medium ${o.status === 'done' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>{o.status === 'done' ? 'Вернуть' : '✓ Выдан'}</button>
                      <button onClick={() => deleteOrder(o.id)} className="w-8 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && (<div className="glass-panel p-8 text-center text-gray-500"><Package className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">Заказов нет</p></div>)}
              </div>
            </>
          ) : (
            <>
              <div className="glass-panel p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Сегодня</span>
                  <span className="text-[10px] text-gray-500">{new Date().toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="text-3xl font-bold gradient-text">{dailyEarnings.find(e => e.date === new Date().toISOString().split('T')[0])?.total.toFixed(2) || '0.00'} BYN</div>
                <div className="text-xs text-gray-400 mt-1">Заказов: {dailyEarnings.find(e => e.date === new Date().toISOString().split('T')[0])?.count || 0}</div>
              </div>
              <div className="mb-2 text-xs text-gray-400 font-medium">История по дням</div>
              <div className="space-y-2">
                {dailyEarnings.map(e => (
                  <div key={e.date} className="glass-card p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      <div className="text-[10px] text-gray-400">{e.count} заказов</div>
                    </div>
                    <div className="text-right"><div className="text-lg font-bold gradient-text">{e.total.toFixed(2)} BYN</div></div>
                  </div>
                ))}
                {dailyEarnings.length === 0 && (<div className="glass-panel p-8 text-center text-gray-500"><p className="text-xs">История заработка пуста</p></div>)}
              </div>
            </>
          )}
        {showProductForm && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-xl">
            <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold gradient-text flex items-center gap-2"><Edit className="w-5 h-5 text-orange-500" />{editingProduct.id ? 'Редактирование' : 'Новый товар'}</h2>
                <button onClick={() => setShowProductForm(false)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1.5 block">Название товара</label>
                <input type="text" placeholder="Например: Xros 5 mini" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Цена (BYN)</label>
                  <input type="number" placeholder="0" value={editingProduct.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Категория</label>
                  <select value={editingProduct.category || 'Другое'} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50">
                    {CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1.5 block">Фото товара</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  showNotification('Загрузка фото...');
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                  const filePath = `products/${fileName}`;
                  try {
                    const { error } = await supabase.storage.from('product-images').upload(filePath, file, { cacheControl: '3600', upsert: false });
                    if (error) { showNotification('Ошибка: ' + error.message, 'error'); return; }
                    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
                    setEditingProduct({...editingProduct, image: publicUrl});
                    showNotification('Фото загружено!', 'success');
                  } catch (err) { showNotification('Ошибка загрузки', 'error'); }
                }} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-gradient-to-r file:from-orange-500 file:to-pink-500 file:text-white file:cursor-pointer" />
                {editingProduct.image && (
                  <div className="mt-3 relative group">
                    <img src={editingProduct.image} className="w-full h-40 object-contain rounded-xl bg-black/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <button onClick={() => setEditingProduct({...editingProduct, image: null})} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Варианты (цвет/вкус)</label>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">{formVariants.length} шт.</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-custom">
                  {formVariants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center bg-black/30 rounded-xl p-2">
                      <input type="text" placeholder="Название" value={v.name} onChange={e => { const nv = [...formVariants]; nv[i].name = e.target.value; setFormVariants(nv); }} className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                      <input type="number" placeholder="Кол-во" value={v.stock === 0 ? '' : v.stock} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); const nv = [...formVariants]; nv[i].stock = val === '' ? 0 : Number(val); setFormVariants(nv); }} className="w-16 bg-transparent border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none text-center" />
                      <input type="number" placeholder="Цена" value={v.price || ''} onChange={e => { const nv = [...formVariants]; nv[i].price = e.target.value === '' ? undefined : Number(e.target.value); setFormVariants(nv); }} className="w-16 bg-transparent border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none text-center" />
                      <button onClick={() => setFormVariants(formVariants.filter((_, x) => x !== i))} className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFormVariants([...formVariants, { name: '', stock: 0 }])} className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-orange-500/30 text-orange-400 text-xs font-medium flex items-center justify-center gap-1.5"><span className="text-lg">+</span> Добавить вариант</button>
              </div>
              <div className="mb-5">
                <button onClick={() => setEditingProduct({...editingProduct, is_preorder: !editingProduct.is_preorder})} className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${editingProduct.is_preorder ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>
                  {editingProduct.is_preorder ? 'Предзаказ включён' : 'Добавить в предзаказ'}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowProductForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300 font-medium">Отмена</button>
                <button onClick={saveProduct} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold">Сохранить</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative">
      <div className="lava-lamp"><div className="lava-blob lava-blob-1"></div><div className="lava-blob lava-blob-2"></div><div className="lava-blob lava-blob-3"></div><div className="lava-blob lava-blob-4"></div></div>

      {notification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className={`w-full max-w-[280px] rounded-xl p-3 backdrop-blur-2xl border shadow-2xl transition-all ${notificationVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${notification.type === 'error' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>
                {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-300" /> : <CheckCircle className="w-5 h-5 text-green-300" />}
              </div>
              <p className={`text-xs font-medium ${notification.type === 'error' ? 'text-red-100' : 'text-green-100'}`}>{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {showOrderSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><CheckCircle className="w-10 h-10 text-white" /></div>
            <h2 className="text-2xl font-bold mb-2">Спасибо за заказ!</h2>
            <p className="text-gray-400 text-sm mb-2">Ваш заказ <span className="text-orange-400 font-bold">№{lastOrderNumber}</span> успешно оформлен</p>
            <p className="text-gray-400 text-xs mb-6">Сделайте скриншот номера заказа и отправьте менеджеру</p>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-white" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">Менеджер</p><p className="text-[11px] text-orange-400">@{MANAGER_USERNAME}</p></div>
            </div>
            <button onClick={contactManager} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2"><Send className="w-4 h-4" /> Написать менеджеру</button>
            <button onClick={() => setShowOrderSuccess(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Закрыть</button>
          </div>
        </div>
      )}

      {showSubscribePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button onClick={handleSkipSubscribe} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><Send className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Подпишись на канал</h2>
            <p className="text-gray-400 text-xs mb-4">Подпишись на наш Telegram канал</p>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Send className="w-5 h-5 text-white" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">@{CHANNEL_USERNAME}</p><p className="text-[10px] text-gray-400">Наш Telegram канал</p></div>
            </div>
            <button onClick={handleSubscribe} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2"><Send className="w-4 h-4" /> Подписаться</button>
            <button onClick={handleSkipSubscribe} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Продолжить без подписки</button>
          </div>
        </div>
      )}

      {showPreorderModal && selectedPreorderProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button onClick={() => setShowPreorderModal(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><ShoppingBag className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Товар по предзаказу</h2>
            <p className="text-gray-400 text-xs mb-4"><span className="text-orange-400 font-bold">{selectedPreorderProduct.name}</span> — напишите менеджеру</p>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-white" /></div>
              <div className="text-left"><p className="text-sm font-bold text-white">Менеджер</p><p className="text-[11px] text-orange-400">@{MANAGER_USERNAME}</p></div>
            </div>
            <button onClick={() => { if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) { window.Telegram.WebApp.openTelegramLink(`https://t.me/${MANAGER_USERNAME}`); } else { window.open(`https://t.me/${MANAGER_USERNAME}`, '_blank'); } }} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2"><Send className="w-4 h-4" /> Написать менеджеру</button>
            <button onClick={() => setShowPreorderModal(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Закрыть</button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-3 relative z-10">
        <div className="sticky top-0 z-40 -mx-3 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow"><Cloud className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <div><h1 className="text-2xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1><p className="text-[10px] text-gray-500">premium shop</p></div>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setShowAdminLogin(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><Edit className="w-4 h-4 text-orange-400" /></button>
              <button onClick={() => setShowHistory(true)} className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><Clock className="w-4 h-4 text-orange-400" />{userOrders.length > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-[9px] font-bold flex items-center justify-center">{userOrders.length}</span>)}</button>
              <button onClick={() => setShowCart(true)} className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><ShoppingBag className="w-4 h-4 text-orange-400" />{totalCartItems > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-[9px] font-bold flex items-center justify-center">{totalCartItems}</span>)}</button>
            </div>
          </div>
        </div>

        <div onClick={openChannel} className="relative my-3 rounded-xl overflow-hidden cursor-pointer group" style={{ background: 'linear-gradient(90deg, #ff5e00, #ff007f, #ff5e00)', backgroundSize: '200% 100%', animation: 'gradient-shift 3s ease infinite' }}>
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all"></div>
          <div className="relative py-2 overflow-hidden">
            <div className="scrolling-banner flex items-center gap-4 text-xs font-bold text-white"><span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">🔥 ПОДПИШИСЬ НА @zslvape  НОВИНКИ • АКЦИИ • СКИДКИ</span></div>
          </div>
        </div>

        <div className="pt-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-3 pl-10 pr-3 text-sm text-white placeholder-gray-500" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-custom">
            {CATEGORIES.map((c) => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${selectedCategory === c ? 'glass-button-active text-white' : 'glass-button text-gray-400'}`}>{c}</button>))}
          </div>
          <div className="mb-4 text-xs text-gray-500">Найдено: <span className="text-orange-500 font-bold">{sortedProducts.length}</span> товаров</div>
          {sortedProducts.length === 0 ? (
            <div className="glass-panel p-8 text-center"><Package className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Товары не найдены</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {sortedProducts.map((p) => {
                const avail = p.variants.reduce((s, f) => s + getAvailableStock(p.id, f.name), 0);
                const isPreorder = p.is_preorder;
                return (
                  <div key={p.id} onClick={() => { if (isPreorder) { setSelectedPreorderProduct(p); setShowPreorderModal(true); } else if (avail > 0) { openProductModal(p); } }} className={`glass-card p-2 transition-all ${isPreorder ? 'opacity-60 cursor-pointer hover:opacity-80' : avail === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group hover:border-orange-500/30'}`}>
                    <div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-2 flex items-center justify-center relative overflow-hidden product-image-glow">
                      {p.image ? (<img src={p.image} alt={p.name} className={`w-full h-full object-contain p-4 rounded-2xl ${isPreorder ? 'brightness-50' : ''}`} />) : (<Package className={`w-12 h-12 text-neutral-700 ${isPreorder ? 'opacity-50' : ''}`} />)}
                      {isPreorder && (<div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10"><span className="text-white font-bold text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg border border-white/20">ПРЕДЗАКАЗ</span></div>)}
                      {!isPreorder && avail === 0 && (<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl"><span className="text-red-400 font-bold text-xs">Нет</span></div>)}
                    </div>
                    <h3 className={`font-semibold text-xs mb-1 line-clamp-2 text-center ${isPreorder ? 'text-gray-400' : 'text-white group-hover:text-orange-400'}`}>{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isPreorder ? 'text-gray-500' : 'gradient-text'}`}>{(() => { const variantPrices = p.variants.filter(v => v.price).map(v => v.price as number); const allPrices = variantPrices.length > 0 ? [...variantPrices, p.price] : [p.price]; const min = Math.min(...allPrices); const max = Math.max(...allPrices); return min === max ? `${min} BYN` : `${min}-${max} BYN`; })()}</span>
                      <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">{p.category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Вход для админа</h2>
              <button onClick={() => setShowAdminLogin(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <input type="password" placeholder="Пароль" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 mb-3 text-sm text-white outline-none focus:border-orange-500" />
            <button onClick={handleAdminLogin} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-bold">Войти</button>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }}></div>
          <div className="relative glass-panel w-full max-w-sm max-h-[90vh] overflow-y-auto relative z-10">
            <button onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-4 h-4" /></button>
            <div className="p-4">
              {selectedProduct.image ? (<div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center overflow-hidden product-image-glow"><img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-6 rounded-2xl" /></div>) : (<div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center"><Package className="w-16 h-16 text-neutral-700" /></div>)}
              <h2 className="text-xl font-bold mb-1 text-center">{selectedProduct.name}</h2>
              <p className="text-sm text-gray-400 mb-4 text-center">Выберите вкусы и количество</p>
              {selectedProduct.variants.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium">ВКУСЫ:</p>
                    <p className="text-[10px] text-gray-500">{selectedVariants.length > 0 && `Выбрано: ${selectedVariants.length}`}</p>
                  </div>
                  <div className="space-y-1.5">
                    {visibleVariants.map((v) => {
                      const avail = getAvailableStock(selectedProduct.id, v.name);
                      const isSelected = selectedVariants.some(sv => sv.name === v.name);
                      const selectedQty = selectedVariants.find(sv => sv.name === v.name)?.quantity || 1;
                      const vPrice = v.price || selectedProduct.price;
                      return (
                        <div key={v.name} className={`rounded-lg border transition-all ${isSelected ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5 bg-white/5'} ${avail === 0 ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between p-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input type="checkbox" checked={isSelected} onChange={() => avail > 0 && toggleVariantSelection(v.name)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer" disabled={avail === 0} />
                              <div className="min-w-0 flex-1"><span className="text-xs font-medium truncate block">{v.name}</span><span className="text-[10px] text-gray-400">{vPrice} BYN</span></div>
                            </div>
                            <span className={`text-[10px] font-medium ml-2 ${avail > 0 ? 'text-green-400' : 'text-red-400'}`}>{avail > 0 ? `${avail} шт.` : 'Нет'}</span>
                          </div>
                          {isSelected && avail > 0 && (
                            <div className="flex items-center justify-between px-2.5 pb-2.5 border-t border-white/5 pt-2">
                              <span className="text-[10px] text-gray-400">Количество:</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateVariantQuantity(v.name, -1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                <input type="number" value={selectedQty} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setVariantQuantity(v.name, val); }} className="w-10 text-center text-xs bg-transparent border border-white/10 rounded px-1 py-0.5 outline-none" />
                                <button onClick={() => updateVariantQuantity(v.name, 1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hiddenVariantsCount > 0 && !showAllVariants && (<button onClick={() => setShowAllVariants(true)} className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-xs">↓ Показать ещё {hiddenVariantsCount}</button>)}
                  {showAllVariants && hiddenVariantsCount > 0 && (<button onClick={() => setShowAllVariants(false)} className="w-full mt-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs">↑ Свернуть</button>)}
                </div>
              )}
              {selectedVariants.length > 0 ? (
                <button onClick={addSelectedToCart} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm">
                  <ShoppingBag className="w-4 h-4" /> В корзину • {selectedVariants.reduce((s, sv) => { const v = selectedProduct.variants.find(x => x.name === sv.name); const price = v?.price || selectedProduct.price; return s + price * sv.quantity; }, 0)} BYN
                </button>
              ) : (<div className="w-full py-3 rounded-xl font-bold bg-white/5 text-center text-gray-400 text-sm">Выберите хотя бы один вкус</div>)}
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCart(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto relative z-10">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Корзина</h2>
              <div className="flex items-center gap-1.5">
                {cart.length > 0 && <button onClick={clearCart} className="text-[10px] text-red-400">Очистить</button>}
                <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-3">
              {cart.length === 0 ? (<div className="text-center py-8"><ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Корзина пуста</p></div>) : (
                <>
                  {(() => {
                    const grouped: Record<string, CartItem[]> = {};
                    cart.forEach(item => { if (!grouped[item.productName]) grouped[item.productName] = []; grouped[item.productName].push(item); });
                    return Object.entries(grouped).map(([productName, items]) => (
                      <div key={productName} className="mb-3">
                        <div className="text-xs font-bold text-orange-400 mb-1.5 px-1">{productName}</div>
                        <div className="space-y-1.5">
                          {items.map((item) => {
                            const idx = cart.indexOf(item);
                            const p = products.find(x => x.id === item.productId);
                            const v = p?.variants.find(x => x.name === item.variant);
                            const maxS = v?.stock || 0;
                            const isMax = item.quantity >= maxS;
                            return (
                              <div key={idx} className="glass-card p-2.5">
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.variant}</p><p className="text-[10px] text-gray-400">{item.price} BYN / шт.</p></div>
                                  <button onClick={() => removeFromCart(idx)} className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center flex-shrink-0 ml-2"><Trash2 className="w-3 h-3 text-red-400" /></button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updateCartQuantity(idx, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                    <button onClick={() => updateCartQuantity(idx, 1)} disabled={isMax} className={`w-7 h-7 rounded-full flex items-center justify-center ${isMax ? 'opacity-30' : 'bg-white/5'}`}><Plus className="w-2.5 h-2.5" /></button>
                                  </div>
                                  <span className="text-sm font-bold gradient-text">{item.price * item.quantity} BYN</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">Итого:</span>
                      <span className="text-xl font-bold gradient-text">{totalCartPrice} BYN</span>
                    </div>
                    <button onClick={checkout} disabled={isCheckingOut} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {isCheckingOut ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Оформление...</> : <><ShoppingBag className="w-4 h-4" />Оформить заказ</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto relative z-10">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">История заказов</h2>
              <div className="flex items-center gap-2">
                {userOrders.length > 0 && (<button onClick={() => { if (confirm('Очистить историю заказов?')) { setUserOrders([]); showNotification('История очищена'); } }} className="text-[10px] text-red-400 hover:text-red-300">Очистить</button>)}
                <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-3">
              {userOrders.length === 0 ? (<div className="text-center py-8"><Clock className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Заказов нет</p></div>) : (
                <div className="space-y-2">
                  {userOrders.map(o => (
                    <div key={o.id} className="glass-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div><h3 className="font-bold text-sm">Заказ #{o.order_number}</h3><p className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                        <span className="text-lg font-bold gradient-text">{o.total_price} BYN</span>
                      </div>
                      <div className="border-t border-white/10 pt-2 space-y-0.5">
                        {o.items.map((item, i) => (<div key={i} className="flex justify-between text-[11px]"><span className="text-gray-300">{item.productName} ({item.variant})</span><span className="text-gray-400">× {item.quantity}</span></div>))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
