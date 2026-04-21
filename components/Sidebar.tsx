'use client';

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
// Anda bisa menggunakan ikon dari library seperti lucide-react
// npm install lucide-react
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Building2,
  UserCog,
  Boxes, // Icon for Stock
  ChevronDown, // Dropdown arrow
} from "lucide-react";

const Sidebar = ({ user }: { user: User | null }) => {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // AppShell akan otomatis mendeteksi perubahan auth state dan me-redirect ke login
    } catch (error) {
      console.error("Gagal logout:", error);
    }
  };

  const allMenuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/" },
    { name: "Data Company", icon: Building2, path: "/company", adminOnly: true },
    { name: "Data User", icon: UserCog, path: "/user", adminOnly: true },
    { name: "Produk", icon: Package, path: "/produk" },
    {
      name: "Data Stok",
      icon: Boxes,
      path: "/stok",
      children: [
        { name: "Stok Proses", path: "/stok/proses" },
        { name: "Stok Masuk", path: "/stok/masuk" },
        { name: "Monitoring Stok", path: "/stok/monitoring" },
      ],
    },
    { name: "Pesanan", icon: ShoppingCart, path: "/orders" },
    { name: "Pelanggan", icon: Users, path: "/customers" },
  ];

  const isSuperAdmin = user?.email === 'ali@gmail.com';

  const menuItems = allMenuItems.filter(item => !item.adminOnly || isSuperAdmin);

  const [openMenus, setOpenMenus] = useState(() => {
    const initialState: { [key: string]: boolean } = {};
    menuItems.forEach(item => {
      if (item.children && pathname.startsWith(item.path)) {
        initialState[item.name] = true;
      }
    });
    return initialState;
  });

  const toggleMenu = (menuName: string) => {
    setOpenMenus(prev => ({ ...prev, [menuName]: !prev[menuName] }));
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 text-white flex flex-col">
      <div className="h-20 flex items-center justify-center bg-gray-900">
        <h1 className="text-2xl font-bold text-primary">StoreApp</h1>
      </div>
      <nav className="flex-grow">
        <ul>
          {menuItems.map((item) => {
            if (item.children) {
              const isParentActive = pathname.startsWith(item.path);
              return (
                <li key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between p-4 transition-colors duration-200 hover:bg-gray-700 ${
                      isParentActive ? "bg-gray-700" : ""
                    }`}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-6 h-6 mr-3 text-secondary" />
                      <span>{item.name}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${openMenus[item.name] ? 'rotate-180' : ''}`} />
                  </button>
                  {openMenus[item.name] && (
                    <ul className="bg-black bg-opacity-20 pl-10">
                      {item.children.map(child => {
                        const isChildActive = pathname === child.path;
                        return (
                          <li key={child.name}>
                            <Link href={child.path} className={`block py-3 px-4 text-sm transition-colors duration-200 ${isChildActive ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}>
                              {child.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            } else {
              const isActive = pathname === item.path;
              return (
                <li key={item.name}>
                  <Link href={item.path} className={`flex items-center p-4 transition-colors duration-200 ${isActive ? "bg-gray-700 border-l-4 border-secondary" : "hover:bg-gray-700 border-l-4 border-transparent"}`}>
                    <item.icon className="w-6 h-6 mr-3 text-secondary" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            }
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <Link
          href="/pengaturan"
          className="flex items-center p-2 rounded-md hover:bg-gray-700 transition-colors duration-200"
        >
          <Settings className="w-6 h-6 mr-3" />
          <span>Pengaturan</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center p-2 mt-2 rounded-md text-left text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-200"
        >
          <LogOut className="w-6 h-6 mr-3" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
