# Agentic Quant Studio

A workspace for building agentic AI systems in quantitative finance and Web3.

---

## Current Status

**Very early prototype (minimal demo)**

What exists right now:
- Rust backend with a single candle data endpoint (Axum)
- Next.js frontend with a basic TradingView Lightweight Charts component
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
- **Frontend**: Next.js + TradingView Lightweight Charts
- **Future**: Rig (agent framework), RAG, Web3 libraries, ERC-8004 / Solana Agent Registry, PyTorch models (mlops)

---

## Getting Started

```bash
git clone https://github.com/wizard50/agentic-quant-studio.git
cd agentic-quant-studio

# Data init
cargo run -p backend --bin seed

# Backend
cargo run -p backend

# Frontend (new terminal)
cd frontend
npm install
npm run dev
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
