'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Edit, Send, Settings, HelpCircle, Info, LogIn } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';

const CATEGORIES = ['Все', 'Жидкости', 'Расходники', 'Снюс', 'POD-системы', 'Одноразки', 'Табак-угли', 'Другое'];
const CATEGORY_PRIORITY: Record<string, number> = { 'Жидкости': 1, 'Снюс': 2, 'Расходники': 3, 'POD-системы': 4, 'Одноразки': 5, 'Табак-угли': 6, 'Другое': 7 };
const LETTER_PRIORITY: Record<string, string[]> = { 'Жидкости': ['R','D','C','A','B','E','P','G','S','F','H'], 'Снюс': ['D','E','G','F'], 'Одноразки': ['P','K','E'], 'Расходники': ['V'] };

const getLetterPriority = (name: string, category: string): number => {
  if (category === 'Расходники' && name.toUpperCase().startsWith('VAPORESSO')) return -1;
  const firstLetter = name.charAt(0).toUpperCase();
  const priorities = LETTER_PRIORITY[category];
  if (!priorities) return 999;
  const idx = priorities.indexOf(firstLetter);
  return idx === -1 ? 999 : idx;
};

const ADMIN_PASSWORD = 'K7m2Q9';
const MANAGER_USERNAME = 'LiqVape_2';
const CHANNEL_USERNAME = 'zslvape';
const CHANNEL_LINK = 'https://t.me/' + CHANNEL_USERNAME;

interface Variant { name: string; stock: number; price?: number; }
interface Product { id: string; name: string; category: string; price: number; image: string | null; variants: Variant[]; is_hidden: boolean; is_preorder: boolean; created_at?: string; }
interface ListItem { productId: string; productName: string; variant: string; price: number; quantity: number; isPreorder: boolean; }

const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; // Увеличил с 100 до 400
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/webp', 0.8); // Увеличил качество с 0.4 до 0.8
      resolve(base64);
    };
  });
};

const BATCH_SIZE = 12;
const CACHE_DURATION = 60 * 60 * 1000; // 1 час

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
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'products' | 'requests'>('products');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCategory, setAdminCategory] = useState('Все');
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> & { id?: string } | null>(null);
  const [formVariants, setFormVariants] = useState<Variant[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showFirstTimeTutorial, setShowFirstTimeTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
      const platform = (window as any).Telegram.WebApp.platform || '';
      const isDesktop = platform.toLowerCase().includes('tdesktop') || platform.toLowerCase().includes('macos');
      if (!isDesktop) (window as any).Telegram.WebApp.expand();
    }
  }, []);

  useEffect(() => {
    const hasSeen = localStorage.getItem('liqvape_seen_subscribe');
    if (!hasSeen) { setShowSubscribePrompt(true); localStorage.setItem('liqvape_seen_subscribe', 'true'); }
    const firstTime = localStorage.getItem('liqvape_first_time');
    if (!firstTime) { setShowFirstTimeTutorial(true); localStorage.setItem('liqvape_first_time', 'true'); }
  }, []);

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

  const loadProducts = useCallback(async (includeHidden = false): Promise<Product[]> => {
    const cacheKey = includeHidden ? 'liqvape_products_admin' : 'liqvape_products';
    const cached = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheKey + '_time');
    
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_DURATION) {
      try {
        const parsed = JSON.parse(cached);
        setProducts(parsed);
        setIsLoading(false);
        setDisplayCount(BATCH_SIZE);
        setLoadingProgress(0);
        setLoadingMessage('');
        loadProductsFromDB(includeHidden, true).catch(() => {});
        return parsed;
      } catch(e) { console.error('Cache error:', e); }
    }
    
    return await loadProductsFromDB(includeHidden, false);
  }, []);

  const loadProductsFromDB = useCallback(async (includeHidden = false, silent = false): Promise<Product[]> => {
    try {
      if (!silent) {
        setLoadingMessage('Подождите пожалуйста, идёт загрузка товаров...');
        setLoadingProgress(10);
      }
      
      const startTime = Date.now();
      const q = query(collection(db, 'products'));
      
      if (!silent) setLoadingProgress(40);
      
      const snapshot = await getDocs(q);
      
      if (!silent) setLoadingProgress(70);
      
      const parsed: Product[] = [];
      snapshot.forEach((docSnapshot) => {
        const p = docSnapshot.data();
        if (!includeHidden && p.is_hidden) return;
        const pAny = p as any;
        let priceValue = 0;
        if (pAny.price && typeof pAny.price === 'object') {
          priceValue = Number(pAny.price.doubleValue ?? pAny.price.integerValue ?? 0);
        } else {
          priceValue = Number(pAny.price) || 0;
        }
        const variants = (pAny.flavors || []).map((v: any) => {
          let variantPrice = priceValue;
          if (v.price !== undefined && v.price !== null) {
            if (typeof v.price === 'object' && v.price !== null) {
              variantPrice = Number(v.price.doubleValue ?? v.price.integerValue ?? priceValue);
            } else {
              variantPrice = Number(v.price) || priceValue;
            }
          }
          return { name: String(v.name || ''), stock: Number(v.stock) || 0, price: variantPrice };
        });
        parsed.push({
          id: docSnapshot.id, name: p.name, category: p.category || 'Другое',
          price: priceValue, image: pAny.image_url || null, variants: variants,
          is_hidden: Boolean(pAny.is_hidden), is_preorder: Boolean(pAny.is_preorder),
          created_at: pAny.created_at || new Date().toISOString()
        });
      });
      
      if (!silent) setLoadingProgress(90);
      
      parsed.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      setProducts(parsed);
      setIsLoading(false);
      setDisplayCount(BATCH_SIZE);
      
      const cacheKey = includeHidden ? 'liqvape_products_admin' : 'liqvape_products';
      try {
        localStorage.setItem(cacheKey, JSON.stringify(parsed));
        localStorage.setItem(cacheKey + '_time', Date.now().toString());
      } catch(e) {
        const withoutImages = parsed.map(p => ({ ...p, image: null }));
        localStorage.setItem(cacheKey, JSON.stringify(withoutImages));
        localStorage.setItem(cacheKey + '_time', Date.now().toString());
      }
      
      if (!silent) {
        setLoadingProgress(100);
        setLoadingMessage('Готово! Все товары загружены.');
        setTimeout(() => { setLoadingProgress(0); setLoadingMessage(''); }, 1000);
      }
      
      return parsed;
    } catch(e) {
      console.error('Load error:', e);
      setIsLoading(false);
      if (!silent) { setLoadingProgress(0); setLoadingMessage(''); }
      return [];
    }
  }, []);

  const loadAllRequests = useCallback(async () => {
    try {
      const q = query(collection(db, 'user_requests'));
      const snapshot = await getDocs(q);
      const requests: any[] = [];
      snapshot.forEach((docSnapshot) => requests.push({ id: docSnapshot.id, ...docSnapshot.data() }));
      requests.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setAllRequests(requests);
    } catch(e) { console.error('Load requests error:', e); }
  }, []);

  useEffect(() => {
    loadProducts(isAdmin);
    if (isAdmin) loadAllRequests();
  }, [isAdmin, loadProducts, loadAllRequests]);

  const showNotification = (message: string, type: 'error' | 'success' = 'success') => {
    setNotification({ message, type });
    setNotificationVisible(true);
    setTimeout(() => { setNotificationVisible(false); setTimeout(() => setNotification(null), 300); }, 2500);
  };

  const getAvailableStock = (productId: string, variant: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    const v = product.variants.find(x => x.name === variant);
    return v ? v.stock : 0;
  };

  const filteredProducts = products.filter(p => {
    return p.name.toLowerCase().includes(search.toLowerCase()) && (selectedCategory === 'Все' || p.category === selectedCategory);
  });

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aAvail = a.variants.reduce((s, v) => s + v.stock, 0);
      const bAvail = b.variants.reduce((s, v) => s + v.stock, 0);
      const getPriority = (inStock: boolean, isPreorder: boolean) => inStock ? 1 : (isPreorder ? 2 : 3);
      const aP = getPriority(aAvail > 0, a.is_preorder);
      const bP = getPriority(bAvail > 0, b.is_preorder);
      if (aP !== bP) return aP - bP;
      if (selectedCategory === 'Все') {
        const aCat = CATEGORY_PRIORITY[a.category] || 99;
        const bCat = CATEGORY_PRIORITY[b.category] || 99;
        if (aCat !== bCat) return aCat - bCat;
        const aLet = getLetterPriority(a.name, a.category);
        const bLet = getLetterPriority(b.name, b.category);
        if (aLet !== bLet) return aLet - bLet;
      } else {
        const aLet = getLetterPriority(a.name, a.category);
        const bLet = getLetterPriority(b.name, b.category);
        if (aLet !== bLet) return aLet - bLet;
      }
      return 0;
    });
  }, [filteredProducts, selectedCategory]);

  const visibleProducts = sortedProducts.slice(0, displayCount);
  const hasMore = displayCount < sortedProducts.length;

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayCount(prev => Math.min(prev + BATCH_SIZE, sortedProducts.length));
      }
    }, { threshold: 0.1 });
    const sentinel = document.getElementById('load-more-sentinel');
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, sortedProducts.length]);

  useEffect(() => { setDisplayCount(BATCH_SIZE); }, [search, selectedCategory]);

  const openProductModal = (product: Product) => { setSelectedProduct(product); setSelectedVariants([]); setShowAllVariants(false); };
  const toggleVariantSelection = (variantName: string) => {
    setSelectedVariants(prev => prev.find(v => v.name === variantName) ? prev.filter(v => v.name !== variantName) : [...prev, { name: variantName, quantity: 1 }]);
  };
  const updateVariantQuantity = (variantName: string, delta: number) => {
    if (!selectedProduct) return;
    setSelectedVariants(prev => prev.map(v => {
      if (v.name !== variantName) return v;
      const avail = getAvailableStock(selectedProduct.id, v.name);
      const newQty = v.quantity + delta;
      if (newQty < 1 || (newQty > avail && !selectedProduct.is_preorder)) return v;
      return { ...v, quantity: newQty };
    }));
  };

  const addSelectedToList = () => {
    if (!selectedProduct || selectedVariants.length === 0) { showNotification('Выберите вкус', 'error'); return; }
    let newList = [...selectionList];
    for (const sv of selectedVariants) {
      const v = selectedProduct.variants.find(x => x.name === sv.name);
      const price = (v?.price !== undefined && v?.price !== null && v.price > 0) ? v.price : selectedProduct.price;
      const idx = newList.findIndex(i => i.productId === selectedProduct.id && i.variant === sv.name);
      if (idx >= 0) newList[idx].quantity += sv.quantity;
      else newList.push({ productId: selectedProduct.id, productName: selectedProduct.name, variant: sv.name, price, quantity: sv.quantity, isPreorder: selectedProduct.is_preorder });
    }
    setSelectionList(newList);
    showNotification('Добавлено: ' + selectedProduct.name);
    setSelectedProduct(null); setSelectedVariants([]);
  };

  const removeFromList = (i: number) => setSelectionList(selectionList.filter((_, x) => x !== i));
  const updateListQuantity = (i: number, d: number) => {
    const item = selectionList[i];
    const p = products.find(x => x.id === item.productId);
    const v = p?.variants.find(x => x.name === item.variant);
    const nq = item.quantity + d;
    if (v && nq > v.stock && !item.isPreorder) { showNotification('Максимум: ' + v.stock, 'error'); return; }
    if (nq <= 0) setSelectionList(selectionList.filter((_, x) => x !== i));
    else { const nl = [...selectionList]; nl[i].quantity = nq; setSelectionList(nl); }
  };
  const clearList = () => { if (confirm('Очистить?')) { setSelectionList([]); showNotification('Список очищен'); } };

  const sendToManager = async () => {
    if (selectionList.length === 0) return;
    setIsSending(true);
    const totalPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);
    let message = 'Привет! Хочу сделать заказ:\n\n';
    const grouped: Record<string, ListItem[]> = {};
    selectionList.forEach(item => { if (!grouped[item.productName]) grouped[item.productName] = []; grouped[item.productName].push(item); });
    for (const [name, items] of Object.entries(grouped)) {
      message += `📦 ${name}\n`;
      for (const item of items) message += `   • ${item.variant} × ${item.quantity}${item.isPreorder ? ' [ПРЕДЗАКАЗ]' : ''}\n`;
    }
    message += `\n💰 Итого: ${totalPrice.toFixed(2)} BYN`;
    const link = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') {
      const isDesktop = ((window as any).Telegram?.WebApp?.platform || '').toLowerCase().includes('tdesktop') || ((window as any).Telegram?.WebApp?.platform || '').toLowerCase().includes('macos');
      if (isDesktop) window.open(link, '_blank');
      else { const a = document.createElement('a'); a.href = link; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    }
    setSelectionList([]); setShowList(false); setShowSendConfirm(false);
    showNotification('Переходим в Telegram...', 'success');
    try { await addDoc(collection(db, 'user_requests'), { user_id: userId, username: 'Клиент', items: selectionList, total_price: totalPrice, status: 'new', created_at: new Date().toISOString() }); } catch(e) {}
    finally { setIsSending(false); }
  };

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) { setIsAdmin(true); setShowAdminLogin(false); setShowAdminPanel(true); setAdminPassword(''); localStorage.setItem('liqvape_admin_session', 'true'); showNotification('Вход выполнен'); }
    else { showNotification('Неверный пароль', 'error'); }
  };
  const handleAdminLogout = () => { setIsAdmin(false); setShowAdminPanel(false); localStorage.removeItem('liqvape_admin_session'); };

  const openProductForm = (product?: Product) => {
    if (product) { setEditingProduct({ id: product.id, name: product.name, price: product.price, category: product.category, image: product.image, is_hidden: product.is_hidden, is_preorder: product.is_preorder }); setFormVariants([...product.variants].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))); }
    else { setEditingProduct({ name: '', price: 0, category: 'Другое', image: null, is_hidden: false, is_preorder: false }); setFormVariants([]); }
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct.price) { showNotification('Заполните название и цену', 'error'); return; }
    const data: any = { name: editingProduct.name, price: Number(editingProduct.price), category: editingProduct.category || 'Другое', image_url: editingProduct.image || null, flavors: formVariants, stock_quantity: formVariants.reduce((s, f) => s + (f.stock || 0), 0), is_hidden: Boolean(editingProduct.is_hidden), is_preorder: Boolean(editingProduct.is_preorder) };
    if (!editingProduct.id) data.created_at = new Date().toISOString(); else delete data.created_at;
    try {
      if (editingProduct.id) { await updateDoc(doc(db, 'products', editingProduct.id), data); showNotification('Товар обновлён', 'success'); }
      else { await addDoc(collection(db, 'products'), data); showNotification('Товар добавлен', 'success'); }
      setShowProductForm(false); setEditingProduct(null); setFormVariants([]); await loadProducts(true);
    } catch(e) { showNotification('Ошибка: ' + (e as Error).message, 'error'); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    showNotification('Обработка фото...');
    try { const base64 = await compressAndConvertToBase64(file); setEditingProduct(prev => prev ? {...prev, image: base64} : null); showNotification('Фото готово!', 'success'); }
    catch (err) { showNotification('Ошибка загрузки фото', 'error'); }
  };

  const toggleHidden = async (p: Product) => { await updateDoc(doc(db, 'products', p.id), { is_hidden: !p.is_hidden }); await loadProducts(true); };
  const togglePreorder = async (p: Product) => { await updateDoc(doc(db, 'products', p.id), { is_preorder: !p.is_preorder }); await loadProducts(true); };
  const deleteProduct = async (id: string) => { if (!confirm('Удалить товар?')) return; await deleteDoc(doc(db, 'products', id)); await loadProducts(true); showNotification('Товар удалён'); };
  const deleteRequest = async (id: string) => { if (!confirm('Заказ обработан? Удалить из списка?')) return; await deleteDoc(doc(db, 'user_requests', id)); await loadAllRequests(); showNotification('Заказ удален', 'success'); };

  const sortedVariants = useMemo(() => {
    if (!selectedProduct) return [];
    return [...selectedProduct.variants].sort((a, b) => {
      const aA = getAvailableStock(selectedProduct.id, a.name) > 0 || selectedProduct.is_preorder;
      const bA = getAvailableStock(selectedProduct.id, b.name) > 0 || selectedProduct.is_preorder;
      if (aA && !bA) return -1; if (!aA && bA) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [selectedProduct]);

  const visibleVariants = showAllVariants ? sortedVariants : sortedVariants.slice(0, 5);
  const hiddenVariantsCount = sortedVariants.length - 5;
  const totalListItems = selectionList.reduce((s, i) => s + i.quantity, 0);
  const totalListPrice = selectionList.reduce((s, i) => s + i.price * i.quantity, 0);
  const groupedSelectionList = useMemo(() => {
    const grouped: Record<string, ListItem[]> = {};
    selectionList.forEach(item => { if (!grouped[item.productName]) grouped[item.productName] = []; grouped[item.productName].push(item); });
    return Object.entries(grouped);
  }, [selectionList]);
  const filteredAdminProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(adminSearch.toLowerCase()) && (adminCategory === 'Все' || p.category === adminCategory)), [products, adminSearch, adminCategory]);

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white p-3 relative">
        <div className="lava-lamp"><div className="lava-blob lava-blob-1"></div><div className="lava-blob lava-blob-2"></div><div className="lava-blob lava-blob-3"></div><div className="lava-blob lava-blob-4"></div></div>
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Cloud className="w-5 h-5 text-white" /></div><div><h1 className="text-xl font-bold">Liq<span className="text-orange-500">Vape</span></h1><p className="text-[10px] text-gray-500">Админ панель</p></div></div>
            <button onClick={handleAdminLogout} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setAdminTab('products')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'products' ? 'bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/30' : 'bg-white/5 text-gray-400'}`}>Товары</button>
            <button onClick={() => setAdminTab('requests')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${adminTab === 'requests' ? 'bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/30' : 'bg-white/5 text-gray-400'}`}>Складские задания {allRequests.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500 text-[10px]">{allRequests.length}</span>}</button>
          </div>
          {adminTab === 'products' ? (
            <div>
              <button onClick={() => openProductForm()} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 mb-3 flex items-center justify-center gap-1 shadow-lg shadow-orange-500/30"><Plus className="w-4 h-4" /> Добавить товар</button>
              <div className="mb-3 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder="Поиск товаров..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} className="w-full glass-panel py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" /></div>
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3">{CATEGORIES.map((c) => (<button key={c} onClick={() => setAdminCategory(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium transition-all ${adminCategory === c ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>{c}</button>))}</div>
              <div className="space-y-2">
                {filteredAdminProducts.map(p => (
                  <div key={p.id} className="glass-card p-3">
                    <div className="flex items-start justify-between mb-2"><div className="flex-1"><h3 className="font-bold text-sm">{p.name}</h3><p className="text-[11px] text-gray-400">{p.price} BYN • {p.category} • {p.variants.reduce((s, v) => s + v.stock, 0)} шт.</p></div></div>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openProductForm(p)} className="flex-1 py-1.5 rounded-md bg-white/5 text-[10px] flex items-center justify-center gap-1 hover:bg-white/10 transition-all"><Edit className="w-3 h-3" /> Изменить</button>
                      <button onClick={() => toggleHidden(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_hidden ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{p.is_hidden ? 'Показать' : 'Скрыть'}</button>
                      <button onClick={() => togglePreorder(p)} className={`flex-1 py-1.5 rounded-md text-[10px] ${p.is_preorder ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5'}`}>Предзаказ</button>
                      <button onClick={() => deleteProduct(p.id)} className="w-10 py-1.5 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {filteredAdminProducts.length === 0 && <div className="glass-panel p-8 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Товаров нет</p></div>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {allRequests.map((r, index) => {
                const hasPreorder = r.items.some((i: any) => i.isPreorder);
                return (
                  <div key={r.id} className={`glass-card p-3 ${hasPreorder ? 'border-orange-500/40 bg-orange-500/5' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div><h3 className="font-bold text-sm flex items-center gap-2">Заказ #{allRequests.length - index}{hasPreorder && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500 text-white font-bold">ЕСТЬ ПРЕДЗАКАЗ</span>}</h3><p className="text-[10px] text-gray-400">Создано: {new Date(r.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p></div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">В работе</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 mb-3 space-y-1.5">
                      {r.items.map((item: any, i: number) => (<div key={i} className={`flex items-center justify-between py-1 text-[11px] rounded-lg px-2 ${item.isPreorder ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-black/20'}`}><div className="flex-1"><span className="text-gray-300 block">{item.productName}</span><span className={`text-[10px] ${item.isPreorder ? 'text-orange-400 font-medium' : 'text-gray-500'}`}>{item.variant}{item.isPreorder ? ' ⚠️ ПРЕДЗАКАЗ' : ''}</span></div><span className="text-white font-bold ml-2">× {item.quantity}</span></div>))}
                    </div>
                    <div className="flex items-center justify-between mb-2 text-xs"><span className="text-gray-400">Итого:</span><span className="font-bold gradient-text">{r.total_price} BYN</span></div>
                    <button onClick={() => deleteRequest(r.id)} className="w-full py-2 rounded-md bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center gap-1 hover:bg-red-500/30 transition-all"><Trash2 className="w-3 h-3" /> Заказ обработан</button>
                  </div>
                );
              })}
              {allRequests.length === 0 && <div className="glass-panel p-8 text-center text-gray-500"><Package className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">Нет активных заказов</p></div>}
            </div>
          )}
          {showProductForm && editingProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-xl">
              <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold gradient-text flex items-center gap-2"><Edit className="w-5 h-5 text-orange-500" />{editingProduct.id ? 'Редактирование' : 'Новый товар'}</h2><button onClick={() => setShowProductForm(false)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"><X className="w-5 h-5" /></button></div>
                <div className="mb-4"><label className="text-xs text-gray-400 mb-1.5 block">Название товара</label><input type="text" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" /></div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="text-xs text-gray-400 mb-1.5 block">Цена (BYN)</label><input type="number" value={editingProduct.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" /></div>
                  <div><label className="text-xs text-gray-400 mb-1.5 block">Категория</label><select value={editingProduct.category || 'Другое'} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all">{CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</select></div>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-400 mb-1.5 block">Фото товара</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-gradient-to-r file:from-orange-500 file:to-pink-500 file:text-white file:cursor-pointer mb-2" />
                  {editingProduct.image && (<div className="mt-3 relative group"><img src={editingProduct.image} className="w-full h-40 object-contain rounded-xl bg-black/30" /><button onClick={() => setEditingProduct({...editingProduct, image: null})} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center"><X className="w-4 h-4" /></button></div>)}
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2"><label className="text-xs text-gray-400">Варианты</label><span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">{formVariants.length} шт.</span></div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {formVariants.map((v, i) => (<div key={i} className="flex gap-2 items-center bg-black/30 rounded-xl p-2"><input type="text" placeholder="Название" value={v.name} onChange={e => { const nv = [...formVariants]; nv[i].name = e.target.value; setFormVariants(nv); }} className="flex-1 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none" /><input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Кол-во" value={v.stock} onChange={e => { const val = e.target.value === '' ? 0 : parseInt(e.target.value) || 0; const nv = [...formVariants]; nv[i].stock = val; setFormVariants(nv); }} className="w-20 bg-transparent border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none text-center" /><input type="number" placeholder="Цена" value={v.price || ''} onChange={e => { const val = e.target.value === '' ? undefined : Number(e.target.value); const nv = [...formVariants]; nv[i].price = val; setFormVariants(nv); }} className="w-20 bg-transparent border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none text-center" /><button onClick={() => setFormVariants(formVariants.filter((_, x) => x !== i))} className="w-9 h-9 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center"><X className="w-4 h-4" /></button></div>))}
                  </div>
                  <button onClick={() => { const newVariant = { name: '', stock: 0 }; const sorted = [...formVariants, newVariant].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })); setFormVariants(sorted); }} className="w-full mt-2 py-2.5 rounded-xl border-2 border-dashed border-orange-500/30 text-orange-400 text-xs font-medium flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Добавить вариант</button>
                </div>
                <div className="mb-5"><button onClick={() => setEditingProduct({...editingProduct, is_preorder: !editingProduct.is_preorder})} className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${editingProduct.is_preorder ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>{editingProduct.is_preorder ? 'Предзаказ включён' : 'Добавить в предзаказ'}</button></div>
                <div className="flex gap-3"><button onClick={() => setShowProductForm(false)} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-medium">Отмена</button><button onClick={saveProduct} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold">Сохранить</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white relative bg-black">
      <style jsx global>{`
        @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .glass-panel { background: rgba(30, 30, 30, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 1.5rem; }
        .glass-card { background: rgba(40, 40, 40, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; transition: all 0.3s ease; }
        .glass-card:hover { background: rgba(50, 50, 50, 0.8); border-color: rgba(255, 94, 0, 0.4); transform: translateY(-2px); }
        .gradient-text { background: linear-gradient(135deg, #ff5e00, #ff1493); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .lava-lamp { position: fixed; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; z-index: 0; pointer-events: none; }
        .lava-blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.35; animation: float 25s infinite ease-in-out; }
        .lava-blob-1 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(255, 94, 0, 0.6), transparent); top: -150px; left: -150px; }
        .lava-blob-2 { width: 450px; height: 450px; background: radial-gradient(circle, rgba(255, 20, 147, 0.6), transparent); bottom: -150px; right: -150px; animation-delay: -8s; }
        .lava-blob-3 { width: 400px; height: 400px; background: radial-gradient(circle, rgba(255, 140, 0, 0.5), transparent); top: 40%; left: 30%; animation-delay: -16s; }
        .lava-blob-4 { width: 350px; height: 350px; background: radial-gradient(circle, rgba(255, 94, 0, 0.4), transparent); top: 60%; right: 20%; animation-delay: -12s; }
        @keyframes float { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(80px, -80px) scale(1.1); } 66% { transform: translate(-60px, 60px) scale(0.9); } }
        @media (min-width: 768px) { body { overflow-y: auto !important; height: auto !important; } .min-h-screen { min-height: 100vh; } .max-w-md { max-width: 480px; margin-left: auto; margin-right: auto; } }
      `}</style>
      <div className="lava-lamp"><div className="lava-blob lava-blob-1"></div><div className="lava-blob lava-blob-2"></div><div className="lava-blob lava-blob-3"></div><div className="lava-blob lava-blob-4"></div></div>

      {notification && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"><div className={`w-full max-w-[280px] rounded-xl p-3 backdrop-blur-2xl border shadow-2xl transition-all ${notificationVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} ${notification.type === 'error' ? 'bg-red-500/20 border-red-500/40' : 'bg-green-500/20 border-green-500/40'}`}><div className="flex flex-col items-center text-center"><div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${notification.type === 'error' ? 'bg-red-500/30' : 'bg-green-500/30'}`}>{notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-300" /> : <CheckCircle className="w-5 h-5 text-green-300" />}</div><p className={`text-xs font-medium ${notification.type === 'error' ? 'text-red-100' : 'text-green-100'}`}>{notification.message}</p></div></div></div>)}

      {showFirstTimeTutorial && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-6 relative z-10">{tutorialStep === 0 && (<div className="text-center"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-white" /></div><h2 className="text-xl font-bold text-white mb-3">Добро пожаловать!</h2><p className="text-gray-400 text-xs mb-4">Быстрый гайд по заказу</p><button onClick={() => setTutorialStep(1)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Начать</button></div>)}{tutorialStep === 1 && (<div className="text-center"><div className="text-4xl mb-4">️</div><h2 className="text-xl font-bold text-white mb-3">Шаг 1: Выбирай товары</h2><p className="text-gray-400 text-xs mb-4">Нажми на карточку чтобы выбрать вкус</p><button onClick={() => setTutorialStep(2)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Далее</button></div>)}{tutorialStep === 2 && (<div className="text-center"><div className="text-4xl mb-4">📋</div><h2 className="text-xl font-bold text-white mb-3">Шаг 2: Смотри список</h2><p className="text-gray-400 text-xs mb-4">Кнопка корзины внизу справа</p><button onClick={() => setTutorialStep(3)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Далее</button></div>)}{tutorialStep === 3 && (<div className="text-center"><div className="text-4xl mb-4">📤</div><h2 className="text-xl font-bold text-white mb-3">Шаг 3: Отправляй</h2><p className="text-gray-400 text-xs mb-4">Нажми "Отправить" для перехода в Telegram</p><button onClick={() => { setShowFirstTimeTutorial(false); setTutorialStep(0); }} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">Понятно!</button></div>)}</div></div>)}

      {showSubscribePrompt && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-6 text-center relative z-10"><button onClick={() => setShowSubscribePrompt(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5"><X className="w-4 h-4 text-gray-400" /></button><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Send className="w-10 h-10 text-white" /></div><h2 className="text-xl font-bold text-white mb-2">Подпишись на канал</h2><button onClick={() => { if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openTelegramLink) (window as any).Telegram.WebApp.openTelegramLink(CHANNEL_LINK); else window.open(CHANNEL_LINK, '_blank'); setTimeout(() => setShowSubscribePrompt(false), 1000); }} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white mb-2">Подписаться</button><button onClick={() => setShowSubscribePrompt(false)} className="w-full py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs">Продолжить</button></div></div>)}

      {showSendConfirm && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-6 text-center relative z-10"><div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Send className="w-10 h-10 text-white" /></div><h2 className="text-xl font-bold text-white mb-2">Отправить заявку?</h2><p className="text-gray-400 text-xs mb-4">Тебя перекинет в Telegram с готовым списком</p><div className="glass-card p-3 mb-4 text-left"><p className="text-xs text-gray-400 mb-1">Товаров: <span className="text-white font-bold">{totalListItems}</span></p><p className="text-xs text-gray-400">Сумма: <span className="gradient-text font-bold">{totalListPrice.toFixed(2)} BYN</span></p></div><div className="flex gap-2"><button onClick={() => setShowSendConfirm(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400">Отмена</button><button onClick={sendToManager} disabled={isSending} className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white disabled:opacity-50">{isSending ? '...' : 'Отправить'}</button></div></div></div>)}

      {showInstructions && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm max-h-[80vh] overflow-y-auto p-5 relative z-10"><div className="flex items-center justify-between mb-5"><button onClick={() => { setShowInstructions(false); setShowSettings(true); }} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:scale-110 transition-all"><svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></button><h2 className="text-xl font-bold gradient-text">Инструкция</h2><div className="w-10"></div></div><div className="space-y-3 text-xs text-gray-300"><div className="glass-card p-3"><h3 className="font-bold text-orange-400 mb-1">1. Выбор товара</h3><p>Нажми на карточку товара</p></div><div className="glass-card p-3"><h3 className="font-bold text-orange-400 mb-1">2. Выбор вкуса</h3><p>Отметь галочкой нужные вкусы</p></div><div className="glass-card p-3"><h3 className="font-bold text-orange-400 mb-1">3. Просмотр списка</h3><p>Кнопка корзины внизу справа</p></div><div className="glass-card p-3"><h3 className="font-bold text-orange-400 mb-1">4. Отправка</h3><p>Нажми "Отправить"</p></div></div></div></div>)}

      {showAbout && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-6 text-center relative z-10"><div className="flex items-center justify-between mb-5"><button onClick={() => { setShowAbout(false); setShowSettings(true); }} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center hover:scale-110 transition-all"><svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></button><h2 className="text-xl font-bold gradient-text">О приложении</h2><div className="w-10"></div></div><div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center"><Cloud className="w-10 h-10 text-white" /></div><h3 className="text-xl font-bold mb-1">Liq<span className="text-orange-500">Vape</span></h3><p className="text-gray-400 text-xs mb-4">Premium vape shop</p><div className="glass-card p-3 mb-4 text-left space-y-1 text-xs"><p className="text-gray-400">Версия: <span className="text-white">3.0.0</span></p><p className="text-gray-400">Канал: <span className="text-orange-400">@{CHANNEL_USERNAME}</span></p><p className="text-gray-400">Менеджер: <span className="text-orange-400">@{MANAGER_USERNAME}</span></p></div><p className="text-[10px] text-gray-500">© 2026 LiqVape</p></div></div>)}

      {showSettings && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-5 relative z-10"><div className="flex items-center justify-between mb-5"><h2 className="text-xl font-bold gradient-text">Настройки</h2><button onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-orange-500/30"><Cloud className="w-5 h-5 text-white" /></button></div><div className="space-y-2.5"><button onClick={() => { setShowSettings(false); setShowInstructions(true); }} className="w-full glass-card p-4 flex items-center gap-3 text-left hover:bg-white/10 hover:border-orange-500/40 transition-all group cursor-pointer"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center group-hover:scale-110 transition-all"><HelpCircle className="w-5 h-5 text-orange-400" /></div><div className="flex-1"><p className="text-sm font-bold text-white">Инструкция</p><p className="text-[11px] text-gray-400">Как пользоваться</p></div><svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button><button onClick={() => { setShowSettings(false); setShowAbout(true); }} className="w-full glass-card p-4 flex items-center gap-3 text-left hover:bg-white/10 hover:border-orange-500/40 transition-all group cursor-pointer"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center group-hover:scale-110 transition-all"><Info className="w-5 h-5 text-orange-400" /></div><div className="flex-1"><p className="text-sm font-bold text-white">О приложении</p><p className="text-[11px] text-gray-400">LiqVape v3.0</p></div><svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button><button onClick={() => { setShowSettings(false); setShowAdminLogin(true); }} className="w-full glass-card p-4 flex items-center gap-3 text-left hover:bg-white/10 hover:border-orange-500/40 transition-all group cursor-pointer"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/30 flex items-center justify-center group-hover:scale-110 transition-all"><LogIn className="w-5 h-5 text-orange-400" /></div><div className="flex-1"><p className="text-sm font-bold text-white">Вход в админку</p><p className="text-[11px] text-gray-400">Только для администраторов</p></div><svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button></div></div></div>)}

      {showAdminLogin && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"><div className="glass-panel w-full max-w-sm p-5 relative z-10"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold gradient-text">Вход для админа</h2><button onClick={() => setShowAdminLogin(false)} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-orange-500/30"><Cloud className="w-5 h-5 text-white" /></button></div><input type="password" placeholder="Пароль" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" /><button onClick={handleAdminLogin} className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-bold hover:from-orange-600 hover:to-pink-600 transition-all">Войти</button></div></div>)}

      {loadingProgress > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="glass-panel w-full max-w-sm p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center animate-pulse">
              <Cloud className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">LiqVape</h2>
            <p className="text-sm text-gray-400 mb-6">{loadingMessage}</p>
            <div className="w-full bg-white/10 rounded-full h-3 mb-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${loadingProgress}%` }}></div>
            </div>
            <p className="text-xs text-gray-500">{Math.round(loadingProgress)}%</p>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto px-3 relative z-10 pb-24">
        <div className="sticky top-0 z-40 -mx-3 px-3 py-2 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/40"><Cloud className="w-5 h-5 text-white" strokeWidth={2.5} /></div>
            <div><h1 className="text-2xl font-bold"><span className="text-white">Liq</span><span className="gradient-text">Vape</span></h1><p className="text-[10px] text-gray-500">premium shop</p></div>
            <div className="ml-auto"><button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center"><Settings className="w-4 h-4 text-orange-400" /></button></div>
          </div>
        </div>
        <div onClick={() => { if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openTelegramLink) (window as any).Telegram.WebApp.openTelegramLink(CHANNEL_LINK); else window.open(CHANNEL_LINK, '_blank'); }} className="relative my-3 rounded-xl overflow-hidden cursor-pointer group" style={{ background: 'linear-gradient(90deg, #ff5e00, #ff007f, #ff5e00)', backgroundSize: '200% 100%', animation: 'gradient-shift 3s ease infinite' }}>
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-all"></div>
          <div className="relative py-2 text-center"><span className="text-xs font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"> ПОДПИШИСЬ НА @{CHANNEL_USERNAME} • НОВИНКИ • АКЦИИ</span></div>
        </div>
        <div className="pt-3">
          <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder="Поиск товаров..." className="w-full glass-panel py-3 pl-10 pr-3 text-sm text-white" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">{CATEGORIES.map((c) => (<button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-medium ${selectedCategory === c ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400'}`}>{c}</button>))}</div>
          <div className="mb-4 text-xs text-gray-500">Найдено: <span className="text-orange-500 font-bold">{sortedProducts.length}</span> товаров{hasMore && <span className="text-gray-600"> • Показано: {displayCount}</span>}</div>
          
          {isLoading ? (
             <div className="glass-panel p-8 text-center"><div className="animate-pulse space-y-4"><div className="h-4 w-24 bg-white/10 rounded mx-auto"></div><p className="text-gray-500 text-sm">Загрузка...</p></div></div>
          ) : sortedProducts.length === 0 ? (
            <div className="glass-panel p-8 text-center"><Package className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Товары не найдены</p></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 pb-4 auto-rows-fr">
                {visibleProducts.map((p) => {
                  const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
                  const isAvailable = totalStock > 0 || p.is_preorder;
                  const inList = selectionList.filter(i => i.productId === p.id).reduce((s, i) => s + i.quantity, 0);
                  return (
                    <div key={p.id} onClick={() => { if (isAvailable) openProductModal(p); }} className={`glass-card p-3 transition-all flex flex-col h-full ${isAvailable ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/20' : 'opacity-40 cursor-not-allowed'}`}>
                      <div className="w-full aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden border border-white/10 flex-shrink-0">
                        {p.image ? (<img src={p.image} alt={p.name} className="w-full h-full object-contain p-4 rounded-2xl" loading="eager" />) : (<Package className="w-12 h-12 text-neutral-600" />)}
                        {p.is_preorder && (<div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold">ПРЕДЗАКАЗ</div>)}
                      </div>
                      <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-center text-white leading-tight flex-grow">{p.name}</h3>
                      <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <span className="text-base font-bold gradient-text">
                          {(() => {
                            const prices = p.variants.map(v => (v.price !== undefined && v.price !== null && v.price > 0) ? v.price : p.price);
                            const minP = Math.min(...prices); const maxP = Math.max(...prices);
                            return minP === maxP ? `${minP} BYN` : `${minP}-${maxP} BYN`;
                          })()}
                        </span>
                        <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded-full">{p.category}</span>
                      </div>
                      {inList > 0 ? (
                        <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/40 text-orange-400 text-xs font-bold text-center flex-shrink-0"> в списке: {inList}</div>
                      ) : (
                        <div className={`w-full py-2.5 rounded-xl text-xs font-bold text-center flex-shrink-0 ${isAvailable ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/30' : 'bg-white/5 text-gray-500'}`}>
                          {isAvailable ? (p.is_preorder ? ' Предзаказ' : '➕ Выбрать') : 'Нет в наличии'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div id="load-more-sentinel" className="h-20 flex items-center justify-center">
                {hasMore && (<div className="glass-panel px-4 py-2"><div className="animate-pulse text-xs text-gray-400">Загрузка ещё товаров...</div></div>)}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedProduct && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }}></div><div className="relative glass-panel w-full max-w-sm max-h-[90vh] overflow-y-auto relative z-10"><button onClick={() => { setSelectedProduct(null); setSelectedVariants([]); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center z-10"><X className="w-4 h-4" /></button><div className="p-4">{selectedProduct.image && (<div className="w-full aspect-square bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-2xl mb-4 flex items-center justify-center border border-white/10"><img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain p-6 rounded-2xl" loading="eager" /></div>)}<h2 className="text-xl font-bold mb-1 text-center">{selectedProduct.name}</h2>{selectedProduct.is_preorder && (<div className="text-center mb-2"><span className="text-[10px] px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">ПРЕДЗАКАЗ</span></div>)}<p className="text-sm text-gray-400 mb-4 text-center">Выберите вкусы и количество</p>{sortedVariants.length > 0 && (<div className="mb-4"><div className="space-y-1.5">{visibleVariants.map((v) => { const avail = getAvailableStock(selectedProduct.id, v.name); const isSelected = selectedVariants.some(sv => sv.name === v.name); const selectedQty = selectedVariants.find(sv => sv.name === v.name)?.quantity || 1; const isAvailable = avail > 0 || selectedProduct.is_preorder; return (<div key={v.name} className={`rounded-lg border transition-all ${isSelected ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/5 bg-white/5'} ${!isAvailable ? 'opacity-50 grayscale-[0.5]' : ''}`}><div className="flex items-center justify-between p-2.5"><div className="flex items-center gap-2 flex-1"><input type="checkbox" checked={isSelected} onChange={() => isAvailable && toggleVariantSelection(v.name)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" disabled={!isAvailable} /><div><span className={`text-xs font-medium ${!isAvailable ? 'text-gray-500 line-through' : ''}`}>{v.name}</span><span className="text-[10px] text-gray-400 ml-2">{(v.price !== undefined && v.price !== null && v.price > 0) ? v.price : selectedProduct.price} BYN</span></div></div><span className={`text-[10px] font-medium ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>{isAvailable ? avail + ' шт.' : 'Нет в наличии'}</span></div>{isSelected && isAvailable && (<div className="flex items-center justify-between px-2.5 pb-2.5 border-t border-white/5 pt-2"><span className="text-[10px] text-gray-400">Количество:</span><div className="flex items-center gap-2"><button onClick={() => updateVariantQuantity(v.name, -1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button><span className="text-xs font-bold w-6 text-center">{selectedQty}</span><button onClick={() => updateVariantQuantity(v.name, 1)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Plus className="w-3 h-3" /></button></div></div>)}</div>); })}</div>{hiddenVariantsCount > 0 && !showAllVariants && (<button onClick={() => setShowAllVariants(true)} className="w-full mt-2 py-2 rounded-lg border border-orange-500/30 text-orange-400 text-xs">↓ Ещё {hiddenVariantsCount}</button>)}{showAllVariants && hiddenVariantsCount > 0 && (<button onClick={() => setShowAllVariants(false)} className="w-full mt-2 py-2 rounded-lg border border-white/10 text-gray-400 text-xs">↑ Свернуть</button>)}</div>)}{selectedVariants.length > 0 ? (<button onClick={addSelectedToList} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white">В список • {selectedVariants.reduce((s, sv) => { const v = selectedProduct.variants.find(x => x.name === sv.name); const price = (v?.price !== undefined && v?.price !== null && v.price > 0) ? v.price : selectedProduct.price; return s + price * sv.quantity; }, 0)} BYN</button>) : (<div className="w-full py-3 rounded-xl font-bold bg-white/5 text-center text-gray-400 text-sm">Выберите хотя бы один вкус</div>)}</div></div></div>)}

      {showList && (<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3"><div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowList(false)}></div><div className="relative glass-panel w-full max-w-md rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto relative z-10"><div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 p-3 flex items-center justify-between"><h2 className="text-lg font-bold">Мой список</h2><div className="flex items-center gap-1.5">{selectionList.length > 0 && <button onClick={clearList} className="text-[10px] text-red-400">Очистить</button>}<button onClick={() => setShowList(false)} className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-orange-500/30"><Cloud className="w-5 h-5 text-white" /></button></div></div><div className="p-3">{selectionList.length === 0 ? (<div className="text-center py-8"><ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-700" /><p className="text-gray-500 text-sm">Список пуст</p></div>) : (<div>{groupedSelectionList.map(([productName, items]) => (<div key={productName} className="mb-3"><div className="text-xs font-bold text-orange-400 mb-1.5 px-1">{productName}</div><div className="space-y-1.5">{items.map((item) => { const idx = selectionList.indexOf(item); return (<div key={idx} className={`glass-card p-2.5 ${item.isPreorder ? 'border-orange-500/30' : ''}`}><div className="flex items-start justify-between mb-1.5"><div className="flex-1"><p className="text-xs font-medium">{item.variant}{item.isPreorder && <span className="ml-1 text-[9px] text-orange-400">[ПРЕДЗАКАЗ]</span>}</p><p className="text-[10px] text-gray-400">{item.price} BYN</p></div><button onClick={() => removeFromList(idx)} className="w-6 h-6 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button></div><div className="flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => updateListQuantity(idx, -1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Minus className="w-2.5 h-2.5" /></button><span className="text-xs font-bold w-5 text-center">{item.quantity}</span><button onClick={() => updateListQuantity(idx, 1)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center"><Plus className="w-2.5 h-2.5" /></button></div><span className="text-sm font-bold gradient-text">{item.price * item.quantity} BYN</span></div></div>); })}</div></div>))}<div className="border-t border-white/10 pt-3 mt-3"><div className="flex items-center justify-between mb-3"><span className="text-gray-400 text-sm">Итого:</span><span className="text-xl font-bold gradient-text">{totalListPrice.toFixed(2)} BYN</span></div><button onClick={() => setShowSendConfirm(true)} className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white flex items-center justify-center gap-1.5"><Send className="w-4 h-4" /> Отправить менеджеру</button></div></div>)}</div></div></div>)}

      {selectionList.length > 0 && (<button onClick={() => setShowList(true)} className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 shadow-lg shadow-orange-500/40 flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-white" /><span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-orange-500 text-[10px] font-bold flex items-center justify-center">{totalListItems}</span></button>)}
    </div>
  );
}
