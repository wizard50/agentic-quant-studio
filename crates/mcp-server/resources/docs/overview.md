# Agentic Quant Studio — agent overview

## Policy (always)

1. Author **GraphSpec only**. Presentation is derived on the server (`compile_presentation`).
2. Create **drafts only** (`create_study` forces `created_by: agent`). The user **Accepts** in Market Research UI.
3. Port refs are `node_id.port_name`. **Node ids must not contain `.`**.
4. Backend must be running (`AQS_BACKEND_URL`, default `http://127.0.0.1:3000`).

## How to work

1. Read this overview and, when needed, `aqs://docs/graph-spec` and example resources.
2. Discover live data: tools `list_candle_datasets`, `list_indicators` / `list_node_kinds`.
3. Build a GraphSpec. For logic/literal ports, use `aqs://schema/node-kinds` or `aqs://schema/kinds/{kind}`.
4. `validate_graph` until ok.
5. `create_study` with a clear `title`.
6. Tell the user to Reload studies in the UI and Accept if they want it applied.

## Resources vs tools

| Kind | Use for |
|------|---------|
| **Resources** (`aqs://…`) | Static docs, example graphs, full node-kind ports/params |
| **Tools** | Live catalogs, validate, create/list/get studies |

Do not invent port names. Prefer schema resources over guessing.
