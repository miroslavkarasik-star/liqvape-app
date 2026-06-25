'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, Edit, Eye, EyeOff, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Все', 'POD-системы', 'Жидкости', 'Расходники', 'Снюс', 'Одноразки', 'Другое'];
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
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
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
    if (c) { try { setCart(JSON.parse(c)); } catch(e) {} }
  }, []);
  useEffect(() => { localStorage.setItem('liqvape_cart', JSON.stringify(cart)); }, [cart]);

  const loadProducts = useCallback(async (includeHidden = false) => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query;
    if (error) { console.error('Ошибка загрузки товаров:', error); return; }
    if (data && data.length > 0) {
      const parsed = data.map((p: any) => ({
        id: p.id, name: p.name, category: p.category || 'Другое',
        price: Number(p.price), image: p.image_url || null,
        variants: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.variants || p.flavors || []),
        is_hidden: p.is_hidden || false, is_preorder: p.is_preorder || false,
      }));
      setProducts(parsed);
    } else {
      setProducts([]);
    }
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
      if (aAvail > 0 && !a.is_preorder && (bAvail === 0 || b.is_preorder)) return -1;
      if (bAvail > 0 && !b.is_preorder && (aAvail === 0 || a.is_preorder)) return 1;
      if (a.is_preorder && !b.is_preorder) return -1;
      if (!a.is_preorder && b.is_preorder) return 1;
      if (aAvail > 0 && bAvail === 0) return -1;
      if (aAvail === 0 && bAvail > 0) return 1;
      return 0;
    });
  }, [filteredProducts, getAvailableStock]);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    const first = product.variants.find(f => getAvailableStock(product.id, f.name) > 0);
    setSelectedVariant(first?.name || '');
    setQuantity(1);
    setShowAllVariants(false);
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) return;
    const avail = getAvailableStock(selectedProduct.id, selectedVariant);
    if (avail <= 0) { showNotification('Нет в наличии', 'error'); return; }
    if (quantity > avail) { showNotification(`Максимум: ${avail} шт.`, 'error'); setQuantity(avail); return; }
    const idx = cart.findIndex(i => i.productId === selectedProduct.id && i.variant === selectedVariant);
    const v = selectedProduct.variants.find(x => x.name === selectedVariant);
    const price = v?.price || selectedProduct.price;
    if (idx >= 0) {
      const nc = [...cart]; nc[idx].quantity += quantity; nc[idx].price = price; setCart(nc);
    } else {
      setCart([...cart, { productId: selectedProduct.id, productName: selectedProduct.name, variant: selectedVariant, price, quantity }]);
    }
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    showNotification(`Добавлено: ${selectedProduct.name}`);
    setSelectedProduct(null);
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
      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase.from('orders').select('order_number').eq('order_date', today).order('order_number', { ascending: false }).limit(1);
      const nextNum = todayOrders && todayOrders.length > 0 ? todayOrders[0].order_number + 1 : 1;
      const { error } = await supabase.from('orders').insert({
        user_id: userId, username: telegramUsername || null, order_number: nextNum, 
        order_date: today, items: cart, 
        total_price: cart.reduce((s, i) => s + i.price * i.quantity, 0), 
        status: 'new',
      });
      if (error) { showNotification('Ошибка заказа', 'error'); setIsCheckingOut(false); return; }
      
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        const updatedVariants = product.variants.map(v => 
          v.name === item.variant ? { ...v, stock: Math.max(0, v.stock - item.quantity) } : v
        );
        const totalStock = updatedVariants.reduce((s, v) => s + v.stock, 0);
        await supabase.from('products').update({
          flavors: JSON.stringify(updatedVariants),
          stock_quantity: totalStock
        }).eq('id', item.productId);
      }
      
      const updated = products.map(p => {
        const ci = cart.filter(i => i.productId === p.id);
        if (ci.length === 0) return p;
        return { ...p, variants: p.variants.map(v => {
          const it = ci.find(i => i.variant === v.name);
          return it ? { ...v, stock: Math.max(0, v.stock - it.quantity) } : v;
        })};
      });
      setProducts(updated);
      setLastOrderNumber(nextNum);
      setShowOrderSuccess(true);
      setCart([]); 
      setShowCart(false);
      await loadUserOrders();
      await loadAllOrders();
    } catch(e) { showNotification('Ошибка', 'error'); } 
    finally { setIsCheckingOut(false); }
  };

  const contactManager = () => {
    const link = `https://t.me/${MANAGER_USERNAME}`;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  };

  const contactUser = (username?: string) => {
    if (!username) return;
    const link = `https://t.me/${username.replace('@', '')}`;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminPassword('');
      showNotification('Вход выполнен');
    } else {
      showNotification('Неверный пароль', 'error');
    }
  };

  const openProductForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormVariants([...product.variants]);
    } else {
      setEditingProduct({ name: '', price: 0, category: 'Другое', image: null, is_hidden: false, is_preorder: false });
      setFormVariants([]);
    }
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
    setShowProductForm(false);
    setEditingProduct(null);
    await loadProducts(true);
    await loadAllOrders();
  };

  const toggleHidden = async (p: Product) => {
    const newHidden = !p.is_hidden;
    await supabase.from('products').update({ is_hidden: newHidden }).eq('id', p.id);
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
      return 0;
    });
  }, [selectedProduct, getAvailableStock]);

  const visibleVariants = showAllVariants ? sortedVariants : sortedVariants.slice(0, 5);
  const hiddenVariantsCount = sortedVariants.length - 5;
  const availableStock = selectedProduct && selectedVariant ? getAvailableStock(selectedProduct.id, selectedVariant) : 0;
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
            <button onClick={() => setAdminTab('products')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Товары
            </button>
            <button onClick={() => setAdminTab('orders')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'orders' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Заказы
            </button>
            <button onClick={() => setAdminTab('earnings')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'earnings' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Доход
            </button>
          </div>
          {adminTab === 'products' ? (
            <>
              <button onClick={() => openProductForm()}
                className="w-full py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 mb-3 flex items-center justify-center gap-1">
                <Plus className="w-4 h-4" /> Добавить товар
              </button>
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Поиск товаров..." value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  className="w-full glass-panel py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-500" />
              </div>
              <div className="space-y-2">
                {products.filter(p => p.name.toLowerCase().includes(adminSearch.toLowerCase())).map(p => (
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
                      <button onClick={() => openProductForm(p)} className="flex-1 py-1.5 rounded-md bg-white/5 text-[10px] flex items-center justify-center gap-1">
                        <Edit className="w-3 h-3" /> Изменить
                      </button>
                      <button onClick={() => toggleHidden(p)} className={`flex-1 py-1.5 rounded-md text-[10px] flex items-center justify-center gap-1 ${p.is_hidden ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {p.is_hidden ? <><Eye className="w-3 h-3" /> Показать</> : <><EyeOff className="w-3 h-3" /> Скрыть</>}
                      </button>
                      <button onClick={() => togglePreorder(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_preorder ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-400'}`}>
                        Предзаказ
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="w-8 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <div className="glass-panel p-8 text-center text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Товаров нет. Добавь первый!</p>
                  </div>
                )}
              </div>
            </>
          ) : adminTab === 'orders' ? (
            <>
              <div className="flex gap-1 mb-3">
                <button onClick={() => setOrderFilter('all')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'all' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>
                  Все ({allOrders.length})
                </button>
                <button onClick={() => setOrderFilter('new')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'new' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>
                  Новые ({allOrders.filter(o => o.status === 'new').length})
                </button>
                <button onClick={() => setOrderFilter('done')} className={`flex-1 py-1.5 rounded-md text-[10px] ${orderFilter === 'done' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>
                  Выданные ({allOrders.filter(o => o.status === 'done').length})
                </button>
              </div>
              <div className="space-y-2">
                {filteredOrders.map(o => (
                  <div key={o.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm">Заказ #{o.order_number}</h3>
                        <p className="text-[10px] text-gray-400">
                          {new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {o.username && (
                          <div className="flex items-center gap-1 mt-1">
                            <MessageCircle className="w-3 h-3 text-orange-400" />
                            <span className="text-[11px] text-orange-400 font-medium">@{o.username}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-base font-bold gradient-text">{o.total_price} BYN</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mb-2 space-y-0.5">
                      {o.items.map((item, i) => (
                        <p key={i} className="text-[11px] text-gray-300">• {item.productName} ({item.variant}) × {item.quantity}</p>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {o.username && (
                        <button onClick={() => contactUser(o.username)}
                          className="flex-1 py-1.5 rounded-md bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 text-orange-400 text-[10px] font-medium flex items-center justify-center gap-1">
                          <MessageCircle className="w-3 h-3" /> Написать
                        </button>
                      )}
                      <button onClick={() => updateOrderStatus(o.id, o.status === 'done' ? 'new' : 'done')}
                        className={`flex-1 py-1.5 rounded-md text-[10px] font-medium ${o.status === 'done' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {o.status === 'done' ? 'Вернуть' : '✓ Выдан'}
                      </button>
                      <button onClick={() => deleteOrder(o.id)} className="w-8 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <div className="glass-panel p-8 text-center text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Заказов нет</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="glass-panel p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Сегодня</span>
                  <span className="text-[10px] text-gray-500">{new Date().toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="text-3xl font-bold gradient-text">
                  {dailyEarnings.find(e => e.date === new Date().toISOString().split('T')[0])?.total.toFixed(2) || '0.00'} BYN
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Заказов: {dailyEarnings.find(e => e.date === new Date().toISOString().split('T')[0])?.count || 0}
                </div>
              </div>
              <div className="mb-2 text-xs text-gray-400 font-medium">История по дням</div>
              <div className="space-y-2">
                {dailyEarnings.map(e => (
                  <div key={e.date} className="glass-card p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-gray-400">{e.count} заказов</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold gradient-text">{e.total.toFixed(2)} BYN</div>
                    </div>
                  </div>
                ))}
                {dailyEarnings.length === 0 && (
                  <div className="glass-panel p-8 text-center text-gray-500">
                    <p className="text-xs">История заработка пуста</p>
                  </div>
                )}
              </div>
            </>
          )}
