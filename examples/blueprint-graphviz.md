# Graphviz data lineage

Use one `graph` or `digraph` block for a static Graphviz diagram. This example maps a complete
event path across four clusters, with record ports for the primary payload and side paths for
rejected data, metrics, and replay.

```graphviz
digraph EventLineage {
  graph [
    rankdir=TB,
    bgcolor="transparent",
    pad="0.25",
    nodesep="0.3",
    ranksep="0.45",
    compound=true
  ];
  node [shape=box, style="rounded,filled", fontname="Arial", fontsize=10,
        color="#64748b", fillcolor="#f8fafc", margin="0.12,0.08"];
  edge [fontname="Arial", fontsize=9, color="#64748b", arrowsize=0.7];

  subgraph cluster_sources {
    label="1 · Producers";
    style="rounded,filled"; color="#cbd5e1"; fillcolor="#f8fafc";
    browser [shape=record, fillcolor="#e0f2fe", label="{<web> Web events|<mobile> Mobile SDK}"];
    partner [shape=box, fillcolor="#e0f2fe", label="Partner webhooks"];
    device [shape=box, fillcolor="#e0f2fe", label="IoT telemetry"];
  }

  subgraph cluster_ingest {
    label="2 · Ingestion and quality";
    style="rounded,filled"; color="#93c5fd"; fillcolor="#eff6ff";
    gateway [label="API gateway\nAuth · rate limit"];
    decode [label="Decode and normalize"];
    schema [shape=diamond, style=filled, fillcolor="#fef3c7", label="Schema\nvalid?"];
    quarantine [shape=cylinder, fillcolor="#fee2e2", label="Quarantine\nwith error context"];
  }

  subgraph cluster_stream {
    label="3 · Stream processing";
    style="rounded,filled"; color="#86efac"; fillcolor="#f0fdf4";
    enrich [label="Enrich account\nand geography"];
    dedupe [label="Deduplicate\nby event key"];
    score [label="Score rules\nand anomalies"];
    replay [shape=component, fillcolor="#fef3c7", label="Replay worker"];
  }

  subgraph cluster_products {
    label="4 · Storage and consumers";
    style="rounded,filled"; color="#c4b5fd"; fillcolor="#f5f3ff";
    hot [shape=cylinder, fillcolor="#ede9fe", label="Hot metrics store"];
    lake [shape=cylinder, fillcolor="#ede9fe", label="Immutable event lake"];
    dashboard [shape=component, label="Operations dashboard"];
    alerts [shape=component, label="Alert router"];
    warehouse [shape=component, label="Daily warehouse job"];
  }

  browser:web -> gateway [label="HTTPS"];
  browser:mobile -> gateway;
  partner -> gateway [label="signed POST"];
  device -> decode [label="MQTT"];
  gateway -> decode;
  decode -> schema;
  schema -> enrich [label="yes"];
  schema -> quarantine [label="no", color="#dc2626", fontcolor="#b91c1c"];
  enrich -> dedupe;
  dedupe -> score;
  score -> hot [label="latest values"];
  score -> lake [label="append only"];
  hot -> dashboard [label="< 1 s queries"];
  score -> alerts [label="rule match"];
  lake -> warehouse [label="hourly partitions"];
  quarantine -> replay [style=dashed, label="operator approves"];
  replay -> decode [style=dashed, label="reprocess"];
}
```

The offline WebAssembly renderer supports the verified `dot`, `neato`, `circo`, `fdp`, `osage`,
`patchwork`, and `twopi` layout engines, including clusters, record ports, and HTML-like labels.
