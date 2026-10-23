# Graphviz diagrams

Use one `graph` or `digraph` block for a static Graphviz diagram. The renderer supports clusters,
record ports, HTML-like labels, and local layout engines.

## Order flow

```graphviz
digraph OrderFlow {
  rankdir=LR;
  graph [bgcolor="transparent", pad="0.25"];
  node [shape=box, style="rounded,filled", fillcolor="#f6f8fa"];

  subgraph cluster_request {
    label="Запрос заказа";
    color="#8c959f";
    client [shape=record, label="<request> Клиент | <response> Ответ"];
  }

  api [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0"><TR><TD>API заказов</TD></TR></TABLE>>];
  database [shape=cylinder, label="База данных"];

  client:request -> api [label="Создать заказ"];
  api -> database [label="Сохранить"];
}
```

## Service links

```dot engine=neato
graph Services {
  graph [bgcolor="transparent"];
  node [shape=ellipse, style=filled, fillcolor="#dbeafe"];

  gateway -- orders;
  gateway -- catalog;
  orders -- database;
  catalog -- database;
}
```
