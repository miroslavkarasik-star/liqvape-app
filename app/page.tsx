'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Cloud, Package, X, Plus, Minus, ShoppingBag, Trash2, CheckCircle, AlertCircle, Edit, Send, Settings, HelpCircle, Info, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['Все', 'Жидкости', 'Расходники', 'Снюс', 'POD-системы', 'Одноразки', 'Табак-угли', 'Другое'];
const CATEGORY_PRIORITY: Record<string, number> = { 'Жидкости': 1, 'Снюс': 2, 'Расходники': 3, 'POD-системы': 4, 'Одноразки': 5, 'Табак-угли': 6, 'Другое': 7 };

const ADMIN_PASSWORD = 'K7m2Q9';
const MANAGER_USERNAME = 'LiqVape_2';
const CHANNEL_USERNAME = 'zslvape';

interface Variant { name: string; stock: number; price?: number; }
interface Product { id: string; name: string; category: string; price: number; image: string | null; variants: Variant[]; is_hidden: boolean; is_preorder: boolean; created_at?: string; }
interface ListItem { productId: string; productName: string; variant: string; price: number; quantity: number; isPreorder: boolean; }

const BATCH_SIZE = 12;
const CACHE_DURATION = 60 * 60 * 1000;

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
  const [editingProduct, setEditingProduct] = useState<Partial<Product> & { id?: string; imageFile?: File } | null>(null);
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
  const [isUploading, setIsUploading] = useState(false);

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
      
      if (!silent) setLoadingProgress(40);
      
      // ЗАГРУЗКА ИЗ SUPABASE (не Firebase!)
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      if (!silent) setLoadingProgress(70);
      
      const parsed: Product[] = [];
      productsData?.forEach((p: any) => {
        if (!includeHidden && p.is_hidden) return;
        const variants = (p.flavors || []).map((v: any) => ({
          name: String(v.name || ''),
          stock: Number(v.stock) || 0,
          price: v.price !== undefined ? Number(v.price) : p.price
        }));
        parsed.push({
          id: p.id,
          name: p.name,
          category: p.category || 'Другое',
          price: Number(p.price) || 0,
          image: p.image_url || null,
          variants: variants,
          is_hidden: Boolean(p.is_hidden),
          is_preorder: Boolean(p.is_preorder),
          created_at: p.created_at || new Date().toISOString()
        });
      });
      
      if (!silent) setLoadingProgress(90);
      
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
      
      console.log('✅ Supabase load complete in', Date.now() - startTime, 'ms, products:', parsed.length);
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
      const { data: requestsData, error } = await supabase.from('user_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setAllRequests(requestsData || []);
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
      const aCat = CATEGORY_PRIORITY[a.category] || 99;
      const bCat = CATEGORY_PRIORITY[b.category] || 99;
      if (aCat !== bCat) return aCat - bCat;
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
    try { 
      const { error } = await supabase.from('user_requests').insert({
        user_id: userId,
        username: 'Клиент',
        items: selectionList,
        total_price: totalPrice,
        status: 'new',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
    } catch(e) { console.error('Background save failed:', e); }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;
    
    setIsUploading(true);
    showNotification('Загрузка фото...');
    
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8);
      });
      
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      
      setEditingProduct({ ...editingProduct, image: urlData.publicUrl });
      showNotification('Фото загружено!', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showNotification('Ошибка загрузки фото', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const saveProduct = async () => {
    if (!editingProduct?.name || !editingProduct.price) { showNotification('Заполните название и цену', 'error'); return; }
    const data: any = {
      name: editingProduct.name,
      price: Number(editingProduct.price),
      category: editingProduct.category || 'Другое',
      image_url: editingProduct.image || null,
      flavors: formVariants,
      stock_quantity: formVariants.reduce((s, f) => s + (f.stock || 0), 0),
      is_hidden: Boolean(editingProduct.is_hidden),
      is_preorder: Boolean(editingProduct.is_preorder)
    };
    if (!editingProduct.id) data.created_at = new Date().toISOString();
    try {
      if (editingProduct.id) {
        const { error } = await supabase.from('products').update(data).eq('id', editingProduct.id);
        if (error) throw error;
        showNotification('Товар обновлён', 'success');
      } else {
        const { error } = await supabase.from('products').insert(data);
        if (error) throw error;
        showNotification('Товар добавлен', 'success');
      }
      setShowProductForm(false); setEditingProduct(null); setFormVariants([]); await loadProducts(true);
    } catch(e) { showNotification('Ошибка: ' + (e as Error).message, 'error'); }
  };

  const toggleHidden = async (p: Product) => { 
    const { error } = await supabase.from('products').update({ is_hidden: !p.is_hidden }).eq('id', p.id);
    if (error) { showNotification('Ошибка', 'error'); return; }
    await loadProducts(true); 
  };
  const togglePreorder = async (p: Product) => { 
    const { error } = await supabase.from('products').update({ is_preorder: !p.is_preorder }).eq('id', p.id);
    if (error) { showNotification('Ошибка', 'error'); return; }
    await loadProducts(true); 
  };
  const deleteProduct = async (id: string) => {
    if (!confirm('Удалить товар?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { showNotification('Ошибка', 'error'); return; }
    await loadProducts(true);
    showNotification('Товар удалён');
  };
  const deleteRequest = async (id: string) => {
    if (!confirm('Заказ обработан? Удалить из списка?')) return;
    const { error } = await supabase.from('user_requests').delete().eq('id', id);
    if (error) { showNotification('Ошибка', 'error'); return; }
    await loadAllRequests();
    showNotification('Заказ удален', 'success');
  };

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

  // ... (далее идёт JSX код, который слишком длинный для этого ответа, но он остаётся без изменений)
  // Просто скопируй весь JSX из предыдущего полного кода

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-black text-white p-3">
        <h1>Admin Panel - SUPABASE</h1>
        <p>Working with Supabase, not Firebase!</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <h1>LiqVape - SUPABASE</h1>
      <p>Loading from Supabase database...</p>
      {loadingProgress > 0 && <div>Progress: {loadingProgress}%</div>}
    </div>
  );
}
