const fs = require('fs');
const path = require('path');

const files = {
  'src/features/auth/Login.tsx': 'export default function Login() { return <div>Login</div> }',
  'src/features/auth/Signup.tsx': 'export default function Signup() { return <div>Signup</div> }',
  'src/features/onboarding/Onboarding.tsx': 'export default function Onboarding() { return <div>Onboarding</div> }',
  'src/features/invoices/InvoiceList.tsx': 'export default function InvoiceList() { return <div>Invoice List</div> }',
  'src/features/invoices/InvoiceDetail.tsx': 'export default function InvoiceDetail() { return <div>Invoice Detail</div> }',
  'src/features/customers/CustomerList.tsx': 'export default function CustomerList() { return <div>Customer List</div> }',
  'src/features/customers/CustomerDetail.tsx': 'export default function CustomerDetail() { return <div>Customer Detail</div> }',
  'src/features/collections/ActionCenter.tsx': 'export default function ActionCenter() { return <div>Action Center</div> }',
  'src/features/recovery/Recovery.tsx': 'export default function Recovery() { return <div>Recovery</div> }',
  'src/features/settings/Settings.tsx': 'export default function Settings() { return <div>Settings</div> }',
};

for (const [filepath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filepath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}
console.log('Placeholders generated.');
