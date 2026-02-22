'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="p-8">Memuat data user...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Informasi Pengguna</h2>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center">
              <span className="w-32 font-medium text-gray-500">Email:</span>
              <span className="text-gray-900">{user.email}</span>
            </div>
            <div className="flex items-center">
              <span className="w-32 font-medium text-gray-500">User ID:</span>
              <span className="text-gray-900 font-mono text-sm">{user.uid}</span>
            </div>
            <div className="flex items-center">
              <span className="w-32 font-medium text-gray-500">Role:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                user.email === 'ali@gmail.com' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {user.email === 'ali@gmail.com' ? 'Super Admin' : 'Staff Toko'}
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-32 font-medium text-gray-500">Terakhir Login:</span>
              <span className="text-gray-900">{user.metadata.lastSignInTime}</span>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Tidak ada user yang login.</p>
        )}
      </div>

      {/* Statistik Dummy Sederhana */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Penjualan</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">Rp 12.500.000</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Pesanan Baru</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">15</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Produk</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">48</p>
        </div>
      </div>
    </div>
  );
}
