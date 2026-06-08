'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, ShieldAlert, ShieldCheck, Shield, Edit, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
  const [products, setProducts] = useState<Product[]>([]);
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

  // Загрузка товаров из Supabase
  const loadProducts = useCallback(async (includeHidden = false) => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!includeHidden) query = query.eq('is_hidden', false);
    
    const { data, error } = await query;
    if (error) { console.error('Ошибка:', error); return; }
    
    if (data && data.length > 0) {
      const parsed = data.map((p: any) => ({
        id: p.id, name: p.name, category: p.category || 'Другое',
        price: Number(p.price), image: p.image_url || null,
        flavors: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.flavors || []),
        is_hidden: p.is_hidden || false, is_preorder: p.is_preorder || false,
      }));
      setProducts(parsed);
    } else {
      // База пустая - показываем пустой список (пользователь сам добавит товары)
      setProducts([]);
    }
  }, []);

  // Загрузка заказов пользователя
  const loadUserOrders = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setUserOrders(data);
  }, [userId]);

  // Загрузка всех заказов для админа
  const loadAllOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setAllOrders(data);
  }, []);

  // Загружаем товары и заказы
  useEffect(() => {
    if (ageVerified) {
      loadProducts(isAdmin);
      if (isAdmin) loadAllOrders();
    }
  }, [ageVerified, isAdmin, loadProducts, loadAllOrders]);

  useEffect(() => { if (userId && ageVerified) loadUserOrders(); }, [userId, ageVerified, loadUserOrders]);

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
      name: editingProduct.name, price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое', image_url: editingProduct.image || null,
      flavors: JSON.stringify(formFlavors), stock_quantity: formFlavors.reduce((s, f) => s + f.stock, 0),
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
  if (ageVerified === null) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="text-gray-500 text-sm">Загрузка...</div></div>;
  
  if (ageDeclined) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-panel p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Доступ запрещён</h1>
        <p className="text-gray-400 text-xs mb-4">Сайт содержит информацию 18+</p>
        <button onClick={() => { localStorage.removeItem('liqvape_age_verified'); setAgeVerified(null); setAgeDeclined(false); }}
          className="w-full py-2 rounded-lg bg-white/5 text-gray-400 text-xs">Пройти проверку снова</button>
      </div>
    </div>
  );

  // АДМИН ПАНЕЛЬ
  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white p-3">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
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

          {/* Вкладки */}
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

              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <h3 className="font-bold text-sm">{p.name}</h3>
                          {p.is_hidden && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Скрыт</span>}
                          {p.is_preorder && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Предзаказ</span>}
                        </div>
                        <p className="text-[11px] text-gray-400">{p.price} BYN • {p.category} • {p.flavors.reduce((s, f) => s + f.stock, 0)} шт.</p>
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
              {/* Фильтры заказов */}
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
                      <div>
                        <h3 className="font-bold text-sm">Заказ #{o.order_number}</h3>
                        <p className="text-[10px] text-gray-400">
                          {new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[9px] text-gray-500 mt-0.5">ID: {o.user_id.slice(0, 8)}...</p>
                      </div>
                      <span className="text-base font-bold gradient-text">{o.total_price} BYN</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mb-2 space-y-0.5">
                      {o.items.map((item, i) => (
                        <p key={i} className="text-[11px] text-gray-300">• {item.productName} ({item.flavor}) × {item.quantity}</p>
                      ))}
                    </div>
                    <div className="flex gap-1">
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

        {/* Форма товара */}
        {showProductForm && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-xl">
            <div className="glass-panel w-full max-w-md max-h-[90vh] overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">{editingProduct.id ? 'Редактирование' : 'Новый товар'}</h2>
                <button onClick={() => setShowProductForm(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input type="text" placeholder="Название" value={editingProduct.name || ''}
                onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 mb-2 text-sm text-white outline-none focus:border-orange-500" />

              <div className="flex gap-2 mb-2">
                <input type="number" placeholder="Цена" value={editingProduct.price || ''}
                  onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-orange-500" />
                <input type="text" placeholder="URL фото" value={editingProduct.image || ''}
                  onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white outline-none focus:border-orange-500" />
              </div>

              <select value={editingProduct.category || 'Другое'}
                onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 mb-3 text-sm text-white outline-none">
                {CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
              </select>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Варианты</label>
                  <span className="text-[10px] text-orange-400">{formFlavors.length} шт.</span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {formFlavors.map((f, i) => (
                    <div key={i} className="flex gap-1">
                      <input type="text" placeholder="Название" value={f.name}
                        onChange={e => { const nf = [...formFlavors]; nf[i].name = e.target.value; setFormFlavors(nf); }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-md p-1.5 text-xs text-white outline-none" />
                      <input type="number" placeholder="Кол-во" value={f.stock}
                        onChange={e => { const nf = [...formFlavors]; nf[i].stock = Number(e.target.value); setFormFlavors(nf); }}
                        className="w-16 bg-black/50 border border-white/10 rounded-md p-1.5 text-xs text-white outline-none" />
                      <button onClick={() => setFormFlavors(formFlavors.filter((_, x) => x !== i))} className="w-8 bg-red-500/20 rounded-md text-red-400 flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setFormFlavors([...formFlavors, { name: '', stock: 0 }])}
                  className="w-full mt-1 py-1.5 rounded-md border border-orange-500/30 text-orange-400 text-xs">
                  + Добавить вариант
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditingProduct({...editingProduct, is_preorder: !editingProduct.is_preorder})}
                  className={`flex-1 py-1.5 rounded-md text-xs ${editingProduct.is_preorder ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>
                  Предзаказ
                </button>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowProductForm(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-xs">Отмена</button>
                <button onClick={saveProduct} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-xs font-bold">Сохранить</button>
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

      <div className="max-w-md mx-auto px-3">
        {/* Header */}
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
              {/* Все кнопки в одном стиле - оранжевый с розовым */}
              <button onClick={() => setShowAdminLogin(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:from-orange-500/30 hover:to-pink-500/30 transition-all">
                <Shield className="w-4 h-4 text-orange-400" />
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

        <div className="pt-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-3 pl-10 pr-3 text-sm text-white placeholder-gray-500"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-custom">
            {CATEGORIES.map((c, i) => (
              <button key={c} onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${
                  selectedCategory === c ? 'glass-button-active text-white' : 'glass-button text-gray-400'
                }`}>
                {c}
              </button>
            ))}
          </div>

          <div className="mb-4 text-xs text-gray-500">
            Найдено: <span className="text-orange-500 font-bold">{filteredProducts.length}</span> товаров
          </div>

          {filteredProducts.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-500 text-sm">Товары не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {filteredProducts.map((p) => {
                const avail = p.flavors.reduce((s, f) => s + getAvailableStock(p.id, f.name), 0);
                return (
                  <div key={p.id} onClick={() => avail > 0 && openProductModal(p)}
                    className={`glass-card p-3 cursor-pointer group ${avail === 0 ? 'opacity-50' : ''}`}>
                    <div className="w-full h-28 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl mb-2 flex items-center justify-center relative">
                      {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-xl" /> :
                        <Package className="w-8 h-8 text-neutral-700" />}
                      {avail === 0 && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl"><span className="text-red-400 font-bold text-xs">Нет</span></div>}
                      {avail > 0 && avail <= 3 && <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/30"><span className="text-[9px] text-orange-400">{avail} шт.</span></div>}
                      {p.is_preorder && <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-pink-500/20 border border-pink-500/30"><span className="text-[9px] text-pink-400">Предзаказ</span></div>}
                    </div>
                    <h3 className="font-semibold text-xs mb-1 line-clamp-2">{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold gradient-text">{p.price} BYN</span>
                      <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">{p.category}</span>
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
          <div className="glass-panel w-full max-w-sm p-5">
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

      {/* Проверка возраста */}
      {ageVerified === false && !ageDeclined && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
              <span className="text-3xl font-bold text-white">18+</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Подтверждение возраста</h2>
            <p className="text-gray-400 text-xs mb-6">Сайт содержит информацию о никотиносодержащей продукции. Подтвердите что вам 18+.</p>
            <div className="space-y-2">
              <button onClick={() => confirmAge(true)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm">
                <ShieldCheck className="w-4 h-4" /> Мне есть 18 лет
              </button>
              <button onClick={() => confirmAge(false)} className="w-full py-3 rounded-xl font-bold bg-white/5 text-gray-400 flex items-center justify-center gap-1.5 text-sm">
                <ShieldAlert className="w-4 h-4" /> Мне нет 18 лет
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка товара */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-4 h-4" /></button>
            <div className="p-4">
              {selectedProduct.image ? <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-40 object-cover rounded-xl mb-3" /> :
                <div className="w-full h-40 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl mb-3 flex items-center justify-center"><Package className="w-12 h-12 text-neutral-700" /></div>}
              <h2 className="text-xl font-bold mb-1">{selectedProduct.name}</h2>
              <p className="text-2xl font-bold gradient-text mb-4">{selectedProduct.price} BYN</p>

              {selectedProduct.flavors.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium">ВЫБЕРИТЕ ВКУС:</p>
                    <p className="text-[10px] text-gray-500">{selectedProduct.flavors.filter(f => getAvailableStock(selectedProduct.id, f.name) > 0).length} доступно</p>
                  </div>
                  <div className="space-y-1.5">
                    {visibleFlavors.map((f, i) => {
                      const avail = getAvailableStock(selectedProduct.id, f.name);
                      const inCart = getCartQuantity(selectedProduct.id, f.name);
                      return (
                        <label key={i} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                          selectedFlavor === f.name ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5'
                        } ${avail === 0 ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-2">
                            <input type="radio" name="flavor" checked={selectedFlavor === f.name}
                              onChange={() => avail > 0 && setSelectedFlavor(f.name)} className="w-3.5 h-3.5 accent-orange-500" disabled={avail === 0} />
                            <div><span className="text-xs">{f.name}</span>{inCart > 0 && <span className="ml-1.5 text-[9px] text-orange-400">({inCart} в корзине)</span>}</div>
                          </div>
                          <span className={`text-[10px] font-medium ${avail > 0 ? 'text-green-400' : 'text-red-400'}`}>{avail > 0 ? `${avail} шт.` : 'Нет'}</span>
                        </label>
                      );
                    })}
                  </div>
                  {hiddenFlavorsCount > 0 && !showAllFlavors && (
                    <button onClick={() => setShowAllFlavors(true)} className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-xs">↓ Показать ещё {hiddenFlavorsCount}</button>
                  )}
                  {showAllFlavors && hiddenFlavorsCount > 0 && (
                    <button onClick={() => setShowAllFlavors(false)} className="w-full mt-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs">↑ Свернуть</button>
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

      {/* Корзина */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCart(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
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
                      const f = p?.flavors.find(x => x.name === item.flavor);
                      const maxS = f?.stock || 0;
                      const isMax = item.quantity >= maxS;
                      return (
                        <div key={i} className="glass-card p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1"><h3 className="font-semibold text-xs">{item.productName}</h3><p className="text-[10px] text-gray-400">{item.flavor}</p></div>
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

      {/* История */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
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
                          <div key={i} className="flex justify-between text-[11px]"><span className="text-gray-300">{item.productName} ({item.flavor})</span><span className="text-gray-400">× {item.quantity}</span></div>
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