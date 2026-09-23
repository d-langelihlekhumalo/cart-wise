import * as auth from './schema/auth';
import * as core from './schema/core';
import * as lists from './schema/lists';

export * from './schema/auth';
export * from './schema/core';
export * from './schema/lists';

export const schema = { ...auth, ...core, ...lists };
