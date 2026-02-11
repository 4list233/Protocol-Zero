#!/usr/bin/env python3
"""
Shopify Pricing Calculator
Interactive tool to help determine optimal margins and pricing strategy.

Usage:
    python3 shopify_pricing_calculator.py
    python3 shopify_pricing_calculator.py --cost 50 --margin 80
"""

import argparse
from typing import List, Tuple


class PricingCalculator:
    """Calculate Shopify pricing scenarios"""
    
    def __init__(self, exchange_rate: float = 0.19, shipping_cny: float = 30.0):
        self.exchange_rate = exchange_rate
        self.shipping_cny = shipping_cny
    
    def calculate(self, cost_cny: float, margin_percent: float) -> dict:
        """Calculate pricing breakdown"""
        total_cost_cny = cost_cny + self.shipping_cny
        cost_cad = total_cost_cny * self.exchange_rate
        selling_price_cad = cost_cad * (1 + margin_percent / 100)
        
        # Psychological pricing (.99)
        selling_price_cad = round(selling_price_cad) - 0.01
        
        profit_cad = selling_price_cad - cost_cad
        profit_margin = (profit_cad / selling_price_cad * 100) if selling_price_cad > 0 else 0
        
        return {
            'cost_cny': cost_cny,
            'shipping_cny': self.shipping_cny,
            'total_cost_cny': total_cost_cny,
            'cost_cad': round(cost_cad, 2),
            'markup_percent': margin_percent,
            'selling_price_cad': round(selling_price_cad, 2),
            'profit_cad': round(profit_cad, 2),
            'profit_margin_percent': round(profit_margin, 2),
        }
    
    def print_breakdown(self, result: dict):
        """Pretty print pricing breakdown"""
        print(f"\n{'='*60}")
        print(f"💰 PRICING BREAKDOWN")
        print(f"{'='*60}")
        print(f"\n📦 Costs:")
        print(f"   Product Cost:        ¥{result['cost_cny']:.2f} CNY")
        print(f"   Shipping Cost:       ¥{result['shipping_cny']:.2f} CNY")
        print(f"   Total Cost (CNY):    ¥{result['total_cost_cny']:.2f} CNY")
        print(f"   Total Cost (CAD):    ${result['cost_cad']:.2f} CAD")
        print(f"\n💵 Pricing:")
        print(f"   Markup:              {result['markup_percent']:.0f}%")
        print(f"   Selling Price:       ${result['selling_price_cad']:.2f} CAD")
        print(f"\n📈 Profit:")
        print(f"   Profit per Unit:     ${result['profit_cad']:.2f} CAD")
        print(f"   Profit Margin:       {result['profit_margin_percent']:.2f}%")
        print(f"{'='*60}\n")
    
    def collection_tier(self, price_cad: float) -> str:
        """Determine collection tier"""
        if price_cad <= 25:
            return "Budget ($0-$25)"
        elif price_cad <= 75:
            return "Mid-Range ($25-$75)"
        else:
            return "Premium ($75+)"
    
    def compare_margins(self, cost_cny: float, margins: List[int]):
        """Compare different margin scenarios"""
        print(f"\n{'='*80}")
        print(f"📊 MARGIN COMPARISON FOR ¥{cost_cny} CNY PRODUCT")
        print(f"{'='*80}")
        print(f"\n{'Margin':<10} {'Selling Price':<15} {'Profit':<12} {'Margin %':<12} {'Collection':<20}")
        print(f"{'-'*80}")
        
        for margin in margins:
            result = self.calculate(cost_cny, margin)
            collection = self.collection_tier(result['selling_price_cad'])
            
            print(f"{margin}%{' ':<7} "
                  f"${result['selling_price_cad']:<14.2f} "
                  f"${result['profit_cad']:<11.2f} "
                  f"{result['profit_margin_percent']:<11.2f}% "
                  f"{collection}")
        
        print(f"{'='*80}\n")
    
    def suggest_margin(self, cost_cny: float, target_price_cad: float) -> float:
        """Calculate required margin to hit target price"""
        cost_cad = (cost_cny + self.shipping_cny) * self.exchange_rate
        required_margin = ((target_price_cad / cost_cad) - 1) * 100
        return round(required_margin, 2)


def interactive_mode():
    """Interactive pricing calculator"""
    calc = PricingCalculator()
    
    print("=" * 60)
    print("🛒 SHOPIFY PRICING CALCULATOR")
    print("=" * 60)
    print("\nCalculate selling prices with different margins")
    print("Exchange Rate: 0.19 CNY/CAD | Shipping: ¥30 CNY\n")
    
    while True:
        print("\nOptions:")
        print("  1. Calculate single price")
        print("  2. Compare multiple margins")
        print("  3. Suggest margin for target price")
        print("  4. Price range analysis")
        print("  5. Exit")
        
        choice = input("\nSelect option (1-5): ").strip()
        
        if choice == '1':
            try:
                cost = float(input("Enter product cost (CNY): "))
                margin = float(input("Enter desired margin (%): "))
                result = calc.calculate(cost, margin)
                calc.print_breakdown(result)
                print(f"💡 Collection: {calc.collection_tier(result['selling_price_cad'])}")
            except ValueError:
                print("❌ Invalid input. Please enter numbers.")
        
        elif choice == '2':
            try:
                cost = float(input("Enter product cost (CNY): "))
                margins = [50, 60, 70, 80, 90, 100, 120, 150]
                calc.compare_margins(cost, margins)
            except ValueError:
                print("❌ Invalid input. Please enter a number.")
        
        elif choice == '3':
            try:
                cost = float(input("Enter product cost (CNY): "))
                target = float(input("Enter target selling price (CAD): "))
                required_margin = calc.suggest_margin(cost, target)
                print(f"\n💡 Required margin: {required_margin:.2f}%")
                result = calc.calculate(cost, required_margin)
                calc.print_breakdown(result)
            except ValueError:
                print("❌ Invalid input. Please enter numbers.")
        
        elif choice == '4':
            print("\n📊 PRICE RANGE ANALYSIS")
            print("\nBudget Tier ($0-$25):")
            calc.compare_margins(40, [50, 60, 80, 100])
            
            print("\nMid-Range Tier ($25-$75):")
            calc.compare_margins(120, [60, 80, 100, 120])
            
            print("\nPremium Tier ($75+):")
            calc.compare_margins(300, [80, 100, 120, 150])
        
        elif choice == '5':
            print("\n👋 Goodbye!")
            break
        
        else:
            print("❌ Invalid option. Please select 1-5.")


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description='Shopify pricing calculator for Protocol Zero',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 shopify_pricing_calculator.py                    # Interactive mode
  python3 shopify_pricing_calculator.py --cost 50 --margin 80
  python3 shopify_pricing_calculator.py --cost 120 --compare
        """
    )
    
    parser.add_argument('--cost', type=float, help='Product cost in CNY')
    parser.add_argument('--margin', type=float, help='Desired margin percentage')
    parser.add_argument('--compare', action='store_true', help='Compare multiple margins')
    parser.add_argument('--exchange-rate', type=float, default=0.19, help='CNY to CAD rate')
    parser.add_argument('--shipping', type=float, default=30.0, help='Shipping cost in CNY')
    
    args = parser.parse_args()
    
    calc = PricingCalculator(
        exchange_rate=args.exchange_rate,
        shipping_cny=args.shipping
    )
    
    if args.cost:
        if args.compare:
            margins = [50, 60, 70, 80, 90, 100, 120, 150]
            calc.compare_margins(args.cost, margins)
        elif args.margin:
            result = calc.calculate(args.cost, args.margin)
            calc.print_breakdown(result)
            print(f"💡 Collection: {calc.collection_tier(result['selling_price_cad'])}")
        else:
            print("❌ Please specify --margin or --compare")
            return 1
    else:
        # Interactive mode
        interactive_mode()
    
    return 0


if __name__ == '__main__':
    exit(main())
