import { route, json, db, body } from "@/server/http";
import { listProducts, createProduct, zProductInput } from "@/server/products";
export const dynamic = "force-dynamic";
export const GET = route<{ id: string }>(async (_req, { params }) => json({ items: listProducts(db(), params.id) }));
export const POST = route<{ id: string }>(async (req, { params }) => json(createProduct(db(), params.id, await body(req, zProductInput)), 201));
