import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- PUT: Update an existing sale record ---
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      productName,
      customerName,
      address,
      cost,
      soldPrice,
      profitHolder,
      createdAt,
    } = body;

    const parsedCost = parseFloat(cost) || 0;
    const parsedSoldPrice = parseFloat(soldPrice) || 0;
    const calculatedProfit = parsedSoldPrice - parsedCost;
    const schemaDate = createdAt ? new Date(createdAt) : new Date();

    const updatedSale = await prisma.sale.update({
      where: { id: id },
      data: {
        productName,
        customerName: customerName || null,
        address: address || null,
        cost: parsedCost,
        soldPrice: parsedSoldPrice,
        profit: calculatedProfit,
        profitHolder,
        createdAt: schemaDate,
      },
    });

    return NextResponse.json({ success: true, sale: updatedSale });
  } catch (error) {
    console.error("Error updating sale:", error);
    return NextResponse.json(
      { error: "Failed to update sale" },
      { status: 500 },
    );
  }
}

// --- DELETE: Remove a sale record ---
export async function DELETE(
  _request: Request, // <-- Added underscore here to satisfy TypeScript unread rules
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    await prisma.sale.delete({
      where: { id: id },
    });

    return NextResponse.json({
      success: true,
      message: "Sale deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sale:", error);
    return NextResponse.json(
      { error: "Failed to delete sale" },
      { status: 500 },
    );
  }
}
