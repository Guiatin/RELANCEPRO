import { Plus, Trash2 } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import { formatAmount } from '../../lib/format.js';
import {
  EMPTY_QUOTE_ITEM,
  EXEMPTION_CODE_OPTIONS,
  previewLine,
} from '../../features/quotes/schemas.js';

export default function QuoteLineItemsEditor({ items, products, errors = {}, onChange }) {
  function updateItem(index, field, value) {
    onChange(
      items.map((item, position) => (position === index ? { ...item, [field]: value } : item)),
    );
  }

  function selectProduct(index, productId) {
    const product = products.find((entry) => entry.id === productId);

    onChange(
      items.map((item, position) => {
        if (position !== index) return item;

        if (!product) return { ...item, product_id: '' };

        return {
          ...item,
          product_id: product.id,
          description: product.description || product.name,
          unit: product.unit || '',
          unit_price: String(product.unitPrice ?? ''),
          tax_rate: product.taxRate != null ? String(Number(product.taxRate)) : item.tax_rate,
        };
      }),
    );
  }

  function removeItem(index) {
    onChange(items.filter((_, position) => position !== index));
  }

  function addItem() {
    onChange([...items, { ...EMPTY_QUOTE_ITEM }]);
  }

  const productOptions = [
    { value: '', label: 'Ligne libre' },
    ...products.map((product) => ({ value: product.id, label: product.name })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy">Lignes du devis</h2>
        <Button variant="secondary" onClick={addItem}>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une ligne
        </Button>
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-line bg-app px-4 py-6 text-center text-sm text-muted">
          Aucune ligne. Ajoutez au moins une ligne pour pouvoir envoyer le devis.
        </p>
      )}

      {items.map((item, index) => {
        const itemErrors = errors[index] ?? {};
        const line = previewLine(item);
        const exempt = Number(item.tax_rate) === 0;

        return (
          <div key={index} className="rounded-2xl border border-line bg-app/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-navy">Ligne {index + 1}</p>
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label={`Supprimer la ligne ${index + 1}`}
                className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Select
                  id={`item-${index}-product`}
                  label="Produit / service"
                  options={productOptions}
                  value={item.product_id}
                  onChange={(event) => selectProduct(index, event.target.value)}
                />
              </div>

              <div className="lg:col-span-2">
                <Input
                  id={`item-${index}-description`}
                  label="Description *"
                  value={item.description}
                  onChange={(event) => updateItem(index, 'description', event.target.value)}
                  error={itemErrors.description}
                  autoComplete="off"
                />
              </div>

              <Input
                id={`item-${index}-quantity`}
                label="Quantité *"
                inputMode="decimal"
                value={item.quantity}
                onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                error={itemErrors.quantity}
              />

              <Input
                id={`item-${index}-unit`}
                label="Unité"
                value={item.unit}
                onChange={(event) => updateItem(index, 'unit', event.target.value)}
                error={itemErrors.unit}
              />

              <Input
                id={`item-${index}-unit-price`}
                label="Prix unitaire (FCFA) *"
                inputMode="numeric"
                value={item.unit_price}
                onChange={(event) => updateItem(index, 'unit_price', event.target.value)}
                error={itemErrors.unit_price}
              />

              <Input
                id={`item-${index}-discount`}
                label="Remise (%)"
                inputMode="decimal"
                value={item.discount_rate}
                onChange={(event) => updateItem(index, 'discount_rate', event.target.value)}
                error={itemErrors.discount_rate}
              />

              <Input
                id={`item-${index}-tax`}
                label="TVA (%) *"
                inputMode="decimal"
                value={item.tax_rate}
                onChange={(event) => updateItem(index, 'tax_rate', event.target.value)}
                error={itemErrors.tax_rate}
              />

              <div className="flex items-end">
                <p className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-right text-sm font-semibold tabular-nums text-navy">
                  {formatAmount(line.total)}
                </p>
              </div>

              {exempt && (
                <>
                  <div className="sm:col-span-2">
                    <Select
                      id={`item-${index}-exemption`}
                      label="Motif d'exonération *"
                      options={EXEMPTION_CODE_OPTIONS}
                      value={item.tax_exemption_code}
                      onChange={(event) =>
                        updateItem(index, 'tax_exemption_code', event.target.value)
                      }
                      error={itemErrors.tax_exemption_code}
                    />
                  </div>

                  {item.tax_exemption_code === 'other' && (
                    <div className="sm:col-span-2">
                      <Input
                        id={`item-${index}-exemption-reason`}
                        label="Précision *"
                        value={item.tax_exemption_reason}
                        onChange={(event) =>
                          updateItem(index, 'tax_exemption_reason', event.target.value)
                        }
                        error={itemErrors.tax_exemption_reason}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
