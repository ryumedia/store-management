'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, CheckSquare, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';

export default function StockProcessPage() {
  const [processedStocks, setProcessedStocks] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyId: '',
    date: new Date().toISOString().split('T')[0], // Default hari ini
    productId: '',
    productName: '',
    parentSku: '',
    sku: '',
    itemCode: '',
    quantity: 0,
    poReference: 'PO STOCK'
  });

  // Fetch Companies
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

  // Fetch Products untuk Dropdown
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data Realtime
  useEffect(() => {
    // Mengambil data dari koleksi 'stock_processes'
    const q = query(collection(db, 'stock_processes'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProcessedStocks(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching stock processes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data proses ini?")) {
      try {
        await deleteDoc(doc(db, 'stock_processes', id));
      } catch (error) {
        console.error("Error deleting stock process: ", error);
        alert("Gagal menghapus data");
      }
    }
  };

  // Handle Product Change (Otomatisasi Field)
  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    
    if (product) {
      // Logika SKU Induk: Mengambil 2 segmen pertama dari SKU (Brand-Model)
      // Asumsi format SKU di produk adalah: BRAND-MODEL-COLOR-SIZE
      const parentSku = product.sku ? product.sku.split('-').slice(0, 2).join('-') : '';
      
      setFormData(prev => ({
        ...prev,
        productId,
        productName: product.name,
        sku: product.sku || '',
        itemCode: product.itemCode || '',
        parentSku: parentSku
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productId: '',
        productName: '',
        sku: '',
        itemCode: '',
        parentSku: ''
      }));
    }
  };

  // Handle Open Modal (Add/Edit)
  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        companyId: item.companyId || '',
        date: item.date ? new Date(item.date.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        productId: item.productId || '',
        productName: item.productName || '',
        parentSku: item.parentSku || '',
        sku: item.sku || '',
        itemCode: item.itemCode || '',
        quantity: item.quantity || 0,
        poReference: item.poReference || 'PO STOCK'
      });
    } else {
      setEditingId(null);
      setFormData({
        companyId: '',
        date: new Date().toISOString().split('T')[0],
        productId: '',
        productName: '',
        parentSku: '',
        sku: '',
        itemCode: '',
        quantity: 0,
        poReference: 'PO STOCK'
      });
    }
    setIsModalOpen(true);
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        date: Timestamp.fromDate(new Date(formData.date)),
        quantity: Number(formData.quantity),
      };

      if (editingId) {
        await updateDoc(doc(db, 'stock_processes', editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'stock_processes'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      
      // Reset Form (kecuali tanggal mungkin user ingin input banyak di hari yang sama)
      setFormData(prev => ({ ...prev, productId: '', productName: '', parentSku: '', sku: '', itemCode: '', quantity: 0 }));
      setEditingId(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding stock process: ", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper untuk mendapatkan nama company berdasarkan ID
  const getCompanyName = (id: string) => {
    const company = companies.find(c => c.id === id);
    return company ? company.name : '-';
  };

  // Format Tanggal
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Stok Proses</h1>
        <button
          className="flex items-center px-4 py-2 bg-secondary text-black rounded-md hover:opacity-90 transition-opacity shadow-sm"
          onClick={() => handleOpenModal()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Proses
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU Induk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QTY</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Ref</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={10} className="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>
              ) : processedStocks.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-4 text-center text-gray-500">Belum ada produk dalam proses.</td></tr>
              ) : (
                processedStocks.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCompanyName(item.companyId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(item.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.productName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.parentSku || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sku || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.itemCode || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{item.quantity || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.poReference || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button onClick={() => handleOpenModal(item)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={() => alert('Fitur selesai akan dikonfigurasi.')} className="text-green-600 hover:text-green-900 transition-colors" title="Selesai"><CheckSquare className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Proses */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Proses Produksi' : 'Tambah Proses Produksi'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select required value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="">Pilih Company</option>
                    {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <select required value={formData.productId} onChange={handleProductChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                  <option value="">Pilih Produk</option>
                  {products
                    // Opsional: Filter produk berdasarkan company yang dipilih jika ada
                    .filter(p => !formData.companyId || p.companyId === formData.companyId)
                    .map(p => (<option key={p.id} value={p.id}>{p.name}</option>))
                  }
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU Induk (Otomatis)</label>
                  <input type="text" readOnly value={formData.parentSku} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="-" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU (Otomatis)</label>
                  <input type="text" readOnly value={formData.sku} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="-" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Code (Otomatis)</label>
                  <input type="text" readOnly value={formData.itemCode} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium focus:outline-none" placeholder="-" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input 
                    type="number" 
                    min="1"
                    required 
                    value={formData.quantity} 
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Reference</label>
                  <select 
                    required 
                    value={formData.poReference} 
                    onChange={(e) => setFormData({ ...formData, poReference: e.target.value })} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none"
                  >
                    <option value="PO STOCK">PO STOCK</option>
                    <option value="PO OLD">PO OLD</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-black bg-secondary rounded-md hover:opacity-90 disabled:opacity-70">{isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}