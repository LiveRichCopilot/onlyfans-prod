const mockTransactions = [
  { amount: 50.00, createdAt: new Date().toISOString() },
  { amount: "100.50", createdAt: new Date().toISOString() },
  { price: 25.00, createdAt: new Date().toISOString() },
  { amount: 0, createdAt: new Date(Date.now() - 2*60*60*1000).toISOString() } // 2 hours old
];

const now = new Date();
const start1h = new Date(now.getTime() - (1 * 60 * 60 * 1000));

const txs1h = mockTransactions.filter(t => new Date(t.createdAt) >= start1h);
const sum = txs1h.reduce((acc, t) => acc + parseFloat(t.amount || t.gross || t.price || "0"), 0);

console.log("Mock 1H Expected: 175.50");
console.log("Calculated 1H:", sum.toFixed(2));
