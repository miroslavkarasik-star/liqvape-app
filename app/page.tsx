'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Clock, Edit, Eye, EyeOff, MessageCircle, Send, Settings, HelpCircle, Info, LogIn, User } from 'lucide-react';
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
interface ListItem { productId: number; productName: string; variant: string; price: number; quantity: number; isPreorder: boolean; }
interface Request { 
  id: string; user_id: string; username: string; items: ListItem[]; 
  total_price: number; status: string; created_at: string;
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
  const [showPreorderModal, setShowPreorderModal] = useState(false);
  const [selectedPreorderProduct, setSelectedPreorderProduct] = useState<Product | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'requests'>('products');
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [requestFilter, setRequestFilter] = useState<'all' | 'new' | 'done'>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('Все');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [settingsUsername, setSettingsUsername] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showFirstTimeTutorial, setShowFirstTimeTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [flyingItem, setFlyingItem] = useState<{ x: number; y: number; name: string } | null>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);

  // Инициализация Telegram
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  // Подписка на канал
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
    } else { window.open(CHANNEL_LINK, '_blank'); }
    setTimeout(() => setShowSubscribePrompt(false), 1000);
  };

  const openChannel = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(CHANNEL_LINK);
    } else { window.open(CHANNEL_LINK, '_blank'); }
  };

  // userID
  useEffect(() => {
    let id = localStorage.getItem('liqvape_user_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('liqvape_user_id', id); }
    setUserId(id);
  }, []);

  // Проверка админ-сессии
  useEffect(() => {
    const adminSession = localStorage.getItem('liqvape_admin_session');
    if (adminSession === 'true') {
      setIsAdmin(true);
      setShowAdminPanel(true);
    }
  }, []);

  // Проверка первого входа
  useEffect(() => {
    const firstTime = localStorage.getItem('liqvape_first_time');
    if (!firstTime) {
      setShowFirstTimeTutorial(true);
      localStorage.setItem('liqvape_first_time', 'true');
    }
  }, []);

  // Загрузка списка из localStorage
  useEffect(() => {
    const saved = localStorage.getItem('liqvape_selection_list');
    if (saved) {
      try { setSelectionList(JSON.parse(saved)); } catch(e) {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('liqvape_selection_list', JSON.stringify(selectionList));
  }, [selectionList]);

  // Загрузка username из базы
  useEffect(() => {
    if (!userId) return;
    const loadUsername = async () => {
      const { data, error } = await supabase.from('user_profiles').select('username').eq('user_id', userId).single();
      if (data?.username) {
        setUsername(data.username);
        setSettingsUsername(data.username);
      } else {
        setShowUsernamePrompt(true);
      }
    };
    loadUsername();
  }, [userId]);

  // Сохранение username
  const saveUsername = async (newUsername: string) => {
    if (!newUsername.trim()) return;
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: userId, username: newUsername.trim()
    }, { onConflict: 'user_id' });
    if (error) { showNotification('Ошибка сохранения', 'error'); return; }
    setUsername(newUsername.trim());
    setSettingsUsername(newUsername.trim());
    setShowUsernamePrompt(false);
    showNotification('Username сохранён');
  };

  // Загрузка товаров
  const loadProducts = useCallback(async (includeHidden = false): Promise<Product[]> => {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!includeHidden) query = query.eq('is_hidden', false);
    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    let parsed: Product[] = [];
    if (data && data.length > 0) {
      parsed = data.map((p: any) => ({
        id: Number(p.id), name: p.name, category: p.category || 'Другое',
        price: Number(p.price), image: p.image_url || null,
        variants: typeof p.flavors === 'string' ? JSON.parse(p.flavors) : (p.variants || p.flavors || []),
        is_hidden: p.is_hidden || false, is_preorder: p.is_preorder || false,
      }));
      console.log('📦 Products loaded:', parsed.map(p => ({
        id: p.id, name: p.name, variantsCount: p.variants.length,
        totalStock: p.variants.reduce((s: number, v: any) => s + (v.stock || 0), 0),
        variants: p.variants
      })));
    }
    setProducts(parsed);
    return parsed;
  }, []);

  const loadAllRequests = useCallback(async () => {
    const { data } = await supabase.from('user_requests').select('*').order('created_at', { ascending: false });
    if (data) setAllRequests(data);
  }, []);

  useEffect(() => {
    loadProducts(isAdmin);
    if (isAdmin) loadAllRequests();
  }, [isAdmin, loadProducts, loadAllRequests]);

  // Real-time
  useEffect(() => {
    const channel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        loadProducts(isAdmin);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadProducts]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => { loadProducts(isAdmin); if (isAdmin) loadAllRequests(); }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, loadProducts, loadAllRequests]);

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
    }
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getAvailableStock = useCallback((productId: number, variant: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const v = product.variants.find(x => x.name === variant);
    if (!v) return 0;
    return Math.max(0, v.stock);
  }, [products]);

  const getListItemQuantity = (productId: number, variant: string) => {
    const item = selectionList.find(i => i.productId === productId && i.variant === variant);
    return item ? item.quantity : 0;
  };

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
      if (a.is_preorder && !b.is_preorder) return -1;
      if (!a.is_preorder && b.is_preorder) return 1;
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

  const addSelectedToList = () => {
    if (!selectedProduct || selectedVariants.length === 0) {
      showNotification('Выберите хотя бы один вкус', 'error');
      return;
    }
    const issues: string[] = [];
    for (const sv of selectedVariants) {
      const avail = getAvailableStock(selectedProduct.id, sv.name);
      if (avail <= 0 && !selectedProduct.is_preorder) issues.push(`${sv.name} — нет в наличии`);
      else if (sv.quantity > avail && !selectedProduct.is_preorder) issues.push(`${sv.name} — максимум ${avail} шт.`);
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
          productId: selectedProduct.id, productName: selectedProduct.name,
          variant: sv.name, price, quantity: sv.quantity,
          isPreorder: selectedProduct.is_preorder
        });
      }
    }
    setSelectionList(newList);
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
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
    if (v && nq > v.stock && !item.isPreorder) { showNotification(`Максимум: ${v.stock} шт.`, 'error'); return; }
    if (nq <= 0) setSelectionList(selectionList.filter((_, x) => x !== i));
    else { const nl = [...selectionList]; nl[i].quantity = nq; setSelectionList(nl); }
  };

  const clearList = () => { if (confirm('Очистить список?')) { setSelectionList([]); showNotification('Список очищен'); } };

  const sendToManager = async () => {
    if (selectionList.length === 0 || !username) return;
    setIsSending(true);
    try {
      // Получаем актуальные цены
      const freshProducts = await loadProducts(false);
      const updatedList = selectionList.map(item => {
        const product = freshProducts.find(p => p.id === item.productId);
        const variant = product?.variants.find(v => v.name === item.variant);
        const price = variant?.price || product?.price || item.price;
        return { ...item, price };
      });
      
      const totalPrice = updatedList.reduce((s, i) => s + i.price * i.quantity, 0);
      
      // Сохраняем заявку в базу
      const { error } = await supabase.from('user_requests').insert({
        user_id: userId, username, items: updatedList,
        total_price: totalPrice, status: 'new'
      });
      
      if (error) { showNotification('Ошибка отправки: ' + error.message, 'error'); setIsSending(false); return; }
      
      // Формируем текст сообщения
      let message = `Привет! Хочу заказать:\n\n`;
      const grouped: Record<string, ListItem[]> = {};
      updatedList.forEach(item => {
        if (!grouped[item.productName]) grouped[item.productName] = [];
        grouped[item.productName].push(item);
      });
      
      for (const [name, items] of Object.entries(grouped)) {
        message += `🧃 ${name}\n`;
        for (const item of items) {
          const preorderTag = item.isPreorder ? ' [ПРЕДЗАКАЗ]' : '';
          message += `  • ${item.variant} × ${item.quantity}${preorderTag}\n`;
        }
      }
      message += `\n Итого: ${totalPrice.toFixed(2)} BYN`;
      message += `\n\n👤 ${username}`;
      
      const encodedMessage = encodeURIComponent(message);
      const telegramLink = `https://t.me/${MANAGER_USERNAME}?text=${encodedMessage}`;
      
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(telegramLink);
      } else {
        window.open(telegramLink, '_blank');
      }
      
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
    } else {
      showNotification('Неверный пароль', 'error');
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowAdminPanel(false);
    localStorage.removeItem('liqvape_admin_session');
    showNotification('Выход из админки');
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
    await loadProducts(true); await loadAllRequests();
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

  const updateRequestStatus = async (id: string, status: string) => {
    await supabase.from('user_requests').update({ status }).eq('id', id);
    await loadAllRequests();
    showNotification('Статус обновлён');
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Удалить заявку?')) return;
    await supabase.from('user_requests').delete().eq('id', id);
    await loadAllRequests();
    showNotification('Заявка удалена');
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
  const totalListItems = selectionList.reduce((s, i) => s + i.quantity, 0);
  const totalListPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);

  const filteredRequests = allRequests.filter(o => {
    if (requestFilter === 'new') return o.status === 'new';
    if (requestFilter === 'done') return o.status === 'done';
    return true;
  });

  const startAnimation = (e: React.MouseEvent, productName: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setFlyingItem({ x: rect.left, y: rect.top, name: productName });
    setTimeout(() => setFlyingItem(null), 600);
  };

  // ============ АДМИН ПАНЕЛЬ ============
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
            <button onClick={handleAdminLogout} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5 mb-4">
            <button onClick={() => setAdminTab('products')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>Товары</button>
            <button onClick={() => setAdminTab('requests')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === 'requests' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5 text-gray-400'}`}>
              Заявки {allRequests.filter(r => r.status === 'new').length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-[9px]">{allRequests.filter(r => r.status === 'new').length}</span>}
            </button>
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
          ) : (
            <>
              <div className="flex gap-1 mb-3">
                <button onClick={() => setRequestFilter('all')} className={`flex-1 py-1.5 rounded-md text-[10px] ${requestFilter === 'all' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Все ({allRequests.length})</button>
                <button onClick={() => setRequestFilter('new')} className={`flex-1 py-1.5 rounded-md text-[10px] ${requestFilter === 'new' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Новые ({allRequests.filter(o => o.status === 'new').length})</button>
                <button onClick={() => setRequestFilter('done')} className={`flex-1 py-1.5 rounded-md text-[10px] ${requestFilter === 'done' ? 'bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/5'}`}>Обработанные ({allRequests.filter(o => o.status === 'done').length})</button>
              </div>
              <div className="glass-panel p-3 mb-3 text-[10px] text-gray-400">
                ⚠️ Наличие списывается вручную через редактирование товара
              </div>
              <div className="space-y-2">
                {filteredRequests.map(o => (
                  <div key={o.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm">Заявка от @{o.username}</h3>
                        <p className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className="text-base font-bold gradient-text">{o.total_price} BYN</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mb-2 space-y-0.5">
                      {o.items.map((item, i) => (
                        <p key={i} className="text-[11px] text-gray-300">
                          • {item.productName} ({item.variant}) × {item.quantity}
                          {item.isPreorder && <span className="text-orange-400"> [ПРЕДЗАКАЗ]</span>}
                        </p>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => updateRequestStatus(o.id, o.status === 'done' ? 'new' : 'done')} className={`flex-1 py-1.5 rounded-md text-[10px] font-medium ${o.status === 'done' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {o.status === 'done' ? 'Вернуть' : '✓ Обработана'}
                      </button>
                      <button onClick={() => deleteRequest(o.id)} className="w-8 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {filteredRequests.length === 0 && (
                  <div className="glass-panel p-8 text-center text-gray-500"><Package className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">Заявок нет</p></div>
                )}
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

  // ============ ГЛАВНАЯ СТРАНИЦА ============
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

      {flyingItem && (
        <div className="fixed z-[80] pointer-events-none animate-fly-to-list" style={{ left: flyingItem.x, top: flyingItem.y }}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">+1</div>
        </div>
      )}

      {showSubscribePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button onClick={() => setShowSubscribePrompt(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><Send className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Подпишись на канал</h2>
            <p className="text-gray-400 text-xs mb-4">Подпишись на наш Telegram канал</p>
            <button onClick={handleSubscribe} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-2 text-sm mb-2"><Send className="w-4 h-4" /> Подписаться</button>
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
            <input type="text" placeholder="username" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveUsername(usernameInput)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm text-white outline-none focus:border-orange-500/50" />
            <button onClick={() => saveUsername(usernameInput)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Сохранить</button>
          </div>
        </div>
      )}

      {showFirstTimeTutorial && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 relative z-10">
            {tutorialStep === 0 && (
              <>
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><ShoppingBag className="w-10 h-10 text-white" /></div>
                <h2 className="text-xl font-bold text-white mb-3 text-center">Добро пожаловать в LiqVape!</h2>
                <p className="text-gray-400 text-xs mb-4 text-center leading-relaxed">Давай покажем как делать заказы</p>
                <button onClick={() => setTutorialStep(1)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Начать →</button>
              </>
            )}
            {tutorialStep === 1 && (
              <>
                <div className="text-4xl mb-4 text-center"></div>
                <h2 className="text-xl font-bold text-white mb-3 text-center">Шаг 1: Выбирай товары</h2>
                <p className="text-gray-400 text-xs mb-4 text-center leading-relaxed">Нажми на <span className="text-orange-400 font-bold">+</span> на карточке товара чтобы выбрать вкус и количество</p>
                <button onClick={() => setTutorialStep(2)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Далее →</button>
              </>
            )}
            {tutorialStep === 2 && (
              <>
                <div className="text-4xl mb-4 text-center">📋</div>
                <h2 className="text-xl font-bold text-white mb-3 text-center">Шаг 2: Смотри список</h2>
                <p className="text-gray-400 text-xs mb-4 text-center leading-relaxed">Нажми на плавающую кнопку внизу справа чтобы увидеть свой список</p>
                <button onClick={() => setTutorialStep(3)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Далее →</button>
              </>
            )}
            {tutorialStep === 3 && (
              <>
                <div className="text-4xl mb-4 text-center"></div>
                <h2 className="text-xl font-bold text-white mb-3 text-center">Шаг 3: Отправляй менеджеру</h2>
                <p className="text-gray-400 text-xs mb-4 text-center leading-relaxed">Нажми <span className="text-orange-400 font-bold">"Отправить"</span> и тебя перекинет в Telegram с готовым сообщением</p>
                <button onClick={() => { setShowFirstTimeTutorial(false); setTutorialStep(0); }} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Понятно! 🎉</button>
              </>
            )}
          </div>
        </div>
      )}

      {showSendConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><Send className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Отправить заявку?</h2>
            <p className="text-gray-400 text-xs mb-4">Тебя перекинет в Telegram к менеджеру с готовым списком</p>
            <div className="glass-card p-3 mb-4 text-left">
              <p className="text-xs text-gray-400 mb-1">Товаров: <span className="text-white font-bold">{totalListItems}</span></p>
              <p className="text-xs text-gray-400">Сумма: <span className="gradient-text font-bold">{totalListPrice.toFixed(2)} BYN</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSendConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-medium">Отмена</button>
              <button onClick={sendToManager} disabled={isSending} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white disabled:opacity-50">
                {isSending ? '...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreorderModal && selectedPreorderProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <button onClick={() => setShowPreorderModal(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center pulse-glow"><ShoppingBag className="w-10 h-10 text-white" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Товар по предзаказу</h2>
            <p className="text-gray-400 text-xs mb-4"><span className="text-orange-400 font-bold">{selectedPreorderProduct.name}</span> — добавь в список</p>
            <button onClick={() => { setShowPreorderModal(false); openProductModal(selectedPreorderProduct); }} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white mb-2">Добавить в список</button>
            <button onClick={() => setShowPreorderModal(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Закрыть</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Настройки</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <button onClick={() => { setShowSettings(false); setShowUsernamePrompt(true); setUsernameInput(username); }} className="w-full glass-card p-3 flex items-center gap-3 text-left">
                <User className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">Сменить username</p><p className="text-[10px] text-gray-400">@{username}</p></div>
              </button>
              <button onClick={() => { setShowSettings(false); setShowInstructions(true); }} className="w-full glass-card p-3 flex items-center gap-3 text-left">
                <HelpCircle className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">Инструкция</p><p className="text-[10px] text-gray-400">Как пользоваться</p></div>
              </button>
              <button onClick={() => { setShowSettings(false); setShowAbout(true); }} className="w-full glass-card p-3 flex items-center gap-3 text-left">
                <Info className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">О приложении</p><p className="text-[10px] text-gray-400">LiqVape v1.0</p></div>
              </button>
              <button onClick={() => { setShowSettings(false); setShowAdminLogin(true); }} className="w-full glass-card p-3 flex items-center gap-3 text-left">
                <LogIn className="w-5 h-5 text-orange-400" />
                <div><p className="text-sm font-medium">Вход в админку</p><p className="text-[10px] text-gray-400">Только для администраторов</p></div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm max-h-[80vh] overflow-y-auto p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Инструкция</h2>
              <button onClick={() => setShowInstructions(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <div className="glass-card p-3">
                <h3 className="font-bold text-orange-400 mb-1">1. Выбор товара</h3>
                <p>Нажми на карточку товара или кнопку <span className="text-orange-400 font-bold">+</span> чтобы открыть выбор вкусов</p>
              </div>
              <div className="glass-card p-3">
                <h3 className="font-bold text-orange-400 mb-1">2. Выбор вкуса и количества</h3>
                <p>Отметь галочкой нужные вкусы и укажи количество для каждого. Нажми "В список"</p>
              </div>
              <div className="glass-card p-3">
                <h3 className="font-bold text-orange-400 mb-1">3. Просмотр списка</h3>
                <p>Нажми на плавающую кнопку внизу справа чтобы увидеть все выбранные товары</p>
              </div>
              <div className="glass-card p-3">
                <h3 className="font-bold text-orange-400 mb-1">4. Отправка менеджеру</h3>
                <p>Нажми "Отправить" — тебя перекинет в Telegram с готовым сообщением. Осталось только нажать Send!</p>
              </div>
              <div className="glass-card p-3">
                <h3 className="font-bold text-orange-400 mb-1">5. Предзаказ</h3>
                <p>Товары с пометкой ПРЕДЗАКАЗ тоже можно добавить в список. Они будут отмечены отдельно</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-6 text-center relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">О приложении</h2>
              <button onClick={() => setShowAbout(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Cloud className="w-10 h-10 text-white" /></div>
            <h3 className="text-xl font-bold mb-1">Liq<span className="text-orange-500">Vape</span></h3>
            <p className="text-gray-400 text-xs mb-4">Premium vape shop</p>
            <div className="glass-card p-3 mb-4 text-left space-y-1 text-xs">
              <p className="text-gray-400">Версия: <span className="text-white">1.0.0</span></p>
              <p className="text-gray-400">Канал: <span className="text-orange-400">@{CHANNEL_USERNAME}</span></p>
              <p className="text-gray-400">Менеджер: <span className="text-orange-400">@{MANAGER_USERNAME}</span></p>
            </div>
            <p className="text-[10px] text-gray-500">© 2026 LiqVape. Все права защищены.</p>
          </div>
        </div>
      )}

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

      <div className="max-w-md mx-auto px-3 relative z-10 pb-24">
        <div className="sticky top-0 z-40 -mx-3 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40 pulse-glow"><Cloud className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <div><h1 className="text-2xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1><p className="text-[10px] text-gray-500">premium shop</p></div>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><Settings className="w-4 h-4 text-orange-400" /></button>
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
                const inList = selectionList.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={p.id} onClick={() => { if (isPreorder || avail > 0 || p.variants.length > 0) openProductModal(p); }} className={`glass-card p-2 transition-all ${isPreorder ? 'opacity-80' : avail === 0 && !isPreorder ? 'opacity-50' : 'cursor-pointer hover:border-orange-500/30'}`}>
                    <div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-2 flex items-center justify-center relative overflow-hidden product-image-glow">
                      {p.image ? (<img src={p.image} alt={p.name} className={`w-full h-full object-contain p-4 rounded-2xl ${isPreorder ? 'brightness-75' : ''}`} />) : (<Package className={`w-12 h-12 text-neutral-700 ${isPreorder ? 'opacity-50' : ''}`} />)}
                      {isPreorder && (<div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10"><span className="text-white font-bold text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg border border-white/20">ПРЕДЗАКАЗ</span></div>)}
                      {!isPreorder && avail === 0 && (<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl"><span className="text-red-400 font-bold text-xs">Нет</span></div>)}
                    </div>
                    <h3 className={`font-semibold text-xs mb-1 line-clamp-2 text-center ${isPreorder ? 'text-gray-300' : avail === 0 ? 'text-gray-500' : 'text-white'}`}>{p.name}</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-bold ${isPreorder ? 'text-orange-400' : 'gradient-text'}`}>{(() => { const variantPrices = p.variants.filter(v => v.price).map(v => v.price as number); const allPrices = variantPrices.length > 0 ? [...variantPrices, p.price] : [p.price]; const min = Math.min(...allPrices); const max = Math.max(...allPrices); return min === max ? `${min} BYN` : `${min}-${max} BYN`; })()}</span>
                      <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">{p.category}</span>
                    </div>
                    {inList > 0 ? (
                      <button onClick={(e) => { startAnimation(e, p.name); openProductModal(p); }} className="w-full py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold flex items-center justify-center gap-1">
                        <ShoppingBag className="w-3 h-3" /> В списке: {inList}
                      </button>
                    ) : (
                      <button onClick={(e) => { startAnimation(e, p.name); openProductModal(p); }} className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${isPreorder || avail > 0 ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-500'}`}>
                        <Plus className="w-3 h-3" /> {isPreorder ? 'Предзаказ' : avail > 0 ? 'Выбрать' : 'Нет в наличии'}
                      </button>
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
              {selectedProduct.image ? (<div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center overflow-hidden product-image-glow"><img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-6 rounded-2xl" /></div>) : (<div className="w-full aspect-square bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl mb-4 flex items-center justify-center"><Package className="w-16 h-16 text-neutral-700" /></div>)}
              <h2 className="text-xl font-bold mb-1 text-center">{selectedProduct.name}</h2>
              {selectedProduct.is_preorder && (<div className="text-center mb-2"><span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">ПРЕДЗАКАЗ</span></div>)}
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
                      const isAvailable = avail > 0 || selectedProduct.is_preorder;
                      return (
                        <div key={v.name} className={`rounded-lg border transition-all ${isSelected ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5 bg-white/5'} ${!isAvailable ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between p-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input type="checkbox" checked={isSelected} onChange={() => isAvailable && toggleVariantSelection(v.name)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer" disabled={!isAvailable} />
                              <div className="min-w-0 flex-1"><span className="text-xs font-medium truncate block">{v.name}</span><span className="text-[10px] text-gray-400">{vPrice} BYN</span></div>
                            </div>
                            <span className={`text-[10px] font-medium ml-2 ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>{isAvailable ? `${avail} шт.` : 'Нет'}</span>
                          </div>
                          {isSelected && isAvailable && (
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
                <button onClick={addSelectedToList} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm">
                  <ShoppingBag className="w-4 h-4" /> В список • {selectedVariants.reduce((s, sv) => { const v = selectedProduct.variants.find(x => x.name === sv.name); const price = v?.price || selectedProduct.price; return s + price * sv.quantity; }, 0)} BYN
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
                <button onClick={() => setShowList(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
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
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.variant}{item.isPreorder && <span className="ml-1 text-[9px] text-orange-400">[ПРЕДЗАКАЗ]</span>}</p>
                                    <p className="text-[10px] text-gray-400">{item.price} BYN / шт.</p>
                                  </div>
                                  <button onClick={() => removeFromList(idx)} className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center flex-shrink-0 ml-2"><Trash2 className="w-3 h-3 text-red-400" /></button>
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
                    <button onClick={() => setShowSendConfirm(true)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center gap-1.5 text-sm">
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
        <button ref={listButtonRef} onClick={() => setShowList(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/40 flex items-center justify-center pulse-glow">
          <ShoppingBag className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-orange-500 text-[10px] font-bold flex items-center justify-center">{totalListItems}</span>
        </button>
      )}
    </div>
  );
}
