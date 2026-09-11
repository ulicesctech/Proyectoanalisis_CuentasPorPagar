import type { CxpValidationIssue } from '@erp/contracts';

export class CxpError extends Error {
  constructor(message: string, public status = 400, public details: CxpValidationIssue[] = []) {
    super(message);
    this.name = 'CxpError';
  }
}
