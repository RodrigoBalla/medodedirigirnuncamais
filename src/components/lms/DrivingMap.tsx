import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playHornSound } from "@/lib/sounds";

interface Pin {
  id: string;
  name: string;
  type: "parking" | "hills" | "highway" | "city";
  x: number;
  y: number;
  description: string;
  xp: number;
}

interface DrivingMapProps {
  onStartTraining: (pin: Pin) => void;
}

const PINS: Pin[] = [
  { id: "shopping", name: "Estacionamento do Shopping", type: "parking", x: 20, y: 70, description: "Treine baliza e estacionamento paralelo entre carros reais.", xp: 25 },
  { id: "ladeira", name: "Rua do Desafio (Ladeira)", type: "hills", x: 75, y: 30, description: "Domine o controle de embreagem e saída em subidas íngremes.", xp: 30 },
  { id: "rodovia", name: "Acesso à Rodovia", type: "highway", x: 85, y: 80, description: "Treine a entrada em fluxos de alta velocidade e troca de marchas.", xp: 40 },
  { id: "centro", name: "Centro da Cidade", type: "city", x: 45, y: 40, description: "Lide com pedestres, cruzamentos e o caos do trânsito urbano.", xp: 50 },
];

export function DrivingMap({ onStartTraining }: DrivingMapProps) {
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  // Flash Events - Random 2x XP for urgency
  const [flashEvent, setFlashEvent] = useState<{ pinId: string; timeLeft: number } | null>(null);

  useEffect(() => {
    // Start a random flash event after 5 seconds
    const timer = setTimeout(() => {
      const randomPin = PINS[Math.floor(Math.random() * PINS.length)];
      setFlashEvent({ pinId: randomPin.id, timeLeft: 300 }); // 5 min
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setFlashEvent(prev => {
        if (!prev || prev.timeLeft <= 0) return null;
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleStart = () => {
    if (selectedPin) {
      playHornSound();
      onStartTraining(selectedPin);
    }
  };

  return (
    <div className="relative w-full aspect-square bg-slate-900 rounded-[40px] overflow-hidden border-8 border-slate-800 shadow-2xl">
      {/* Flash Event Banner */}
      {flashEvent && (
        <div className="absolute top-4 left-4 right-4 z-[60] bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-yellow-300/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl animate-pulse filled-icon">bolt</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest">Evento Relâmpago!</p>
              <p className="text-xs font-bold">2x XP em {PINS.find(p => p.id === flashEvent.pinId)?.name}</p>
            </div>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-black tabular-nums">
            {formatTime(flashEvent.timeLeft)}
          </div>
        </div>
      )}

      {/* City Background Texture */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-full h-2 bg-slate-100 rotate-12" />
        <div className="absolute top-1/2 left-0 w-full h-2 bg-slate-100 -rotate-6" />
        <div className="absolute top-0 left-1/3 w-2 h-full bg-slate-100 -rotate-12" />
        <div className="absolute top-0 left-2/3 w-2 h-full bg-slate-100 rotate-6" />
      </div>

      {/* Map Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {PINS.map((pin) => (
          <motion.button
            key={pin.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.2 }}
            onClick={() => setSelectedPin(pin)}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
          >
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-primary rounded-full"
              />
              <div className={`size-8 rounded-full ${flashEvent?.pinId === pin.id ? 'bg-yellow-500 ring-4 ring-yellow-500/50 animate-pulse' : 'bg-primary'} border-4 border-white flex items-center justify-center shadow-lg relative z-10 transition-colors group-hover:bg-primary-foreground group-hover:text-primary`}>
                <span className="material-symbols-outlined text-sm font-black filled-icon">
                  {pin.type === 'parking' ? 'local_parking' : 
                   pin.type === 'hills' ? 'terrain' : 
                   pin.type === 'highway' ? 'speed' : 'location_city'}
                </span>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full text-[8px] font-black uppercase text-white tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                {pin.name}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Info Card Overlay */}
      <AnimatePresence>
        {selectedPin && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 left-6 right-6 bg-card/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl z-50 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight italic flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                  {selectedPin.name}
                </h3>
                <p className="text-xs text-muted-foreground font-medium pr-4 mt-1 leading-tight">
                  {selectedPin.description}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPin(null)}
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Recompensa</p>
                 <div className="flex items-center gap-2">
                    <div className="bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20 text-yellow-600 font-black text-xs flex items-center gap-1">
                       <span className="material-symbols-outlined text-xs filled-icon">database</span>
                       +15
                    </div>
                    <div className="bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 text-primary font-black text-xs flex items-center gap-1">
                       <span className="material-symbols-outlined text-xs filled-icon">bolt</span>
                       +{selectedPin.xp} XP
                    </div>
                 </div>
              </div>
              <button 
                onClick={handleStart}
                className="bg-primary text-primary-foreground font-black px-6 py-3 rounded-2xl shadow-lg hover:bg-primary/90 transition-all active:scale-95 text-sm uppercase tracking-widest italic"
              >
                Iniciar Treino 🚗
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(circle,white_1px,transparent_1px)] [background-size:20px_20px]" />
    </div>
  );
}
