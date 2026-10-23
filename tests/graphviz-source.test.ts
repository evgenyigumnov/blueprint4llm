import { describe, expect, it } from 'vitest';

import {
  assertSingleGraphSource,
  parseGraphvizMetadata,
} from '../src/renderers/graphviz-source.js';
import { GRAPHVIZ_ENGINES } from '../src/renderers/graphviz-worker-protocol.js';

describe('Graphviz metadata', () => {
  it('uses dot when metadata is absent or whitespace only', () => {
    expect(parseGraphvizMetadata(undefined)).toEqual({ engine: 'dot' });
    expect(parseGraphvizMetadata('   ')).toEqual({ engine: 'dot' });
  });

  it('accepts each verified layout engine', () => {
    for (const engine of GRAPHVIZ_ENGINES) {
      expect(parseGraphvizMetadata(`engine=${engine}`)).toEqual({ engine });
    }
  });

  it('accepts one quoted engine value and surrounding whitespace', () => {
    expect(parseGraphvizMetadata(' engine="neato" ')).toEqual({ engine: 'neato' });
  });

  it.each([
    ['unknown key', 'format=svg', 'unknown Graphviz metadata parameter "format"'],
    ['empty value', 'engine=', 'must not be empty'],
    ['empty quoted value', 'engine=""', 'must not be empty'],
    ['repeated key', 'engine=dot engine=neato', 'must not be repeated'],
    ['invalid engine', 'engine=sfdp', 'unsupported Graphviz engine "sfdp"'],
    ['missing equals sign', 'neato', 'expected key=value'],
    ['unmatched quote', 'engine="neato', 'invalid quoted Graphviz metadata'],
  ])('rejects %s', (_name, metadata, message) => {
    expect(() => parseGraphvizMetadata(metadata)).toThrow(message);
  });
});

describe('single Graphviz graph check', () => {
  it('accepts one graph with nested subgraphs, strings, comments, and HTML labels', () => {
    const source = `// graph ignored before the declaration
digraph One {
  label="quoted } graph { text";
  /* } is part of this comment */
  subgraph cluster_a {
    node [label=<<TABLE BGCOLOR="a>b"><TR><TD>brace { text }</TD></TR></TABLE>>];
    a -> b;
  }
}
# a second graph name in a trailing comment is safe
`;

    expect(() => assertSingleGraphSource(source)).not.toThrow();
  });

  it('accepts HTML comments and escaped quotes inside HTML labels', () => {
    const source = `graph One {
  a [label=<<TABLE TITLE="one > two"><!-- } ignored --><TR><TD>left { right }</TD></TR></TABLE>>];
}`;

    expect(() => assertSingleGraphSource(source)).not.toThrow();
  });

  it('rejects a second top-level graph and other trailing input', () => {
    expect(() => assertSingleGraphSource('digraph A { a -> b }\ndigraph B { c -> d }')).toThrow(
      'exactly one graph',
    );
    expect(() => assertSingleGraphSource('graph A { a -- b } trailing')).toThrow(
      'exactly one graph',
    );
  });

  it('allows trailing whitespace and DOT comments', () => {
    expect(() => assertSingleGraphSource('graph A { a -- b } // done\n/* done */')).not.toThrow();
  });

  it('leaves malformed or non-graph input for Graphviz to diagnose', () => {
    expect(() => assertSingleGraphSource('digraph { a -> }')).not.toThrow();
    expect(() => assertSingleGraphSource('this is not a graph')).not.toThrow();
  });
});
