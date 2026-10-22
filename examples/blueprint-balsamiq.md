# Макет входа Balsamiq

Вставьте JSON отдельного mockup из Balsamiq Mockups 3. Блок преобразуется в inline SVG локально.

```balsamiq
{
  "mockup": {
    "version": "1.0",
    "measuredW": "360",
    "measuredH": "640",
    "controls": {
      "control": [
        {
          "ID": "1",
          "typeID": "Title",
          "x": "24",
          "y": "32",
          "measuredW": "312",
          "measuredH": "36",
          "zOrder": "1",
          "properties": { "text": "Вход", "size": "22", "bold": "true" }
        },
        {
          "ID": "2",
          "typeID": "Label",
          "x": "24",
          "y": "96",
          "measuredW": "312",
          "measuredH": "20",
          "zOrder": "2",
          "properties": { "text": "Электронная почта" }
        },
        {
          "ID": "3",
          "typeID": "TextInput",
          "x": "24",
          "y": "120",
          "w": "312",
          "h": "44",
          "zOrder": "3",
          "properties": { "text": "anna@example.com" }
        },
        {
          "ID": "4",
          "typeID": "Label",
          "x": "24",
          "y": "184",
          "measuredW": "312",
          "measuredH": "20",
          "zOrder": "4",
          "properties": { "text": "Пароль" }
        },
        {
          "ID": "5",
          "typeID": "TextInput",
          "x": "24",
          "y": "208",
          "w": "312",
          "h": "44",
          "zOrder": "5",
          "properties": { "text": "••••••••" }
        },
        {
          "ID": "6",
          "typeID": "CheckBox",
          "x": "24",
          "y": "280",
          "w": "180",
          "h": "24",
          "zOrder": "6",
          "properties": { "text": "Запомнить меня", "checked": "true" }
        },
        {
          "ID": "7",
          "typeID": "Button",
          "x": "24",
          "y": "336",
          "w": "312",
          "h": "48",
          "zOrder": "7",
          "properties": { "text": "Продолжить" }
        },
        {
          "ID": "8",
          "typeID": "Line",
          "x": "24",
          "y": "424",
          "w": "312",
          "h": "0",
          "zOrder": "8"
        }
      ]
    }
  }
}
```

Рендерер отображает `Canvas`, `Label`, `Title`, `SubTitle`, `Paragraph`, `TextInput`, `TextArea`, `Button`, `CheckBox`, `RadioButton`, `ComboBox`, `List`, `Rectangle` и `Line`. Он принимает JSON одного mockup с размерами `measuredW`/`measuredH`; `.bmpr`, `.bmml`, assets и symbols не поддерживаются.
