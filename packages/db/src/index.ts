import * as auth from './schema/auth';
import * as core from './schema/core';

export * from './schema/auth';
export * from './schema/core';

export const schema = { ...auth, ...core };
