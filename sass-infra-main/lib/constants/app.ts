/**
 * Product-level identity. Override per project via env; these defaults keep the
 * boilerplate runnable out of the box.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'SaaS Infra';

export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'תשתית SaaS רב-טננטית';

/** Shown in the sidebar when a tenant has not uploaded a logo. */
export const APP_NAME_HE = process.env.NEXT_PUBLIC_APP_NAME_HE || APP_NAME;
