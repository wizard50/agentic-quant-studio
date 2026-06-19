use std::collections::HashMap;

use crate::{
    error::{Error, Result},
    spec::graph::GraphSpec,
};

pub fn topo_sort(graph: &GraphSpec) -> Result<Vec<String>> {
    let mut in_degree: HashMap<&str, usize> = graph
        .nodes
        .iter()
        .map(|node| (node.id.as_str(), 0usize))
        .collect();

    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in &graph.edges {
        let from = edge.from.node_id.as_str();
        let to = edge.to.node_id.as_str();

        if !in_degree.contains_key(from) {
            return Err(Error::NodeNotFound(edge.from.node_id.clone()));
        }
        if !in_degree.contains_key(to) {
            return Err(Error::NodeNotFound(edge.to.node_id.clone()));
        }

        *in_degree
            .get_mut(to)
            .ok_or_else(|| Error::NodeNotFound(edge.to.node_id.clone()))? += 1;
        adjacency.entry(from).or_default().push(to);
    }

    let mut queue: Vec<&str> = in_degree
        .iter()
        .filter_map(|(id, degree)| if *degree == 0 { Some(*id) } else { None })
        .collect();
    queue.sort_unstable();

    let mut order = Vec::with_capacity(graph.nodes.len());
    while let Some(node_id) = queue.first().copied() {
        queue.remove(0);
        order.push(node_id.to_string());

        if let Some(children) = adjacency.get(node_id) {
            for child in children {
                let degree = in_degree
                    .get_mut(child)
                    .ok_or_else(|| Error::NodeNotFound((*child).to_string()))?;
                *degree -= 1;
                if *degree == 0 {
                    queue.push(*child);
                    queue.sort_unstable();
                }
            }
        }
    }

    if order.len() != graph.nodes.len() {
        return Err(Error::CycleDetected);
    }

    Ok(order)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::spec::{GraphKind, NodeSpec, PortRef, graph::Edge};

    fn two_node_graph(edges: Vec<Edge>) -> GraphSpec {
        GraphSpec {
            id: "test".to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                NodeSpec {
                    id: "a".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
                NodeSpec {
                    id: "b".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
            ],
            edges,
        }
    }

    #[test]
    fn topo_sort_orders_acyclic_graph() {
        let graph = two_node_graph(vec![Edge {
            from: PortRef::new("a", "value").unwrap(),
            to: PortRef::new("b", "input").unwrap(),
        }]);

        let order = topo_sort(&graph).unwrap();
        assert_eq!(order, vec!["a", "b"]);
    }

    #[test]
    fn topo_sort_detects_cycle() {
        let graph = two_node_graph(vec![
            Edge {
                from: PortRef::new("a", "value").unwrap(),
                to: PortRef::new("b", "input").unwrap(),
            },
            Edge {
                from: PortRef::new("b", "value").unwrap(),
                to: PortRef::new("a", "input").unwrap(),
            },
        ]);

        let err = topo_sort(&graph).unwrap_err();
        assert!(matches!(err, Error::CycleDetected));
    }

    #[test]
    fn topo_sort_rejects_unknown_edge_node() {
        let graph = two_node_graph(vec![Edge {
            from: PortRef::new("a", "value").unwrap(),
            to: PortRef::new("missing", "input").unwrap(),
        }]);

        let err = topo_sort(&graph).unwrap_err();
        assert!(matches!(err, Error::NodeNotFound(id) if id == "missing"));
    }
}
