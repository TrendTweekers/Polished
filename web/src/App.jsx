import { useCallback, useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Button,
  InlineStack,
  BlockStack,
  Select,
  TextField,
  Banner,
  Text,
  SkeletonBodyText,
} from "@shopify/polaris";
import { api } from "./lib/api.js";
import { showToast } from "./lib/toast.js";
import HowItWorks from "./components/HowItWorks.jsx";
import ProgressCard from "./components/ProgressCard.jsx";
import ProductTable from "./components/ProductTable.jsx";
import SettingsCard from "./components/SettingsCard.jsx";
import GlossaryManager from "./components/GlossaryManager.jsx";
import ReviewModal from "./components/ReviewModal.jsx";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Translated", value: "done" },
  { label: "Published", value: "published" },
  { label: "Out of date", value: "stale" },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [products, setProducts] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [reviewProduct, setReviewProduct] = useState(null);
  const [fatalError, setFatalError] = useState(null);

  const loadProducts = useCallback(async () => {
    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (search.trim()) params.search = search.trim();
    const res = await api.getProducts(params);
    setProducts(res.products);
    return res.products;
  }, [statusFilter, search]);

  const loadAll = useCallback(async () => {
    try {
      const [meRes, glossRes] = await Promise.all([api.me(), api.getGlossary()]);
      setMe(meRes);
      setGlossary(glossRes.terms);
      await loadProducts();
    } catch (error) {
      if (error.status === 401) {
        setFatalError(
          "Could not authenticate with Shopify. Please reopen the app from your Shopify admin."
        );
      } else {
        setFatalError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [loadProducts]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the product list when filters change (after initial load).
  useEffect(() => {
    if (!loading) loadProducts().catch((e) => showToast(e.message, { error: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, search]);

  async function refreshSummary() {
    try {
      const meRes = await api.me();
      setMe(meRes);
    } catch {
      /* non-fatal */
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      const res = await api.scan();
      showToast(`Scan complete — ${res.scanned} products found`);
      await Promise.all([loadProducts(), refreshSummary()]);
    } catch (error) {
      if (error.status === 402 && error.data?.planSelectionUrl) {
        redirectToBilling(error.data.planSelectionUrl);
        return;
      }
      showToast(error.message, { error: true });
    } finally {
      setScanning(false);
    }
  }

  async function handleTranslateSelected() {
    if (selectedIds.length === 0) {
      showToast("Select at least one product to translate.", { error: true });
      return;
    }
    setTranslating(true);
    try {
      const res = await api.translate(selectedIds, false);
      const job = res.job;
      showToast(
        `Translated ${job.processedItems} product(s)` +
          (job.failedItems ? `, ${job.failedItems} failed` : "")
      );
      await Promise.all([loadProducts(), refreshSummary()]);
    } catch (error) {
      if (error.status === 402 && error.data?.planSelectionUrl) {
        redirectToBilling(error.data.planSelectionUrl);
        return;
      }
      showToast(error.message, { error: true });
    } finally {
      setTranslating(false);
    }
  }

  function redirectToBilling(url) {
    // The plan selection page must open at the top level, outside the iframe.
    if (window.top) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  async function reloadGlossary() {
    const res = await api.getGlossary();
    setGlossary(res.terms);
  }

  if (fatalError) {
    return (
      <Page title="Polished">
        <Banner tone="critical" title="Something went wrong">
          <p>{fatalError}</p>
        </Banner>
      </Page>
    );
  }

  const billingInactive =
    me?.billing?.enabled && me?.billing?.active === false && me?.billing?.planSelectionUrl;

  return (
    <Page
      title="Make your Shopify store sound native in Polish"
      subtitle="Translate your products into natural, native-quality Polish before entering the market."
    >
      <Layout>
        {billingInactive && (
          <Layout.Section>
            <Banner
              tone="warning"
              title="Choose a plan"
              action={{
                content: "Choose a plan",
                onAction: () => redirectToBilling(me.billing.planSelectionUrl),
              }}
            >
              <p>Pick a Polished plan to scan and translate products. 14-day free trial included.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <HowItWorks />
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <SkeletonBodyText lines={3} />
            </Card>
          ) : (
            <ProgressCard counts={me?.counts} />
          )}
        </Layout.Section>

        <Layout.Section>
          {!loading && (
            <SettingsCard
              settings={me?.settings}
              onChange={(settings) => setMe((m) => ({ ...m, settings }))}
            />
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" align="space-between" blockAlign="end" wrap>
                <InlineStack gap="300" blockAlign="end" wrap>
                  <Button variant="primary" onClick={handleScan} loading={scanning}>
                    Scan all products
                  </Button>
                  <Button
                    onClick={handleTranslateSelected}
                    loading={translating}
                    disabled={selectedIds.length === 0}
                  >
                    {`Translate selected${
                      selectedIds.length ? ` (${selectedIds.length})` : ""
                    }`}
                  </Button>
                </InlineStack>
                <InlineStack gap="300" blockAlign="end" wrap>
                  <div style={{ minWidth: 160 }}>
                    <Select
                      label="Status"
                      labelInline
                      options={STATUS_FILTERS}
                      value={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <TextField
                      label="Search"
                      labelHidden
                      placeholder="Search products"
                      value={search}
                      onChange={setSearch}
                      clearButton
                      onClearButtonClick={() => setSearch("")}
                      autoComplete="off"
                    />
                  </div>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {loading ? (
            <Card>
              <SkeletonBodyText lines={6} />
            </Card>
          ) : (
            <ProductTable
              products={products}
              onSelectionChange={setSelectedIds}
              onReview={setReviewProduct}
            />
          )}
        </Layout.Section>

        <Layout.Section>
          {!loading && <GlossaryManager terms={glossary} onReload={reloadGlossary} />}
        </Layout.Section>
      </Layout>

      <ReviewModal
        product={reviewProduct}
        open={Boolean(reviewProduct)}
        settings={me?.settings}
        onClose={() => setReviewProduct(null)}
        onSaved={async () => {
          const [freshProducts] = await Promise.all([loadProducts(), refreshSummary()]);
          // Refresh the modal's product reference with latest data.
          setReviewProduct((current) => {
            if (!current) return current;
            const updated = freshProducts.find((p) => p.productId === current.productId);
            return updated ?? current;
          });
        }}
      />
    </Page>
  );
}
