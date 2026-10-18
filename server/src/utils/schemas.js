import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const atLeastOne = (value) => Object.keys(value).length > 0;
export const NOTHING_TO_CHANGE = 'Send at least one field to change';
