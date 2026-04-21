'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { db, app } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { initializeApp, getApps } from 'firebase/app';

interface UserDocument {
  id: string;
  name: string;
  email: string;
  companyId: string;
  role: string;
  status: 'Aktif' | 'Non-Aktif';
  createdAt: Timestamp;
}

interface Company {
  id: string;
  name: string;
}

export default function UserPage() {
  const [users, setUsers] = useState<UserDocument[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyId: '',
    role: 'Admin Company',
    status: 'Aktif'
  });

  useEffect(() => {
    const mainAuth = getAuth(app);
    const unsubscribe = onAuthStateChanged(mainAuth, (user) => {
      if (user && user.email === 'ali@gmail.com') {
        setIsSuperAdmin(true);
      } else {
        router.push('/');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch Users Realtime
  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList as UserDocument[]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  // Fetch Companies untuk Dropdown
  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const companyList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companyList as Company[]);
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  // Helper untuk mendapatkan nama company berdasarkan ID
  const getCompanyName = (id: string) => {
    const company = companies.find(c => c.id === id);
    return company ? company.name : '-';
  };

  // Handle Open Modal
  const handleOpenModal = (user?: UserDocument) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        name: user.name,
        email: user.email,
        password: '', // Password tidak diedit di sini
        companyId: user.companyId || '',
        role: user.role,
        status: user.status
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        companyId: '',
        role: 'Admin Company',
        status: 'Aktif'
      });
    }
    setIsModalOpen(true);
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), {
          name: formData.name,
          email: formData.email,
          companyId: formData.companyId,
          role: formData.role,
          status: formData.status,
          updatedAt: serverTimestamp()
        });
      } else {
        // 1. Buat User di Firebase Authentication menggunakan Secondary App
        // Tujuannya agar Super Admin tidak ter-logout saat membuat user baru
        const secondaryAppName = "SecondaryApp";
        const secondaryApp = getApps().find(a => a.name === secondaryAppName) || initializeApp(app.options, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        let newUserUid = '';
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
          newUserUid = userCredential.user.uid;
          // Logout dari secondary auth agar tidak ada sesi yang tertinggal
          await signOut(secondaryAuth);
        } catch (authError: any) {
          console.error("Auth Error:", authError);
          alert("Gagal membuat akun login: " + (authError as Error).message);
          setIsSubmitting(false);
          return;
        }

        // 2. Simpan data profil ke Firestore
        await addDoc(collection(db, 'users'), {
          ...formData,
          uid: newUserUid, // Simpan UID agar terhubung dengan Auth
          password: '', // Jangan simpan password plain text di database!
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving user: ", error);
      alert("Gagal menyimpan data user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus user ini?")) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        console.error("Error deleting user: ", error);
        alert("Gagal menghapus user");
      }
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isSuperAdmin) {
    return <div className="flex items-center justify-center h-screen">Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Data User</h1>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center px-4 py-2 bg-secondary text-black rounded-md hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">Belum ada data user.</td></tr>
              ) : (
                users.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCompanyName(user.companyId)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === 'Aktif' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button onClick={() => handleOpenModal(user)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900 transition-colors" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit User' : 'Tambah User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nama</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" /></div>
              
              {/* Input Password hanya muncul saat menambah user baru */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password Login</label>
                  <input type="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none" placeholder="Minimal 6 karakter" />
                  <p className="text-xs text-gray-500 mt-1">Password ini digunakan user untuk login.</p>
                </div>
              )}

              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label><select required value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none"><option value="">Pilih Company</option>{companies.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none"><option value="Admin Company">Admin Company</option><option value="Finance Company">Finance Company</option><option value="Marketing Company">Marketing Company</option><option value="Operational Company">Operational Company</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none"><option value="Aktif">Aktif</option><option value="Non-Aktif">Non-Aktif</option></select></div>
              <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Batal</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-black bg-secondary rounded-md hover:opacity-90 disabled:opacity-70">{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}