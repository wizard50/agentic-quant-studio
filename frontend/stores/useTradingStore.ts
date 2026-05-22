import { create } from "zustand";

interface TradingState {
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
  limit: number;
  setExchange: (exchange: string) => void;
  setCategory: (category: string) => void;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
  setLimit: (limit: number) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  exchange: "bybit",
  category: "spot",
  symbol: "BTCUSDT",
  interval: "1m",
  limit: 500,
  setExchange: (exchange) => set({ exchange }),
  setCategory: (category) => set({ category }),
  setSymbol: (symbol) => set({ symbol }),
  setInterval: (interval) => set({ interval }),
  setLimit: (limit) => set({ limit }),
}));
