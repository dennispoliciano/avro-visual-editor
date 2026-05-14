# Avro Visual Editor

![Tests](https://img.shields.io/badge/tests-vitest-6E40C9?style=flat-square&logo=vitest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A browser-based visual editor for building [Apache Avro](https://avro.apache.org/) schemas. No backend required — everything runs in the browser.

Designed for teams working with **Kafka + Schema Registry**, it generates an avro schema from a single visual form, with real-time JSON preview and validation, making schema creation accessible to anyone on the team — no Avro expertise needed.

---

## Features

- **Visual form** — build Avro schemas without writing JSON by hand
- **Recursive types** — supports nested `record`, `enum`, and `array` types at any depth
- **Logical types** — `date` and `timestamp-millis` with correct Avro serialization
- **Optional fields** — automatically wraps types in `["null", <type>]` unions with `"default": null`
- **Logical names** — prevents class name collisions in generated producers/consumers
- **Real-time validation** — inline errors with export blocked until the schema is valid
- **Copy & Export** — copy JSON to clipboard or download as `.avsc`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 6 |
| State management | Zustand + Immer |
| Syntax highlighting | react-syntax-highlighter |
| Styling | Tailwind CSS + CSS custom properties |
| Unit tests | Vitest + React Testing Library |
| Property-based tests | fast-check |

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later

### Installation

```bash
# Clone the repository
git clone https://github.com/dennispoliciano/avro-visual-editor.git
cd avro-visual-editor

# Install dependencies
npm install
```

### Running locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for production

```bash
npm run build
```

The output is placed in the `dist/` folder. You can preview it with:

```bash
npm run preview
```

---

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Tests cover:

- **Serializer** — unit tests + property-based tests (round-trip, union rules, no mutation)
- **Validator** — unit tests + property-based tests (idempotency, error paths)
- **Store** — integration tests for add/remove/move/update actions

---


## Avro Type Support

| Type | Kind | Notes |
|---|---|---|
| `null`, `boolean`, `int`, `long`, `float`, `double`, `string` | Primitive | Serialized as a plain string |
| `date` | Logical | `{"type": "int", "logicalType": "date"}` |
| `timestamp-millis` | Logical | `{"type": "long", "logicalType": "timestamp-millis"}` |
| `record` | Complex | Recursive — supports nested fields |
| `enum` | Complex | Requires at least one symbol |
| `array` | Complex | Items can be any type, including nested records |

Optional fields (`required = false`) are serialized as:

```json
{
  "name": "myField",
  "type": ["null", "<type>"],
  "default": null
}
```

---


## Logical Names

When the same field name (e.g. `address`) appears in multiple events, Avro code generators produce conflicting class names. The **logical name** field lets you override the serialized `"name"` key to avoid collisions:

- Display name: `address`
- Logical name: `address_OrderCreated`
- Serialized as: `{"name": "address_OrderCreated", "type": "record", ...}`

Convention: `fieldName_EventNameWithoutValueSuffix`

---

