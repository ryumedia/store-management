'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, ShoppingBag } from 'lucide-react';

export default function ShopeeOrderPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // 1. Identifikasi User dan CompanyId mereka
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === 'ali@gmail.com') {
          setIsSuperAdmin(true);
        } else {
          // Cari data user di Firestore untuk dapatkan companyId
          const { getDocs, query, collection, where } = await import('firebase/firestore');
          const q = query(collection(db, "users"), where("uid", "==", user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setUserCompanyId(querySnapshot.docs[0].data().companyId);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Ambil data dengan Filter CompanyId
  useEffect(() => {
    // Tunggu sampai userCompanyId didapatkan (kecuali superadmin)
    if (!isSuperAdmin && !userCompanyId) return;

    let q = query(collection(db, 'orders_shopee'), orderBy('createdAt', 'desc'));

    // Jika bukan superadmin, tambahkan filter WHERE
    if (!isSuperAdmin && userCompanyId) {
      q = query(q, where('companyId', '==', userCompanyId));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setLoading(false);
    }, (err) => {
      console.error("Error fetch orders:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin, userCompanyId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        <p className="mt-2 text-gray-500">Memuat data pesanan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Pesanan Shopee</h1>
        <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg flex items-center text-sm font-semibold">
          <ShoppingBag className="w-4 h-4 mr-2" />
          Shopee Marketplace
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Pesanan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Resi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 italic">
                    Belum ada data pesanan untuk perusahaan Anda.
                  </td>
                </tr>
              ) : (
                orders.map((order, idx) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">...</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}