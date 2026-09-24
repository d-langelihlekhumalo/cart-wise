import * as auth from './schema/auth';
import * as catalogue from './schema/catalogue';
import * as core from './schema/core';
import * as lists from './schema/lists';

export * from './schema/auth';
export * from './schema/catalogue';
export * from './schema/core';
export * from './schema/lists';

export const schema = { ...auth, ...catalogue, ...core, ...lists };
