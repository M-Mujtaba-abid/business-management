import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

// --- POST: Create a new sale ---
export async function POST(request: NextRequest) {
  try {
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

    if (!productName || !cost || !soldPrice || !createdAt) {
      return NextResponse.json(
        { error: "Product Name, Cost, Sold Price, and Date are required" },
        { status: 400 },
      );
    }

    const cost_num = parseFloat(cost);
    const soldPrice_num = parseFloat(soldPrice);
    const profit = soldPrice_num - cost_num;

    const sale = await prisma.sale.create({
      data: {
        productName,
        customerName: customerName || null,
        address: address || null,
        cost: cost_num,
        soldPrice: soldPrice_num,
        profit,
        profitHolder: profitHolder || null,
        createdAt: new Date(createdAt),
      },
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Error creating sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 },
    );
  }
}

// --- GET: Fetch sales with Month, Year, and Profit Holder filtering ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const profitHolder = searchParams.get("profitHolder"); // <-- Added new parameter

    let whereClause: any = {};

    // 1. Handle Date Filtering (Month / Year)
    if ((month && month !== "all") || (year && year !== "all")) {
      const currentYear = new Date().getFullYear();
      const filterYear = year && year !== "all" ? parseInt(year) : currentYear;

      if (month && month !== "all") {
        const filterMonth = parseInt(month);
        whereClause.createdAt = {
          gte: new Date(filterYear, filterMonth - 1, 1),
          lt: new Date(filterYear, filterMonth, 1),
        };
      } else {
        whereClause.createdAt = {
          gte: new Date(filterYear, 0, 1),
          lt: new Date(filterYear + 1, 0, 1),
        };
      }
    }

    // 2. Handle Profit Holder Filtering
    if (profitHolder && profitHolder !== "all") {
      whereClause.profitHolder = profitHolder;
    }

    // Fetch filtered data from database
    const sales = await prisma.sale.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate aggregated metrics from filtered results
    const totalSales = sales.reduce((sum, sale) => sum + sale.soldPrice, 0);
    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);

    return NextResponse.json({
      sales,
      totalSales,
      totalProfit,
      count: sales.length,
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500 },
    );
  }
}

