import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct, updateProduct } from '../api/client';
import ProductForm, { type ProductFormValues } from '../components/ProductForm';
import type { ApiError, Product } from '../types';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const productId = Number(id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [externalErrors, setExternalErrors] = useState<Partial<ProductFormValues>>({});

  useEffect(() => {
    if (!productId) return;
    getProduct(productId)
      .then((p) => {
        setProduct(p);
        setLoading(false);
      })
      .catch((err: ApiError) => {
        if (err.statusCode === 404) {
          navigate('/');
          return;
        }
        setPageError(err.message ?? 'Failed to load product.');
        setLoading(false);
      });
  }, [productId, navigate]);

  async function handleSubmit(values: ProductFormValues) {
    setExternalErrors({});
    try {
      await updateProduct(productId, {
        name: values.name.trim(),
        sku: values.sku.trim(),
        current_stock: Number(values.current_stock),
        supplier_lead_time_days: Number(values.supplier_lead_time_days),
        safety_stock: Number(values.safety_stock),
        target_coverage_days: Number(values.target_coverage_days),
      });
      navigate('/');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 409) {
        setExternalErrors({ sku: 'SKU already exists.' });
        return;
      }
      if (apiErr.field) {
        setExternalErrors({ [apiErr.field]: apiErr.message } as Partial<ProductFormValues>);
        return;
      }
      throw err;
    }
  }

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" role="status" aria-label="Loading" />
        <div className="state-text">Loading product…</div>
      </div>
    );
  }

  if (pageError || !product) {
    return (
      <div className="state-container">
        <div className="state-icon">⚠</div>
        <div className="state-text">{pageError ?? 'Product not found.'}</div>
        <Link to="/" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Edit Product</h1>
        <Link to={`/products/${product.id}`} className="btn btn-secondary">
          Cancel
        </Link>
      </div>
      <div className="card" style={{ maxWidth: 560, background: 'var(--color-surface)' }}>
        <ProductForm
          initialValues={product}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          externalErrors={externalErrors}
        />
      </div>
    </>
  );
}
