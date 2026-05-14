<script setup lang="ts">
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-[#070b18] text-white">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.24)_0%,rgba(16,185,129,0.08)_30%,transparent_62%)]" />
    <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_34%,rgba(0,0,0,0.16)_100%)]" />
    <div
      class="absolute -left-24 top-24 h-56 w-56 rounded-full bg-emerald-400/10"
      style="filter: blur(64px)"
    />
    <div
      class="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-emerald-300/8"
      style="filter: blur(64px)"
    />

    <div class="relative flex h-full w-full flex-col px-[72px] py-[56px]">
      <div class="flex items-start justify-between gap-8">
        <div class="flex items-center gap-4">
          <div class="flex h-16 w-16 items-center justify-center rounded-[20px] border border-emerald-300/25 bg-emerald-400/12">
            <div class="flex h-9 w-9 items-center justify-center rounded-[12px] border-[5px] border-emerald-300 border-r-transparent rotate-45" />
          </div>
          <div>
            <p class="m-0 text-[16px] font-semibold uppercase tracking-[0.34em] text-emerald-300/85">
              Nuxt Studio
            </p>
            <h1 class="m-0 mt-3 text-[54px] font-semibold leading-none text-white">
              Alpha release
            </h1>
          </div>
        </div>

        <div class="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[14px] font-medium text-emerald-200">
          Visual editing in production
        </div>
      </div>

      <p class="mt-6 max-w-[880px] text-[26px] leading-[1.35] text-white/70">
        Manage content, edit Markdown, and preview changes directly from your live site.
      </p>

      <div class="mt-10 grid flex-1 grid-cols-[1.05fr_1.55fr] gap-6">
        <div
          class="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]"
          style="box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35)"
        >
          <div class="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4">
            <div class="flex items-center gap-2.5">
              <span class="size-3 rounded-full bg-[#ff5f57]" />
              <span class="size-3 rounded-full bg-[#febc2e]" />
              <span class="size-3 rounded-full bg-[#28c840]" />
            </div>
            <div class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-medium text-white/70">
              Content · installation.md
            </div>
          </div>

          <div class="flex h-full flex-col gap-4 px-6 py-5">
            <div class="flex items-center gap-2 text-[12px] uppercase tracking-[0.28em] text-white/45">
              <span class="rounded-full bg-emerald-400/10 px-2 py-1 text-emerald-300">Editor</span>
              <span>TipTap + form fields</span>
            </div>

            <div class="rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-[15px] leading-7 text-white/70">
              <div class="flex items-center gap-2 text-emerald-300">
                <span class="text-white/35">---</span>
                <span>frontmatter</span>
                <span class="text-white/35">---</span>
              </div>
              <div class="mt-3 flex flex-col gap-2">
                <div class="flex items-start gap-3">
                  <span class="text-white/25">title:</span>
                  <span class="text-white">Installation</span>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-white/25">description:</span>
                  <span>Get started with Nuxt Studio.</span>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-white/25">navigation:</span>
                  <span class="text-emerald-200">icon: i-lucide-download</span>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-white/25">seo:</span>
                  <span>title: Nuxt Studio module</span>
                </div>
              </div>
            </div>

            <div class="mt-auto grid grid-cols-3 gap-3 text-[13px]">
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-white/80">
                Visual editor
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-white/80">
                Media library
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-white/80">
                Git sync
              </div>
            </div>
          </div>
        </div>

        <div
          class="overflow-hidden rounded-[28px] border border-black/10 bg-white text-[#111827]"
          style="box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25)"
        >
          <div class="flex items-center justify-between border-b border-black/10 bg-[#fafafa] px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="rounded-full bg-black/5 px-4 py-2 text-[15px] font-semibold text-[#111827]">
                TockDocs
              </div>
              <div class="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px] text-[#6b7280]">
                Search...
              </div>
            </div>
            <div class="flex items-center gap-3 text-[#6b7280]">
              <span class="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px]">EN</span>
              <span class="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px]">☀</span>
              <span class="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px]">◌</span>
            </div>
          </div>

          <div class="grid h-full grid-cols-[220px_minmax(0,1fr)_190px] gap-0">
            <aside class="border-r border-black/10 bg-[#fcfcfc] px-5 py-5 text-[14px] text-[#6b7280]">
              <div class="mb-4 font-semibold text-[#111827]">
                Content
              </div>
              <div class="flex flex-col gap-2">
                <div class="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
                  Installation
                </div>
                <div class="rounded-xl px-3 py-2">
                  Project Structure
                </div>
                <div class="rounded-xl px-3 py-2">
                  Web Editor
                </div>
                <div class="rounded-xl px-3 py-2">
                  Migration
                </div>
              </div>
              <div class="mt-6 font-semibold text-[#111827]">
                Core Concepts
              </div>
              <div class="mt-2 flex flex-col gap-2">
                <div class="rounded-xl px-3 py-2">
                  Edition
                </div>
                <div class="rounded-xl px-3 py-2">
                  Configuration
                </div>
                <div class="rounded-xl px-3 py-2">
                  Theme
                </div>
              </div>
            </aside>

            <main class="px-8 py-6">
              <div class="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Getting Started
              </div>
              <h2 class="mt-3 text-[42px] font-semibold leading-none text-[#111827]">
                Installation
              </h2>
              <p class="mt-4 max-w-[520px] text-[18px] leading-8 text-[#6b7280]">
                Get started with Nuxt Studio and edit your documentation visually.
              </p>

              <div
                class="mt-8 rounded-3xl border border-black/10 bg-[#fafafa] p-6"
                style="box-shadow: 0 18px 45px rgba(0, 0, 0, 0.08)"
              >
                <div class="flex items-center justify-between">
                  <div class="rounded-full border border-black/10 bg-white px-4 py-2 text-[14px] font-medium text-[#111827]">
                    Copy page
                  </div>
                  <div class="rounded-full bg-emerald-600/10 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                    Live preview
                  </div>
                </div>

                <div class="mt-6 flex flex-col gap-4 text-[16px] text-[#374151]">
                  <div class="h-3 w-3/4 rounded-full bg-[#e5e7eb]" />
                  <div class="h-3 w-11/12 rounded-full bg-[#e5e7eb]" />
                  <div class="h-3 w-5/6 rounded-full bg-[#e5e7eb]" />
                  <div class="h-3 w-2/3 rounded-full bg-[#e5e7eb]" />
                </div>
              </div>
            </main>

            <aside class="border-l border-black/10 bg-[#fcfcfc] px-5 py-5 text-[14px] text-[#6b7280]">
              <div class="mb-4 font-semibold text-[#111827]">
                On this page
              </div>
              <div class="flex flex-col gap-2">
                <div class="rounded-xl border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 text-emerald-700">
                  Install
                </div>
                <div class="rounded-xl px-3 py-2">
                  Configure
                </div>
                <div class="rounded-xl px-3 py-2">
                  Customize
                </div>
                <div class="rounded-xl px-3 py-2">
                  Deploy
                </div>
              </div>
              <div class="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4 text-[#111827]">
                <div class="text-xs uppercase tracking-[0.22em] text-[#6b7280]">
                  Community
                </div>
                <div class="mt-2 text-[15px] font-medium">
                  Nuxt Studio docs
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
