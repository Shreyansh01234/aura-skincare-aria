export interface Order {
  order_id: string;
  customer_name: string;
  product: string;
  value: number;
  status: 'Processing' | 'Shipped' | 'Out for Delivery' | 'Delivered';
  notes: string;
}

export const MOCK_ORDERS: Record<string, Order> = {
  "ORD-101": {
    order_id: "ORD-101",
    customer_name: "Priya Sharma",
    product: "Vitamin C Serum (30ml)",
    value: 699,
    status: "Out for Delivery",
    notes: "BlueDart — BD-982103. Expected by 6 PM today"
  },
  "ORD-102": {
    order_id: "ORD-102",
    customer_name: "Rahul Verma",
    product: "Hydrating Sunscreen SPF 50",
    value: 499,
    status: "Delivered",
    notes: "Delhivery — DL-441029. Delivered 14 days ago"
  },
  "ORD-103": {
    order_id: "ORD-103",
    customer_name: "Ananya Patel",
    product: "Green Tea Face Wash + Toner",
    value: 850,
    status: "Processing",
    notes: "Ordered 3 hours ago. Eligible for cancellation"
  }
};