import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProduct } from '../api/client';
import ProductForm, { type ProductFormValues } from '../components/ProductForm';
import type { ApiError } from '../types';

export default function AddProductPage() {
  const navigate = useNavigate();
  const [externalErrors, setExternalErrors] = useState<Partial<ProductFormValues>>({});

  async function handleSubmit(values: ProductFormValues) {
    setExternalErrors({});
    try {
      await createProduct({
        name: values.name.trim(),
        sku: values.sku.trim(),
        current_stock: Number(values.current_stock),
        supplier_lead_time_days: Number(values.supplier_lead_time_days),
        safety_stock: Number(values.safety_stock),
        target_coverage_days: Number(values.target_coverage_days),
        is_sample: 0,
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
      throw err; // let form handle it
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Add Product</h1>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <ProductForm
          onSubmit={handleSubmit}
          submitLabel="Add Product"
          externalErrors={externalErrors}
        />
      </div>
    </>
  );
}
