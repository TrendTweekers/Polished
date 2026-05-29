import { graphqlClient } from "../shopify.js";
import { prisma } from "../db.js";

const PRODUCTS_QUERY = `
  query ScanProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          descriptionHtml
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** Extract the numeric id from a Shopify GID (gid://shopify/Product/123 -> "123"). */
export function gidToId(gid) {
  if (!gid) return "";
  const parts = String(gid).split("/");
  return parts[parts.length - 1];
}

export function idToProductGid(id) {
  return `gid://shopify/Product/${id}`;
}

/**
 * Fetch every product (title + description) for a shop via the Admin GraphQL
 * API and upsert title/description rows into ProductTranslation.
 *
 * @returns {Promise<{scanned:number, created:number, updated:number}>}
 */
export async function scanAllProducts(store) {
  const client = await graphqlClient(store.shopDomain);

  let cursor = null;
  let hasNext = true;
  let scanned = 0;
  let created = 0;
  let updated = 0;

  while (hasNext) {
    let response;
    try {
      response = await client.request(PRODUCTS_QUERY, {
        variables: { cursor },
      });
    } catch (error) {
      console.error("[products] GraphQL scan failed:", error.message);
      throw new Error(`Failed to fetch products from Shopify: ${error.message}`);
    }

    const products = response?.data?.products;
    if (!products) break;

    for (const edge of products.edges) {
      const node = edge.node;
      const productId = gidToId(node.id);
      scanned += 1;

      const fields = [
        { field: "title", text: node.title ?? "" },
        { field: "description", text: node.descriptionHtml ?? "" },
      ];

      for (const { field, text } of fields) {
        const existing = await prisma.productTranslation.findUnique({
          where: {
            storeId_shopifyProductId_field: {
              storeId: store.id,
              shopifyProductId: productId,
              field,
            },
          },
        });

        if (!existing) {
          await prisma.productTranslation.create({
            data: {
              storeId: store.id,
              shopifyProductId: productId,
              field,
              originalText: text,
              status: "pending",
            },
          });
          created += 1;
        } else if (existing.originalText !== text) {
          await prisma.productTranslation.update({
            where: { id: existing.id },
            data: {
              originalText: text,
              status: ["done", "published"].includes(existing.status)
                ? "stale"
                : existing.status,
            },
          });
          updated += 1;
        }
      }
    }

    hasNext = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;
  }

  return { scanned, created, updated };
}
