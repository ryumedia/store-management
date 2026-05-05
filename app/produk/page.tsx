'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, X, RefreshCw, FileUp, Info, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp, updateDoc, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function ProductPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(10); // Menampilkan 10 produk per halaman
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    brandId: '',
    modelId: '',
    colorId: '',
    sizeId: '',
    sequenceNumber: '',
    minQty: 0,
    hpp: 0,
    price: 0,
    companyId: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === 'ali@gmail.com') {
          setIsSuperAdmin(true);
        } else {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("uid", "==", user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0].data();
            setUserCompanyId(userDoc.companyId);
          }
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Companies untuk Dropdown (hanya untuk super admin)
  useEffect(() => {
    if (isSuperAdmin) {
      const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const companyList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCompanies(companyList);
      });
      return () => unsubscribe();
    }
  }, [isSuperAdmin]);

  // Fetch Products Realtime
  useEffect(() => {
    if (loading) return;

    let productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));

    if (!isSuperAdmin && userCompanyId) {
      productsQuery = query(productsQuery, where('companyId', '==', userCompanyId));
    }

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
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
  }, [loading, isSuperAdmin, userCompanyId]);

  // Fetch Data Pengaturan (Brands, Models, Colors, Sizes)
  useEffect(() => {
    if (loading) return;

    const getMetadataQuery = (colName: string) => {
      let q = query(collection(db, colName), orderBy('name'));
      if (!isSuperAdmin && userCompanyId) {
        q = query(q, where('companyId', '==', userCompanyId));
      }
      return q;
    };

    const unsubBrands = onSnapshot(getMetadataQuery('brands'), (snap) => {
      setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubModels = onSnapshot(getMetadataQuery('models'), (snap) => {
      setModels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubColors = onSnapshot(getMetadataQuery('colors'), (snap) => {
      setColors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSizes = onSnapshot(getMetadataQuery('sizes'), (snap) => {
      setSizes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubBrands();
      unsubModels();
      unsubColors();
      unsubSizes();
    };
  }, [loading, isSuperAdmin, userCompanyId]);

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
        companyId: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const processUpload = async () => {
    if (!selectedFile) return;

    const targetCompanyId = isSuperAdmin ? formData.companyId : userCompanyId;
    
    if (isSuperAdmin && !targetCompanyId) {
      alert("Sebagai Super Admin, silakan buka modal 'Tambah Produk' dan pilih Company terlebih dahulu agar data yang diunggah memiliki relasi perusahaan yang tepat.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const existingSkus = new Set(
          products
            .filter(p => p.companyId === targetCompanyId)
            .map(p => p.sku.toUpperCase())
        );

        let addedCount = 0;
        let skipCount = 0;

        for (const row of data as any[]) {
          const sku = (row['SKU.'] || row['SKU'] || '').toString().trim().toUpperCase();
          
          if (!sku) continue;

          // Cek duplikat dalam database lokal (produk yang sudah ada + yang sedang diproses)
          if (existingSkus.has(sku)) {
            skipCount++;
            continue;
          }

          await addDoc(collection(db, 'products'), {
            name: row['Nama.'] || row['Nama'] || '',
            sku: sku,
            itemCode: row['Item Code.'] || row['Item Code'] || '',
            minQty: Number(row['Min QTY.'] || row['Min QTY'] || 0),
            hpp: Number(row['HPP.'] || row['HPP'] || 0),
            price: Number(row['Harga.'] || row['Harga'] || 0),
            companyId: targetCompanyId,
            createdAt: serverTimestamp(),
            brandId: '', modelId: '', colorId: '', sizeId: '', sequenceNumber: ''
          });

          existingSkus.add(sku);
          addedCount++;
        }

        if (skipCount > 0) {
          alert(`Selesai! ${addedCount} produk berhasil ditambahkan, ${skipCount} produk dilewati karena SKU sudah ada.`);
        } else {
          alert(`Berhasil mengunggah ${addedCount} produk ke sistem.`);
        }

        setIsUploadModalOpen(false);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error("Error processing excel:", error);
        alert("Gagal memproses file Excel. Pastikan format dan header kolom sudah sesuai.");
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Logika Pencarian
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Logika Paginasi
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

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

    const targetCompanyId = isSuperAdmin ? formData.companyId : userCompanyId;

    // Cek duplikat SKU
    const isSkuDuplicate = products.some(p => 
      p.sku.toUpperCase() === generatedSKU.toUpperCase() && 
      p.id !== editingId && 
      p.companyId === targetCompanyId
    );

    if (isSkuDuplicate) {
      alert(`Gagal: SKU "${generatedSKU}" sudah digunakan oleh produk lain di perusahaan ini.`);
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
          companyId: targetCompanyId,
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
        companyId: '',
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
        <div className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />
          <button
            onClick={() => {
              setSelectedFile(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <FileUp className="w-4 h-4 mr-2" />
            Upload Excel
          </button>
          <button
            className="flex items-center px-4 py-2 bg-secondary text-black rounded-md hover:opacity-90 transition-opacity shadow-sm"
            onClick={() => handleOpenModal()}
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end mb-4">
        <input
          type="text"
          placeholder="Cari produk (Nama, SKU, Item Code)..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} // Reset halaman saat mencari
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
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
              ) : currentProducts.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500">Belum ada data produk.</td></tr>
              ) : (
                currentProducts.map((product, index) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
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

      {/* Pagination Controls */}
      {filteredProducts.length > productsPerPage && (
        <div className="flex justify-center items-center space-x-2 mt-4">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => paginate(i + 1)}
              className={`px-3 py-1 border rounded-md text-sm font-medium ${
                currentPage === i + 1 ? 'bg-secondary text-black border-secondary' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

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
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select
                    required
                    value={formData.companyId}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      companyId: e.target.value,
                      // Reset dependent fields when company changes
                      brandId: '', modelId: '', colorId: '', sizeId: ''
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  >
                    <option value="">Pilih Company</option>
                    {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select required value={formData.brandId} onChange={(e) => setFormData({ ...formData, brandId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Brand</option>
                    {brands
                      .filter(b => !formData.companyId || b.companyId === formData.companyId)
                      .map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select required value={formData.modelId} onChange={(e) => setFormData({ ...formData, modelId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Model</option>
                    {models
                      .filter(m => !formData.companyId || m.companyId === formData.companyId)
                      .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warna</label>
                  <select required value={formData.colorId} onChange={(e) => setFormData({ ...formData, colorId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Warna</option>
                    {colors
                      .filter(c => !formData.companyId || c.companyId === formData.companyId)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ukuran</label>
                  <select required value={formData.sizeId} onChange={(e) => setFormData({ ...formData, sizeId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Ukuran</option>
                    {sizes
                      .filter(s => !formData.companyId || s.companyId === formData.companyId)
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    }
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

      {/* Modal Cara Upload Excel */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <div className="flex items-center">
                <Info className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Petunjuk Upload Excel</h3>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-sm text-blue-700 font-medium mb-2">Pastikan file Anda memenuhi syarat berikut:</p>
                <ul className="text-xs text-blue-600 space-y-2 list-disc ml-4">
                  <li>Format file harus <strong>.xlsx</strong> atau <strong>.xls</strong></li>
                  <li>Header baris pertama harus berisi:<br />
                    <code className="bg-blue-100 px-1 py-0.5 rounded text-[10px] font-bold block mt-1">
                      No. Nama. SKU. Item Code. Min QTY. HPP. Harga.
                    </code>
                  </li>
                  <li>Pastikan tidak ada baris kosong di antara data produk.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${
                    selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-secondary bg-gray-50'
                  }`}
                >
                  {selectedFile ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <span className="text-sm font-medium text-green-700 truncate max-w-full px-4">{selectedFile.name}</span>
                      <span className="text-xs text-green-500 mt-1">Klik untuk mengganti file</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm font-medium text-gray-600">Pilih File Excel</span>
                      <span className="text-xs text-gray-400 mt-1">Klik untuk mencari file</span>
                    </>
                  )}
                </button>
              </div>

              {isSuperAdmin && !formData.companyId && (
                <p className="text-xs text-red-500 italic font-medium">
                  * Sebagai Super Admin, pastikan Anda telah memilih Company di form "Tambah Produk" terlebih dahulu.
                </p>
              )}

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsUploadModalOpen(false)} 
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Batal
                </button>
                <button 
                  onClick={processUpload}
                  disabled={!selectedFile || isSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting ? 'Mengunggah...' : 'Unggah Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}