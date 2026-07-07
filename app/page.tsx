'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Edit, Settings, HelpCircle, Info, LogIn, User, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

const CATEGORIES = ['Все', 'Жидкости', 'Расходники', 'Снюс', 'POD-системы', 'Одноразки', 'Другое'];
const ADMIN_PASSWORD = 'K7m2Q9';
const MANAGER_USERNAME = 'LiqVape_2';
const CHANNEL_USERNAME = 'zslvape';

interface Variant { name: string; stock: number; price?: number; }
interface Product { 
  id: string; name: string; category: string; price: number; image: string | null; 
  variants: Variant[]; is_hidden: boolean; is_preorder: boolean;
}
interface ListItem { productId: string; productName: string; variant: string; price: number; quantity: number; isPreorder: boolean; }

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Все');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<{ name: string; quantity: number }[]>([]);
  const [showAllVariants, setShowAllVariants] = useState(false);
  const [selectionList, setSelectionList] = useState<ListItem[]>([]);
  const [showList, setShowList] = useState(false);
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> & { id?: string } | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  useEffect(() => {
    const hasSeen = localStorage.getItem('liqvape_seen_subscribe');
    if (!hasSeen) { setShowSubscribePrompt(true); localStorage.setItem('liqvape_seen_subscribe', 'true'); }
  }, []);

  const handleSubscribe = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/${CHANNEL_USERNAME}`);
    } else { window.open(`https://t.me/${CHANNEL_USERNAME}`, '_blank'); }
    setTimeout(() => setShowSubscribePrompt(false), 1000);
  };

  useEffect(() => {
    let id = localStorage.getItem('liqvape_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('liqvape_user_id', id); }
    setUserId(id);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('liqvape_admin_session');
    if (session === 'true') { setIsAdmin(true); setShowAdminPanel(true); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('liqvape_selection_list');
    if (saved) { try { setSelectionList(JSON.parse(saved)); } catch(e) {} }
  }, []);
  useEffect(() => { localStorage.setItem('liqvape_selection_list', JSON.stringify(selectionList)); }, [selectionList]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await supabase.from('user_profiles').select('username').eq('user_id', userId).single();
      if (data?.username) { setUsername(data.username); }
      else { setShowUsernamePrompt(true); }
    };
    load();
  }, [userId]);

  const saveUsername = async (name: string) => {
    if (!name.trim()) return;
    await supabase.from('user_profiles').upsert({ user_id: userId, username: name.trim() }, { onConflict: 'user_id' });
    setUsername(name.trim());
    setShowUsernamePrompt(false);
  };

  const loadProducts = useCallback(async (includeHidden = false): Promise<Product[]> => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query;
    
    if (error) { console.error('Load error:', error); return []; }
    
    const parsed: Product[] = (data || []).map((p: any) => {
      let variants: Variant[] = [];
      
      try {
        if (p.flavors) {
          let parsedFlavors = p.flavors;
          if (typeof p.flavors === 'string') {
            parsedFlavors = JSON.parse(p.flavors);
          }
          
          if (Array.isArray(parsedFlavors)) {
            variants = parsedFlavors.map((v: any) => ({
              name: String(v.name || ''),
              stock: Number(v.stock) || 0,
              price: v.price ? Number(v.price) : undefined
            }));
          }
        }
      } catch (e) { console.error('Parse error:', e); }
      
      const totalStock = variants.reduce((s, v) => s + v.stock, 0);
      console.log(`✅ Loaded: "${p.name}" | Variants: ${variants.length} | Total stock: ${totalStock}`, variants);
      
      return {
        id: String(p.id),
        name: p.name,
        category: p.category || 'Другое',
        price: Number(p.price),
        image: p.image_url || null,
        variants,
        is_hidden: Boolean(p.is_hidden),
        is_preorder: Boolean(p.is_preorder),
      };
    });
    
    setProducts(parsed);
    return parsed;
  }, []);

  useEffect(() => {
    loadProducts(isAdmin);
  }, [isAdmin, loadProducts]);

  useEffect(() => {
    const channel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadProducts(isAdmin))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadProducts]);

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
    }
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getAvailableStock = (productId: string, variant: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const v = product.variants.find(x => x.name === variant);
    if (!v) return 0;
    return v.stock;
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategory === 'Все' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

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
      if (newQty > avail && !selectedProduct.is_preorder) { showNotification(`Максимум: ${avail}`, 'error'); return v; }
      return { ...v, quantity: newQty };
    }));
  };

  const addSelectedToList = () => {
    if (!selectedProduct || selectedVariants.length === 0) { showNotification('Выберите вкус', 'error'); return; }
    
    const issues: string[] = [];
    for (const sv of selectedVariants) {
      const avail = getAvailableStock(selectedProduct.id, sv.name);
      if (avail <= 0 && !selectedProduct.is_preorder) issues.push(`${sv.name} — нет в наличии`);
      else if (sv.quantity > avail && !selectedProduct.is_preorder) issues.push(`${sv.name} — максимум ${avail}`);
    }
    if (issues.length > 0) { showNotification(issues.join('; '), 'error'); return; }

    let newList = [...selectionList];
    for (const sv of selectedVariants) {
      const v = selectedProduct.variants.find(x => x.name === sv.name);
      const price = v?.price || selectedProduct.price;
      const idx = newList.findIndex(i => i.productId === selectedProduct.id && i.variant === sv.name);
      if (idx >= 0) {
        newList[idx] = { ...newList[idx], quantity: newList[idx].quantity + sv.quantity, price };
      } else {
        newList.push({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          variant: sv.name,
          price,
          quantity: sv.quantity,
          isPreorder: selectedProduct.is_preorder
        });
      }
    }
    setSelectionList(newList);
    showNotification(`Добавлено: ${selectedProduct.name}`);
    setSelectedProduct(null);
    setSelectedVariants([]);
  };

  const removeFromList = (i: number) => setSelectionList(selectionList.filter((_, x) => x !== i));
  
  const updateListQuantity = (i: number, d: number) => {
    const item = selectionList[i];
    const p = products.find(x => x.id === item.productId);
    const v = p?.variants.find(x => x.name === item.variant);
    const nq = item.quantity + d;
    if (v && nq > v.stock && !item.isPreorder) { showNotification(`Максимум: ${v.stock}`, 'error'); return; }
    if (nq <= 0) setSelectionList(selectionList.filter((_, x) => x !== i));
    else { const nl = [...selectionList]; nl[i].quantity = nq; setSelectionList(nl); }
  };

  const clearList = () => { if (confirm('Очистить?')) { setSelectionList([]); showNotification('Список очищен'); } };

  const sendToManager = async () => {
    if (selectionList.length === 0 || !username) return;
    setIsSending(true);
    try {
      const totalPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);
      
      let message = `Привет! Хочу заказать:\n\n`;
      const grouped: Record<string, ListItem[]> = {};
      selectionList.forEach(item => {
        if (!grouped[item.productName]) grouped[item.productName] = [];
        grouped[item.productName].push(item);
      });
      
      for (const [name, items] of Object.entries(grouped)) {
        message += `🧃 ${name}\n`;
        for (const item of items) {
          const tag = item.isPreorder ? ' [ПРЕДЗАКАЗ]' : '';
          message += `  • ${item.variant} × ${item.quantity}${tag}\n`;
        }
      }
      message += `\n💰 Итого: ${totalPrice.toFixed(2)} BYN`;
      message += `\n👤 ${username}`;
      
      const link = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(message)}`;
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(link);
      } else { window.open(link, '_blank'); }
      
      setSelectionList([]);
      setShowList(false);
      setShowSendConfirm(false);
      showNotification('Заявка отправлена!', 'success');
    } catch(e) {
      showNotification('Ошибка: ' + (e as Error).message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setShowAdminPanel(true);
      setAdminPassword('');
      localStorage.setItem('liqvape_admin_session', 'true');
      showNotification('Вход выполнен');
    } else { showNotification('Неверный пароль', 'error'); }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    localStorage.removeItem('liqvape_admin_session');
  };

  const openProductForm = (product?: Product) => {
    if (product) {
      setEditingProduct({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        image: product.image,
        is_hidden: product.is_hidden,
        is_preorder: product.is_preorder
      });
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
      name: editingProduct.name,
      price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое',
      image_url: editingProduct.image || null,
      flavors: JSON.stringify(formVariants),
      stock_quantity: formVariants.reduce((s, f) => s + f.stock, 0),
      is_hidden: editingProduct.is_hidden || false,
      is_preorder: editingProduct.is_preorder || false,
    };
    
    if (editingProduct.id) {
      const { error } = await supabase.from('products').update(data).eq('id', editingProduct.id);
      if (error) { showNotification('Ошибка: ' + error.message, 'error'); return; }
      showNotification('Товар обновлён');
    } else {
      const { error } = await supabase.from('products').insert(data);
      if (error) { showNotification('Ошибка: ' + error.message, 'error'); return; }
      showNotification('Товар добавлен');
    }
    setShowProductForm(false);
    setEditingProduct(null);
    await loadProducts(true);
  };

  const toggleHidden = async (p: Product) => {
    await supabase.from('products').update({ is_hidden: !p.is_hidden }).eq('id', p.id);
    await loadProducts(true);
  };

  const togglePreorder = async (p: Product) => {
    await supabase.from('products').update({ is_preorder: !p.is_preorder }).eq('id', p.id);
    await loadProducts(true);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Удалить товар?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { showNotification('Ошибка удаления: ' + error.message, 'error'); return; }
    await loadProducts(true);
    showNotification('Товар удалён');
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
  }, [selectedProduct]);

  const visibleVariants = showAllVariants ? sortedVariants : sortedVariants.slice(0, 5);
  const hiddenVariantsCount = sortedVariants.length - 5;
  const totalListItems = selectionList.reduce((s, i) => s + i.quantity, 0);
  const totalListPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);

  // ============ РЕНДЕРИНГ ============
  return (
    <div className="min-h-screen text-white relative bg-black">
      <style jsx global>{`
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(255, 94, 0, 0.5); } 50% { box-shadow: 0 0 40px rgba(255, 94, 0, 0.8); } }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        .glass-panel { background: rgba(30, 30, 30, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 1.5rem; }
        .glass-card { background: rgba(40, 40, 40, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; transition: all 0.3s ease; }
        .glass-card:hover { background: rgba(50, 50, 50, 0.8); border-color: rgba(255, 94, 0, 0.4); transform: translateY(-2px); }
        .gradient-text { background: linear-gradient(135deg, #ff5e00, #ff1493); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      `}</style>

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

      {showSubscribePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button onClick={() => setShowSubscribePrompt(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5"><X className="w-4 h-4 text-gray-400" /></button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><Send className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Подпишись на канал</h2>
            <button onClick={handleSubscribe} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white mb-2">Подписаться</button>
            <button onClick={() => setShowSubscribePrompt(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Продолжить</button>
          </div>
        </div>
      )}

      {showUsernamePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 relative z-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><User className="w-8 h-8 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2 text-center">Как к тебе обращаться?</h2>
            <p className="text-gray-400 text-xs mb-4 text-center">Введи свой Telegram username (без @)</p>
            <input type="text" placeholder="username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveUsername(usernameInput)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm text-white" />
            <button onClick={() => saveUsername(usernameInput)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Сохранить</button>
          </div>
        </div>
      )}

      {showSendConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><Send className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Отправить заявку?</h2>
            <p className="text-gray-400 text-xs mb-4">Тебя перекинет в Telegram с готовым списком</p>
            <div className="glass-card p-3 mb-4 text-left">
              <p className="text-xs text-gray-400 mb-1">Товаров: <span className="text-white font-bold">{totalListItems}</span></p>
              <p className="text-xs text-gray-400">Сумма: <span className="gradient-text font-bold">{totalListPrice.toFixed(2)} BYN</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSendConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400">Отмена</button>
              <button onClick={sendToManager} disabled={isSending} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white disabled:opacity-50">{isSending ? '...' : 'Отправить'}</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Настройки</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setShowSettings(false); setShowUsernamePrompt(true); setUsernameInput(username); }} className="w-full glass-card p-3 flex items-center gap-3 text-left hover:bg-white/5 transition-all">
                <User className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">Сменить username</p><p className="text-[10px] text-gray-400">@{username}</p></div>
              </button>
              <button onClick={() => { setShowSettings(false); setShowAdminLogin(true); }} className="w-full glass-card p-3 flex items-center gap-3 text-left hover:bg-white/5 transition-all">
                <LogIn className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">Вход в админку</p></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Вход для админа</h2>
              <button onClick={() => setShowAdminLogin(false)} className="w-8 h-8 rounded-full bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <input type="password" placeholder="Пароль" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 mb-3 text-sm text-white" />
            <button onClick={handleAdminLogin} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-bold">Войти</button>
          </div>
        </div>
      )}

      {showAdminPanel && (
        <div className="min-h-screen bg-black text-white p-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow">
                  <Cloud className="w-5 h-5 text-white" />
                </div>
                <div><h1 className="text-xl font-bold">Liq<span className="text-orange-500">Vape</span></h1><p className="text-[10px] text-gray-500">Админ панель</p></div>
              </div>
              <button onClick={handleAdminLogout} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <button onClick={() => openProductForm()} className="w-full py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 mb-3 flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Добавить товар</button>
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="glass-card p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-sm">{p.name}</h3>
                      <p className="text-[11px] text-gray-400">{p.price} BYN • {p.variants.reduce((s, v) => s + v.stock, 0)} шт. • {p.variants.length} вкусов</p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => openProductForm(p)} className="flex-1 py-1.5 rounded-md bg-white/5 text-[10px] flex items-center justify-center gap-1"><Edit className="w-3 h-3" /> Изменить</button>
                    <button onClick={() => toggleHidden(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_hidden ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{p.is_hidden ? 'Показать' : 'Скрыть'}</button>
                    <button onClick={() => togglePreorder(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_preorder ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5'}`}>Предзаказ</button>
                    <button onClick={() => deleteProduct(p.id)} className="w-10 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
            </div>
            {showProductForm && editingProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-xl">
                <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-bold gradient-text">{editingProduct.id ? 'Редактирование' : 'Новый товар'}</h2>
                    <button onClick={() => setShowProductForm(false)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block">Название товара</label>
                    <input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white" />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1.5 block">Цена (BYN)</label>
                    <input type="number" value={editingProduct.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white" />
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-gray-400">Варианты (вкус/название)</label>
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">{formVariants.length} шт.</span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {formVariants.map((v, i) => (
                        <div key={i} className="flex gap-2 items-center bg-black/30 rounded-xl p-2">
                          <input type="text" placeholder="Название" value={v.name} onChange={e => { const nv = [...formVariants]; nv[i].name = e.target.value; setFormVariants(nv); }} className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs text-white" />
                          <input type="number" placeholder="Кол-во" value={v.stock} onChange={e => { const nv = [...formVariants]; nv[i].stock = Number(e.target.value); setFormVariants(nv); }} className="w-20 bg-transparent border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center" />
                          <button onClick={() => setFormVariants(formVariants.filter((_, x) => x !== i))} className="w-9 h-9 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setFormVariants([...formVariants, { name: '', stock: 0 }])} className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-orange-500/30 text-orange-400 text-xs font-medium flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Добавить вариант</button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowProductForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-300">Отмена</button>
                    <button onClick={saveProduct} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold">Сохранить</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-3 relative z-10 pb-24">
        <div className="sticky top-0 z-40 -mx-3 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow"><Cloud className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <div><h1 className="text-2xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1><p className="text-[10px] text-gray-500">premium shop</p></div>
            <div className="ml-auto">
              <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><Settings className="w-4 h-4 text-orange-400" /></button>
            </div>
          </div>
        </div>

        <div className="pt-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-3 pl-10 pr-3 text-sm text-white" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {CATEGORIES.map((c) => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium ${selectedCategory === c ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>{c}</button>))}
          </div>
          <div className="mb-4 text-xs text-gray-500">Найдено: <span className="text-orange-500 font-bold">{filteredProducts.length}</span> товаров</div>
          {filteredProducts.length === 0 ? (
            <div className="glass-panel p-8 text-center"><Package className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Товары не найдены</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-8">
              {filteredProducts.map((p) => {
                const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                const isAvailable = totalStock > 0 || p.is_preorder;
                const inList = selectionList.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={p.id} onClick={() => isAvailable && openProductModal(p)} className={`glass-card p-3 transition-all ${isAvailable ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20' : 'opacity-40 cursor-not-allowed'}`}>
                    <div className="w-full aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden border border-white/10">
                      {p.image ? (<img src={p.image} alt={p.name} className="w-full h-full object-contain p-4 rounded-2xl" />) : (<Package className="w-12 h-12 text-neutral-600" />)}
                      {p.is_preorder && (<div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold">ПРЕДЗАКАЗ</div>)}
                    </div>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-center text-white leading-tight">{p.name}</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-bold gradient-text">{p.price} BYN</span>
                      <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded-full">{p.category}</span>
                    </div>
                    {inList > 0 ? (
                      <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/40 text-orange-400 text-xs font-bold text-center">🛒 в списке: {inList}</div>
                    ) : (
                      <div className={`w-full py-2.5 rounded-xl text-xs font-bold text-center ${isAvailable ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white/5 text-gray-500'}`}>
                        {isAvailable ? (p.is_preorder ? '📦 Предзаказ' : '➕ Выбрать') : '❌ Нет в наличии'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }}></div>
          <div className="relative glass-panel w-full max-w-sm max-h-[90vh] overflow-y-auto relative z-10">
            <button onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-4 h-4" /></button>
            <div className="p-4">
              {selectedProduct.image && (<div className="w-full aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl mb-4 flex items-center justify-center border border-white/10"><img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-6 rounded-2xl" /></div>)}
              <h2 className="text-xl font-bold mb-1 text-center">{selectedProduct.name}</h2>
              {selectedProduct.is_preorder && (<div className="text-center mb-2"><span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">ПРЕДЗАКАЗ</span></div>)}
              <p className="text-sm text-gray-400 mb-4 text-center">Выберите вкусы и количество</p>
              {sortedVariants.length > 0 && (
                <div className="mb-4">
                  <div className="space-y-1.5">
                    {visibleVariants.map((v) => {
                      const avail = getAvailableStock(selectedProduct.id, v.name);
                      const isSelected = selectedVariants.some(sv => sv.name === v.name);
                      const selectedQty = selectedVariants.find(sv => sv.name === v.name)?.quantity || 1;
                      const isAvailable = avail > 0 || selectedProduct.is_preorder;
                      return (
                        <div key={v.name} className={`rounded-lg border transition-all ${isSelected ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5 bg-white/5'} ${!isAvailable ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between p-2.5">
                            <div className="flex items-center gap-2 flex-1">
                              <input type="checkbox" checked={isSelected} onChange={() => isAvailable && toggleVariantSelection(v.name)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer" disabled={!isAvailable} />
                              <div>
                                <span className="text-xs font-medium">{v.name}</span>
                                <span className="text-[10px] text-gray-400 ml-2">{v.price || selectedProduct.price} BYN</span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-medium ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>{isAvailable ? `${avail} шт.` : 'Нет'}</span>
                          </div>
                          {isSelected && isAvailable && (
                            <div className="flex items-center justify-between px-2.5 pb-2.5 border-t border-white/5 pt-2">
                              <span className="text-[10px] text-gray-400">Количество:</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateVariantQuantity(v.name, -1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                                <span className="text-xs font-bold w-6 text-center">{selectedQty}</span>
                                <button onClick={() => updateVariantQuantity(v.name, 1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {hiddenVariantsCount > 0 && !showAllVariants && (<button onClick={() => setShowAllVariants(true)} className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-xs">↓ Ещё {hiddenVariantsCount}</button>)}
                  {showAllVariants && hiddenVariantsCount > 0 && (<button onClick={() => setShowAllVariants(false)} className="w-full mt-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs">↑ Свернуть</button>)}
                </div>
              )}
              {selectedVariants.length > 0 ? (
                <button onClick={addSelectedToList} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">
                  ➕ В список • {selectedVariants.reduce((s, sv) => { const v = selectedProduct.variants.find(x => x.name === sv.name); const price = v?.price || selectedProduct.price; return s + price * sv.quantity; }, 0)} BYN
                </button>
              ) : (<div className="w-full py-3 rounded-xl font-bold bg-white/5 text-center text-gray-400 text-sm">Выберите хотя бы один вкус</div>)}
            </div>
          </div>
        </div>
      )}

      {showList && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowList(false)}></div>
          <div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto relative z-10">
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Мой список</h2>
              <div className="flex items-center gap-1.5">
                {selectionList.length > 0 && <button onClick={clearList} className="text-[10px] text-red-400">Очистить</button>}
                <button onClick={() => setShowList(false)} className="w-8 h-8 rounded-full bg-white/5"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-3">
              {selectionList.length === 0 ? (<div className="text-center py-8"><ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Список пуст</p></div>) : (
                <>
                  {(() => {
                    const grouped: Record<string, ListItem[]> = {};
                    selectionList.forEach(item => { if (!grouped[item.productName]) grouped[item.productName] = []; grouped[item.productName].push(item); });
                    return Object.entries(grouped).map(([productName, items]) => (
                      <div key={productName} className="mb-3">
                        <div className="text-xs font-bold text-orange-400 mb-1.5 px-1">{productName}</div>
                        <div className="space-y-1.5">
                          {items.map((item) => {
                            const idx = selectionList.indexOf(item);
                            return (
                              <div key={idx} className={`glass-card p-2.5 ${item.isPreorder ? 'border-orange-500/30' : ''}`}>
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="flex-1">
                                    <p className="text-xs font-medium">{item.variant}{item.isPreorder && <span className="ml-1 text-[9px] text-orange-400">[ПРЕДЗАКАЗ]</span>}</p>
                                    <p className="text-[10px] text-gray-400">{item.price} BYN</p>
                                  </div>
                                  <button onClick={() => removeFromList(idx)} className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updateListQuantity(idx, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button>
                                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                    <button onClick={() => updateListQuantity(idx, 1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button>
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
                      <span className="text-xl font-bold gradient-text">{totalListPrice.toFixed(2)} BYN</span>
                    </div>
                    <button onClick={() => setShowSendConfirm(true)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-1.5">
                      <Send className="w-4 h-4" /> Отправить менеджеру
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectionList.length > 0 && (
        <button onClick={() => setShowList(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/40 flex items-center justify-center pulse-glow">
          <ShoppingBag className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-orange-500 text-[10px] font-bold flex items-center justify-center">{totalListItems}</span>
        </button>
      )}
    </div>
  );
}
