import { useState } from 'react';
import type { Product } from '../types';

export interface ProductFormValues {
  name: string;
  sku: string;
  current_stock: string;
  supplier_lead_time_days: string;
  safety_stock: string;
  target_coverage_days: string;
}

interface ProductFormProps {
  initialValues?: Partial<Product>;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitLabel: string;
  externalErrors?: Partial<ProductFormValues>;
}

interface FormErrors {
  name?: string;
  sku?: string;
  current_stock?: string;
  supplier_lead_time_days?: string;
  safety_stock?: string;
  target_coverage_days?: string;
}

function validateForm(v: ProductFormValues): FormErrors {
  const errors: FormErrors = {};

  if (!v.name.trim()) {
    errors.name = 'Name is required.';
  } else if (v.name.trim().length > 120) {
    errors.name = 'Name must be 120 characters or fewer.';
  }

  if (!v.sku.trim()) {
    errors.sku = 'SKU is required.';
  } else if (v.sku.trim().length > 50) {
    errors.sku = 'SKU must be 50 characters or fewer.';
  }

  const stock = Number(v.current_stock);
  if (v.current_stock === '' || !Number.isInteger(stock) || stock < 0) {
    errors.current_stock = 'Current stock must be an integer ≥ 0.';
  }

  const lead = Number(v.supplier_lead_time_days);
  if (v.supplier_lead_time_days === '' || !Number.isInteger(lead) || lead < 1) {
    errors.supplier_lead_time_days = 'Lead time must be an integer ≥ 1.';
  }

  const safety = Number(v.safety_stock);
  if (v.safety_stock === '' || !Number.isInteger(safety) || safety < 0) {
    errors.safety_stock = 'Safety stock must be an integer ≥ 0.';
  }

  const coverage = Number(v.target_coverage_days);
  if (v.target_coverage_days === '' || !Number.isInteger(coverage) || coverage < 1) {
    errors.target_coverage_days = 'Target coverage must be an integer ≥ 1.';
  }

  return errors;
}

/**
 * Reusable product form for both Add and Edit pages.
 * All fields have associated <label htmlFor> elements.
 * Validates client-side and shows field-level errors.
 */
export default function ProductForm({
  initialValues,
  onSubmit,
  submitLabel,
  externalErrors,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    name: initialValues?.name ?? '',
    sku: initialValues?.sku ?? '',
    current_stock: initialValues?.current_stock?.toString() ?? '0',
    supplier_lead_time_days: initialValues?.supplier_lead_time_days?.toString() ?? '3',
    safety_stock: initialValues?.safety_stock?.toString() ?? '0',
    target_coverage_days: initialValues?.target_coverage_days?.toString() ?? '14',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof ProductFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch {
      // parent handles errors
    } finally {
      setSubmitting(false);
    }
  }

  const combinedErrors = { ...errors, ...externalErrors };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="product-name">
          Product Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="product-name"
          type="text"
          className={`form-input${combinedErrors.name ? ' error' : ''}`}
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          maxLength={120}
          required
          aria-required="true"
          aria-describedby={combinedErrors.name ? 'product-name-error' : undefined}
        />
        {combinedErrors.name && (
          <div id="product-name-error" className="form-error" role="alert">
            {combinedErrors.name}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="product-sku">
          SKU <span aria-hidden="true">*</span>
        </label>
        <input
          id="product-sku"
          type="text"
          className={`form-input${combinedErrors.sku ? ' error' : ''}`}
          value={values.sku}
          onChange={(e) => handleChange('sku', e.target.value)}
          maxLength={50}
          required
          aria-required="true"
          aria-describedby={combinedErrors.sku ? 'product-sku-error' : undefined}
        />
        {combinedErrors.sku && (
          <div id="product-sku-error" className="form-error" role="alert">
            {combinedErrors.sku}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="product-stock">
          Current Stock <span aria-hidden="true">*</span>
        </label>
        <input
          id="product-stock"
          type="number"
          className={`form-input${combinedErrors.current_stock ? ' error' : ''}`}
          value={values.current_stock}
          onChange={(e) => handleChange('current_stock', e.target.value)}
          min={0}
          step={1}
          required
          aria-required="true"
          aria-describedby={combinedErrors.current_stock ? 'product-stock-error' : undefined}
        />
        {combinedErrors.current_stock && (
          <div id="product-stock-error" className="form-error" role="alert">
            {combinedErrors.current_stock}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="product-lead-time">
          Supplier Lead Time (days) <span aria-hidden="true">*</span>
        </label>
        <input
          id="product-lead-time"
          type="number"
          className={`form-input${combinedErrors.supplier_lead_time_days ? ' error' : ''}`}
          value={values.supplier_lead_time_days}
          onChange={(e) => handleChange('supplier_lead_time_days', e.target.value)}
          min={1}
          step={1}
          required
          aria-required="true"
          aria-describedby={
            combinedErrors.supplier_lead_time_days ? 'product-lead-time-error' : undefined
          }
        />
        {combinedErrors.supplier_lead_time_days && (
          <div id="product-lead-time-error" className="form-error" role="alert">
            {combinedErrors.supplier_lead_time_days}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="product-safety-stock">
          Safety Stock{' '}
          <span className="assumption-label" aria-label="User-set assumption">
            User-set assumption
          </span>
        </label>
        <input
          id="product-safety-stock"
          type="number"
          className={`form-input${combinedErrors.safety_stock ? ' error' : ''}`}
          value={values.safety_stock}
          onChange={(e) => handleChange('safety_stock', e.target.value)}
          min={0}
          step={1}
          aria-describedby="product-safety-stock-hint product-safety-stock-error"
        />
        <div id="product-safety-stock-hint" className="form-hint">
          Minimum buffer stock to keep on hand (units ≥ 0).
        </div>
        {combinedErrors.safety_stock && (
          <div id="product-safety-stock-error" className="form-error" role="alert">
            {combinedErrors.safety_stock}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="product-coverage-days">
          Target Coverage (days){' '}
          <span className="assumption-label" aria-label="User-set assumption">
            User-set assumption
          </span>
        </label>
        <input
          id="product-coverage-days"
          type="number"
          className={`form-input${combinedErrors.target_coverage_days ? ' error' : ''}`}
          value={values.target_coverage_days}
          onChange={(e) => handleChange('target_coverage_days', e.target.value)}
          min={1}
          step={1}
          aria-describedby="product-coverage-hint product-coverage-days-error"
        />
        <div id="product-coverage-hint" className="form-hint">
          Desired days of forward stock cover (integer ≥ 1).
        </div>
        {combinedErrors.target_coverage_days && (
          <div id="product-coverage-days-error" className="form-error" role="alert">
            {combinedErrors.target_coverage_days}
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
