import { useEffect, useState } from 'react'

type Product = { id: string; name: string; active: boolean }

export function ActiveProducts({ products }: { products: Product[] }) {
  const [activeProducts, setActiveProducts] = useState<Product[]>([])

  useEffect(() => {
    setActiveProducts(products.filter((product) => product.active))
  }, [products])

  return <p>{activeProducts.length} active products</p>
}
