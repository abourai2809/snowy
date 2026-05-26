import { useEffect, useState } from "react";
import type { CatalogCategory, CatalogItem, Product } from "../../domain/catalog";
import type { Flavour } from "../../domain/flavours";
import {
  listCatalogItems,
  listCategories,
  listFlavours,
  listProducts,
} from "./catalogApi";
import { CatalogCategoryEditor } from "./CatalogCategoryEditor";
import { CatalogItemEditor } from "./CatalogItemEditor";
import { FlavourEditor } from "./FlavourEditor";
import { ProductEditor } from "./ProductEditor";
import { QueueBusterCommandCenter } from "../queuebuster/QueueBusterCommandCenter";

type CatalogTab = "flavours" | "categories" | "items" | "products" | "queuebuster";

export function CatalogPage() {
  const [activeTab, setActiveTab] = useState<CatalogTab>("flavours");
  const [flavours, setFlavours] = useState<Flavour[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [flavourRows, categoryRows, itemRows, productRows] = await Promise.all([
        listFlavours(),
        listCategories(),
        listCatalogItems(),
        listProducts(),
      ]);
      setFlavours(flavourRows);
      setCategories(categoryRows);
      setItems(itemRows);
      setProducts(productRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load catalog.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="page-stack">
      <div className="tabs" aria-label="Catalog sections">
        <button className={`tab ${activeTab === "flavours" ? "act" : ""}`} type="button" onClick={() => setActiveTab("flavours")}>
          Flavours
        </button>
        <button className={`tab ${activeTab === "categories" ? "act" : ""}`} type="button" onClick={() => setActiveTab("categories")}>
          Categories
        </button>
        <button className={`tab ${activeTab === "items" ? "act" : ""}`} type="button" onClick={() => setActiveTab("items")}>
          Items
        </button>
        <button className={`tab ${activeTab === "products" ? "act" : ""}`} type="button" onClick={() => setActiveTab("products")}>
          Products
        </button>
        <button className={`tab ${activeTab === "queuebuster" ? "act" : ""}`} type="button" onClick={() => setActiveTab("queuebuster")}>
          QueueBuster
        </button>
      </div>

      {loading ? <p className="muted-copy">Loading catalog...</p> : null}
      {error ? <div className="alert alert-danger">{error}</div> : null}

      {activeTab === "flavours" ? <FlavourEditor flavours={flavours} onChanged={refresh} /> : null}
      {activeTab === "categories" ? <CatalogCategoryEditor categories={categories} onChanged={refresh} /> : null}
      {activeTab === "items" ? (
        <CatalogItemEditor items={items} categories={categories} onChanged={refresh} />
      ) : null}
      {activeTab === "products" ? (
        <ProductEditor products={products} items={items} flavours={flavours} onChanged={refresh} />
      ) : null}
      {activeTab === "queuebuster" ? <QueueBusterCommandCenter /> : null}
    </div>
  );
}
