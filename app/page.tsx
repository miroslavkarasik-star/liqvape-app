'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, ShieldAlert, ShieldCheck, Shield, Edit, Eye, EyeOff, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const INITIAL_PRODUCTS = [
  { id: 1, name: 'ELFBAR 5000', category: 'Одноразки', price: 15, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: 'Манго', stock: 15 }, { name: 'Виноград', stock: 8 }, { name: 'Холодок', stock: 0 }, { name: 'Яблоко', stock: 12 }, { name: 'Персик', stock: 5 }] },
  { id: 2, name: 'Жидкость Mango Ice 100ml', category: 'Жидкости', price: 8, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: '3mg', stock: 20 }, { name: '6mg', stock: 15 }] },
  { id: 3, name: 'XROS 3 Pod System', category: 'POD-системы', price: 25, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: 'Чёрный', stock: 10 }, { name: 'Серебристый', stock: 8 }, { name: 'Розовый', stock: 5 }] },
  { id: 4, name: 'Снюс Nordic Spirit', category: 'Снюс', price: 3.5, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: 'Мята', stock: 25 }, { name: 'Ягоды', stock: 18 }, { name: 'Кола', stock: 12 }, { name: 'Манго', stock: 9 }] },
  { id: 5, name: 'Кальян Alpha Hookah', category: 'Кальяны', price: 45, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: 'Чёрный матовый', stock: 3 }, { name: 'Белый', stock: 2 }] },
  { id: 6, name: 'Испаритель 0.4ohm', category: 'Расходники', price: 2.5, image: null, is_hidden: false, is_preorder: false,
    flavors: [{ name: 'Стандарт', stock: 50 }] },
];

const CATEGORIES = ['Все', 'POD-системы', 'Жидкости', 'Расходники', 'Снюс', 'Одноразки', 'Кальяны', 'Другое'];
const ADMIN_PASSWORD = 'liqvape67';

interface Flavor { name: string; stock: number; }
interface Product { 
  id: number; name: string; category: string; price: number; image: string | null; 
  flavors: Flavor[]; is_hidden: boolean; is_preorder: boolean;
}
interface CartItem { productId: number; productName: string; flavor: string; price: number; quantity: number; }
interface Order { 
  id: string; user_id: string; order_number: number; order_date: string; 
  items: CartItem[]; total_price: number; status: string; created_at: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void; expand: () => void; close: () => void;
        HapticFeedback: { impactOccurred: (s: string) => void; notificationOccurred: (t: string) => void; };
        initDataUnsafe?: { user?: { id: number; username?: string; first_name?: string; } };
      };
    };
  }
}

export default function Home() {
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);
  const [ageDeclined, setAgeDeclined] = useState(false);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showAllFlavors, setShowAllFlavors] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Админ
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'orders'>('products');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'done'>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [formFlavors, setFormFlavors] = useState<Flavor[]>([]);

  // Telegram
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // Возраст
  useEffect(() => {
    const v = localStorage.getItem('liqvape_age_verified');
    if (v === 'true') setAgeVerified(true);
    else if (v === 'false') { setAgeVerified(false); setAgeDeclined(true); }
    else setAgeVerified(false);
  }, []);

  const confirmAge = (isAdult: boolean) => {
    localStorage.setItem('liqvape_age_verified', isAdult.toString());
    setAgeVerified(isAdult);
    if (!isAdult) setAgeDeclined(true);
  };

  // User ID
  useEffect(() => {
    let id = localStorage.getItem('liqvape_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('liqvape_user_id', id); }
    setUserId(id);
  }, []);

  // Корзина
  useEffect(() => {
    const c = localStorage.getItem('liqvape_cart');
    if (c) { try { setCart(JSON.parse(c)); } catch(e) {} }
  }, []);
  useEffect(() => { localStorage.setItem('liqvape_cart', JSON.stringify(cart)); }, [cart]);

  // Загрузка заказов пользователя
  const loadUserOrders = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setUserOrders(data);
  }, [userId]);

  useEffect(() => { if (userId && ageVerified) loadUserOrders(); }, [userId, ageVerified, loadUserOrders]);

  // Загрузка всех заказов для админа
  const loadAllOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setAllOrders(data);
  }, []);

  // Загрузка товаров из Supabase
  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) {
      const parsed = data.map((p: any) => ({
        ...p,
        flavors: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.flavors || []),
        price: Number(p.price),
      }));
      setProducts(parsed);
    }
  }, []);

  useEffect(() => { if (isAdmin) { loadProducts(); loadAllOrders(); } }, [isAdmin, loadProducts, loadAllOrders]);

  // Уведомления
  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
    }
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getCartQuantity = (productId: number, flavor: string) => {
    const item = cart.find(i => i.productId === productId && i.flavor === flavor);
    return item ? item.quantity : 0;
  };

  const getAvailableStock = useCallback((productId: number, flavor: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const f = product.flavors.find(x => x.name === flavor);
    if (!f) return 0;
    return Math.max(0, f.stock - getCartQuantity(productId, flavor));
  }, [products, cart]);

  const filteredProducts = products.filter(p => {
    if (p.is_hidden && !isAdmin) return false;
    const s = p.name.toLowerCase().includes(search.toLowerCase());
    const c = selectedCategory === 'Все' || p.category === selectedCategory;
    return s && c;
  });

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    const first = product.flavors.find(f => getAvailableStock(product.id, f.name) > 0);
    setSelectedFlavor(first?.name || '');
    setQuantity(1);
    setShowAllFlavors(false);
  };

  const addToCart = () => {
    if (!selectedProduct || !selectedFlavor) return;
    const avail = getAvailableStock(selectedProduct.id, selectedFlavor);
    if (avail <= 0) { showNotification('Нет в наличии', 'error'); return; }
    if (quantity > avail) { showNotification(`Максимум: ${avail} шт.`, 'error'); setQuantity(avail); return; }
    
    const idx = cart.findIndex(i => i.productId === selectedProduct.id && i.flavor === selectedFlavor);
    if (idx >= 0) {
      const nc = [...cart]; nc[idx].quantity += quantity; setCart(nc);
    } else {
      setCart([...cart, { productId: selectedProduct.id, productName: selectedProduct.name, flavor: selectedFlavor, price: selectedProduct.price, quantity }]);
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
    const f = p?.flavors.find(x => x.name === item.flavor);
    const nq = item.quantity + d;
    if (f && nq > f.stock) { showNotification(`Максимум: ${f.stock} шт.`, 'error'); return; }
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
        user_id: userId, order_number: nextNum, order_date: today,
        items: cart, total_price: cart.reduce((s, i) => s + i.price * i.quantity, 0), status: 'new',
      });
      
      if (error) { showNotification('Ошибка заказа', 'error'); setIsCheckingOut(false); return; }
      
      const updated = products.map(p => {
        const ci = cart.filter(i => i.productId === p.id);
        if (ci.length === 0) return p;
        return { ...p, flavors: p.flavors.map(f => {
          const it = ci.find(i => i.flavor === f.name);
          return it ? { ...f, stock: Math.max(0, f.stock - it.quantity) } : f;
        })};
      });
      setProducts(updated);
      const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
      showNotification(`Заказ №${nextNum} оформлен на ${total} BYN!`);
      setCart([]); setShowCart(false);
      await loadUserOrders();
    } catch(e) { showNotification('Ошибка', 'error'); }
    finally { setIsCheckingOut(false); }
  };

  // АДМИН ФУНКЦИИ
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
      setFormFlavors([...product.flavors]);
    } else {
      setEditingProduct({ name: '', price: 0, category: 'Другое', image: null, is_hidden: false, is_preorder: false });
      setFormFlavors([]);
    }
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct.price) { showNotification('Заполните название и цену', 'error'); return; }
    const data = {
      name: editingProduct.name,
      price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое',
      image_url: editingProduct.image || null,
      flavors: JSON.stringify(formFlavors),
      stock_quantity: formFlavors.reduce((s, f) => s + f.stock, 0),
      is_hidden: editingProduct.is_hidden || false,
      is_preorder: editingProduct.is_preorder || false,
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
    await loadProducts();
  };

  const toggleHidden = async (p: Product) => {
    await supabase.from('products').update({ is_hidden: !p.is_hidden }).eq('id', p.id);
    await loadProducts();
    showNotification(p.is_hidden ? 'Товар показан' : 'Товар скрыт');
  };

  const togglePreorder = async (p: Product) => {
    await supabase.from('products').update({ is_preorder: !p.is_preorder }).eq('id', p.id);
    await loadProducts();
    showNotification(p.is_preorder ? 'Предзаказ отключён' : 'Предзаказ включён');
  };

  const deleteProduct = async (id: number) => {
    if (!confirm('Удалить товар?')) return;
    await supabase.from('products').delete().eq('id', id);
    await loadProducts();
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

  const sortedFlavors = useMemo(() => {
    if (!selectedProduct) return [];
    return [...selectedProduct.flavors].sort((a, b) => {
      const aa = getAvailableStock(selectedProduct.id, a.name);
      const ba = getAvailableStock(selectedProduct.id, b.name);
      if (aa > 0 && ba === 0) return -1;
      if (aa === 0 && ba > 0) return 1;
      return 0;
    });
  }, [selectedProduct, getAvailableStock]);

  const visibleFlavors = showAllFlavors ? sortedFlavors : sortedFlavors.slice(0, 5);
  const hiddenFlavorsCount = sortedFlavors.length - 5;
  const availableStock = selectedProduct && selectedFlavor ? getAvailableStock(selectedProduct.id, selectedFlavor) : 0;
  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);
  const totalCartPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const filteredOrders = allOrders.filter(o => {
    if (orderFilter === 'new') return o.status === 'new';
    if (orderFilter === 'done') return o.status === 'done';
    return true;
  });

  // Экраны
  if (ageVerified === null) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-gray-500">Загрузка...</div></div>;
  
  if (ageDeclined) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Доступ запрещён</h1>
        <p className="text-gray-400 text-sm mb-6">Сайт содержит информацию 18+</p>
        <button onClick={() => { localStorage.removeItem('liqvape_age_verified'); setAgeVerified(null); setAgeDeclined(false); }}
          className="w-full py-3 rounded-xl bg-white/5 text-gray-400 text-sm">Пройти проверку снова</button>
      </div>
    </div>
  );

  // АДМИН ПАНЕЛЬ
  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                <Cloud className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Liq<span className="text-orange-500">Vape</span></h1>
                <p className="text-xs text-gray-500">Админ панель</p>
              </div>
            </div>
            <button onClick={() => { setShowAdminPanel(false); setIsAdmin(false); }} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Вкладки */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setAdminTab('orders')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${adminTab === 'orders' ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-white/5 text-gray-400'}`}>
              Заказы ({allOrders.length})
            </button>
            <button onClick={() => setAdminTab('products')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Товары ({products.length})
            </button>
          </div>

          {adminTab === 'products' ? (
            <>
              <button onClick={() => openProductForm()}
                className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 mb-4 flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> Добавить товар
              </button>

              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{p.name}</h3>
                          {p.is_hidden && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Скрыт</span>}
                          {p.is_preorder && <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">Предзаказ</span>}
                        </div>
                        <p className="text-sm text-gray-400">{p.price} BYN • {p.category} • {p.flavors.reduce((s, f) => s + f.stock, 0)} шт.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openProductForm(p)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm flex items-center justify-center gap-1">
                        <Edit className="w-4 h-4" /> Изменить
                      </button>
                      <button onClick={() => toggleHidden(p)} className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1 ${p.is_hidden ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {p.is_hidden ? <><Eye className="w-4 h-4" /> Показать</> : <><EyeOff className="w-4 h-4" /> Скрыть</>}
                      </button>
                      <button onClick={() => togglePreorder(p)} className={`flex-1 py-2 rounded-lg text-sm ${p.is_preorder ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-gray-400'}`}>
                        Предзаказ
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="w-10 py-2 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Фильтры заказов */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => setOrderFilter('all')} className={`flex-1 py-2 rounded-lg text-sm ${orderFilter === 'all' ? 'bg-orange-500' : 'bg-white/5'}`}>
                  Все ({allOrders.length})
                </button>
                <button onClick={() => setOrderFilter('new')} className={`flex-1 py-2 rounded-lg text-sm ${orderFilter === 'new' ? 'bg-orange-500' : 'bg-white/5'}`}>
                  Новые ({allOrders.filter(o => o.status === 'new').length})
                </button>
                <button onClick={() => setOrderFilter('done')} className={`flex-1 py-2 rounded-lg text-sm ${orderFilter === 'done' ? 'bg-orange-500' : 'bg-white/5'}`}>
                  Выданные ({allOrders.filter(o => o.status === 'done').length})
                </button>
              </div>

              <div className="space-y-3">
                {filteredOrders.map(o => (
                  <div key={o.id} className="glass-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">Заказ #{o.order_number}</h3>
                        <p className="text-xs text-gray-400">
                          {new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">ID: {o.user_id.slice(0, 8)}...</p>
                      </div>
                      <span className="text-xl font-bold gradient-text">{o.total_price} BYN</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 mb-3 space-y-1">
                      {o.items.map((item, i) => (
                        <p key={i} className="text-sm text-gray-300">• {item.productName} ({item.flavor}) × {item.quantity}</p>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => updateOrderStatus(o.id, o.status === 'done' ? 'new' : 'done')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${o.status === 'done' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {o.status === 'done' ? 'Вернуть в новые' : '✓ Выдан'}
                      </button>
                      <button onClick={() => deleteOrder(o.id)} className="w-12 py-2 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <div className="glass-panel p-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Заказов нет</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Форма товара */}
        {showProductForm && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <div className="glass-panel w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{editingProduct.id ? 'Редактирование' : 'Новый товар'}</h2>
                <button onClick={() => setShowProductForm(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input type="text" placeholder="Название" value={editingProduct.name || ''}
                onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-white outline-none focus:border-orange-500" />

              <div className="flex gap-2 mb-3">
                <input type="number" placeholder="Цена" value={editingProduct.price || ''}
                  onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-orange-500" />
                <input type="text" placeholder="URL фото" value={editingProduct.image || ''}
                  onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-orange-500" />
              </div>

              <select value={editingProduct.category || 'Другое'}
                onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-white outline-none">
                {CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
              </select>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Варианты (вкусы/цвета)</label>
                  <span className="text-xs text-orange-400">{formFlavors.length} шт.</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {formFlavors.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input type="text" placeholder="Название" value={f.name}
                        onChange={e => { const nf = [...formFlavors]; nf[i].name = e.target.value; setFormFlavors(nf); }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white outline-none" />
                      <input type="number" placeholder="Кол-во" value={f.stock}
                        onChange={e => { const nf = [...formFlavors]; nf[i].stock = Number(e.target.value); setFormFlavors(nf); }}
                        className="w-20 bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white outline-none" />
                      <button onClick={() => setFormFlavors(formFlavors.filter((_, x) => x !== i))} className="w-10 bg-red-500/20 rounded-lg text-red-400 flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFormFlavors([...formFlavors, { name: '', stock: 0 }])}
                  className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-sm">
                  + Добавить вариант
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditingProduct({...editingProduct, is_preorder: !editingProduct.is_preorder})}
                  className={`flex-1 py-2 rounded-lg text-sm ${editingProduct.is_preorder ? 'bg-orange-500' : 'bg-white/5'}`}>
                  Предзаказ
                </button>
              </div>

              <div className="flex gap-2 mt-6">
                <button onClick={() => setShowProductForm(false)} className="flex-1 py-3 rounded-xl bg-white/5">Отмена</button>
                <button onClick={saveProduct} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 font-bold">Сохранить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ОСНОВНОЙ ИНТЕРФЕЙС
  return (
    <div className="min-h-screen text-white relative">
      {/* Уведомление */}
      {notification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className={`w-full max-w-[280px] rounded-2xl p-4 backdrop-blur-2xl border shadow-2xl transition-all duration-300 ${
            notificationVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          } ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${notification.type === 'error' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>
                {notification.type === 'error' ? <AlertCircle className="w-6 h-6 text-red-300" /> : <CheckCircle className="w-6 h-6 text-green-300" />}
              </div>
              <p className={`text-sm font-medium ${notification.type === 'error' ? 'text-red-100' : 'text-green-100'}`}>{notification.message}</p>
              <div className="w-full h-0.5 rounded-full bg-white/10 mt-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-[2500ms] ease-linear ${notification.type === 'error' ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: notificationVisible ? '0%' : '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow">
              <Cloud className="w-7 h-7 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1>
              <p className="text-xs text-gray-500 mt-0.5">premium shop</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setShowAdminLogin(true)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Shield className="w-5 h-5 text-gray-400" />
              </button>
              <button onClick={() => setShowHistory(true)} className="relative w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-400" />
                {userOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-xs font-bold flex items-center justify-center">{userOrders.length}</span>
                )}
              </button>
              <button onClick={() => setShowCart(true)} className="relative w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-gray-400" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-xs font-bold flex items-center justify-center">{totalCartItems}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-4 pl-12 pr-4 text-white placeholder-gray-500"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-custom">
            {CATEGORIES.map((c, i) => (
              <button key={c} onClick={() => setSelectedCategory(c)}
                className={`px-6 py-3 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  selectedCategory === c ? 'glass-button-active text-white' : 'glass-button text-gray-400'
                }`} style={{ animationDelay: `${i * 0.05}s` }}>
                {c}
              </button>
            ))}
          </div>

          <div className="mb-6 text-sm text-gray-500">
            Найдено: <span className="text-orange-500 font-bold">{filteredProducts.length}</span> товаров
          </div>

          {filteredProducts.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-gray-500">Товары не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 pb-8">
              {filteredProducts.map((p, i) => {
                const avail = p.flavors.reduce((s, f) => s + getAvailableStock(p.id, f.name), 0);
                return (
                  <div key={p.id} onClick={() => avail > 0 && openProductModal(p)}
                    className={`glass-card p-4 cursor-pointer group ${avail === 0 ? 'opacity-50' : ''}`}>
                    <div className="w-full h-36 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-3 flex items-center justify-center relative">
                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-2xl" /> :
                        <Package className="w-10 h-10 text-neutral-700" />}
                      {avail === 0 && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl"><span className="text-red-400 font-bold text-sm">Нет</span></div>}
                      {avail > 0 && avail <= 3 && <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30"><span className="text-xs text-orange-400">{avail} шт.</span></div>}
                      {p.is_preorder && <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-pink-500/20 border border-pink-500/30"><span className="text-xs text-pink-400">Предзаказ</span></div>}
                    </div>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold gradient-text">{p.price} BYN</span>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{p.category}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Вход админа */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Вход для админа</h2>
              <button onClick={() => setShowAdminLogin(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <input type="password" placeholder="Пароль" value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-4 text-white outline-none focus:border-orange-500" />
            <button onClick={handleAdminLogin} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 font-bold">Войти</button>
          </div>
        </div>
      )}

      {/* Проверка возраста */}
      {ageVerified === false && !ageDeclined && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
              <span className="text-4xl font-bold text-white">18+</span>
            </div>
            <h2 className="text-2xl font-bold mb-3">Подтверждение возраста</h2>
            <p className="text-gray-400 text-sm mb-8">Сайт содержит информацию о никотиносодержащей продукции. Подтвердите что вам 18+.</p>
            <div className="space-y-3">
              <button onClick={() => confirmAge(true)} className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Мне есть 18 лет
              </button>
              <button onClick={() => confirmAge(false)} className="w-full py-4 rounded-2xl font-bold bg-white/5 text-gray-400 flex items-center justify-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Мне нет 18 лет
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка товара */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-5 h-5" /></button>
            <div className="p-6">
              {selectedProduct.image ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-48 object-cover rounded-2xl mb-4" /> :
                <div className="w-full h-48 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center"><Package className="w-16 h-16 text-neutral-700" /></div>}
              <h2 className="text-2xl font-bold mb-2">{selectedProduct.name}</h2>
              <p className="text-3xl font-bold gradient-text mb-6">{selectedProduct.price} BYN</p>

              {selectedProduct.flavors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-400 font-medium">ВЫБЕРИТЕ ВКУС:</p>
                    <p className="text-xs text-gray-500">{selectedProduct.flavors.filter(f => getAvailableStock(selectedProduct.id, f.name) > 0).length} доступно</p>
                  </div>
                  <div className="space-y-2">
                    {visibleFlavors.map((f, i) => {
                      const avail = getAvailableStock(selectedProduct.id, f.name);
                      const inCart = getCartQuantity(selectedProduct.id, f.name);
                      return (
                        <label key={i} className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer ${
                          selectedFlavor === f.name ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5'
                        } ${avail === 0 ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <input type="radio" name="flavor" checked={selectedFlavor === f.name}
                              onChange={() => avail > 0 && setSelectedFlavor(f.name)} className="w-4 h-4 accent-orange-500" disabled={avail === 0} />
                            <div><span className="text-sm">{f.name}</span>{inCart > 0 && <span className="ml-2 text-xs text-orange-400">({inCart} в корзине)</span>}</div>
                          </div>
                          <span className={`text-xs font-medium ${avail > 0 ? 'text-green-400' : 'text-red-400'}`}>{avail > 0 ? `${avail} шт.` : 'Нет'}</span>
                        </label>
                      );
                    })}
                  </div>
                  {hiddenFlavorsCount > 0 && !showAllFlavors && (
                    <button onClick={() => setShowAllFlavors(true)} className="w-full mt-3 py-3 rounded-xl border border-orange-500/30 text-orange-400 text-sm">↓ Показать ещё {hiddenFlavorsCount}</button>
                  )}
                  {showAllFlavors && hiddenFlavorsCount > 0 && (
                    <button onClick={() => setShowAllFlavors(false)} className="w-full mt-3 py-3 rounded-xl border border-white/10 text-gray-400 text-sm">↑ Свернуть</button>
                  )}
                </div>
              )}

              {availableStock > 0 ? (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between glass-card p-4">
                      <span className="text-sm font-medium">Количество:</span>
                      <div className="flex items-center gap-4">
                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                        <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                        <button onClick={() => quantity + 1 > availableStock ? showNotification(`Максимум: ${availableStock} шт.`, 'error') : setQuantity(quantity + 1)}
                          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                  <button onClick={addToCart} className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2">
                    <ShoppingBag className="w-5 h-5" /> В корзину • {selectedProduct.price * quantity} BYN
                  </button>
                </>
              ) : <div className="w-full py-4 rounded-2xl font-bold bg-white/5 text-center text-red-400">Нет в наличии</div>}
            </div>
          </div>
        </div>
      )}

      {/* Корзина */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCart(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Корзина</h2>
              <div className="flex items-center gap-2">
                {cart.length > 0 && <button onClick={clearCart} className="text-xs text-red-400">Очистить</button>}
                <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12"><ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-700" /><p className="text-gray-500">Корзина пуста</p></div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cart.map((item, i) => {
                      const p = products.find(x => x.id === item.productId);
                      const f = p?.flavors.find(x => x.name === item.flavor);
                      const maxS = f?.stock || 0;
                      const isMax = item.quantity >= maxS;
                      return (
                        <div key={i} className="glass-card p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1"><h3 className="font-semibold text-sm">{item.productName}</h3><p className="text-xs text-gray-400">{item.flavor}</p></div>
                            <button onClick={() => removeFromCart(i)} className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-400" /></button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button onClick={() => updateCartQuantity(i, -1)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                              <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(i, 1)} disabled={isMax} className={`w-8 h-8 rounded-full flex items-center justify-center ${isMax ? 'opacity-30' : 'bg-white/5'}`}><Plus className="w-3 h-3" /></button>
                            </div>
                            <span className="text-lg font-bold gradient-text">{item.price * item.quantity} BYN</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400">Итого:</span>
                      <span className="text-2xl font-bold gradient-text">{totalCartPrice} BYN</span>
                    </div>
                    <button onClick={checkout} disabled={isCheckingOut}
                      className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 disabled:opacity-50">
                      {isCheckingOut ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Оформление...</> : <><ShoppingBag className="w-5 h-5" />Оформить заказ</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* История */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">История заказов</h2>
              <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {userOrders.length === 0 ? (
                <div className="text-center py-12"><Clock className="w-16 h-16 mx-auto mb-4 text-gray-700" /><p className="text-gray-500">Заказов нет</p></div>
              ) : (
                <div className="space-y-4">
                  {userOrders.map(o => (
                    <div key={o.id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg">Заказ #{o.order_number}</h3>
                          <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <span className="text-xl font-bold gradient-text">{o.total_price} BYN</span>
                      </div>
                      <div className="border-t border-white/10 pt-3 space-y-1">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm"><span className="text-gray-300">{item.productName} ({item.flavor})</span><span className="text-gray-400">× {item.quantity}</span></div>
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

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}