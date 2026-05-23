export const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const fmtD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const ROUTES = {
  HOME: '/',
  ACCOUNTS: '/accounts',
  PLAN: '/plan',
  GOALS: '/goals',
  SPENDING: '/spending',
  BUDGET: '/budget',
  REWARDS: '/rewards',
  SETTINGS: '/settings',
  LOGIN: '/login',
  SIGNUP: '/signup',
} as const;

export type Route = typeof ROUTES[keyof typeof ROUTES];
