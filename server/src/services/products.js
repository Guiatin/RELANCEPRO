import { pool } from '../config/db.js';
import {
  create as insertProduct,
  findAllByCompany,
  findById,
  softDelete,
  update as modifyProduct,
} from '../repositories/products.js';
import { AppError, validationError } from '../utils/errors.js';

const PRODUCT_TYPES = new Set(['product', 'service']);
const BIGINT_UNSIGNED_MAX = 18446744073709551615n;

const PRODUCT_FIELDS = {
  type: 'type',
  name: 'name',
  description: 'description',
  unit: 'unit',
  unit_price: 'unitPrice',
  tax_rate: 'taxRate',
  is_active: 'isActive',
};

const ALLOWED_FIELDS = new Set(Object.keys(PRODUCT_FIELDS));

function productNotFound() {
  return new AppError(404, 'NOT_FOUND', 'Produit introuvable.');
}

function tenant(context) {
  return { companyId: context.user.companyId, userId: context.user.id };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushUnknownFields(data, errors) {
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(key)) {
      errors.push({ field: key, message: 'Champ non autorisé.' });
    }
  }
}

function readType(data, errors, required) {
  if (data.type === undefined) {
    if (required) errors.push({ field: 'type', message: 'Le type est requis.' });
    return undefined;
  }

  if (!PRODUCT_TYPES.has(data.type)) {
    errors.push({ field: 'type', message: "Le type doit être 'product' ou 'service'." });
    return undefined;
  }

  return data.type;
}

function readName(data, errors, required) {
  if (data.name === undefined) {
    if (required) errors.push({ field: 'name', message: 'Le nom est requis.' });
    return undefined;
  }

  if (typeof data.name !== 'string') {
    errors.push({ field: 'name', message: 'Le nom doit être une chaîne de caractères.' });
    return undefined;
  }

  const name = data.name.trim();

  if (!name) {
    errors.push({ field: 'name', message: 'Le nom est requis.' });
    return undefined;
  }

  if (name.length > 120) {
    errors.push({ field: 'name', message: 'Le nom ne doit pas dépasser 120 caractères.' });
    return undefined;
  }

  return name;
}

function readDescription(data, errors) {
  if (data.description === undefined) return undefined;

  if (data.description !== null && typeof data.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'La description doit être une chaîne de caractères ou null.',
    });
    return undefined;
  }

  return data.description;
}

function readUnit(data, errors) {
  if (data.unit === undefined) return undefined;

  if (data.unit === null) return null;

  if (typeof data.unit !== 'string') {
    errors.push({ field: 'unit', message: "L'unité doit être une chaîne de caractères ou null." });
    return undefined;
  }

  const unit = data.unit.trim();

  if (unit.length > 20) {
    errors.push({ field: 'unit', message: "L'unité ne doit pas dépasser 20 caractères." });
    return undefined;
  }

  return unit;
}

function readUnitPrice(data, errors) {
  if (data.unit_price === undefined) return undefined;

  let text = null;

  if (typeof data.unit_price === 'string') {
    text = data.unit_price.trim();
  } else if (typeof data.unit_price === 'number' && Number.isSafeInteger(data.unit_price)) {
    text = String(data.unit_price);
  } else if (typeof data.unit_price === 'bigint') {
    text = data.unit_price.toString();
  }

  if (text === null || !/^\d+$/.test(text)) {
    errors.push({
      field: 'unit_price',
      message: 'Le prix unitaire doit être un entier positif.',
    });
    return undefined;
  }

  const unitPrice = BigInt(text);

  if (unitPrice > BIGINT_UNSIGNED_MAX) {
    errors.push({
      field: 'unit_price',
      message: 'Le prix unitaire dépasse la limite autorisée.',
    });
    return undefined;
  }

  return unitPrice.toString();
}

function readTaxRate(data, errors) {
  if (data.tax_rate === undefined) return undefined;

  let text = null;

  if (typeof data.tax_rate === 'string') {
    text = data.tax_rate.trim();
  } else if (typeof data.tax_rate === 'number' && Number.isFinite(data.tax_rate)) {
    text = String(data.tax_rate);
  }

  if (text === null || !/^\d+(\.\d{1,2})?$/.test(text)) {
    errors.push({
      field: 'tax_rate',
      message: 'Le taux de TVA doit être compris entre 0 et 100 avec au maximum deux décimales.',
    });
    return undefined;
  }

  const taxRate = Number(text);

  if (taxRate > 100) {
    errors.push({
      field: 'tax_rate',
      message: 'Le taux de TVA doit être compris entre 0 et 100 avec au maximum deux décimales.',
    });
    return undefined;
  }

  return text;
}

function readIsActive(data, errors) {
  if (data.is_active === undefined) return undefined;

  if (typeof data.is_active !== 'boolean') {
    errors.push({ field: 'is_active', message: "Le statut d'activation doit être un booléen." });
    return undefined;
  }

  return data.is_active;
}

function validateProduct(data, { required }) {
  if (!isPlainObject(data)) {
    throw validationError([{ field: '', message: 'Données invalides.' }]);
  }

  const errors = [];
  pushUnknownFields(data, errors);

  const result = {};

  const type = readType(data, errors, required);
  if (type !== undefined) result.type = type;

  const name = readName(data, errors, required);
  if (name !== undefined) result.name = name;

  const description = readDescription(data, errors);
  if (description !== undefined) result.description = description;

  const unit = readUnit(data, errors);
  if (unit !== undefined) result.unit = unit;

  const unitPrice = readUnitPrice(data, errors);
  if (unitPrice !== undefined) result.unit_price = unitPrice;

  const taxRate = readTaxRate(data, errors);
  if (taxRate !== undefined) result.tax_rate = taxRate;

  const isActive = readIsActive(data, errors);
  if (isActive !== undefined) result.is_active = isActive;

  if (errors.length > 0) throw validationError(errors);

  return result;
}

function toRepositoryData(data) {
  const result = {};

  for (const [apiKey, repositoryKey] of Object.entries(PRODUCT_FIELDS)) {
    if (data[apiKey] !== undefined) result[repositoryKey] = data[apiKey];
  }

  return result;
}

export async function listProducts(filters, context) {
  return findAllByCompany(pool, tenant(context).companyId, filters);
}

export async function getProduct(productId, context) {
  const product = await findById(pool, tenant(context).companyId, productId);

  if (!product) throw productNotFound();

  return product;
}

export async function createProduct(data, context) {
  const payload = validateProduct(data, { required: true });
  const { companyId } = tenant(context);
  const productId = await insertProduct(pool, companyId, toRepositoryData(payload));

  return findById(pool, companyId, productId);
}

export async function updateProduct(productId, data, context) {
  const payload = validateProduct(data, { required: false });

  const { product, updated } = await modifyProduct(
    pool,
    tenant(context).companyId,
    productId,
    toRepositoryData(payload),
  );

  if (!product) throw productNotFound();

  return { product, updated };
}

export async function deleteProduct(productId, context) {
  const deleted = await softDelete(pool, tenant(context).companyId, productId);

  if (!deleted) throw productNotFound();
}
