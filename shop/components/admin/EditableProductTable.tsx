import React from 'react'

export default function EditableProductTable({ products }: { products: any[] }) {
  // Placeholder: Render product name, variants, editable yuan price, and margin
  return (
    <table className="w-full text-sm border border-[#2C2C2C] rounded-xl overflow-hidden">
      <thead className="bg-[#121212] text-neutral-300">
        <tr>
          <th className="text-left p-3 border-b border-[#2C2C2C]">Product Name</th>
          <th className="text-left p-3 border-b border-[#2C2C2C]">Variant</th>
          <th className="text-left p-3 border-b border-[#2C2C2C]">Yuan Price</th>
          <th className="text-left p-3 border-b border-[#2C2C2C]">Margin</th>
        </tr>
      </thead>
      <tbody>
        {products.map(product => (
          <React.Fragment key={product.id}>
            <tr className="bg-[#181818]">
              <td className="p-3 font-medium" colSpan={4}>{product.name}</td>
            </tr>
            {product.variants?.map((variant:any) => (
              <tr key={variant.id} className="hover:bg-[#111] border-b border-[#2C2C2C]">
                <td></td>
                <td className="p-3">{variant.name}</td>
                <td className="p-3">
                  <input type="number" defaultValue={variant.priceYuan} className="bg-[#222] border rounded px-2 py-1 w-24" />
                </td>
                <td className="p-3">
                  <input type="number" defaultValue={variant.margin} className="bg-[#222] border rounded px-2 py-1 w-24" />
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
}
