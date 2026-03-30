import { configureGlobal } from 'fast-check'

// Configure fast-check defaults for all property-based tests
// Minimum 100 iterations per property test
configureGlobal({
  numRuns: 100,
})
