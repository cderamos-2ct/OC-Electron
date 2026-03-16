"use client";

import { useEffect, useState } from "react";
import { Cinzel, Inter } from "next/font/google";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cinzel",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-inter",
});

export default function AegilumeSplash() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const numNodes = 16;
  const cx = 100;
  const cy = 100;
  const radius = 80;
  
  const nodes = Array.from({ length: numNodes }).map((_, i) => {
    const angle = (i * Math.PI * 2) / numNodes - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      isCardinal: i % 4 === 0,
    };
  });

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#0f172a] ${cinzel.variable} ${inter.variable}`}>
      <style>{`
        @keyframes loading-progress {
          0% { left: -30%; width: 30%; }
          50% { left: 30%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }
        @keyframes pulse-glow {
          0% { filter: drop-shadow(0 0 10px rgba(163, 134, 42, 0.2)); }
          100% { filter: drop-shadow(0 0 25px rgba(163, 134, 42, 0.6)); }
        }
        .animate-loading {
          animation: loading-progress 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite alternate;
        }
      `}</style>

      {/* Subtle radial star field gradient overlay */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0) 0%, rgba(5, 8, 15, 0.95) 100%)'
        }} 
      />
      
      {/* Generated Star Field */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none opacity-40">
           {Array.from({ length: 150 }).map((_, i) => {
             const size = Math.random() * 2 + 0.5;
             const isGold = Math.random() > 0.9;
             const isBlue = Math.random() > 0.8;
             const bg = isGold ? '#a3862a' : (isBlue ? '#94a3b8' : '#ffffff');
             
             return (
               <div
                 key={i}
                 className="absolute rounded-full animate-pulse"
                 style={{
                   top: `${Math.random() * 100}%`,
                   left: `${Math.random() * 100}%`,
                   width: size,
                   height: size,
                   backgroundColor: bg,
                   animationDuration: `${Math.random() * 3 + 2}s`,
                   animationDelay: `${Math.random() * 5}s`,
                   opacity: Math.random() * 0.4 + 0.1
                 }}
               />
             );
           })}
        </div>
      )}

      {/* Main Container - 16:10 aspect ratio layout feel */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[800px] aspect-[16/10] justify-center">
        
        {/* Constellation Logomark */}
        <div className="relative w-48 h-48 mb-8 animate-pulse-glow">
          <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
             {/* Core Glow Pulse */}
             <circle cx={cx} cy={cy} r="16" fill="rgba(163, 134, 42, 0.15)">
                <animate attributeName="r" values="12;22;12" dur="4s" repeatCount="indefinite" />
             </circle>
             
             {/* Golden Core Node */}
             <circle cx={cx} cy={cy} r="8" fill="#a3862a" style={{ filter: "drop-shadow(0 0 8px #a3862a)" }} />
             
             {/* Connections to core */}
             {nodes.map((node, i) => (
               (node.isCardinal || i % 3 === 0) && (
                 <line 
                   key={`line-${i}`}
                   x1={cx} y1={cy} x2={node.x} y2={node.y}
                   stroke={node.isCardinal ? "rgba(163, 134, 42, 0.6)" : "rgba(241, 245, 249, 0.15)"}
                   strokeWidth={node.isCardinal ? 2 : 1}
                   strokeDasharray={node.isCardinal ? "none" : "3,3"}
                 />
               )
             ))}

             {/* Connecting Ring (Arcs) */}
             <path 
               d={`M ${nodes[0].x} ${nodes[0].y} ${nodes.slice(1).map(n => `L ${n.x} ${n.y}`).join(' ')} Z`}
               fill="none"
               stroke="rgba(241, 245, 249, 0.2)"
               strokeWidth="1.5"
             />

             {/* Nodes */}
             {nodes.map((node, i) => (
                <circle
                  key={`node-${i}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.isCardinal ? 4.5 : 2.5}
                  fill={node.isCardinal ? "#a3862a" : "#f1f5f9"}
                  style={{ filter: `drop-shadow(0 0 ${node.isCardinal ? '8px #a3862a' : '5px #f1f5f9'})` }}
                />
             ))}
          </svg>
        </div>

        {/* Wordmark */}
        <h1 
          className="font-[family-name:var(--font-cinzel)] font-medium text-[2.75rem] text-[#f1f5f9] tracking-[0.45em] ml-[0.45em] mb-4 uppercase" 
          style={{ textShadow: '0 0 25px rgba(241, 245, 249, 0.25)' }}
        >
          Aegilume
        </h1>

        {/* Subtitle */}
        <p className="font-[family-name:var(--font-inter)] font-light text-sm text-[#94a3b8] tracking-[0.25em] ml-[0.25em] uppercase mb-16">
          Stellar Agora
        </p>

        {/* Loading Progress Bar */}
        <div className="relative w-72 h-[1px] bg-[#94a3b8]/20 overflow-hidden rounded-full">
           <div 
             className="absolute top-0 bottom-0 animate-loading bg-[#a3862a]"
             style={{ boxShadow: '0 0 12px #a3862a' }}
           />
        </div>
      </div>
    </div>
  );
}
