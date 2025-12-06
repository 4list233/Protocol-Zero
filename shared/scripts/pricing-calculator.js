#!/usr/bin/env node
/**
 * Protocol Zero Pricing Calculator
 * 
 * Usage: node pricing-calculator.js
 * 
 * This script helps calculate:
 * - Variant prices based on ratio scaling from a base item
 * - Margins for standard and promo sales
 * - Break-even prices
 */

// ============ CONFIGURATION ============

const CONFIG = {
  // Exchange rate (CNY to CAD) - using buffered rate for margin protection
  exchangeRate: 0.20,
  
  // Fixed shipping cost per item (CNY)
  shippingCny: 70,
  
  // Revenue cuts
  salespersonCut: 0.10,  // 10% of revenue
  promoCut: 0.10,        // 10% of net revenue (after discount)
  customerDiscount: 0.10, // 10% discount for promo code users
  
  // Competitor undercut percentage
  competitorUndercut: 0.15,  // 15% below competitor
}

// ============ CALCULATOR FUNCTIONS ============

function calculateCost(costCny) {
  return (costCny + CONFIG.shippingCny) * CONFIG.exchangeRate
}

function calculateMarginStandard(priceCad, costCad) {
  if (priceCad <= 0) return -1
  const revenue = priceCad
  const afterSalesperson = revenue * (1 - CONFIG.salespersonCut)
  const profit = afterSalesperson - costCad
  return profit / revenue
}

function calculateMarginPromo(priceCad, costCad) {
  if (priceCad <= 0) return -1
  const netRevenue = priceCad * (1 - CONFIG.customerDiscount)
  const afterCuts = netRevenue * (1 - CONFIG.salespersonCut - CONFIG.promoCut)
  const profit = afterCuts - costCad
  return profit / netRevenue
}

function calculateBreakEvenStandard(costCad) {
  return costCad / (1 - CONFIG.salespersonCut)
}

function calculateBreakEvenPromo(costCad) {
  const netBreakEven = costCad / (1 - CONFIG.salespersonCut - CONFIG.promoCut)
  return netBreakEven / (1 - CONFIG.customerDiscount)
}

// ============ MAIN PRICING FUNCTION ============

function calculatePricing(variants, baseVariantIndex, basePriceCad, competitorPriceCad) {
  const baseVariant = variants[baseVariantIndex]
  const basePriceCny = baseVariant.priceCny
  
  const results = variants.map((variant) => {
    // Calculate price using ratio scaling
    const ratio = variant.priceCny / basePriceCny
    const priceCad = Math.round(basePriceCad * ratio * 100) / 100
    
    // Calculate cost (use costCny if provided, otherwise priceCny as proxy)
    const costCny = variant.costCny ?? variant.priceCny
    const costCad = calculateCost(costCny)
    
    // Calculate margins
    const marginStandard = calculateMarginStandard(priceCad, costCad)
    const marginPromo = calculateMarginPromo(priceCad, costCad)
    
    return {
      name: variant.name,
      priceCny: variant.priceCny,
      priceCad,
      costCny,
      costCad,
      marginStandard,
      marginPromo,
      isViable: marginStandard >= 0.15 && marginPromo >= 0
    }
  })
  
  // Calculate summary
  const viableVariants = results.filter(r => r.isViable)
  const avgMarginStandard = results.reduce((sum, r) => sum + r.marginStandard, 0) / results.length
  const avgMarginPromo = results.reduce((sum, r) => sum + r.marginPromo, 0) / results.length
  
  return {
    baseVariant: baseVariant.name,
    basePriceCad,
    competitorPriceCad: competitorPriceCad ?? null,
    variants: results,
    summary: {
      avgMarginStandard,
      avgMarginPromo,
      viableCount: viableVariants.length,
      warningCount: results.length - viableVariants.length
    }
  }
}

// ============ DISPLAY HELPERS ============

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`
}

function formatCurrency(value, currency = 'CAD') {
  const symbol = currency === 'CAD' ? '$' : '¥'
  return `${symbol}${value.toFixed(2)}`
}

function printResults(result) {
  console.log('\n' + '='.repeat(80))
  console.log('PRICING ANALYSIS')
  console.log('='.repeat(80))
  
  console.log(`\nBase Variant: ${result.baseVariant}`)
  console.log(`Base Price (CAD): ${formatCurrency(result.basePriceCad)}`)
  if (result.competitorPriceCad) {
    console.log(`Competitor Price: ${formatCurrency(result.competitorPriceCad)} → Undercut to ${formatCurrency(result.basePriceCad)}`)
  }
  
  console.log('\n' + '-'.repeat(80))
  console.log('VARIANT BREAKDOWN')
  console.log('-'.repeat(80))
  
  console.log(
    'Variant'.padEnd(40) +
    'CNY'.padStart(8) +
    'CAD'.padStart(10) +
    'Cost'.padStart(10) +
    'Std%'.padStart(8) +
    'Promo%'.padStart(8) +
    'Status'.padStart(10)
  )
  console.log('-'.repeat(80))
  
  for (const v of result.variants) {
    const status = v.isViable ? '✓' : (v.marginStandard < 0 ? '❌ LOSS' : '⚠️ LOW')
    console.log(
      v.name.substring(0, 38).padEnd(40) +
      formatCurrency(v.priceCny, 'CNY').padStart(8) +
      formatCurrency(v.priceCad).padStart(10) +
      formatCurrency(v.costCad).padStart(10) +
      formatPercent(v.marginStandard).padStart(8) +
      formatPercent(v.marginPromo).padStart(8) +
      status.padStart(10)
    )
  }
  
  console.log('\n' + '-'.repeat(80))
  console.log('SUMMARY')
  console.log('-'.repeat(80))
  console.log(`Average Margin (Standard): ${formatPercent(result.summary.avgMarginStandard)}`)
  console.log(`Average Margin (Promo):    ${formatPercent(result.summary.avgMarginPromo)}`)
  console.log(`Viable Variants:           ${result.summary.viableCount}/${result.variants.length}`)
  if (result.summary.warningCount > 0) {
    console.log(`⚠️  ${result.summary.warningCount} variant(s) have concerning margins!`)
  }
  console.log('='.repeat(80))
}

// ============ UTILITY: Find minimum viable base price ============

function findMinimumViableBasePrice(variants, baseVariantIndex, targetMarginStandard = 0.15) {
  const baseVariant = variants[baseVariantIndex]
  
  // For each variant, calculate the minimum base price needed
  let maxRequiredBase = 0
  
  for (const variant of variants) {
    const ratio = variant.priceCny / baseVariant.priceCny
    const costCny = variant.costCny ?? variant.priceCny
    const costCad = calculateCost(costCny)
    
    // Minimum price for this variant to hit target margin
    const minVariantPrice = costCad / (1 - CONFIG.salespersonCut - targetMarginStandard)
    
    // Convert back to required base price
    const requiredBase = minVariantPrice / ratio
    maxRequiredBase = Math.max(maxRequiredBase, requiredBase)
  }
  
  return Math.ceil(maxRequiredBase * 100) / 100
}

// ============ EXAMPLE USAGE ============

// Example: 2011 Holster Set
const holsterVariants = [
  { name: '2011 Holster (Light-bearing)', priceCny: 59 },
  { name: 'Outer Belt', priceCny: 35 },
  { name: 'Single Mag Pouch', priceCny: 29 },
  { name: 'Double Mag Pouch', priceCny: 35 },
  { name: 'Belt + Holster', priceCny: 89 },
  { name: 'Belt + Holster + Single Mag', priceCny: 109 },
  { name: 'Belt + Holster + Double Mag', priceCny: 119 },
  { name: 'Thigh Holster (Light-bearing)', priceCny: 69 },
  { name: 'MOLLE Holster (Light-bearing)', priceCny: 69 },
  { name: 'MOLLE Holster + Thigh Strap', priceCny: 79 },
]

// Competitor found at $45, undercut by 15%
const competitorPrice = 45
const basePrice = competitorPrice * (1 - CONFIG.competitorUndercut)

const result = calculatePricing(
  holsterVariants,
  0,  // Base variant index (holster)
  basePrice,
  competitorPrice
)

printResults(result)

// ============ MINIMUM VIABLE ANALYSIS ============

console.log('\n')
console.log('='.repeat(80))
console.log('MINIMUM VIABLE BASE PRICE ANALYSIS')
console.log('='.repeat(80))

const minBase15 = findMinimumViableBasePrice(holsterVariants, 0, 0.15)
const minBase20 = findMinimumViableBasePrice(holsterVariants, 0, 0.20)
const minBase25 = findMinimumViableBasePrice(holsterVariants, 0, 0.25)

console.log(`\nFor all variants to have at least:`)
console.log(`  15% margin (standard): Base price must be at least ${formatCurrency(minBase15)}`)
console.log(`  20% margin (standard): Base price must be at least ${formatCurrency(minBase20)}`)
console.log(`  25% margin (standard): Base price must be at least ${formatCurrency(minBase25)}`)
console.log('')


