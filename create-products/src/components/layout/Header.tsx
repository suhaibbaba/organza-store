"use client";
import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3 lg:hidden">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <Menu size={20} className="text-slate-600" />
      </button>
      {title && <h1 className="font-semibold text-slate-800">{title}</h1>}
    </header>
  );
}
