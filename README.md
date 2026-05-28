# Agentic Quant Studio

A workspace for building agentic AI systems in quantitative finance and Web3.

<!--![Agentic Quant Studio Screenshot](./assets/agentic-quant-studio-screenshot.png)-->
<div align="center">
  <img 
    src="./assets/agentic-quant-studio-screenshot.png" 
    alt="Agentic Quant Studio Screenshot" 
    width="820" 
    style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</div>

---

## Current Status

**Very early prototype (minimal demo)**

What exists right now:
- Rust backend (Axum) with candle data endpoints:
  - `GET /api/v1/candles` — query historical candles (with downsampling)
  - `POST /api/v1/candles/ingest` — trigger background candle ingestion (returns 202 Accepted)
- Next.js frontend with a basic TradingView Lightweight Charts component
- Downsampling support in the warehouse / backend (already selectable in the UI)
- Manual seeding script (`cargo run -p backend --bin seed`) that loads the latest 7 days of data

Most features are still in planning or not implemented yet.

---

## Vision

The long-term goal is to build an intelligent workspace where users can interact with AI agents (via chat and eventually voice) to:
- Perform quantitative research and backtesting
- Generate code for indicators, strategies, and dashboards
- Analyze DEX pools and on-chain data
- Use RAG on documents and private knowledge bases
- Eventually register and run autonomous on-chain agents (ERC-8004 / Solana)

---

## Tech Stack

- **Backend**: Rust + Axum (multi-crate workspace)
- **Data Warehouse**: Parquet + Polars (Hive-style partitioning)
- **Frontend**: Next.js + TradingView Lightweight Charts
- **Future / Planned**: Rig (agent framework), RAG, Web3 libraries, ERC-8004 / Solana Agent Registry, PyTorch models (MLOps)

---

## Getting Started

```bash
git clone https://github.com/wizard50/agentic-quant-studio.git
cd agentic-quant-studio

# Initial data seeding (optional)
cargo run -p backend --bin seed

# Backend
cargo run -p backend

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

You can also trigger candle ingestion via the API:
```bash
curl -X POST "http://localhost:3000/api/v1/candles/ingest?exchange=bybit&category=spot&symbol=BTCUSDT" -H "Accept: application/json" -w "\n\nHTTP Status: %{http_code}\n" -s
```

---

## Project Structure
```
agentic-quant-studio/
├── config/
├── crates/          # Rust workspace crates
│   ├── api-client/  # Exchange connectors (Bybit etc.)
│   ├── backend/     # Axum API + candle endpoint
│   ├── common/      # Shared types and utilities
│   └── warehouse/   # Data handling & parquet storage
├── frontend/        # Next.js UI
└── README.md
```

---

## License
This project is licensed under the [MIT License](LICENSE).

---

Built by [@wizard50](https://github.com/wizard50)
