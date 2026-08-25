

async function test() {
  const url1 = `https://dcmorrpyscafqlkesbkj.supabase.co/rest/v1/rpc/get_expected_cash_inflow`;
  const url2 = `https://dcmorrpyscafqlkesbkj.supabase.co/rest/v1/rpc/get_customer_payment_behaviour`;
  const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjbW9ycnB5c2NhZnFsa2VzYmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjMxMjUsImV4cCI6MjEwMjYzOTEyNX0.bX6xlSNegywILiB5B8LOC6dICcilYgXMWxBLmXF2SRo';
  
  const headers = {
    'apikey': anon,
    'Authorization': `Bearer ${anon}`,
    'Content-Type': 'application/json'
  };
  
  // Try dummy ID first, if we get 400 with a specific message we will know.
  const body = JSON.stringify({ target_business_id: '11111111-1111-1111-1111-111111111111' });

  try {
    const res1 = await fetch(url1, { method: 'POST', headers, body });
    console.log('Cash Inflow:', res1.status, await res1.text());
    
    const res2 = await fetch(url2, { method: 'POST', headers, body });
    console.log('Behaviour:', res2.status, await res2.text());
  } catch (err) {
    console.error(err);
  }
}

test();
