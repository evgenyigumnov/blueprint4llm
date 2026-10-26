# Balsamiq Mockups 3 JSON

## Upstream Mockups 3 model

Balsamiq Mockups 3 is a low-fidelity interface sketching tool. A project can contain multiple named mockups (screens or states), along with project-level notes, assets, and reusable symbols. Each mockup has a pixel-sized canvas populated by controls from the UI Library. A control is a typed visual object: its type determines its default appearance and which properties the editor exposes. It describes a proposed interface, not production UI code.

The Property Inspector is where authors tune common geometry and alignment as well as control-specific settings such as text, color, or a selected state. Control property names and meanings vary by type; the full application supports many more control types and options than the small static subset described later in this guide. When a feature matters, use the real Balsamiq editor and its property inspector rather than assuming every Mockups 3 property is portable to a renderer.

### Position, size, and visual order

A control's `x` and `y` locate it on its mockup canvas in pixels; `w` and `h` describe its size. Think in canvas coordinates from the upper-left: place related controls consistently, align edges, and leave intentional gaps so the visual hierarchy is easy to scan. Controls can overlap. Their `zOrder` expresses front-to-back stacking, so use it deliberately for overlays, labels, and dividers instead of relying on accidental placement order. Groups help move and organize several controls together; layering commands let you bring controls forward or send them behind others.

Use geometry to communicate structure, not just to fill space: align labels with their fields, keep related choices close, distinguish primary and secondary actions, and use consistent margins. Text should fit the control's bounds; resize the control or simplify the wording rather than crowding the sketch.

### Reusable symbols and assets

A **Symbol** is a reusable source made from controls and placed as an instance in one or more mockups. Edit the Symbol source to update its uses throughout the project; an instance can also override eligible properties or be broken apart when it must diverge. This is useful for repeated headers, navigation, cards, or common product chrome. Groups are convenient for manipulating a selection, while Symbols add a reusable source-and-instance relationship.

**Assets** are project resources such as imported images and icons. They are managed separately from the canvas and can be used in mockups. Keep reusable imagery in the project asset collection when working in Balsamiq itself; don't assume a mockup-only data export will carry its asset files or Symbol libraries with it.

### Mockups 3 file formats are not interchangeable

| Format           | What it represents upstream                                                                                                                                                                                                                                                                        | When to use it                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Mockups JSON** | A JSON representation of a selected mockup that Mockups 3 can export and import (the desktop workflow copies it through the clipboard). It is useful for moving one mockup's control data; it does not carry the project's images or Symbols.                                                      | Use for a single mockup's data, or when a tool explicitly accepts this JSON shape. It is not the complete desktop project file. |
| **BMPR**         | The Mockups 3 desktop project format: one SQLite-backed BAR archive containing the project's mockups and resources, including assets and Symbols.                                                                                                                                                  | Use to save, share, or reopen a complete Mockups 3 project.                                                                     |
| **BMML / XML**   | The older, human-readable Balsamiq Mockups Markup Language format, typically one XML file per mockup. Older multi-mockup projects could keep images and Symbols in a separate assets folder or ZIP. Mockups 3 provided import/conversion to BMPR; BMML is a legacy format, not a synonym for JSON. | Use only for legacy exchange or migration through a compatible Balsamiq application.                                            |

### Choosing common controls

Choose the control that communicates the user's intent at a glance. In a sketch, controls represent a design decision rather than implementing it.

| Control family                        | Good fit                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Labels, titles, subtitles, paragraphs | Name a screen or section, label content, and provide short explanatory copy. Use clear heading levels and keep long copy brief.            |
| Text input and text area              | Show where a user enters one-line or multi-line content. Put a short example or hint in the field when it clarifies the expected value.    |
| Button                                | Mark an action. Make the primary action visually prominent and name it with a verb; keep secondary actions quieter.                        |
| Checkbox and radio button             | Show independent toggles with checkboxes, or mutually exclusive options with radio buttons. Make the current choice obvious in the sketch. |
| Combo box and list                    | Suggest a compact choice control or a visible set of options. Use a list when comparing options is more important than saving space.       |
| Rectangle and line                    | Group related content into a panel or separate regions with a divider. Keep decoration subordinate to information.                         |

## blueprint4llm static renderer profile

This project accepts one raw Mockups 3-style JSON mockup in a Markdown code fence tagged `balsamiq`. It normalizes the supported controls and renders a static SVG wireframe; it does not import Balsamiq project files or run UI behavior. The sections below specify this project's accepted profile, not the full Balsamiq format.

### Document envelope

The JSON root must be an object containing a `mockup` object. Inside it, `controls.control` must be a non-empty array of control objects. A `version` field is optional and is not used to choose or validate a format version.

Set the canvas size with `mockupW` and `mockupH`. The renderer also accepts `measuredW` and `measuredH` in their place. If a root dimension is omitted, that dimension can come from the single `Canvas` control's width or height. Supply both dimensions through the root, the canvas, or a mix of the two. Root dimensions take precedence over canvas dimensions.

### Controls and geometry

Every control needs these fields:

- `ID`: a non-empty string, unique within the mockup.
- `typeID`: one of the supported names listed below, with exact spelling and capitalization.
- `x`, `y`: finite coordinates in pixels from the top-left of the canvas. Negative coordinates are accepted.
- `w`, `h`: finite width and height in pixels. A dimension can instead use `measuredW` or `measuredH` respectively.
- `zOrder`: a finite layer number.

Geometry values may be JSON numbers or numeric strings. Coordinates are limited to ±4,056 px; widths and heights must be greater than zero and at most 4,056 px. A `Line` may have a zero width or height to make a vertical or horizontal line. `zOrder` must be between -1,000,000 and 1,000,000. Controls render in ascending `zOrder`; controls on the same layer keep their input order.

`properties` is optional and, when present, must be an object. Supported properties are:

| Property              | Accepted value                                                         | Effect                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`                | String                                                                 | Text shown by controls that display text. Newlines create rows in `List` and lines in `TextArea`.                                          |
| `color`               | `#RRGGBB`, or a decimal integer or decimal string from 0 to 16,777,215 | Color used by the control: background for `Canvas` and `Rectangle`, fill for `Button`, stroke for `Line`, and text color where applicable. |
| `size`                | Number or numeric string from 6 to 72                                  | Text size in pixels.                                                                                                                       |
| `bold`, `italic`      | `true`, `false`, `"true"`, or `"false"`                                | Text styling. A `Title` is bold by default.                                                                                                |
| `align`               | `left`, `center`, or `right`                                           | Alignment for label-like controls.                                                                                                         |
| `checked`, `selected` | `true`, `false`, `"true"`, or `"false"`                                | Shows the mark in a `CheckBox` or `RadioButton` when true.                                                                                 |

Unknown property names and other unrecognized fields are ignored. A non-string `text`, invalid color, unsupported alignment, or invalid supported-property value is rejected. Text is escaped for SVG output and wrapped to fit the supplied control bounds; excess lines are omitted.

The accepted `typeID` values are:

- `Canvas`: optional background and, when needed, source of canvas dimensions. At most one is allowed; it is not rendered as an ordinary control.
- `Label`, `Title`, `SubTitle`, `Paragraph`: text labels with wrapping and optional alignment and styling.
- `TextInput`, `TextArea`: static input-shaped boxes showing `text`.
- `Button`: a static button shape with its text.
- `CheckBox`, `RadioButton`: static choice marks with a text label; `checked` or `selected` controls the mark.
- `ComboBox`: a static selection box with an arrow and optional text.
- `List`: a bordered box whose `text` is split into newline-separated rows.
- `Rectangle`: a rectangle that can include centered text.
- `Line`: a straight line from `(x, y)` to `(x + w, y + h)`.

These controls only describe their rendered appearance. They do not create interactive fields, menus, or actions.

### Complete mockup

This support queue screen uses only supported controls and fields. Place the JSON object inside a Markdown fence tagged `balsamiq` when adding it to a document.

```balsamiq
{
  "mockup": {
    "mockupW": "960",
    "mockupH": "680",
    "controls": {
      "control": [
        {
          "ID": "canvas",
          "typeID": "Canvas",
          "x": "0",
          "y": "0",
          "w": "960",
          "h": "680",
          "zOrder": "0",
          "properties": { "color": "#f1f5f9" }
        },
        {
          "ID": "queue-panel",
          "typeID": "Rectangle",
          "x": "24",
          "y": "96",
          "w": "220",
          "h": "560",
          "zOrder": "1",
          "properties": { "color": "#ffffff" }
        },
        {
          "ID": "ticket-panel",
          "typeID": "Rectangle",
          "x": "264",
          "y": "96",
          "w": "672",
          "h": "560",
          "zOrder": "1",
          "properties": { "color": "#ffffff" }
        },
        {
          "ID": "page-title",
          "typeID": "Title",
          "x": "24",
          "y": "20",
          "w": "420",
          "h": "30",
          "zOrder": "2",
          "properties": { "text": "Support center", "size": "22" }
        },
        {
          "ID": "page-description",
          "typeID": "Label",
          "x": "24",
          "y": "55",
          "w": "640",
          "h": "22",
          "zOrder": "2",
          "properties": {
            "text": "Review incoming requests and keep customers informed.",
            "size": "13",
            "color": "#64748b"
          }
        },
        {
          "ID": "new-request",
          "typeID": "Button",
          "x": "820",
          "y": "22",
          "w": "116",
          "h": "36",
          "zOrder": "2",
          "properties": { "text": "New request", "bold": "true" }
        },
        {
          "ID": "queue-heading",
          "typeID": "Label",
          "x": "40",
          "y": "110",
          "w": "188",
          "h": "24",
          "zOrder": "2",
          "properties": { "text": "Request queue", "size": "16", "bold": true }
        },
        {
          "ID": "queue-filter",
          "typeID": "ComboBox",
          "x": "40",
          "y": "142",
          "w": "188",
          "h": "34",
          "zOrder": "2",
          "properties": { "text": "All open requests" }
        },
        {
          "ID": "queue-search",
          "typeID": "TextInput",
          "x": "40",
          "y": "188",
          "w": "188",
          "h": "36",
          "zOrder": "2",
          "properties": { "text": "Search requests" }
        },
        {
          "ID": "priority-heading",
          "typeID": "Label",
          "x": "40",
          "y": "240",
          "w": "188",
          "h": "20",
          "zOrder": "2",
          "properties": { "text": "Priority", "size": "13", "bold": true }
        },
        {
          "ID": "priority-high",
          "typeID": "RadioButton",
          "x": "40",
          "y": "266",
          "w": "188",
          "h": "26",
          "zOrder": "2",
          "properties": { "text": "High", "selected": true }
        },
        {
          "ID": "priority-normal",
          "typeID": "RadioButton",
          "x": "40",
          "y": "298",
          "w": "188",
          "h": "26",
          "zOrder": "2",
          "properties": { "text": "Normal", "selected": false }
        },
        {
          "ID": "priority-low",
          "typeID": "RadioButton",
          "x": "40",
          "y": "330",
          "w": "188",
          "h": "26",
          "zOrder": "2",
          "properties": { "text": "Low", "selected": false }
        },
        {
          "ID": "queue-divider",
          "typeID": "Line",
          "x": "40",
          "y": "372",
          "w": "188",
          "h": "0",
          "zOrder": "2",
          "properties": { "color": "#cbd5e1" }
        },
        {
          "ID": "unassigned-only",
          "typeID": "CheckBox",
          "x": "40",
          "y": "392",
          "w": "188",
          "h": "28",
          "zOrder": "2",
          "properties": { "text": "Unassigned only", "checked": false }
        },
        {
          "ID": "queue-count",
          "typeID": "Label",
          "x": "40",
          "y": "436",
          "w": "188",
          "h": "22",
          "zOrder": "2",
          "properties": {
            "text": "18 open · 4 waiting",
            "size": "12",
            "color": "#64748b"
          }
        },
        {
          "ID": "ticket-reference",
          "typeID": "Label",
          "x": "284",
          "y": "112",
          "w": "360",
          "h": "18",
          "zOrder": "2",
          "properties": {
            "text": "TICKET  #SR-2048",
            "size": "12",
            "bold": true,
            "color": "#64748b"
          }
        },
        {
          "ID": "ticket-subject",
          "typeID": "Title",
          "x": "284",
          "y": "136",
          "w": "470",
          "h": "32",
          "zOrder": "2",
          "properties": {
            "text": "Export finishes without a download",
            "size": "20"
          }
        },
        {
          "ID": "resolve-ticket",
          "typeID": "Button",
          "x": "816",
          "y": "134",
          "w": "96",
          "h": "34",
          "zOrder": "2",
          "properties": { "text": "Resolve" }
        },
        {
          "ID": "requester-label",
          "typeID": "Label",
          "x": "284",
          "y": "180",
          "w": "190",
          "h": "18",
          "zOrder": "2",
          "properties": { "text": "Requester", "size": "12", "color": "#64748b" }
        },
        {
          "ID": "requester-name",
          "typeID": "Label",
          "x": "284",
          "y": "202",
          "w": "190",
          "h": "22",
          "zOrder": "2",
          "properties": { "text": "Mina Patel", "size": "14", "bold": true }
        },
        {
          "ID": "created-label",
          "typeID": "Label",
          "x": "500",
          "y": "180",
          "w": "190",
          "h": "18",
          "zOrder": "2",
          "properties": { "text": "Created", "size": "12", "color": "#64748b" }
        },
        {
          "ID": "created-time",
          "typeID": "Label",
          "x": "500",
          "y": "202",
          "w": "190",
          "h": "22",
          "zOrder": "2",
          "properties": { "text": "Today, 09:42", "size": "14" }
        },
        {
          "ID": "header-divider",
          "typeID": "Line",
          "x": "284",
          "y": "244",
          "w": "628",
          "h": "0",
          "zOrder": "2",
          "properties": { "color": "#e2e8f0" }
        },
        {
          "ID": "assignee-label",
          "typeID": "Label",
          "x": "284",
          "y": "260",
          "w": "210",
          "h": "18",
          "zOrder": "2",
          "properties": { "text": "Assignee", "size": "12", "color": "#64748b" }
        },
        {
          "ID": "assignee-select",
          "typeID": "ComboBox",
          "x": "284",
          "y": "282",
          "w": "210",
          "h": "34",
          "zOrder": "2",
          "properties": { "text": "Ari Chen" }
        },
        {
          "ID": "status-label",
          "typeID": "Label",
          "x": "520",
          "y": "260",
          "w": "180",
          "h": "18",
          "zOrder": "2",
          "properties": { "text": "Status", "size": "12", "color": "#64748b" }
        },
        {
          "ID": "status-select",
          "typeID": "ComboBox",
          "x": "520",
          "y": "282",
          "w": "180",
          "h": "34",
          "zOrder": "2",
          "properties": { "text": "In progress" }
        },
        {
          "ID": "priority-label",
          "typeID": "Label",
          "x": "724",
          "y": "260",
          "w": "188",
          "h": "18",
          "zOrder": "2",
          "properties": { "text": "Priority", "size": "12", "color": "#64748b" }
        },
        {
          "ID": "priority-value",
          "typeID": "Label",
          "x": "724",
          "y": "282",
          "w": "188",
          "h": "34",
          "zOrder": "2",
          "properties": { "text": "High", "size": "14", "bold": true, "color": "#b91c1c" }
        },
        {
          "ID": "message-divider",
          "typeID": "Line",
          "x": "284",
          "y": "338",
          "w": "628",
          "h": "0",
          "zOrder": "2",
          "properties": { "color": "#e2e8f0" }
        },
        {
          "ID": "latest-message-heading",
          "typeID": "Label",
          "x": "284",
          "y": "354",
          "w": "360",
          "h": "24",
          "zOrder": "2",
          "properties": { "text": "Latest customer message", "size": "16", "bold": true }
        },
        {
          "ID": "latest-message",
          "typeID": "Paragraph",
          "x": "284",
          "y": "382",
          "w": "628",
          "h": "54",
          "zOrder": "2",
          "properties": {
            "text": "The CSV export shows Ready, but clicking Download does not save a file. This started after I filtered by date range.",
            "size": "14"
          }
        },
        {
          "ID": "reply-divider",
          "typeID": "Line",
          "x": "284",
          "y": "454",
          "w": "628",
          "h": "0",
          "zOrder": "2",
          "properties": { "color": "#e2e8f0" }
        },
        {
          "ID": "reply-heading",
          "typeID": "Label",
          "x": "284",
          "y": "470",
          "w": "200",
          "h": "24",
          "zOrder": "2",
          "properties": { "text": "Reply", "size": "16", "bold": true }
        },
        {
          "ID": "reply-draft",
          "typeID": "TextArea",
          "x": "284",
          "y": "500",
          "w": "628",
          "h": "92",
          "zOrder": "2",
          "properties": {
            "text": "Hi Mina,\nThanks for reporting this. I am checking the export flow and will send an update shortly.",
            "size": "14"
          }
        },
        {
          "ID": "notify-requester",
          "typeID": "CheckBox",
          "x": "284",
          "y": "610",
          "w": "280",
          "h": "24",
          "zOrder": "2",
          "properties": { "text": "Notify Mina when sent", "checked": true }
        },
        {
          "ID": "save-draft",
          "typeID": "Button",
          "x": "658",
          "y": "604",
          "w": "112",
          "h": "38",
          "zOrder": "2",
          "properties": { "text": "Save draft" }
        },
        {
          "ID": "send-reply",
          "typeID": "Button",
          "x": "784",
          "y": "604",
          "w": "128",
          "h": "38",
          "zOrder": "2",
          "properties": {
            "text": "Send reply",
            "bold": true,
            "color": "#bfdbfe"
          }
        }
      ]
    }
  }
}
```

### Unsupported inputs

The renderer reads the code fence as strict JSON text. JSON comments, trailing commas, duplicate object keys, or a document without the `mockup` envelope are rejected. The JSON root must have a nonempty `controls.control` array; the accepted input is limited to 256 KiB, nesting depth 100, and 3,000 controls. A `.bmpr` or `.bmml` file is not loaded or converted; the renderer has no project-file or XML import path. It also has no asset loader or symbol expansion step. Only the listed `typeID` values are rendered, so image or symbol controls are rejected as unsupported types. Put the supported JSON controls directly in the fenced source instead of relying on external files or references.

## Sources and evidence

- Official upstream reference: [Balsamiq Mockups 3 for Desktop documentation (PDF)](https://balsamiq.com/assets/product/mockups3fordesktop/balsamiq-mockups-3-for-desktop-documentation.pdf) (application overview, controls and properties, Symbols and Assets, Mockups JSON export/import, BMML import, and BMPR format).
- Official migration reference: [Converting BMML files to BMPR](https://balsamiq.com/support/troubleshooting-faqs/bmml-to-bmpr/).
- Official background on the legacy XML name: [Mockups 1.6 release notes](https://balsamiq.com/learn/mockups-16-release-linking-mockups-and-more/).
- Local profile checked against [balsamiq.ts](../../../src/renderers/balsamiq.ts), [balsamiq-json.ts](../../../src/renderers/balsamiq-json.ts), [balsamiq-svg.ts](../../../src/renderers/balsamiq-svg.ts), [balsamiq-json.test.ts](../../../tests/balsamiq-json.test.ts), and [balsamiq-svg.test.ts](../../../tests/balsamiq-svg.test.ts).

**Review date:** 2026-10-26.
