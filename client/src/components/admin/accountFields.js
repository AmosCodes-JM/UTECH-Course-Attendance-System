// Form fields for creating a lecturer or administrator account.
export const ACCOUNT_FIELDS = [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'workId', label: 'Work ID', required: true },
  {
    name: 'password',
    label: 'Initial password',
    type: 'password',
    required: true,
    hint: '8+ characters with a letter and a number',
  },
];
