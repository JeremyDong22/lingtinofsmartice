// Public Decorator - Mark routes as public (no auth required)
// v1.0 - Initial implementation

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
