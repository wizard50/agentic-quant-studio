mod colors;
mod compile;
mod types;

pub use colors::{
    indicator_color, INDICATOR_COLOR_POOL, LITERAL_LINE_COLOR, MARKER_COLOR_CROSSOVER,
    MARKER_COLOR_CROSSUNDER, MARKER_COLOR_DEFAULT,
};
pub use compile::{
    compile_presentation, prefer_context_pane, resolve_pane_from_consumer_peers,
    resolve_pane_from_inputs,
};
pub use types::{
    LayerSpec, LayerStyle, LayerVisual, MarkerShape, PaneHeight, PaneRole, PaneSpec,
    PresentationSpec, DEFAULT_SUBCHART_PANE_HEIGHT, MAIN_PANE_ID, MARKET_LAYER_ID,
    PRESENTATION_VERSION,
};
