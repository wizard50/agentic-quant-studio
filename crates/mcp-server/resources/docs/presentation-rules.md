# Presentation rules (server-derived)

Agents and studies author **GraphSpec only**. On create/update study the backend runs `validate` then `compile_presentation` and stores `Study.presentation`.

| Node | Chart effect |
|------|----------------|
| `datasource.candles` | Candlestick layer on main pane |
| `indicator.*` with overlay defaults | Line on main |
| `indicator.*` with subchart defaults (e.g. RSI) | Own pane + optional value_range |
| `literal.number` with consumers | Horizontal level / series on peer pane |
| `logic.*` (crossover, etc.) | Markers on the relevant pane |

Do **not** invent a client presentation compiler. Dry-run HTTP (no MCP tool yet): `POST /api/v1/studio/presentations` with `{ "graph": ... }`.
