#!/usr/bin/env node
import { createCLI } from './cli'

const cli = createCLI({
  name: 'create-tockdocs',
  description: 'Create a new TockDocs documentation project',
  setup: {
    defaults: {},
  },
})

cli.runMain()
