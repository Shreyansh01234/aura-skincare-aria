import { NextResponse } from 'next/server';
import { MOCK_ORDERS } from '@/data/orders';

export async function POST(request: Request) {
  try {
    const { order_id } = await request.json();

    if (!order_id) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const cleanId = order_id.trim().toUpperCase();
    const order = MOCK_ORDERS[cleanId];

    if (!order) {
      return NextResponse.json({
        success: false,
        message: `I couldn't locate an order with ID ${order_id}. Could you please verify and repeat the ID?`
      });
    }

    return NextResponse.json({
      success: true,
      order
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}