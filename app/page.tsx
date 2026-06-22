'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, Edit, Eye, EyeOff, MessageCircle, Send, TrendingUp, Sparkles, Zap, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Все', 'POD-системы', 'Жидкости', 'Расходники', 'Снюс', 'Одноразки', 'Другое'];
const ADMIN_PASSWORD = 'liqvape67';
const MANAGER_USERNAME = 'zslvape';
const CHANNEL_USERNAME = 'zslvape';
const CHANNEL_LINK = `https://t.me/${CHANNEL_USERNAME}`;

interface Variant { name: string; stock: number; }
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
  const [adminTab, setAdminTab] = useState<'products' | 'orders'>('products');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'done'>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      const user = window.Telegram.WebApp.initDataUnsafe?.user;
      if (user) {
        setTelegramUsername(user.username || user.first_name || '');
      }
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

  const handleSkipSubscribe = () => {
    setShowSubscribePrompt(false);
  };

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
    if (data) setAllOrders(data);
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
      
      // 1. В наличии (без предзаказа) - ПЕРВЫЕ
      if (aAvail > 0 && !a.is_preorder && (bAvail === 0 || b.is_preorder)) return -1;
      if (bAvail > 0 && !b.is_preorder && (aAvail === 0 || a.is_preorder)) return 1;
      
      // 2. Предзаказ - ВТОРЫЕ
      if (a.is_preorder && !b.is_preorder) return -1;
      if (!a.is_preorder && b.is_preorder) return 1;
      
      // 3. Нет в наличии - ПОСЛЕДНИЕ
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
    if (idx >= 0) {
      const nc = [...cart]; nc[idx].quantity += quantity; setCart(nc);
    } else {
      setCart([...cart, { productId: selectedProduct.id, productName: selectedProduct.name, variant: selectedVariant, price: selectedProduct.price, quantity }]);
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
        user_id: userId,
        username: telegramUsername || null,
        order_number: nextNum, 
        order_date: today,
        items: cart, 
        total_price: cart.reduce((s, i) => s + i.price * i.quantity, 0), 
        status: 'new',
      });
      if (error) { showNotification('Ошибка заказа', 'error'); setIsCheckingOut(false); return; }
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
    } catch(e) { 
      showNotification('Ошибка', 'error'); 
    } finally { 
      setIsCheckingOut(false); 
    }
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
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAdminTab('orders')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'orders' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Заказы ({allOrders.length})
            </button>
            <button onClick={() => setAdminTab('products')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Товары ({products.length})
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
          ) : (
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
          )}
        </div>
        {showProductForm && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-xl">
            <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold gradient-text flex items-center gap-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {editingProduct.id ? 'Редактирование' : 'Новый товар'}
                </h2>
                <button onClick={() => setShowProductForm(false)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Название */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1.5 block">Название товара</label>
                <input type="text" placeholder="Например: Xros 5 mini" value={editingProduct.name || ''}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all" />
              </div>
              
              {/* Цена и категория */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Цена (BYN)</label>
                  <input type="number" placeholder="0" value={editingProduct.price || ''}
                    onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Категория</label>
                  <select value={editingProduct.category || 'Другое'}
                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all">
                    {CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
                  </select>
                </div>
              </div>
              
              {/* Загрузка фото */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1.5 block">Фото товара</label>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await fetch('/api/upload', { method: 'POST', body: formData });
                        const data = await res.json();
                        if (data.url) {
                          setEditingProduct({...editingProduct, image: data.url});
                          showNotification('Фото загружено ✅');
                        }
                      } catch (error) {
                        showNotification('Ошибка загрузки', 'error');
                      }
                    }}
                    className="hidden"
                    id="product-image-upload"
                  />
                  <label htmlFor="product-image-upload" className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border-2 border-dashed border-orange-500/30 rounded-xl p-4 cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/10 transition-all">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                      <span className="text-2xl"></span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Нажмите для загрузки</p>
                      <p className="text-xs text-gray-400">PNG, JPG до 5MB</p>
                    </div>
                  </label>
                </div>
                {editingProduct.image && (
                  <div className="mt-3 relative group">
                    <img src={editingProduct.image} className="w-full h-40 object-contain rounded-xl bg-black/30" />
                    <button onClick={() => setEditingProduct({...editingProduct, image: null})} 
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Варианты */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Варианты (цвет/вкус)</label>
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">{formVariants.length} шт.</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-custom">
                  {formVariants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center bg-black/30 rounded-xl p-2">
                      <input type="text" placeholder="Название (например: Чёрный)" value={v.name}
                        onChange={e => { const nv = [...formVariants]; nv[i].name = e.target.value; setFormVariants(nv); }}
                        className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50 transition-all" />
                      <input type="number" placeholder="0" 
                        value={v.stock === 0 ? '' : v.stock}
                        onChange={e => { 
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const nv = [...formVariants]; 
                          nv[i].stock = val === '' ? 0 : Number(val); 
                          setFormVariants(nv); 
                        }}
                        className="w-20 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50 transition-all text-center" />
                      <button onClick={() => setFormVariants(formVariants.filter((_, x) => x !== i))} 
                        className="w-9 h-9 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFormVariants([...formVariants, { name: '', stock: 0 }])}
                  className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-orange-500/30 text-orange-400 text-xs font-medium hover:border-orange-500/50 hover:bg-orange-500/10 transition-all flex items-center justify-center gap-1.5">
                  <span className="text-lg">+</span> Добавить вариант
                </button>
              </div>
              
              {/* Предзаказ */}
              <div className="mb-5">
                <button onClick={() => setEditingProduct({...editingProduct, is_preorder: !editingProduct.is_preorder})}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    editingProduct.is_preorder 
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}>
                  <span className="text-lg">{editingProduct.is_preorder ? '✅' : '⏳'}</span>
                  {editingProduct.is_preorder ? 'Предзаказ включён' : 'Добавить в предзаказ'}
                </button>
              </div>
              
              {/* Кнопки */}
              <div className="flex gap-3">
                <button onClick={() => setShowProductForm(false)} 
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium transition-all">
                  Отмена
                </button>
                <button onClick={saveProduct} 
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold shadow-lg shadow-orange-500/30 transition-all transform hover:scale-[1.02]">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative">
      <div className="lava-lamp">
        <div className="lava-blob lava-blob-1"></div>
        <div className="lava-blob lava-blob-2"></div>
        <div className="lava-blob lava-blob-3"></div>
        <div className="lava-blob lava-blob-4"></div>
      </div>

      {notification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className={`w-full max-w-[260px] rounded-xl p-3 backdrop-blur-2xl border shadow-2xl transition-all duration-300 ${
            notificationVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          } ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${notification.type === 'error' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>
                {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-300" /> : <CheckCircle className="w-5 h-5 text-green-300" />}
              </div>
              <p className={`text-xs font-medium ${notification.type === 'error' ? 'text-red-100' : 'text-green-100'}`}>{notification.message}</p>
              <div className="w-full h-0.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-[2500ms] ease-linear ${notification.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: notificationVisible ? '0%' : '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOrderSuccess && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Спасибо за заказ!</h2>
            <p className="text-gray-400 text-sm mb-2">
              Ваш заказ <span className="text-orange-400 font-bold">№{lastOrderNumber}</span> успешно оформлен
            </p>
            <p className="text-gray-400 text-xs mb-6 leading-relaxed">
              Для подтверждения заказа отправьте нашему менеджеру фото номера вашего заказа в Telegram
            </p>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Менеджер</p>
                <p className="text-[11px] text-orange-400">@{MANAGER_USERNAME}</p>
              </div>
            </div>
            <button onClick={contactManager}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2">
              <Send className="w-4 h-4" /> Написать менеджеру
            </button>
            <button onClick={() => setShowOrderSuccess(false)}
              className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showSubscribePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button 
              onClick={handleSkipSubscribe}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
              <Send className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Подпишись на канал</h2>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
              Подпишись на наш Telegram канал, чтобы быть в курсе новинок и акций
            </p>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">@{CHANNEL_USERNAME}</p>
                <p className="text-[10px] text-gray-400">Наш Telegram канал</p>
              </div>
            </div>
            <button onClick={handleSubscribe}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2">
              <Send className="w-4 h-4" /> Подписаться
            </button>
            <button onClick={handleSkipSubscribe}
              className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-colors">
              Продолжить без подписки
            </button>
          </div>
        </div>
      )}

      {showPreorderModal && selectedPreorderProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button 
              onClick={() => setShowPreorderModal(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
              <ShoppingBag className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Товар доступен по предзаказу</h2>
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">
              <span className="text-orange-400 font-bold">{selectedPreorderProduct.name}</span> доступен для предварительного заказа. Напишите менеджеру для оформления.
            </p>
            <div className="glass-card p-3 mb-4">
              <p className="text-sm text-gray-300 mb-1">Цена: <span className="text-white font-bold">{selectedPreorderProduct.price} BYN</span></p>
            </div>
            <div className="glass-card p-3 mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Менеджер</p>
                <p className="text-[11px] text-orange-400">@{MANAGER_USERNAME}</p>
              </div>
            </div>
            <button onClick={() => {
              if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
                window.Telegram.WebApp.openTelegramLink(`https://t.me/${MANAGER_USERNAME}`);
              } else {
                window.open(`https://t.me/${MANAGER_USERNAME}`, '_blank');
              }
            }}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2">
              <Send className="w-4 h-4" /> Написать менеджеру
            </button>
            <button onClick={() => setShowPreorderModal(false)}
              className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-colors">
              Закрыть
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-3 relative z-10">
        {/* ШАПКА С ЛОГОТИПОМ И КНОПКАМИ */}
        <div className="sticky top-0 z-40 -mx-3 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow">
              <Cloud className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1>
              <p className="text-[10px] text-gray-500">premium shop</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setShowAdminLogin(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:from-orange-500/30 hover:to-pink-500/30 transition-all">
                <Edit className="w-4 h-4 text-orange-400" />
              </button>
              <button onClick={() => setShowHistory(true)} className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:from-orange-500/30 hover:to-pink-500/30 transition-all">
                <Clock className="w-4 h-4 text-orange-400" />
                {userOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-[9px] font-bold flex items-center justify-center">{userOrders.length}</span>
                )}
              </button>
              <button onClick={() => setShowCart(true)} className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:from-orange-500/30 hover:to-pink-500/30 transition-all">
                <ShoppingBag className="w-4 h-4 text-orange-400" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-[9px] font-bold flex items-center justify-center">{totalCartItems}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* НЕОНОВАЯ БЕГУЩАЯ СТРОКА - КЛИКАБЕЛЬНАЯ */}
        <div 
          onClick={openChannel}
          className="relative my-3 rounded-xl overflow-hidden cursor-pointer group"
          style={{
            background: 'linear-gradient(90deg, #ff5e00, #ff007f, #ff5e00)',
            backgroundSize: '200% 100%',
            animation: 'gradient-shift 3s ease infinite',
          }}
        >
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all"></div>
          <div className="relative py-2 overflow-hidden">
            <div className="scrolling-banner flex items-center gap-4 text-xs font-bold text-white">
              <Sparkles className="w-4 h-4 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
              <Zap className="w-4 h-4 flex-shrink-0 text-yellow-300 animate-pulse" />
              <span className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">ПОДПИШИСЬ НА @zslvape и следи за НОВИНКАМИ</span>
              <Star className="w-4 h-4 flex-shrink-0 text-yellow-300 animate-ping" style={{ animationDuration: '2s' }} />
              <Sparkles className="w-4 h-4 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.3), 0 0 30px rgba(255, 94, 0, 0.5)',
          }}></div>
        </div>

        <div className="pt-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-3 pl-10 pr-3 text-sm text-white placeholder-gray-500"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-custom">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${
                  selectedCategory === c ? 'glass-button-active text-white' : 'glass-button text-gray-400'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <div className="mb-4 text-xs text-gray-500">
            Найдено: <span className="text-orange-500 font-bold">{sortedProducts.length}</span> товаров
          </div>
          {sortedProducts.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-500 text-sm">Товары не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {sortedProducts.map((p) => {
                const avail = p.variants.reduce((s, f) => s + getAvailableStock(p.id, f.name), 0);
                const isPreorder = p.is_preorder;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      if (isPreorder) {
                        setSelectedPreorderProduct(p);
                        setShowPreorderModal(true);
                      } else if (avail > 0) {
                        openProductModal(p);
                      }
                    }}
                    className={`glass-card p-2 transition-all ${
                      isPreorder 
                        ? 'opacity-60 cursor-pointer hover:opacity-80' 
                        : avail === 0 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer group hover:border-orange-500/30'
                    }`}>
                    <div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-2 flex items-center justify-center relative overflow-hidden product-image-glow">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className={`w-full h-full object-contain p-4 rounded-2xl ${isPreorder ? 'brightness-50' : ''}`} />
                      ) : (
                        <Package className={`w-12 h-12 text-neutral-700 ${isPreorder ? 'opacity-50' : ''}`} />
                      )}
                      {isPreorder && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                          <span className="text-white font-bold text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg border border-white/20">
                            ПРЕДЗАКАЗ
                          </span>
                        </div>
                      )}
                      {!isPreorder && avail === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl">
                          <span className="text-red-400 font-bold text-xs">Нет</span>
                        </div>
                      )}
                      {!isPreorder && avail > 0 && avail <= 3 && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/30">
                          <span className="text-[10px] text-orange-400">{avail} шт.</span>
                        </div>
                      )}
                    </div>
                    <h3 className={`font-semibold text-xs mb-1 line-clamp-2 text-center ${isPreorder ? 'text-gray-400' : 'text-white group-hover:text-orange-400'}`}>
                      {p.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${isPreorder ? 'text-gray-500' : 'gradient-text'}`}>
                        {p.price} BYN
                      </span>
                      <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                        {p.category}
                      </span>
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
            <input type="password" placeholder="Пароль" value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 mb-3 text-sm text-white outline-none focus:border-orange-500" />
            <button onClick={handleAdminLogin} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-bold">Войти</button>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative glass-panel w-full max-w-sm max-h-[90vh] overflow-y-auto relative z-10">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-4 h-4" /></button>
            <div className="p-4">
              {selectedProduct.image ? (
                <div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center overflow-hidden product-image-glow">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-6 rounded-2xl" />
                </div>
              ) : (
                <div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center">
                  <Package className="w-16 h-16 text-neutral-700" />
                </div>
              )}
              <h2 className="text-xl font-bold mb-1 text-center">{selectedProduct.name}</h2>
              <p className="text-2xl font-bold gradient-text mb-4 text-center">{selectedProduct.price} BYN</p>
              {selectedProduct.variants.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium">ВЫБЕРИТЕ ЦВЕТ / ВАРИАНТ:</p>
                    <p className="text-[10px] text-gray-500">{selectedProduct.variants.filter(f => getAvailableStock(selectedProduct.id, f.name) > 0).length} доступно</p>
                  </div>
                  <div className="space-y-1.5">
                    {visibleVariants.map((v, i) => {
                      const avail = getAvailableStock(selectedProduct.id, v.name);
                      const inCart = getCartQuantity(selectedProduct.id, v.name);
                      return (
                        <label key={i} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                          selectedVariant === v.name ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5'
                        } ${avail === 0 ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-2">
                            <input type="radio" name="variant" checked={selectedVariant === v.name}
                              onChange={() => avail > 0 && setSelectedVariant(v.name)} className="w-3.5 h-3.5 accent-orange-500" disabled={avail === 0} />
                            <div><span className="text-xs">{v.name}</span>{inCart > 0 && <span className="ml-1.5 text-[9px] text-orange-400">({inCart} в корзине)</span>}</div>
                          </div>
                          <span className={`text-[10px] font-medium ${avail > 0 ? 'text-green-400' : 'text-red-400'}`}>{avail > 0 ? `${avail} шт.` : 'Нет'}</span>
                        </label>
                      );
                    })}
                  </div>
                  {hiddenVariantsCount > 0 && !showAllVariants && (
                    <button onClick={() => setShowAllVariants(true)} className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-xs">↓ Показать ещё {hiddenVariantsCount}</button>
                  )}
                  {showAllVariants && hiddenVariantsCount > 0 && (
                    <button onClick={() => setShowAllVariants(false)} className="w-full mt-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs">↑ Свернуть</button>
                  )}
                </div>
              )}
              {availableStock > 0 ? (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between glass-card p-3">
                      <span className="text-xs font-medium">Количество:</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                        <span className="text-base font-bold w-6 text-center">{quantity}</span>
                        <button onClick={() => quantity + 1 > availableStock ? showNotification(`Максимум: ${availableStock} шт.`, 'error') : setQuantity(quantity + 1)}
                          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                  <button onClick={addToCart} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm">
                    <ShoppingBag className="w-4 h-4" /> В корзину • {selectedProduct.price * quantity} BYN
                  </button>
                </>
              ) : <div className="w-full py-3 rounded-xl font-bold bg-white/5 text-center text-red-400 text-sm">Нет в наличии</div>}
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
              {cart.length === 0 ? (
                <div className="text-center py-8"><ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Корзина пуста</p></div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    {cart.map((item, i) => {
                      const p = products.find(x => x.id === item.productId);
                      const v = p?.variants.find(x => x.name === item.variant);
                      const maxS = v?.stock || 0;
                      const isMax = item.quantity >= maxS;
                      return (
                        <div key={i} className="glass-card p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1"><h3 className="font-semibold text-xs">{item.productName}</h3><p className="text-[10px] text-gray-400">{item.variant}</p></div>
                            <button onClick={() => removeFromCart(i)} className="w-7 h-7 rounded-md bg-red-500/10 flex items-center justify-center"><Trash2 className="w-3 h-3 text-red-400" /></button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateCartQuantity(i, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                              <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(i, 1)} disabled={isMax} className={`w-7 h-7 rounded-full flex items-center justify-center ${isMax ? 'opacity-30' : 'bg-white/5'}`}><Plus className="w-2.5 h-2.5" /></button>
                            </div>
                            <span className="text-base font-bold gradient-text">{item.price * item.quantity} BYN</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">Итого:</span>
                      <span className="text-xl font-bold gradient-text">{totalCartPrice} BYN</span>
                    </div>
                    <button onClick={checkout} disabled={isCheckingOut}
                      className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
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
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3">
              {userOrders.length === 0 ? (
                <div className="text-center py-8"><Clock className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Заказов нет</p></div>
              ) : (
                <div className="space-y-2">
                  {userOrders.map(o => (
                    <div key={o.id} className="glass-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-sm">Заказ #{o.order_number}</h3>
                          <p className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <span className="text-lg font-bold gradient-text">{o.total_price} BYN</span>
                      </div>
                      <div className="border-t border-white/10 pt-2 space-y-0.5">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-[11px]"><span className="text-gray-300">{item.productName} ({item.variant})</span><span className="text-gray-400">× {item.quantity}</span></div>
                        ))}
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
