'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, X } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, addDoc, serverTimestamp, Timestamp, updateDoc, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function IncomingStockPage() {
  const [incomingStocks, setIncomingStocks] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    productName: '',
    parentSku: '',
    sku: '',
    itemCode: '',
    quantity: 0,
    poReference: 'PO STOCK',
    companyId: '',
    remark: '',
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
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    let productsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
    if (!isSuperAdmin && userCompanyId) {
      productsQuery = query(productsQuery, where('companyId', '==', userCompanyId));
    }
    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [loading, isSuperAdmin, userCompanyId]);

  useEffect(() => {
    if (loading) return;
    let incomingQuery = query(collection(db, 'incoming_stocks'), orderBy('date', 'desc'));
    if (!isSuperAdmin && userCompanyId) {
      incomingQuery = query(incomingQuery, where('companyId', '==', userCompanyId));
    }
    const unsubscribe = onSnapshot(incomingQuery, (snapshot) => {
      setIncomingStocks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [loading, isSuperAdmin, userCompanyId]);

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    if (product) {
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
      setFormData(prev => ({ ...prev, productId: '', productName: '', sku: '', itemCode: '', parentSku: '' }));
    }
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        date: item.date ? new Date(item.date.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        productId: item.productId || '',
        productName: item.productName || '',
        parentSku: item.parentSku || '',
        sku: item.sku || '',
        itemCode: item.itemCode || '',
        quantity: item.quantity || 0,
        poReference: item.poReference || 'PO STOCK',
        companyId: item.companyId || '',
        remark: item.remark || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        productId: '',
        productName: '',
        parentSku: '',
        sku: '',
        itemCode: '',
        quantity: 0,
        poReference: 'PO STOCK',
        companyId: '',
        remark: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        date: Timestamp.fromDate(new Date(formData.date)),
        quantity: Number(formData.quantity),
        companyId: isSuperAdmin ? formData.companyId : userCompanyId,
      };

      if (editingId) {
        await updateDoc(doc(db, 'incoming_stocks', editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'incoming_stocks'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving incoming stock:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCompanyName = (id: string) => {
    const company = companies.find(c => c.id === id);
    return company ? company.name : '-';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Stok Masuk</h1>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (<tr><td colSpan={11} className="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>) : incomingStocks.length === 0 ? (<tr><td colSpan={11} className="px-6 py-4 text-center text-gray-500">Belum ada data stok masuk.</td></tr>) : (
                incomingStocks.map((item, index) => (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.remark || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => handleOpenModal(item)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50 sticky top-0 z-10">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Stok Masuk' : 'Tambah Stok Masuk'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <select required value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                      <option value="">Pilih Company</option>
                      {companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  </div>
                )}
                <div className={isSuperAdmin ? "" : "md:col-span-2"}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <select required value={formData.productId} onChange={handleProductChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                  <option value="">Pilih Produk</option>
                  {products.filter(p => !formData.companyId || p.companyId === formData.companyId).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU Induk</label><input type="text" readOnly value={formData.parentSku} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU</label><input type="text" readOnly value={formData.sku} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Item Code</label><input type="text" readOnly value={formData.itemCode} className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input type="number" min="1" required value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Reference</label>
                  <select required value={formData.poReference} onChange={(e) => setFormData({ ...formData, poReference: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none">
                    <option value="PO STOCK">PO STOCK</option>
                    <option value="PO OLD">PO OLD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                <textarea value={formData.remark} onChange={(e) => setFormData({ ...formData, remark: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" placeholder="Catatan tambahan..." />
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