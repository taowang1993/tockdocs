[![tockdocs](https://tockdocs.dev/_og/s/c_Landing,title_TockDocs,description_An+AI-powered+Knowledge+Management+System.png)](https://tockdocs.dev)

# TockDocs

> A minimal and beautiful Nuxt layer for documentation websites

[![npm version](https://img.shields.io/npm/v/tockdocs.svg)](https://www.npmjs.com/package/tockdocs)
[![npm downloads](https://img.shields.io/npm/dm/tockdocs.svg)](https://www.npmjs.com/package/tockdocs)

This is the official Nuxt layer for [TockDocs](https://tockdocs.dev), providing a complete documentation theming. It works with the [TockDocs CLI](https://github.com/taowang1993/tockdocs/tree/main/cli) for rapid project setup.

## 🚀 Features

- ✨ **Beautiful Design** - Clean, modern documentation theme
- 📱 **Responsive** - Mobile-first responsive design
- 🌙 **Dark Mode** - Built-in dark/light mode support
- 🌍 **Internationalization** - Native i18n support with automatic routing and language switching
- 🔍 **Search** - Full-text search functionality
- 📝 **Markdown Enhanced** - Extended markdown with custom components
- 🎨 **Customizable** - Easy theming and customization
- ⚡ **Fast** - Optimized for performance
- 🔧 **TypeScript** - Full TypeScript support
- 🛠️ **CLI Integration** - Works with TockDocs CLI for quick project setup

## 📦 Installation

```bash
npm install tockdocs
```

## 🏗️ Quick Setup

### Option 1: TockDocs CLI (Recommended)

The easiest way to get started is using the TockDocs CLI, which automatically sets up a project with this layer:

```bash
# Create a new documentation project
npx create-tockdocs my-docs

# Navigate to your project
cd my-docs

# Start development
npm run dev
```

This creates a complete documentation project pre-configured with `tockdocs`.

For multi-language documentation, use the i18n template:

```bash
# Create a new i18n documentation project
npx create-tockdocs my-docs -t i18n
```

### Option 2: Manual Setup

#### Option 2a: Nuxt Config (recommended)

Add the layer to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  extends: ['tockdocs'],
})
```

For internationalization, also add the `@nuxtjs/i18n` module:

```typescript
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
    ],
  },
})
```

#### Option 2b: CLI Usage

Use directly with Nuxt CLI:

```bash
# Development
nuxt dev --extends tockdocs

# Build
nuxt build --extends tockdocs
```

## 🔗 Related Packages

- [`create-tockdocs`](https://www.npmjs.com/package/create-tockdocs) - CLI tool to scaffold TockDocs projects

## 📄 License

[MIT License](./LICENSE)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- 📖 [Documentation](https://tockdocs.dev)
- 🐛 [Issues](https://github.com/taowang1993/tockdocs/issues)
- 💬 [Discussions](https://github.com/taowang1993/tockdocs/discussions)

---

Made with ❤️ for the Nuxt community
