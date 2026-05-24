'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Search, Loader2 } from 'lucide-react';

export default function StockMonitoringPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [incomingStocks, setIncomingStocks] = useState<any[]>([]);
  const [outgoingStocks, setOutgoingStocks] = useState<any[]>([]);
  const [stockProcesses, setStockProcesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data Realtime
  useEffect(() => {
    const fetchData = () => {
      const collections = ['products', 'incoming_stocks', 'outgoing_stocks', 'stock_processes'];
      const unsubscribes = collections.map((colName) => {
        let q = query(collection(db, colName));
        if (!isSuperAdmin && userCompanyId) {
          q = query(q, where('companyId', '==', userCompanyId));
        }
        
        return onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (colName === 'products') setProducts(data);
          if (colName === 'incoming_stocks') setIncomingStocks(data);
          if (colName === 'outgoing_stocks') setOutgoingStocks(data);
          if (colName === 'stock_processes') setStockProcesses(data);
          setLoading(false);
        });
      });

      return () => unsubscribes.forEach(unsub => unsub());
    };

    if (isSuperAdmin || userCompanyId) {
      return fetchData();
    }
  }, [isSuperAdmin, userCompanyId]);

  // Logika Agregasi Data
  const monitoringData = useMemo(() => {
    return products.map(product => {
      const totalMasuk = incomingStocks
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      const totalKeluar = outgoingStocks
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      const totalProses = stockProcesses
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

      // Mengambil remark terbaru dari incoming_stocks
      const lastIncoming = [...incomingStocks]
        .filter(item => item.productId === product.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];

      // Mengambil PO terbaru dari proses
      const activeProcess = stockProcesses
        .filter(item => item.productId === product.id)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        masuk: totalMasuk,
        keluar: totalKeluar,
        sisa: totalMasuk - totalKeluar,
        proses: totalProses,
        remark: lastIncoming?.remark || '-',
        nextPo: activeProcess?.poReference || '-'
      };
    }).filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, incomingStocks, outgoingStocks, stockProcesses, searchTerm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        <p className="text-gray-500 animate-pulse">Menghitung sisa stok...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Monitoring Stok</h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama atau SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-secondary focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">Masuk</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">Keluar</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">Sisa Stok</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-yellow-50">Proses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next PO</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monitoringData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    Data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                monitoringData.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-blue-600 bg-blue-50/30">
                      {item.masuk}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600 bg-red-50/30">
                      {item.keluar}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center bg-green-50/30">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        item.sisa <= 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {item.sisa}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-yellow-700 bg-yellow-50/30">
                      {item.proses}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={item.remark}>
                      {item.remark}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                      {item.nextPo}
                    </td>
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