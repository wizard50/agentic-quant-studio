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

The project has two main areas:

### Data Management (`/data`)
The most developed part of the application right now:

- **Live KPIs** powered by the catalog service (Total Datasets, Total Candles, Storage Used, Active Jobs)
- **Searchable Datasets table** — shows all ingested datasets with symbol, interval, record count, and size
- **Quick Ingest** — select symbols to ingest. The UI only offers symbols that are **not yet** present in the catalog for the chosen market
- **Ingestion job tracking** — background jobs with status (`pending` / `running` / `completed` / `failed`)
- Toolbar with global search, market filters (Exchange/Category), and Quick Ingest toggle

### Market Research (`/`)
- Basic candle visualization using TradingView Lightweight Charts
- Downsampling support

---

### Backend Endpoints (v1)

| Method | Endpoint                          | Description |
|--------|-----------------------------------|-----------|
| GET    | `/api/v1/candles`                 | Query historical candles |
| POST   | `/api/v1/candles/ingest`          | Trigger candle ingestion |
| GET    | `/api/v1/candles/ingest/jobs`     | List ingestion jobs (supports `?active=true`) |
| GET    | `/api/v1/candles/ingest/jobs/{id}`| Get single job status |
| GET    | `/api/v1/catalog/candles`         | Get full warehouse catalog snapshot |
| POST   | `/api/v1/catalog/candles/refresh` | Trigger background catalog rescan |

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
```

The actively developed version lives in the main development iteration folder.

From there:

```bash
# Backend
cargo run -p backend

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The main Data Management interface is available at `/data`.

### Example API usage

Trigger ingestion:
```bash
curl -X POST "http://localhost:3000/api/v1/candles/ingest?exchange=bybit&category=spot&symbol=SOLUSDT"
```

Fetch current catalog snapshot:
```bash
curl -s http://localhost:3000/api/v1/catalog/candles | jq '.datasets | length'
```

---

## Project Structure

The repository root (`agentic-quant-studio`) contains several iterations of the project. The actively developed version (with the Data Management UI) follows this structure:

```
/ (root)
├── crates/
│   ├── backend/      # Axum API (catalog, ingestion jobs, candles)
│   ├── warehouse/    # Parquet storage + catalog builder
│   ├── common/
│   └── api-client/
├── frontend/
│   ├── app/
│   │   ├── data/          # Data Management page (KPIs, table, Quick Ingest)
│   │   └── page.tsx       # Market Research / charts
│   └── ...
└── README.md
```

---

## License
This project is licensed under the [MIT License](LICENSE).

---

Built by [@wizard50](https://github.com/wizard50)
