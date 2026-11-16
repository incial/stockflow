import { todayISO } from './calculations';

/**
 * Frontend validation utilities for stock management application
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate positive integer (quantity)
 * @param value - Input value
 * @param fieldName - Field name for error message
 * @param max - Maximum allowed value
 */
export const validatePositiveInteger = (
  value: string,
  fieldName: string = 'Value',
  max: number = 99999
): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: true }; // Empty is valid (optional field)
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (num < 0) {
    return { isValid: false, error: `${fieldName} cannot be negative` };
  }

  if (!Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be a whole number` };
  }

  if (num > max) {
    return { isValid: false, error: `${fieldName} cannot exceed ${max}` };
  }

  if (num === 0) {
    return { isValid: false, error: `${fieldName} must be greater than 0` };
  }

  return { isValid: true };
};

/**
 * Validate positive decimal number (price/amount)
 * @param value - Input value
 * @param fieldName - Field name for error message
 * @param max - Maximum allowed value
 * @param decimals - Maximum decimal places
 */
export const validatePositiveDecimal = (
  value: string,
  fieldName: string = 'Value',
  max: number = 9999999.99,
  decimals: number = 2
): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: true }; // Empty is valid (optional field)
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a number` };
  }

  if (num < 0) {
    return { isValid: false, error: `${fieldName} cannot be negative` };
  }

  if (num === 0) {
    return { isValid: false, error: `${fieldName} must be greater than 0` };
  }

  if (num > max) {
    return { isValid: false, error: `${fieldName} cannot exceed ₹${max.toLocaleString('en-IN')}` };
  }

  // Check decimal places
  const decimalPart = value.split('.')[1];
  if (decimalPart && decimalPart.length > decimals) {
    return { isValid: false, error: `${fieldName} can have maximum ${decimals} decimal places` };
  }

  return { isValid: true };
};

/**
 * Validate text input
 * @param value - Input value
 * @param fieldName - Field name for error message
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @param required - Whether field is required
 */
export const validateText = (
  value: string,
  fieldName: string = 'Field',
  minLength: number = 1,
  maxLength: number = 100,
  required: boolean = true
): ValidationResult => {
  const trimmedValue = value.trim();

  if (required && !trimmedValue) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (!required && !trimmedValue) {
    return { isValid: true };
  }

  if (trimmedValue.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  if (trimmedValue.length > maxLength) {
    return { isValid: false, error: `${fieldName} cannot exceed ${maxLength} characters` };
  }

  return { isValid: true };
};

/**
 * Validate date input
 * @param value - Date string (YYYY-MM-DD)
 * @param fieldName - Field name for error message
 * @param allowFuture - Whether future dates are allowed
 */
export const validateDate = (
  value: string,
  fieldName: string = 'Date',
  allowFuture: boolean = false
): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
    return { isValid: false, error: `${fieldName} is invalid` };
  }

  // Compare calendar dates as strings (YYYY-MM-DD sorts lexicographically) in IST.
  if (!allowFuture && value > todayISO()) {
    return { isValid: false, error: `${fieldName} cannot be in the future` };
  }

  return { isValid: true };
};

/**
 * Sanitize number input - remove invalid characters
 * @param value - Input value
 * @param allowDecimals - Whether to allow decimal point
 */
export const sanitizeNumberInput = (value: string, allowDecimals: boolean = false): string => {
  if (!value) return '';
  
  // Remove any non-numeric characters except decimal point if allowed
  let sanitized = value.replace(/[^\d.]/g, '');
  
  if (!allowDecimals) {
    sanitized = sanitized.replace(/\./g, '');
  } else {
    // Allow only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
  }
  
  return sanitized;
};

/**
 * Validate quantity against available stock
 * @param requestedQty - Requested quantity
 * @param availableQty - Available quantity
 * @param productName - Product name for error message
 */
export const validateStockAvailability = (
  requestedQty: number,
  availableQty: number,
  productName: string = 'Product'
): ValidationResult => {
  if (requestedQty <= 0) {
    return { isValid: false, error: 'Quantity must be greater than 0' };
  }

  if (requestedQty > availableQty) {
    return {
      isValid: false,
      error: `Cannot remove ${requestedQty} of ${productName}. Only ${availableQty} available.`
    };
  }

  return { isValid: true };
};
