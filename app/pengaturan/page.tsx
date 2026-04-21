'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Brand');
  const [data, setData] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    initial: '',
    code: '',
    status: 'Aktif',
    companyId: ''
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

  // Mapping nama tab ke nama koleksi di Firestore
  const getCollectionName = (tab: string) => {
    switch (tab) {
      case 'Brand': return 'brands';
      case 'Model': return 'models';
      case 'Warna': return 'colors';
      case 'Size': return 'sizes';
      case 'Platform': return 'platforms';
      default: return 'brands'; // Fallback
    }
  };

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

  // Fetch Data Realtime saat Tab berubah
  useEffect(() => {
    setLoading(true);
    const colName = getCollectionName(activeTab);
    let dataQuery = query(collection(db, colName), orderBy('createdAt', 'desc'));

    if (isSuperAdmin || userCompanyId) {
      if (!isSuperAdmin) {
        dataQuery = query(dataQuery, where('companyId', '==', userCompanyId));
      }
      
      const unsubscribe = onSnapshot(dataQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(list);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (!loading) {
      setLoading(false);
      setData([]);
    }
  }, [activeTab, isSuperAdmin, userCompanyId]);

  // Helper untuk mendapatkan nama company berdasarkan ID
  const getCompanyName = (id: string) => {
    const company = companies.find(c => c.id === id);
    return company ? company.name : '-';
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name,
        initial: item.initial,
        code: item.code || '',
        status: item.status || 'Aktif',
        companyId: ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        initial: '',
        code: '',
        status: 'Aktif',
        companyId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const colName = getCollectionName(activeTab);

    try {
      const dataToSave: any = {
        name: formData.name,
        companyId: isSuperAdmin ? formData.companyId : userCompanyId,
      };
      
      if (activeTab === 'Platform') {
        dataToSave.status = formData.status;
      } else {
        dataToSave.initial = formData.initial;
        if (activeTab === 'Brand' || activeTab === 'Model') {
          dataToSave.code = formData.code;
        }
      }

      if (editingId) {
        await updateDoc(doc(db, colName, editingId), {
          ...dataToSave,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, colName), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving data: ", error);
      alert("Gagal menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      try {
        const colName = getCollectionName(activeTab);
        await deleteDoc(doc(db, colName, id));
      } catch (error) {
        console.error("Error deleting data: ", error);
        alert("Gagal menghapus data");
      }
    }
  };

  const tabs = ['Brand', 'Model', 'Warna', 'Size', 'Platform'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Pengaturan</h1>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab
                  ? 'border-secondary text-secondary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end">
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-secondary text-black rounded-md hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah {activeTab}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                {activeTab !== 'Platform' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inisial</th>
                )}
                {(activeTab === 'Brand' || activeTab === 'Model') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kode</th>
                )}
                {activeTab === 'Platform' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Belum ada data {activeTab}.</td></tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCompanyName(item.companyId)}</td>
                    {activeTab !== 'Platform' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.initial}</td>
                    )}
                    {(activeTab === 'Brand' || activeTab === 'Model') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.code}</td>
                    )}
                    {activeTab === 'Platform' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.status === 'Aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button onClick={() => handleOpenModal(item)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? `Edit ${activeTab}` : `Tambah ${activeTab}`}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {isSuperAdmin && (
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
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama {activeTab}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  placeholder={`Masukkan nama ${activeTab}`}
                />
              </div>
              {activeTab !== 'Platform' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inisial</label>
                  <input
                    type="text"
                    required
                    value={formData.initial}
                    onChange={(e) => setFormData({ ...formData, initial: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Contoh: NK, AD, XL"
                  />
                </div>
              )}
              {(activeTab === 'Brand' || activeTab === 'Model') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kode Unik</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="Kode unik"
                  />
                </div>
              )}
              {activeTab === 'Platform' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-black bg-secondary rounded-md hover:opacity-90 disabled:opacity-70">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}