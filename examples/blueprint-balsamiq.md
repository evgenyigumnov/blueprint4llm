# Balsamiq support triage dashboard

This Mockups 3 sample is a dense desktop work surface rather than a sign-in form: it combines a
queue, filters, SLA context, a selected case, an assignee control, and response actions.

```balsamiq
{
  "mockup": {
    "version": "1.0",
    "measuredW": "800",
    "measuredH": "540",
    "controls": {
      "control": [
        { "ID": "canvas", "typeID": "Rectangle", "x": "0", "y": "0", "w": "800", "h": "540", "zOrder": "0", "properties": { "color": "#ffffff" } },
        { "ID": "title", "typeID": "Title", "x": "20", "y": "14", "w": "270", "h": "34", "zOrder": "1", "properties": { "text": "Support triage", "size": "24", "bold": "true" } },
        { "ID": "subtitle", "typeID": "SubTitle", "x": "20", "y": "48", "w": "365", "h": "24", "zOrder": "2", "properties": { "text": "12 open tickets · 3 need attention", "size": "13" } },
        { "ID": "new", "typeID": "Button", "x": "652", "y": "20", "w": "128", "h": "38", "zOrder": "3", "properties": { "text": "+ New ticket", "bold": "true" } },
        { "ID": "search", "typeID": "TextInput", "x": "20", "y": "88", "w": "254", "h": "36", "zOrder": "4", "properties": { "text": "Search tickets or customers" } },
        { "ID": "priority", "typeID": "ComboBox", "x": "288", "y": "88", "w": "150", "h": "36", "zOrder": "5", "properties": { "text": "Priority: all" } },
        { "ID": "status", "typeID": "ComboBox", "x": "452", "y": "88", "w": "130", "h": "36", "zOrder": "6", "properties": { "text": "Status: open" } },
        { "ID": "mine", "typeID": "CheckBox", "x": "594", "y": "95", "w": "178", "h": "24", "zOrder": "7", "properties": { "text": "Assigned to my team", "checked": "true" } },
        { "ID": "queue-panel", "typeID": "Rectangle", "x": "20", "y": "144", "w": "492", "h": "376", "zOrder": "8", "properties": { "color": "#f8fafc" } },
        { "ID": "queue-title", "typeID": "Label", "x": "34", "y": "154", "w": "300", "h": "25", "zOrder": "9", "properties": { "text": "Needs attention · oldest first", "size": "15", "bold": "true" } },
        { "ID": "ticket-1", "typeID": "Rectangle", "x": "30", "y": "190", "w": "472", "h": "60", "zOrder": "10", "properties": { "text": "CS-4821  ·  Webhook retries doubled\nGrowth plan  ·  Mira K.  ·  14 min ago  ·  SLA 18 min", "color": "#fff7ed", "size": "13" } },
        { "ID": "ticket-2", "typeID": "Rectangle", "x": "30", "y": "256", "w": "472", "h": "60", "zOrder": "11", "properties": { "text": "CS-4817  ·  Invoice export is blank\nScale plan  ·  Noel R.  ·  31 min ago  ·  SLA 42 min", "color": "#ffffff", "size": "13" } },
        { "ID": "ticket-3", "typeID": "Rectangle", "x": "30", "y": "322", "w": "472", "h": "60", "zOrder": "12", "properties": { "text": "CS-4809  ·  Cannot add a second workspace\nStarter plan  ·  Eli T.  ·  53 min ago", "color": "#ffffff", "size": "13" } },
        { "ID": "ticket-4", "typeID": "Rectangle", "x": "30", "y": "388", "w": "472", "h": "60", "zOrder": "13", "properties": { "text": "CS-4798  ·  SSO redirect loops on Safari\nEnterprise  ·  Jo S.  ·  1 h ago", "color": "#ffffff", "size": "13" } },
        { "ID": "ticket-5", "typeID": "Rectangle", "x": "30", "y": "454", "w": "472", "h": "54", "zOrder": "14", "properties": { "text": "CS-4786  ·  Usage report differs from dashboard\nGrowth plan  ·  Sam P.  ·  2 h ago", "color": "#ffffff", "size": "13" } },
        { "ID": "detail-panel", "typeID": "Rectangle", "x": "526", "y": "144", "w": "254", "h": "376", "zOrder": "15", "properties": { "color": "#f8fafc" } },
        { "ID": "detail-title", "typeID": "Label", "x": "542", "y": "158", "w": "220", "h": "26", "zOrder": "16", "properties": { "text": "CS-4821 · P1", "size": "17", "bold": "true" } },
        { "ID": "account", "typeID": "Label", "x": "542", "y": "188", "w": "224", "h": "42", "zOrder": "17", "properties": { "text": "Northstar Analytics\nGrowth plan · 84 seats", "size": "12" } },
        { "ID": "issue", "typeID": "Paragraph", "x": "542", "y": "240", "w": "220", "h": "70", "zOrder": "18", "properties": { "text": "Retries started after key rotation. Customer sees duplicate delivery receipts but no data loss." } },
        { "ID": "assignee", "typeID": "ComboBox", "x": "542", "y": "324", "w": "220", "h": "34", "zOrder": "19", "properties": { "text": "Assignee: Mira K." } },
        { "ID": "reply", "typeID": "TextArea", "x": "542", "y": "370", "w": "220", "h": "76", "zOrder": "20", "properties": { "text": "Draft a clear update…" } },
        { "ID": "assign", "typeID": "Button", "x": "542", "y": "460", "w": "104", "h": "34", "zOrder": "21", "properties": { "text": "Take ticket" } },
        { "ID": "escalate", "typeID": "Button", "x": "654", "y": "460", "w": "108", "h": "34", "zOrder": "22", "properties": { "text": "Escalate" } }
      ]
    }
  }
}
```

The local renderer supports common Mockups 3 controls and keeps their positions and labels. `.bmpr`,
`.bmml`, external assets, and symbols are not supported.
