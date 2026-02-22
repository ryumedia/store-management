'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export default function ProductPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    brandId: '',
    modelId: '',
    colorId: '',
    sizeId: '',
    sequenceNumber: '',
    minQty: 0,
    hpp: 0,
    price: 0,
    companyId: ''
  });

  // Fetch Products Realtime
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Companies untuk Dropdown
  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const companyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companyList);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data Pengaturan (Brands, Models, Colors, Sizes)
  useEffect(() => {
    const unsubBrands = onSnapshot(query(collection(db, 'brands'), orderBy('name')), (snap) => {
      setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubModels = onSnapshot(query(collection(db, 'models'), orderBy('name')), (snap) => {
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubColors = onSnapshot(query(collection(db, 'colors'), orderBy('name')), (snap) => {
      setColors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSizes = onSnapshot(query(collection(db, 'sizes'), orderBy('name')), (snap) => {
      setSizes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBrands();
      unsubModels();
      unsubColors();
      unsubSizes();
    };
  }, []);

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus produk ini?")) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error("Error deleting product: ", error);
        alert("Gagal menghapus produk");
      }
    }
  };

  // Format Mata Uang IDR
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  // Helper untuk mendapatkan nama company berdasarkan ID
  const getCompanyName = (id: string) => {
    const company = companies.find(c => c.id === id);
    return company ? company.name : '-';
  };

  const handleOpenModal = (product?: any) => {
    if (product) {
      // Mode Edit
      setEditingId(product.id);
      setFormData({
        brandId: product.brandId || '',
        modelId: product.modelId || '',
        colorId: product.colorId || '',
        sizeId: product.sizeId || '',
        sequenceNumber: product.sequenceNumber || '',
        minQty: product.minQty || 0,
        hpp: product.hpp || 0,
        price: product.price || 0,
        companyId: product.companyId || '',
      });
    } else {
      // Mode Tambah
      setEditingId(null);
      setFormData({
        brandId: '', modelId: '', colorId: '', sizeId: '',
        sequenceNumber: '',
        minQty: 0, hpp: 0, price: 0,
        companyId: ''
      });
    }
    setIsModalOpen(true);
  };


  // Logika Otomatisasi Field
  const selectedBrand = brands.find(b => b.id === formData.brandId);
  const selectedModel = models.find(m => m.id === formData.modelId);
  const selectedColor = colors.find(c => c.id === formData.colorId);
  const selectedSize = sizes.find(s => s.id === formData.sizeId);

  // 1. Nama Produk: Model + Warna + Ukuran
  const generatedName = (selectedModel && selectedColor && selectedSize) 
    ? `${selectedModel.name} ${selectedColor.name} ${selectedSize.name}`.toUpperCase()
    : '';

  // 2. SKU: Brand Initial - Model Initial - Color Initial - Size Initial
  const generatedSKU = (selectedBrand && selectedModel && selectedColor && selectedSize)
    ? `${selectedBrand.initial}-${selectedModel.initial}-${selectedColor.initial}-${selectedSize.initial}`.toUpperCase()
    : '';

  // 3. Kode Prefix: Brand Code + Model Code
  const generatedCodePrefix = (selectedBrand && selectedModel)
    ? `${selectedBrand.code || ''}${selectedModel.code || ''}`
    : '';
  
  // 4. Item Code: Kode Prefix + Nomor Urut
  const finalItemCode = (generatedCodePrefix && formData.sequenceNumber)
    ? `${generatedCodePrefix}${formData.sequenceNumber}`
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!generatedName || !generatedSKU || !finalItemCode) {
      alert("Pastikan semua data Brand, Model, Warna, Ukuran, dan Nomor Urut terisi.");
      setIsSubmitting(false);
      return;
    }

    try {
      const productData = {
          name: generatedName,
          sku: generatedSKU,
          itemCode: finalItemCode,
          minQty: Number(formData.minQty),
          hpp: Number(formData.hpp),
          price: Number(formData.price),
          brandId: formData.brandId,
          modelId: formData.modelId,
          colorId: formData.colorId,
          sizeId: formData.sizeId,
          sequenceNumber: formData.sequenceNumber,
          companyId: formData.companyId,
      };

      if (editingId) {
        // Update produk yang ada
        const productRef = doc(db, 'products', editingId);
        await updateDoc(productRef, {
          ...productData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Tambah produk baru
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        brandId: '',
        modelId: '',
        colorId: '',
        sizeId: '',
        sequenceNumber: '',
        minQty: 0,
        hpp: 0,
        price: 0,
        companyId: ''
      });
    } catch (error) {
      console.error("Error adding product: ", error);
      alert("Gagal menyimpan produk.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Data Produk</h1>
        <button
          className="flex items-center px-4 py-2 bg-secondary text-black rounded-md hover:opacity-90 transition-opacity shadow-sm"
          onClick={() => handleOpenModal()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Produk
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min QTY</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HPP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500">Belum ada data produk.</td></tr>
              ) : (
                products.map((product, index) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCompanyName(product.companyId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.itemCode || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.minQty || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(product.hpp || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(product.price || 0)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button onClick={() => handleOpenModal(product)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Produk' : 'Tambah Produk'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Bagian Pilihan Atribut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select
                  required
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                >
                  <option value="">Pilih Company</option>
                  {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select required value={formData.brandId} onChange={(e) => setFormData({ ...formData, brandId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select required value={formData.modelId} onChange={(e) => setFormData({ ...formData, modelId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Model</option>
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warna</label>
                  <select required value={formData.colorId} onChange={(e) => setFormData({ ...formData, colorId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Warna</option>
                    {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ukuran</label>
                  <select required value={formData.sizeId} onChange={(e) => setFormData({ ...formData, sizeId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Ukuran</option>
                    {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Bagian Preview Otomatis */}
              <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Produk (Otomatis)</label>
                  <input type="text" readOnly value={generatedName} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="Pilih atribut di atas..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU (Otomatis)</label>
                    <input type="text" readOnly value={generatedSKU} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="-" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kode Prefix (Otomatis)</label>
                    <input type="text" readOnly value={generatedCodePrefix} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="-" />
                  </div>
                </div>
              </div>

              {/* Bagian Input Manual & Item Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Urut</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.sequenceNumber} 
                    onChange={(e) => setFormData({ ...formData, sequenceNumber: e.target.value })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" 
                    placeholder="Contoh: 001" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Code (Final)</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={finalItemCode} 
                    className="w-full px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-gray-900 font-bold focus:outline-none" 
                    placeholder="Prefix + No. Urut" 
                  />
                </div>
              </div>

              {/* Bagian Harga & Stok */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Qty</label>
                  <input 
                    type="number" 
                    min="0"
                    required 
                    value={formData.minQty} 
                    onChange={(e) => setFormData({ ...formData, minQty: Number(e.target.value) })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HPP (Rp)</label>
                  <input 
                    type="number" 
                    min="0"
                    required 
                    value={formData.hpp} 
                    onChange={(e) => setFormData({ ...formData, hpp: Number(e.target.value) })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Harga Jual (Rp)</label>
                  <input 
                    type="number" 
                    min="0"
                    required 
                    value={formData.price} 
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" 
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-black bg-secondary rounded-md hover:opacity-90 disabled:opacity-70">{isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Produk')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}