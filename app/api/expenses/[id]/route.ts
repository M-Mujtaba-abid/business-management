import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    await prisma.expense.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 },
    );
  }
}
