import React from "react";

// ============================================================
// 💀 SKELETON CARD — Loading state que matchea la card real
// ============================================================

export default function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#0B1221] border border-[#EAEAEA] dark:border-slate-800/60 rounded-xl p-8 flex flex-col items-center text-center overflow-hidden">
      {/* Logo */}
      <div className="w-24 h-24 rounded-xl bg-[#F7F6F3] dark:bg-slate-800/50 shimmer mb-6" />

      {/* Título */}
      <div className="w-3/4 h-7 rounded-md bg-[#F7F6F3] dark:bg-slate-800/50 shimmer mb-3" />

      {/* Subtítulo */}
      <div className="w-1/2 h-4 rounded-md bg-[#F7F6F3] dark:bg-slate-800/50 shimmer" />
    </div>
  );
}
